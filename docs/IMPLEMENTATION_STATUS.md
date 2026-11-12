# Implementation status — replacement in progress

This is NOT a completed 75-screen product or a production launch claim.

## Phase A — Audit
Observed current repository, remote branches, deployed Edge source, 54 public tables, RLS/triggers/migration versions, three storage buckets (11 objects), existing Pages and empty D1. Classification/evidence in LEGACY_AUDIT. Hosted Auth provider configuration and complete external provider state remain unverified. No data or resource deleted.

## Phase B — Architecture
New private schema, server-owned subscription quotes and atomic reservations; typed React SPA, reusable layout, explicit staging variables. Migration and rollback plan documented. No legacy identities or ledger rows copied. Open-policy gates listed.

## Phases C–G — Implemented code, incomplete acceptance
- New 75-entry screen registry and replacement entry point; dark/light tokens and RTL/responsive layout.
- OTP adapter, profile/captain/vehicle/document forms, public route search/details, favorites, route demand, captain route wizard, private conversation/support and in-app notification API.
- Weekly/monthly calendar engine and SQL equivalent; price/start snapshot, transaction locks across periods/directions, idempotency, append-only ledger, reservation, dual declaration release, disputes.
- Staff capability checks, review/list/read analytics endpoints. No payment partner, top-up ingestion or withdrawals adapter activated.
- Legal registration and financial gates false; official holiday coverage absent by design; renewal disabled. Existing production API remains untouched.
- Spatial route ranking, route stops UI, multi-line schedule overlap, complete doc reviewer UX, configurable renewal priority, cancellation policy, admin settings writes, notification campaigns/push, offline/install experience remain incomplete.
- Generic admin list views are not equivalent to finished operational workflows. Screen registry is not completion evidence.

## Phase H — QA
32 independent domain and real PostgreSQL integration tests initially passed, including simultaneous clients. Latest run: 32/32 passed on PostgreSQL 17.11. Typecheck/lint/build passed. Local Playwright could not start Chromium because this runtime denies its Unix socket; this is an environment blocker, not a passed E2E suite. CI build/typecheck/lint and all 32 domain/DB tests passed. Guest discovery and rendering of the 75 screen entries passed. The mobile suite initially found a duplicate test locator (option and card share category name); the locator was corrected for rerun. These checks do not validate authenticated backend journeys. Type check, lint and build run on new active application. Hosted OTP/provider/mobile acceptance not completed. Test fixtures never uploaded as real routes/bookings.

## Phase I — Preview
Preview published and verified: https://c44b45a2.sekka-go.pages.dev/ (UI/code only), draft PR #168, commit 3970d0c. Remote browser verified public search and wallet guard. The hosted migration confirmation expired; a read-back verified sekka_v2 does not exist. No hosted schema or bucket was created. A fresh explicit tool confirmation is required; no execute_sql workaround will bypass it.

## Phases J–K — Not performed
Production cutover, legacy endpoint revocation, data migration and retirement require future explicit resource-specific approval after complete acceptance. Current main and old production deployment remain active.

## Final verification checkpoint

Code commit `ad48c6bd50398e4e7a5e8dc49ea3c0612935f903`: GitHub Actions run 43190565818 succeeded, including install, typecheck, lint, 32 domain/PostgreSQL tests, build and all 3 Playwright suites. Playwright covers guest rendering/navigation and RTL/responsive layout, not authenticated hosted journeys or payment-provider integration. Screenshots are in the `subscription-ui-evidence` CI artifact.
Latest verified preview deploy: https://3897cdaa.sekka-go.pages.dev (Cloudflare status success).
Second Supabase confirmation also expired. Read-back: no sekka_v2 schema, 54 legacy public tables, 11 existing objects. No database mutation, data migration, production cutover or retirement occurred.

## Owner-supplied phase-one designs — 2026-11-12
Implemented the seven paired dark/light references: splash, welcome, role selection, phone, four-digit OTP visual, success visual, and signup. Original supplied raster artwork is shown through CSS crop windows; editable text, fields, navigation, role radios and password visibility use semantic React controls. This is a first visual implementation for owner review, not evidence of pixel-equivalence or working authentication.
Owner chose to implement the screenshot form while holding integration. SMS, verification, signup and social-login controls are disabled, and success is explicitly labeled as a preview without changing authentication state. No real SMS or account creation was performed.
Commit `3e54919fc14d5ffb662497d6ce6d9b62cd750287`, GitHub Actions run `43198873169`: typecheck, lint, domain/PostgreSQL tests, build and all four Playwright suites passed. The phase suite captures all 14 variants, tests role selection, phone editing, OTP input and password visibility, verifies disabled auth buttons and no auth requests. Screenshots in CI are review evidence, not automated reference-image diffs. Cloudflare preview deployment succeeded at https://0109635a.sekka-go.pages.dev/ . Remote browser visual review found and corrected account-card layering; reviewed phone, OTP, success and signup states. Supabase and production unchanged.
Stage two is paused until owner supplies its references. Remaining hosted authentication, provider configuration and production acceptance are not completed by this UI delivery.

### Phase-one captain card correction
Owner reported broken Arabic in the captain card on mobile. Kept the description in three intact RTL lines, adjusted its available width and font scale, and tightened the captain illustration crop to exclude rasterized text from the reference. The text is editable HTML, not duplicated in the illustration. Typecheck/lint/build passed for the text-layout change; browser geometry verified three lines fit within their bounds and the card, without horizontal overflow. Preview-only update; no authentication/backend changes.
