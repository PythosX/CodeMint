import type { EngineResult, Env, Finding, Progress } from '../../types';

export function parseRepoUrl(raw: string): { owner: string; repo: string } {
  const m = raw.trim().match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error('Use a URL like https://github.com/owner/repository');
  return { owner: m[1], repo: m[2] };
}

const SRC = /\.(ts|tsx|js|jsx|py|go|rb|php|java|rs|vue|svelte)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|\.next|vendor|\.git)\//;

// Reads files through GitHub's API/raw CDN only. Repository code is never executed or installed.
export async function analyzeGithub(env: Env, rawUrl: string, progress: Progress): Promise<EngineResult> {
  const findings: Finding[] = []; const facts: Record<string, unknown> = {}; const checks: string[] = [];
  const add = (f: Finding) => findings.push(f);
  const gh = async (path: string) => {
    const r = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CodeMint', ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) } });
    if (r.status === 404) throw new Error('Repository not found, or it is private. Private repositories need GitHub OAuth, which is a future integration.');
    if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') throw new Error('GitHub API rate limit reached. Configure GITHUB_TOKEN or retry later.');
    if (!r.ok) throw new Error(`GitHub API error ${r.status}`);
    return r.json() as Promise<any>;
  };
  try {
    await progress('Validating repository', 8);
    const { owner, repo } = parseRepoUrl(rawUrl);
    await progress('Fetching repository metadata', 20);
    const meta = await gh(`/repos/${owner}/${repo}`);
    if (meta.private) throw new Error('Private repositories are not supported in V1.');
    const langs = await gh(`/repos/${owner}/${repo}/languages`);
    Object.assign(facts, { name: meta.full_name, description: meta.description, default_branch: meta.default_branch, license: meta.license?.spdx_id || null, pushed_at: meta.pushed_at, languages: langs, archived: meta.archived });

    await progress('Inspecting project structure', 35);
    const tree = await gh(`/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`);
    const paths: { path: string; size?: number }[] = (tree.tree || []).filter((t: any) => t.type === 'blob');
    facts.file_count = paths.length; facts.tree_truncated = !!tree.truncated;
    facts.top_level = [...new Set(paths.map((p) => p.path.split('/')[0]))].slice(0, 40);
    const has = (re: RegExp) => paths.some((p) => re.test(p.path));
    checks.push('structure');

    const raw = async (p: string, max = 200_000) => {
      const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${meta.default_branch}/${p}`);
      return r.ok ? (await r.text()).slice(0, max) : null;
    };

    await progress('Detecting languages and frameworks', 48);
    let pkg: any = null;
    if (paths.some((p) => p.path === 'package.json')) { try { pkg = JSON.parse((await raw('package.json')) || ''); } catch { /* invalid JSON */ } }
    if (pkg) {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const fw: string[] = [];
      for (const [k, n] of [['react', 'React'], ['next', 'Next.js'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['express', 'Express'], ['vite', 'Vite'], ['tailwindcss', 'Tailwind'], ['@supabase/supabase-js', 'Supabase'], ['prisma', 'Prisma']]) if (deps[k]) fw.push(n);
      facts.frameworks = fw; facts.dependency_count = Object.keys(pkg.dependencies || {}).length; facts.dev_dependency_count = Object.keys(pkg.devDependencies || {}).length;
      if (!has(/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/)) add({ category: 'dependencies', title: 'No lock file committed', description: 'Builds may resolve different dependency versions over time.', severity: 'medium', confidence: 'high', evidence: 'No package-lock.json, yarn.lock or pnpm-lock.yaml in repository tree.', affected_resource: 'package.json', suggested_fix: 'Commit your lock file.' });
      if (!pkg.scripts?.build) add({ category: 'code_quality', title: 'No build script', description: 'No "build" script in package.json.', severity: 'low', confidence: 'high', evidence: `scripts: ${Object.keys(pkg.scripts || {}).join(', ') || '(none)'}`, affected_resource: 'package.json', suggested_fix: 'Add a build script.' });
      if (!pkg.scripts?.lint) add({ category: 'code_quality', title: 'No lint script', description: 'No automated linting entry point.', severity: 'info', confidence: 'high', evidence: 'package.json has no "lint" script.', affected_resource: 'package.json', suggested_fix: 'Add ESLint and a lint script.' });
      add({ category: 'dependencies', title: 'Vulnerability advisories not checked', description: 'V1 lists dependencies but does not yet query the GitHub Advisory Database, so no dependency is claimed safe or vulnerable.', severity: 'info', confidence: 'high', evidence: `${facts.dependency_count} runtime dependencies listed.`, affected_resource: 'package.json', suggested_fix: 'Run `npm audit` or enable Dependabot.' });
      checks.push('dependencies');
    }

    await progress('Reviewing source code', 62);
    const srcFiles = paths.filter((p) => SRC.test(p.path) && !SKIP.test(p.path) && (p.size || 0) > 0 && (p.size || 0) < 100_000).sort((a, b) => (b.size || 0) - (a.size || 0));
    const sample = srcFiles.slice(0, 25); const todos: string[] = []; let emptyCatch = 0;
    const big = srcFiles.filter((p) => (p.size || 0) > 30_000).slice(0, 5);
    for (const f of sample) {
      const text = await raw(f.path, 100_000); if (!text) continue;
      text.split('\n').forEach((line, i) => { if (/\b(TODO|FIXME)\b/.test(line)) todos.push(`${f.path}:${i + 1}`); });
      emptyCatch += (text.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || []).length;
    }
    facts.files_inspected = sample.length; checks.push('source_review');
    if (todos.length) add({ category: 'missing_feature', title: `${todos.length} TODO/FIXME comment(s) in inspected files`, description: 'Comments mark intended work but do not prove a feature is missing.', severity: 'low', confidence: 'medium', evidence: todos.slice(0, 8).join(', '), affected_resource: todos[0].split(':')[0], suggested_fix: 'Review each marker; convert real gaps to issues.' });
    if (emptyCatch) add({ category: 'code_quality', title: `${emptyCatch} empty catch block(s)`, description: 'Errors are silently swallowed.', severity: 'medium', confidence: 'high', evidence: `Found in the ${sample.length} largest source files inspected.`, suggested_fix: 'Log or handle errors explicitly.' });
    if (big.length) add({ category: 'code_quality', title: `${big.length} very large source file(s)`, description: 'Files over 30 KB are harder to maintain.', severity: 'low', confidence: 'high', evidence: big.map((b) => `${b.path} (${Math.round((b.size || 0) / 1024)} KB)`).join(', '), affected_resource: big[0].path, suggested_fix: 'Split by responsibility.' });

    await progress('Checking tests and documentation', 78);
    if (!has(/(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[jt]sx?$|(^|\/)test_.*\.py$/)) add({ category: 'testing', title: 'No test files found', description: 'No test directory or *.test/*.spec files in the tree. Tests were not executed.', severity: 'medium', confidence: 'high', evidence: `Searched ${paths.length} files.`, suggested_fix: 'Add tests for critical flows (auth, payments, data writes) first.' });
    if (!has(/^readme(\.md)?$/i)) add({ category: 'code_quality', title: 'No README', description: 'New contributors cannot tell how to run the project.', severity: 'low', confidence: 'high', evidence: 'No README at repository root.', suggested_fix: 'Add setup and run instructions.' });
    if (!meta.license) add({ category: 'code_quality', title: 'No license detected', description: 'Others have no legal permission to reuse the code.', severity: 'info', confidence: 'high', evidence: 'GitHub reports no license.', suggested_fix: 'Add a LICENSE file.' });
    if (has(/(^|\/)\.env$/)) add({ category: 'security', title: '.env file committed', description: 'Environment files often contain secrets. Values are never shown in this report.', severity: 'high', confidence: 'high', evidence: 'A .env path exists in the repository tree.', affected_resource: '.env', suggested_fix: 'Remove it from history, rotate any secrets, add .env to .gitignore.' });
    checks.push('tests_docs');
    await progress('Identifying potential issues', 90);
  } catch (e: any) { return { findings, facts, checks, error: e.message }; }
  return { findings, facts, checks };
}
