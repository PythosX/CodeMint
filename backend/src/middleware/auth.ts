import type { Env } from '../types';
// Verifies the Supabase JWT by asking Supabase Auth who the token belongs to.
export async function authenticate(req: Request, env: Env): Promise<{ id: string; email?: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u: any = await res.json();
  return u?.id ? { id: u.id, email: u.email } : null;
}
const hits = new Map<string, { n: number; t: number }>();
// Per-isolate limiter: a basic guard only. Use Cloudflare Rate Limiting rules for real enforcement.
export function rateLimit(key: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return true; }
  return ++h.n <= max;
}
