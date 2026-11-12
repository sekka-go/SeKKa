# Deployment

Existing Pages: `sekka-go`, account `d717a4d03ce35008332f281420dc6753`, production branch `main`.
Build root: `web`; command `npm run build`; output `dist`. Node 24 is used in CI.
Replacement branch: `rebuild/subscriptions-20261112`.

Preview-only variables:
- `VITE_V2_SUPABASE_URL`
- `VITE_V2_SUPABASE_PUBLISHABLE_KEY`

These identify the isolated v2 RPC in the existing Supabase project. No service role in browser or git. Legacy preview variables are not read by the replacement frontend.
New CSP permits same-origin assets and Supabase connections, denies frames/objects. No API/identity data is cached offline; manifest added, offline service-worker/install-flow still pending.

CI checks type checking, lint, domain and real temporary PostgreSQL tests, production build. It never applies hosted migrations, merges branches or cuts over production.
Local verification: `cd web && npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
Database tests bootstrap auth/storage test stubs in a temporary PostgreSQL 17 cluster; this verifies SQL/RLS/transactions but does not replace hosted GoTrue, Storage API, provider or live-device testing.

No production cutover or legacy retirement is authorized by a successful preview. Preserve the old deployment id for rollback before requesting production approval.

## Hosted staging status

First migration attempt returned `status: expired` from the confirmation form. Read-back: `sekka_v2` absent. No hosted data, schema or bucket changed. Fresh tool confirmation remains required. Do not call a DDL operation through a different tool to bypass that gate.
Local Playwright blocked by Unix socket permissions; do not report UI acceptance as passed until CI/remote browser verification.
