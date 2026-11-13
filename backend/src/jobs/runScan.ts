import type { EngineResult, Env, Finding } from '../types';
import { db } from '../services/db';
import { analyzeWebsite } from '../engines/website';
import { analyzeGithub } from '../engines/github';

const W: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
// A score exists only for dimensions whose checks actually ran; otherwise null (shown as "not measured").
function scores(all: Finding[], checks: Set<string>) {
  const dim = (cats: string[], needs: string[]) => needs.some((n) => checks.has(n)) ? Math.max(0, 100 - all.filter((f) => cats.includes(f.category)).reduce((s, f) => s + W[f.severity], 0)) : null;
  return { performance: dim(['performance'], ['performance']), security: dim(['security'], ['security_headers']), seo: dim(['seo'], ['seo']),
    accessibility: dim(['accessibility'], ['accessibility']), code_quality: dim(['code_quality', 'testing'], ['source_review']), maintainability: dim(['architecture', 'dependencies', 'missing_feature'], ['source_review']) };
}

export async function runScan(env: Env, scanId: string, project: any) {
  const patch = (b: object) => db(env, `scans?id=eq.${scanId}&user_id=eq.${project.user_id}&status=neq.cancelled`, { method: 'PATCH', body: JSON.stringify(b) });
  const n = (project.website_url ? 1 : 0) + (project.github_repository_url ? 1 : 0); let i = 0;
  const share = (idx: number) => (s: string, p: number) => patch({ current_stage: s, progress: Math.round(((idx + p / 100) / n) * 90) }).then(() => undefined);
  try {
    await patch({ status: 'running', started_at: new Date().toISOString(), progress: 2, current_stage: 'Validating inputs' });
    const results: { label: string; r: EngineResult }[] = [];
    if (project.website_url) results.push({ label: 'Website', r: await analyzeWebsite(env, project.website_url, share(i++)) });
    if (project.github_repository_url) results.push({ label: 'GitHub', r: await analyzeGithub(env, project.github_repository_url, share(i++)) });
    await patch({ current_stage: 'Generating technical findings', progress: 94 });
    const all = results.flatMap((x) => x.r.findings); const checks = new Set(results.flatMap((x) => x.r.checks));
    const errors = results.filter((x) => x.r.error).map((x) => `${x.label}: ${x.r.error}`);
    if (all.length) await db(env, 'findings', { method: 'POST', body: JSON.stringify(all.map((f) => ({ ...f, scan_id: scanId, user_id: project.user_id }))) });
    const failedAll = results.every((x) => x.r.error);
    const [report] = await db<any[]>(env, 'reports', { method: 'POST', body: JSON.stringify({ scan_id: scanId, project_id: project.id, user_id: project.user_id,
      summary: `${all.length} finding(s) from ${results.map((x) => x.label).join(' + ')} analysis; ${all.filter((f) => ['critical', 'high'].includes(f.severity)).length} high priority or above.`,
      scores: scores(all, checks), report_data: { facts: Object.fromEntries(results.map((x) => [x.label.toLowerCase(), x.r.facts])), errors, checks: [...checks], ai: 'not_configured' } }) });
    const recs = all.filter((f) => f.severity !== 'info').map((f) => ({ report_id: report.id, user_id: project.user_id, title: f.title, description: f.suggested_fix, priority: f.severity, complexity: 'medium' }));
    if (recs.length) await db(env, 'recommendations', { method: 'POST', body: JSON.stringify(recs) });
    await patch({ status: failedAll ? 'failed' : errors.length ? 'partial' : 'completed', progress: 100, current_stage: 'Report ready', completed_at: new Date().toISOString(), error_message: errors.join(' | ') || null });
    await db(env, 'notifications', { method: 'POST', body: JSON.stringify({ user_id: project.user_id, title: failedAll ? 'Analysis failed' : 'Analysis completed', description: project.name, type: failedAll ? 'scan_failed' : 'scan_completed' }) });
  } catch (e: any) {
    await patch({ status: 'failed', error_message: String(e.message).slice(0, 500), completed_at: new Date().toISOString() }).catch(() => {});
  }
}
