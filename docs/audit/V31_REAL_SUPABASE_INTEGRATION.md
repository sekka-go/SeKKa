# PR #185 — Real Supabase Staging integration checkpoint

Date: 2026-11-15
Staging project: `zgcvumykzivsvnlflbyp`
Production project: **not accessed**

This records read-only Staging checks and code-level integration evidence. It is
not release acceptance. No user data, documents, bookings, approvals, or schema
were changed during this checkpoint.

## Staging checks actually run

The PR branch's Cloudflare Staging preview was inspected at
`https://feat-real-app-google-auth-fo.sekka-staging-web.pages.dev`. Its built
frontend points to `https://zgcvumykzivsvnlflbyp.supabase.co` and includes a
publishable client key. Cloudflare branch preview and the Staging API responded.

| Read-only check | Result |
|---|---|
| Auth provider settings | Google enabled; signup is enabled |
| Google OAuth preview redirect | Staging authorize endpoint accepted the PR preview callback and returned a 302 to Google; no login was completed |
| Active service areas | 9 |
| Published routes visible to anonymous search | 0 |
| Route stops visible to anonymous search | 0 |
| Required v31 tables | All 13 checked; application/document/audit tables correctly deny anonymous table reads |
| Sensitive RPCs called anonymously | All 15 denied |
| Public capacity RPC, unknown route | Returns `null`, no capacity disclosure |
| Supabase OpenAPI/catalog root | 401 (`Secret API key required`); no service-role or secret key was requested or used |

The service-area response was public discovery data. Anonymous RLS results are
not used to infer private booking, profile, or approval counts.

The exact allowed OAuth redirect list was not exposed by the public Auth
settings endpoint. The tested preview URL is accepted; the complete Google
sign-in, callback, session, and sign-out lifecycle remains unverified.

## Integration matrix

| Capability | Current implementation / enforcement | Staging evidence | Remaining gap |
|---|---|---|---|
| Google Auth | Supabase Google OAuth; persisted session; app validates `getUser()` before assigning identity | Google provider enabled; bundle uses the specified Staging project; preview callback accepted by authorize endpoint | Interactive sign-in/callback, refresh, sign-out, and real profile creation/edit were not exercised |
| Passenger/Captain intent | URL-backed journey state; Captain enrollment is explicit; role preference is not Admin authority | Anonymous role/authorization checks only | Needs separate real Passenger and Captain sessions |
| Captain application | `v31_captain_profiles`; save details, optional vehicle intent, submit/status RPCs | Required tables and protected RPC existence/anonymous denial verified | No real Captain submission or state refresh |
| Private documents | Private bucket and storage RLS in tracked Staging migration; owner-folder upload and owner/Admin download; MIME/5 MB limits | Migration contract reviewed; no authenticated upload/download performed | Verify bucket settings and owner-vs-other-Captain/Admin access with real sessions; no real document uploaded |
| Admin review | Admin allowlist checked server-side; Admin decision RPC changes submitted application and audit row atomically | Anonymous Admin RPC denial verified | No real Admin login, review, decision, or audit event exercised |
| Vehicle registration | Authenticated insert; database RLS requires server-approved Captain; owner can manage own vehicle | Code/migration reviewed; no record written | Verify with real approved Captain, then verify rejected/pending Captain denial |
| Route draft/publish | Draft RPC persists route/stops; publishing/status changes are server-side, ownership and approval checked | Current Staging has zero published routes; route/list API accessible | UI now calls `v31_set_route_status`; this latest code change is not yet deployed. Real approved-Captain test pending |
| Passenger discovery | Queries only published routes/stops; capacity comes from aggregate RPC | 9 areas; zero published routes/stops; live empty state is legitimate | Publish a real test route after Captain approval and validate matching/refresh |
| Booking | Atomic stop-aware reservation RPC, route lock, seat checks, idempotency UUID, persistent pending status; cancellation RPC | Anonymous sensitive RPC denial verified; existing SQL/domain tests pass | No authenticated booking, idempotent retry, last-seat race, history, cancellation, or restored-capacity Staging journey |
| Captain booking view / notifications | Captain can read bookings for owned routes; DB triggers persist recipient notifications | Source and migration reviewed | Verify actual cross-role visibility and notification rows with Captain and Passenger sessions |
| Admin overview | Server RPC checks allowlisted Google Admin identity; no client metadata role grants Admin | Anonymous call denied | Real allowlisted Admin test and unauthorized signed-in RPC checks pending |

## Implementation changes in this checkpoint

- Captain route publication in `LiveCaptainRouteList` and the real-Staging
  journey harness now call `v31_set_route_status`, then verify the persisted
  status. Publishing no longer uses a direct table update from the UI.
- Added
  `supabase/migrations/20261115140000_v31_idempotent_reservation_retry.sql`.
  The tracked reservation function checks for an existing idempotency key
  before acquiring the route lock, but does not recheck after waiting for that
  lock. Concurrent retries for the same route/key can therefore race into the
  unique constraint instead of returning the original booking. The migration
  adds a post-lock recheck and safe unique-conflict recovery.
- **The reservation migration has not been applied to Staging.** This
  environment has no Supabase DB password/access token. Apply and verify it on
  Staging before claiming the concurrency/idempotency fix is live. It is
  explicitly not authorized for Production.
- Expanded `staging-preflight.mjs` to check the application/document/audit
  tables, Captain/Admin protected RPC denial, Google provider status, and
  aggregate-capacity boundary. It passed against Staging without changing data.
- Added `staging-captain-review.mjs`, an opt-in real-session integration test
  requiring distinct Google-authenticated Captain and server-authorized Admin
  JWTs. It performs real draft submission and approval through the production
  RPC, verifies the Admin actor/audit record, and leaves the designated
  disposable Captain approved for the route/booking test. It has not yet been
  run against Staging because authorized real sessions are unavailable.
- `real-journey.mjs` remains an opt-in real-session test for Captain route,
  Passenger search, booking, idempotency, concurrency, notification, and
  cancellation. It now archives its test route and deactivates its vehicle on
  successful completion. It does not pretend that one Passenger session proves
  cross-account concurrency.

## Local validation

- Production build: passed; Vite reports the existing large-chunk advisory.
- Unit/domain/database/navigation checks: 54 passed.
- TypeScript, lint, and structure checks: passed.
- Standard Playwright E2E: 239 passed.
- Isolated synthetic-auth Playwright checks: 32 passed after building with the
  dedicated fake Supabase endpoint. These are mocks, not authenticated Staging
  acceptance.

## Security notes

- The reviewed v31 SECURITY DEFINER RPC definitions use an empty `search_path`
  and explicit `auth.uid()`/Admin/owner checks in the tracked migrations.
  Sensitive RPC execution is limited to authenticated users; anonymous denial
  checks passed.
- `v31_published_route_available_seats` is intentionally callable by `anon`
  and returns only a published route's aggregate availability.
- No complete Supabase Security Advisor report was available: the dashboard /
  Management API requires an authorized management credential, which is not
  configured here. Therefore this is not a “zero warnings” claim.
- Per-user RLS, private document downloads, authenticated unauthorized RPC
  denial, and Admin-vs-Captain isolation still need real Google sessions.

## Exact blockers to real lifecycle acceptance

1. Owner must provide or configure a **fresh disposable Staging Captain Google
   account**, a separate Passenger Google account, and a separate allowlisted
   Admin account. Do not paste bearer tokens into chat; pass them only through
   a protected local environment or secret store.
2. Owner must complete the Google OAuth sign-in for each session (or arrange
   protected authenticated browser state) and confirm the Staging redirect
   allowlist if callback validation fails.
3. Authorize the real Admin test action explicitly by setting
   `SEKKA_ALLOW_STAGING_ADMIN_APPROVAL=true`; the Captain-review script then
   uses the genuine Admin token and RPC, never a fabricated approval.
4. Provide a Staging DB migration credential or apply
   `20261115140000_v31_idempotent_reservation_retry.sql` through the authorized
   Staging migration process, then run the Staging preflight and real tests.
5. Provide authorized Supabase dashboard access if the full Security Advisor
   and live storage bucket configuration report is required.

## Real-session test commands

From `web/`, with the specified Staging URL and publishable key:

```sh
npm run test:staging:preflight
npm run test:staging:captain-review
npm run test:staging:journey
```

The first is read-only. The latter two create durable Staging QA records and
must use the designated disposable accounts. No test creates payments, wallets,
OTP state, or Production data.

## Acceptance status

**NOT ACCEPTED as a complete working lifecycle.** Local code checks and
read-only Staging checks are not equivalent to real authenticated application
acceptance. The Captain → Admin → approved route → Passenger booking → Captain
notification → Passenger cancellation → seat restoration journey remains
blocked on the real sessions and unapplied Staging migration above.
