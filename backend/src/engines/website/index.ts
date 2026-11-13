import type { EngineResult, Env, Finding, Progress } from '../../types';
import { safeFetch } from '../../utils/ssrf';

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];

export async function analyzeWebsite(env: Env, rawUrl: string, progress: Progress): Promise<EngineResult> {
  const findings: Finding[] = []; const facts: Record<string, unknown> = {}; const checks: string[] = [];
  const add = (f: Finding) => findings.push(f);
  await progress('Checking website reachability', 10);
  let page;
  try { page = await safeFetch(rawUrl); }
  catch (e: any) { return { findings, facts, checks, error: `Website unreachable or blocked: ${e.message}` }; }
  const base = new URL(page.url); const html = page.body;
  facts.final_url = page.url; facts.status = page.status; facts.redirects = page.redirects;
  if (page.status >= 400) add({ category: 'website', title: `Homepage returned HTTP ${page.status}`, description: 'The main page did not return a successful response.', severity: 'high', confidence: 'high', evidence: `GET ${page.url} -> ${page.status}`, affected_resource: page.url, suggested_fix: 'Check hosting, routing and server logs for this URL.' });

  await progress('Inspecting website structure', 30);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (n: string) => { const t = metas.find((m) => new RegExp(`(name|property)=["']${n}["']`, 'i').test(m)); return t ? attr(t, 'content') : undefined; };
  const desc = meta('description'); const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const h1s = (html.match(/<h1\b/gi) || []).length;
  const tech: string[] = [];
  if (/__NEXT_DATA__|\/_next\//.test(html)) tech.push('Next.js');
  if (/wp-content/.test(html)) tech.push('WordPress');
  if (/cdn\.shopify/.test(html)) tech.push('Shopify');
  Object.assign(facts, { title, description: desc, images: imgs.length, forms: forms.length, links: links.length, external_scripts: scripts.length, h1_count: h1s, detected_technologies: tech, https: base.protocol === 'https:' });
  checks.push('structure');

  if (!title) add({ category: 'seo', title: 'Missing <title> tag', description: 'Search engines and browser tabs rely on the title.', severity: 'high', confidence: 'high', evidence: 'No <title> found in homepage HTML.', affected_resource: page.url, suggested_fix: 'Add a unique, descriptive <title> (50-60 chars).' });
  if (!desc) add({ category: 'seo', title: 'Missing meta description', description: 'Without it search engines generate their own snippet.', severity: 'medium', confidence: 'high', evidence: 'No meta name="description" in homepage HTML.', affected_resource: page.url, suggested_fix: 'Add a 120-160 character meta description.' });
  if (h1s !== 1) add({ category: 'seo', title: h1s === 0 ? 'No <h1> heading' : 'Multiple <h1> headings', description: 'A single h1 clarifies page topic for search engines and assistive tech.', severity: 'low', confidence: 'medium', evidence: `Found ${h1s} <h1> in server-rendered HTML. Client-rendered apps may add headings after load, which this check cannot see.`, affected_resource: page.url, suggested_fix: 'Use one h1 per page.' });
  if (!/<link[^>]*rel=["']canonical["']/i.test(html)) add({ category: 'seo', title: 'No canonical URL', description: 'Canonical links prevent duplicate-content ambiguity.', severity: 'low', confidence: 'medium', evidence: 'No link rel="canonical" in HTML.', affected_resource: page.url, suggested_fix: 'Add <link rel="canonical" href="...">.' });
  if (!meta('og:title')) add({ category: 'seo', title: 'Missing Open Graph metadata', description: 'Shared links will have no rich preview.', severity: 'info', confidence: 'high', evidence: 'No og:title meta tag.', affected_resource: page.url, suggested_fix: 'Add og:title, og:description and og:image.' });
  if (!/name=["']viewport["']/i.test(html)) add({ category: 'seo', title: 'Missing viewport meta tag', description: 'Mobile rendering will be poor.', severity: 'medium', confidence: 'high', evidence: 'No meta viewport.', affected_resource: page.url, suggested_fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });

  const noAlt = imgs.filter((i) => attr(i, 'alt') === undefined);
  if (noAlt.length) add({ category: 'accessibility', title: `${noAlt.length} image(s) missing alt text`, description: 'Screen reader users get no description of these images.', severity: noAlt.length > 5 ? 'medium' : 'low', confidence: 'high', evidence: noAlt.slice(0, 3).map((i) => attr(i, 'src') || '(inline)').join(', '), affected_resource: page.url, suggested_fix: 'Add meaningful alt text, or alt="" for decorative images.' });
  if (!/<html[^>]*\blang=/i.test(html)) add({ category: 'accessibility', title: 'Missing lang attribute on <html>', description: 'Assistive tech cannot pick the right pronunciation.', severity: 'low', confidence: 'high', evidence: '<html> has no lang attribute.', affected_resource: page.url, suggested_fix: 'Add lang="en" (or your language).' });
  const unlabeled = forms.flatMap((f) => [...f.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0])).filter((i) => !/type=["'](hidden|submit|button)["']/i.test(i) && !attr(i, 'aria-label') && !attr(i, 'id'));
  if (unlabeled.length) add({ category: 'accessibility', title: `${unlabeled.length} form input(s) may lack labels`, description: 'Inputs need an associated label.', severity: 'medium', confidence: 'low', evidence: 'Inputs without id or aria-label found; a wrapping <label> would also satisfy this and is not checked.', affected_resource: page.url, suggested_fix: 'Associate each input with a <label for> or aria-label.' });
  checks.push('seo', 'accessibility');

  await progress('Inspecting security configuration', 50);
  const h = page.headers;
  if (base.protocol !== 'https:') add({ category: 'security', title: 'Site served over HTTP', description: 'Traffic can be read or modified in transit.', severity: 'high', confidence: 'high', evidence: `Final URL ${page.url}`, affected_resource: page.url, suggested_fix: 'Enable HTTPS and redirect all HTTP traffic.' });
  const hdr: [string, string, Finding['severity'], string][] = [
    ['content-security-policy', 'Content-Security-Policy', 'medium', 'Limits where scripts and resources can load from, reducing XSS impact.'],
    ['strict-transport-security', 'Strict-Transport-Security (HSTS)', 'medium', 'Forces browsers to use HTTPS.'],
    ['x-content-type-options', 'X-Content-Type-Options', 'low', 'Prevents MIME sniffing.'],
    ['referrer-policy', 'Referrer-Policy', 'low', 'Controls how much URL info is leaked to other sites.'],
    ['permissions-policy', 'Permissions-Policy', 'info', 'Restricts powerful browser features.'],
  ];
  for (const [k, label, sev, why] of hdr) if (!h.get(k) && !(k === 'strict-transport-security' && base.protocol !== 'https:'))
    add({ category: 'security', title: `Missing ${label} header`, description: `${why} This is a hardening gap, not a confirmed vulnerability.`, severity: sev, confidence: 'high', evidence: `Response headers for ${page.url} did not include ${k}.`, affected_resource: page.url, suggested_fix: `Set the ${label} response header at your host or CDN.` });
  if (!h.get('x-frame-options') && !/frame-ancestors/i.test(h.get('content-security-policy') || '')) add({ category: 'security', title: 'No clickjacking protection header', description: 'Page may be embeddable in other sites.', severity: 'low', confidence: 'high', evidence: 'No X-Frame-Options or CSP frame-ancestors.', affected_resource: page.url, suggested_fix: "Add frame-ancestors 'self' to CSP." });
  const cookie = h.get('set-cookie');
  if (cookie && (!/secure/i.test(cookie) || !/httponly/i.test(cookie))) add({ category: 'security', title: 'Cookie missing Secure/HttpOnly', description: 'Cookies may be exposed to scripts or insecure transport.', severity: 'medium', confidence: 'medium', evidence: 'Set-Cookie attributes observed on homepage response (values omitted).', affected_resource: page.url, suggested_fix: 'Add Secure, HttpOnly and SameSite attributes to session cookies.' });
  facts.server = h.get('server') || null; checks.push('security_headers');

  await progress('Checking SEO and accessibility', 65);
  for (const [path, label] of [['/robots.txt', 'robots.txt'], ['/sitemap.xml', 'sitemap.xml']] as const) {
    try { const r = await safeFetch(new URL(path, base).toString(), { maxBytes: 50_000 }); facts[label] = r.status === 200;
      if (r.status !== 200) add({ category: 'seo', title: `No ${label} found`, description: 'Helps crawlers discover and index pages.', severity: 'low', confidence: 'medium', evidence: `GET ${path} -> ${r.status}`, affected_resource: new URL(path, base).toString(), suggested_fix: `Publish a ${label}.` });
    } catch { facts[label] = null; }
  }

  await progress('Collecting performance metrics', 80);
  if (!env.PAGESPEED_API_KEY) facts.pagespeed = 'not_configured';
  else try {
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(page.url)}&strategy=mobile&category=performance&key=${env.PAGESPEED_API_KEY}`, { signal: AbortSignal.timeout(25_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j: any = await r.json(); const a = j.lighthouseResult.audits;
    const score = Math.round(j.lighthouseResult.categories.performance.score * 100);
    facts.pagespeed = { score, lcp: a['largest-contentful-paint'].displayValue, cls: a['cumulative-layout-shift'].displayValue, fcp: a['first-contentful-paint'].displayValue, tbt: a['total-blocking-time'].displayValue, speed_index: a['speed-index'].displayValue };
    checks.push('performance');
    if (score < 90) add({ category: 'performance', title: `Mobile performance score ${score}/100`, description: 'Measured by Google PageSpeed Insights (Lighthouse, mobile).', severity: score < 50 ? 'high' : 'medium', confidence: 'high', evidence: `LCP ${a['largest-contentful-paint'].displayValue}, CLS ${a['cumulative-layout-shift'].displayValue}, TBT ${a['total-blocking-time'].displayValue}`, affected_resource: page.url, suggested_fix: 'Review the Lighthouse opportunities: image sizing, unused JS, render-blocking resources.' });
  } catch (e: any) { facts.pagespeed = { error: `PageSpeed request failed: ${e.message}` }; }
  return { findings, facts, checks };
}
