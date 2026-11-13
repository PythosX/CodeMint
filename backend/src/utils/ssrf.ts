// SSRF protection: public http/https only, ports 80/443, every redirect re-validated, DNS resolved via DoH and checked.
const BLOCKED_HOSTS = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n))) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0);
}

async function resolve(host: string): Promise<string[]> {
  const out: string[] = [];
  for (const type of ['A', 'AAAA']) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    if (r.ok) { const j: any = await r.json(); for (const a of j.Answer || []) if (a.type === 1 || a.type === 28) out.push(a.data); }
  }
  return out;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Enter a full URL such as https://yourwebsite.com'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https URLs are allowed.');
  if (u.username || u.password) throw new Error('URLs with credentials are not allowed.');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Only ports 80 and 443 are allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.test(host)) throw new Error('Local and internal hosts cannot be scanned.');
  const isIp = /^[\d.]+$/.test(host) || host.includes(':');
  const ips = isIp ? [host] : await resolve(host);
  if (!ips.length) throw new Error('This domain does not resolve. Check the spelling.');
  if (ips.some(isPrivateIp)) throw new Error('This address points to a private or internal network.');
  return u;
}

export interface SafeResponse { url: string; status: number; headers: Headers; body: string; redirects: string[] }
/** Fetch with manual redirect validation, timeout and body size cap. */
export async function safeFetch(raw: string, opts: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {}): Promise<SafeResponse> {
  const { maxBytes = 1_000_000, timeoutMs = 10_000, maxRedirects = 5 } = opts;
  let url = (await assertPublicUrl(raw)).toString(); const redirects: string[] = [];
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'CodeMintBot/1.0 (+non-invasive analysis)' } });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location'); if (!loc) throw new Error('Redirect without destination.');
      url = (await assertPublicUrl(new URL(loc, url).toString())).toString(); redirects.push(url); continue;
    }
    const reader = res.body?.getReader(); const parts: string[] = []; let size = 0; const dec = new TextDecoder();
    while (reader) { const { done, value } = await reader.read(); if (done) break; size += value.length; parts.push(dec.decode(value, { stream: true })); if (size > maxBytes) { await reader.cancel(); break; } }
    return { url, status: res.status, headers: res.headers, body: parts.join(''), redirects };
  }
  throw new Error('Too many redirects.');
}
