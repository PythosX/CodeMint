import { z } from 'zod';
import type { Env } from './types';
import { authenticate, rateLimit } from './middleware/auth';
import { db } from './services/db';
import { assertPublicUrl } from './utils/ssrf';
import { parseRepoUrl } from './engines/github';
import { runScan } from './jobs/runScan';

const json = (data: unknown, status = 200, h: HeadersInit = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...h } });
const err = (status: number, code: string, message: string, h: HeadersInit = {}) => json({ error: { code, message } }, status, h);

const ProjectBody = z.object({
  name: z.string().trim().min(1).max(120),
  website_url: z.string().trim().max(2000).optional().or(z.literal('')),
  github_repository_url: z.string().trim().max(500).optional().or(z.literal('')),
  authorized: z.literal(true, { errorMap: () => ({ message: 'Confirm you are authorized to scan these assets.' }) }),
});

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = { 'Access-Control-Allow-Origin': env.FRONTEND_URL || 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url); const path = url.pathname;
    if (path === '/api/health') return json({ ok: true }, 200, cors);
    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) return err(503, 'not_configured', 'Backend is missing Supabase secrets. See README > Configuration.', cors);
      const user = await authenticate(req, env);
      if (!user) return err(401, 'unauthorized', 'Your session is missing or expired. Sign in again.', cors);
      if (!rateLimit(user.id)) return err(429, 'rate_limited', 'Too many requests. Wait a minute and retry.', cors);
      const body = ['POST', 'PATCH'].includes(req.method) ? await req.text().then((t) => (t.length > 20_000 ? null : t ? JSON.parse(t) : {})) : null;
      if (body === null && ['POST', 'PATCH'].includes(req.method)) return err(413, 'too_large', 'Request body too large.', cors);
      const uid = user.id; let m: RegExpMatchArray | null;

      if (path === '/api/projects' && req.method === 'GET') return json(await db(env, `projects?user_id=eq.${uid}&order=created_at.desc&select=*,scans(id,status,created_at,findings(count))&scans.order=created_at.desc&scans.limit=1`), 200, cors);

      if (path === '/api/projects' && req.method === 'POST') {
        const p = ProjectBody.safeParse(body); if (!p.success) return err(400, 'invalid', p.error.issues[0].message, cors);
        const { name, website_url, github_repository_url } = p.data;
        if (!website_url && !github_repository_url) return err(400, 'invalid', 'Add a website URL, a GitHub repository, or both.', cors);
        if (website_url) { try { const u = await assertPublicUrl(website_url); await fetch(u, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) }); } catch (e: any) { return err(400, 'invalid_website', e.message.includes('fetch') || e.name === 'TimeoutError' ? 'The website did not respond. Check the URL and that the site is online.' : e.message, cors); } }
        if (github_repository_url) { try { parseRepoUrl(github_repository_url); } catch (e: any) { return err(400, 'invalid_repo', e.message, cors); } }
        const analysis_type = website_url && github_repository_url ? 'full' : website_url ? 'website' : 'github';
        const [proj] = await db<any[]>(env, 'projects', { method: 'POST', body: JSON.stringify({ user_id: uid, name, website_url: website_url || null, github_repository_url: github_repository_url || null, analysis_type }) });
        return json(proj, 201, cors);
      }

      if ((m = path.match(/^\/api\/projects\/([0-9a-f-]{36})$/))) {
        if (req.method === 'PATCH') { const p = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(body); if (!p.success) return err(400, 'invalid', 'Name is required.', cors);
          return json((await db<any[]>(env, `projects?id=eq.${m[1]}&user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ name: p.data.name, updated_at: new Date().toISOString() }) }))[0] ?? null, 200, cors); }
        if (req.method === 'DELETE') { await db(env, `projects?id=eq.${m[1]}&user_id=eq.${uid}`, { method: 'DELETE' }); return json({ ok: true }, 200, cors); }
      }

      if (path === '/api/scans' && req.method === 'POST') {
        const p = z.object({ project_id: z.string().uuid() }).safeParse(body); if (!p.success) return err(400, 'invalid', 'project_id is required.', cors);
        const [project] = await db<any[]>(env, `projects?id=eq.${p.data.project_id}&user_id=eq.${uid}`);
        if (!project) return err(404, 'not_found', 'Project not found.', cors);
        const active = await db<any[]>(env, `scans?project_id=eq.${project.id}&user_id=eq.${uid}&status=in.(queued,running)&created_at=gt.${new Date(Date.now() - 10 * 60_000).toISOString()}`);
        if (active.length) return json(active[0], 200, cors); // idempotent: reuse the in-flight scan
        const [scan] = await db<any[]>(env, 'scans', { method: 'POST', body: JSON.stringify({ project_id: project.id, user_id: uid }) });
        ctx.waitUntil(runScan(env, scan.id, project));
        return json(scan, 202, cors);
      }

      if ((m = path.match(/^\/api\/scans\/([0-9a-f-]{36})(\/cancel|\/results)?$/))) {
        const [scan] = await db<any[]>(env, `scans?id=eq.${m[1]}&user_id=eq.${uid}`);
        if (!scan) return err(404, 'not_found', 'Scan not found.', cors);
        if (m[2] === '/cancel' && req.method === 'POST') return json((await db<any[]>(env, `scans?id=eq.${scan.id}&user_id=eq.${uid}&status=in.(queued,running)`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', completed_at: new Date().toISOString() }) }))[0] ?? scan, 200, cors);
        if (m[2] === '/results') {
          const [findings, reports, project] = await Promise.all([db(env, `findings?scan_id=eq.${scan.id}&user_id=eq.${uid}&order=created_at`), db<any[]>(env, `reports?scan_id=eq.${scan.id}&user_id=eq.${uid}`), db<any[]>(env, `projects?id=eq.${scan.project_id}&user_id=eq.${uid}`)]);
          const recs = reports[0] ? await db(env, `recommendations?report_id=eq.${reports[0].id}&user_id=eq.${uid}`) : [];
          return json({ scan, project: project[0], report: reports[0] ?? null, findings, recommendations: recs }, 200, cors);
        }
        return json(scan, 200, cors);
      }

      if ((m = path.match(/^\/api\/(findings|recommendations)\/([0-9a-f-]{36})$/)) && req.method === 'PATCH') {
        const statuses = m[1] === 'findings' ? ['open', 'in_progress', 'saved', 'resolved'] : ['open', 'in_progress', 'saved', 'completed'];
        const p = z.object({ status: z.enum(statuses as [string, ...string[]]) }).safeParse(body); if (!p.success) return err(400, 'invalid', 'Invalid status.', cors);
        return json((await db<any[]>(env, `${m[1]}?id=eq.${m[2]}&user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify(p.data) }))[0] ?? null, 200, cors);
      }

      if (path === '/api/notifications' && req.method === 'GET') return json(await db(env, `notifications?user_id=eq.${uid}&order=created_at.desc&limit=20`), 200, cors);
      if (path === '/api/stats' && req.method === 'GET') {
        const [projects, reports, open, resolved] = await Promise.all([db<any[]>(env, `projects?user_id=eq.${uid}&select=id`), db<any[]>(env, `reports?user_id=eq.${uid}&select=id`), db<any[]>(env, `findings?user_id=eq.${uid}&status=neq.resolved&select=id`), db<any[]>(env, `findings?user_id=eq.${uid}&status=eq.resolved&select=id`)]);
        return json({ projects: projects.length, reports: reports.length, open_findings: open.length, resolved_findings: resolved.length }, 200, cors);
      }
      return err(404, 'not_found', 'Unknown endpoint.', cors);
    } catch (e: any) {
      console.error(e); return err(500, 'internal', 'Something went wrong on our side. Retry in a moment.', cors);
    }
  },
};
