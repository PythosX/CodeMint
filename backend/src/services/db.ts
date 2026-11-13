import type { Env } from '../types';
// Thin PostgREST client using the service role. EVERY query must filter by user_id.
export async function db<T = any>(env: Env, path: string, init: RequestInit & { single?: boolean } = {}): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(init.single ? { Accept: 'application/vnd.pgrst.object+json' } : {}), ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`DB ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}
