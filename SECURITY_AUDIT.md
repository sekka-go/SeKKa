# SeKKa Security Audit

**Audit baseline:** `ffa16d4808447a0ea67d00256e4d00593cef6738` on branch `security-hardening` (2026-10-10). Scope: tracked repository source, migrations, Edge Function, service worker, CI and deployment configuration, plus Supabase security-advisor metadata. No customer records or secret values are included.

## Findings

| ID | Severity | Location / surface | Impact and evidence | Resolution / status |
|---|---|---|---|---|
| SEC-01 | Medium | `server/src/app.ts`, all `/api/*` requests | `express.json()` had no explicit size cap. Oversized JSON could consume memory/CPU before route validation. | **Fixed:** 256 KiB JSON limit, generic 413/400 handling and regression tests. |
| SEC-02 | Medium | `server/src/app.ts`, `Caddyfile`, Cloudflare Pages | No application security response headers were configured. | **Fixed:** CSP, frame protection, nosniff, referrer/permissions policy; Cloudflare `_headers` also prevents API caching, Caddy adds HSTS. HSTS/Cloudflare deployment status still needs live verification. |
| SEC-03 | Medium | `server/src/middleware/rate-limit.ts`, local login/registration/OTP API | Rate counters are process-local. Restarting or scaling the local Express server resets/splits enforcement. | **Partly fixed:** map size is capped; local registration is limited per IP and phone, and captain OTP request/confirmation attempts are throttled. Limits still return `429`/`Retry-After`; production Edge uses shared database-backed quotas. Local multi-instance deployments still need a shared store. |
| SEC-04 | Medium | `supabase/functions/sekka-api/index.ts`, all JSON and binary responses | CORS accepted any HTTPS subdomain ending in `.sekka-go.pages.dev` and returned `Access-Control-Allow-Origin: null` to untrusted origins. | **Fixed:** exact production/local origins only, plus exact validated origins from `SEKKA_ALLOWED_ORIGINS`; untrusted origins get no allow-origin header. Added tests. |
| SEC-05 | Medium | `server/src/routes/auth.ts`, Edge auth routes | Registration accepted unbounded fields and weak passwords; reset/change paths had no maximum length. | **Fixed:** 8–128-character password bounds, 100-character names and 32-character phone fields applied to local and Edge auth flows; regression coverage added locally. |
| SEC-06 | High | `web/package-lock.json`, `node_modules/source-map-js` | Lockfile resolved `source-map-js@1.2.1`, which was affected by a high-severity event-loop denial-of-service advisory. | **Fixed:** lockfile updated to `1.2.2`; `npm audit --audit-level=high` reports zero vulnerabilities. |
| SEC-11 | Medium | `.github/workflows/*.yml` | Third-party Actions were referenced by mutable tags, and dependency/secret/code scanning was not automated. | **Fixed:** all Actions pinned to verified full commit SHAs; added Dependabot, CodeQL, npm audit, and redacted Gitleaks workflows. |
| SEC-07 | Low | Supabase public tables and RLS | Security advisor reported `rls_enabled_no_policy` for 13 tables. Migrations mark these tables server-managed; live privilege inspection confirmed the sampled tables grant access only to `service_role`, not `anon`/`authenticated`. All three live storage buckets are private with file size/MIME limits. | **Verified safe as currently deployed:** keep backend-only grants and RLS; re-run advisor after migrations. No broad client policies were added. |
| SEC-08 | Low | `web/src/api.ts`, browser storage | The custom bearer session token is persisted in `localStorage`; an XSS flaw could expose it. No `innerHTML`, `dangerouslySetInnerHTML`, or untrusted Leaflet HTML popup usage was found in the scanned app source. | Retain compatibility for now; deploy CSP and keep the XSS-safe rendering patterns. Moving to HttpOnly cookies would need a deliberate API/CSRF migration. |
| SEC-09 | Medium | `web/src/MapPicker.tsx:34`, map privacy/deployment | The browser requests production map tiles directly from `tile.openstreetmap.org`; the tile provider sees client IP/map tile requests, and the repository's own architecture explicitly says not to use this public tile service for production traffic. | **Open:** migrate to approved PMTiles on R2 or a selected compliant provider; preserve OSM attribution and document privacy. This is left for an explicit provider/deployment choice. |
| SEC-10 | Low | Git history, `server/.env.example` | Gitleaks scanned 510 commits across fetched refs and reported two historical JWT-shaped sample values. Both were decoded in-memory as `role=anon`; current example values are empty. No service-role JWT/private key was found by this scan. | **Addressed:** exact historical fingerprints are allowlisted in `.gitleaksignore`; CI scans all reachable refs and redacts output. Rotate any actual service-role secret discovered by provider/GitHub logs. |

## Verified controls

- The local Express API uses opaque random session tokens, stores only token hashes, checks active/non-expired sessions centrally, derives user IDs from the authenticated session, and checks roles from the database. It is not a Supabase JWT API; replacing it with `auth.getUser()` would be an architectural migration, not a safe hardening patch.
- Admin routes are guarded by authentication plus database-backed `admin` role. Rider/captain routes likewise derive identity from the session and enforce role/ownership checks.
- Price, fare and settlement values in the local API are computed from server-side configuration and records. Phase 1 does not implement a third-party checkout/provider webhook; payment-state operations are local application workflows. No payment provider/API key was identified in the scanned application.
- Supabase migrations enable RLS on application tables and restrict backend-owned tables to server-mediated access. Edge Function secrets are read from Deno environment variables; no `VITE_*` service-role key was found in tracked frontend sources.
- Verification documents use private-storage deny policies; avatar/document handling includes size/type checks and server-mediated access.
- Workflows have top-level `contents: read`; no `pull_request_target` workflow was found.
- `.env` files are ignored and tracked examples are placeholders. Gitleaks 8.30.1 scanned all fetched refs and 510 commits; only two documented historical anon-role example fingerprints were found. The scan redacts findings and does not print credential values.

## Public unauthenticated surfaces (repository inventory)

Local API: `GET /api/health`, `GET /api/config`, `GET /api/pool/categories`, `GET /api/pool/push/vapid-public-key`, `POST /api/auth/register`, and `POST /api/auth/login`. All other local routes observed require a session; admin routes additionally require role `admin`.

Supabase Edge Function: health/root/config/category discovery endpoints, `POST /webhooks/telegram` protected by Telegram's webhook secret header, plus registration/login/password-reset/verification flows intended to be public and individually rate-limited. Remaining user/account endpoints call the custom bearer-session authenticator before handling the request.

## Data/business logic checks

No client-controlled `user_id`, role promotion, payment confirmation flag, price/commission mutation, or mass-assignment path was confirmed in reviewed local route handlers. Route handlers use explicit selected fields and derive owner IDs from `req.auth`. Regression tests cover role escalation, ownership/IDOR, price tampering, registration limits, and captain OTP limits. Concurrency-sensitive booking/group operations use conditional updates/transactions in the local SQLite layer; race review remains part of route-level tests.

## Residual risk

Repository inspection cannot verify live Cloudflare, GitHub branch-protection, Supabase Auth provider settings, storage bucket visibility, PITR/backups, billing alerts, TLS/origin exposure, or whether any historical secret was already copied by an external actor. Follow `SECURITY_TODO.md`; rotate any key identified by GitHub secret scanning or provider logs.
