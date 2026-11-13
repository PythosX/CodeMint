import { supabase } from './supabase';
const BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(BASE + path, { method: init.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: init.body ? JSON.stringify(init.body) : undefined });
  } catch { throw new Error('Cannot reach the CodeMint API. Check your connection and that VITE_API_URL points to your running Worker.'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401) await supabase.auth.signOut(); throw new Error(json?.error?.message || `Request failed (${res.status})`); }
  return json as T;
}
