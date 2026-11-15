# CodeMint (V1 foundation)

Website + GitHub repository intelligence. React/Vite/Tailwind frontend, Cloudflare Worker API, Supabase (Postgres, Auth, RLS).

## Setup
1. Create a Supabase project. Run `supabase/migrations/001_init.sql` in the SQL editor.
2. Supabase > Auth > Providers: enable Email and Google (add Google client ID/secret there). Add `http://localhost:5173` to redirect URLs.
3. Backend: `cd backend && npm i`, create `.dev.vars` from `.env.example` (backend vars), `npm run dev` (port 8787).
   Deploy: `wrangler secret put <NAME>` for each secret, then `npm run deploy`.
4. Frontend: `cd frontend && npm i`, copy `.env.example` to `.env`, `npm run dev`.

## Variables
| Variable | Needed for |
|---|---|
| SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY | everything (backend) |
| VITE_SUPABASE_URL / ANON_KEY, VITE_API_URL | everything (frontend) |
| GITHUB_TOKEN | optional, raises GitHub rate limit |
| PAGESPEED_API_KEY | optional, performance metrics |
| FRONTEND_URL | CORS |

## Implemented
Landing page, email + Google auth, protected routes, project create/list/rename/delete, SSRF-safe website engine (headers, SEO, a11y, robots/sitemap, PageSpeed), GitHub engine (metadata, tree, deps, TODOs, tests/docs), persisted scan status with polling, partial-failure handling, findings with evidence/confidence, status updates, copyable fix prompts, RLS on all tables.

