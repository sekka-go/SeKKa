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

## Verified preview

Initial replacement commit: `3970d0c442943ecdfb90426b7427ab6ee7332ce6`.
Draft PR: https://github.com/sekka-go/SeKKa/pull/168
Cloudflare deploy `c44b45a2-b8f5-4946-8868-a95755d6a42f` succeeded:
https://c44b45a2.sekka-go.pages.dev/
Branch alias returned by Cloudflare: https://rebuild-subscriptions-202611.sekka-go.pages.dev
Remote browser verified rendering, guest text search navigation and wallet authentication guard. Backend staging remains unconfigured; this is a UI/code preview, not a live booking service.
Production canonical deployment remains `4a3504d9-96c5-4d78-9855-bf21fe4072ff`, commit `f605e1e`, branch main.

Validated code commit: ad48c6bd50398e4e7a5e8dc49ea3c0612935f903.
Latest successful preview: https://3897cdaa.sekka-go.pages.dev
Successful complete CI run: https://github.com/sekka-go/SeKKa/actions/runs/43190565818
All 3 guest UI suites passed including 390px/1440px overflow checks. Authenticated live acceptance remains blocked by hosted migration/OTP/policy gates.

## Map74 branch preview
Canonical URLs use screen=1..74. Preview scopes: phase2 discovery8–15, phase3 booking16–22,
phase4 account/wallet23–35, phase5 captain onboarding36–42. Existing immutable preview
URLs preserve previous versions; new deployments use the new numbering. Hosted database
migration20261112214616 is not applied by this change. Release requires it before enabling
live discovery/contact APIs. Tests include the baseline plus this forward migration.

### Phase 7 preview
Entry: `?screen=51&theme=dark&preview=phase7` (or theme=light).
Branch remains rebuild/subscriptions-20261112 / draft PR168. Preview actions are local only.
The operations migration is committed and tested, not applied to hosted production.
