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

## Phase two — owner-supplied discovery batch
Implemented native React planner/time inputs, filters, fixed-offer results/details, confirmed-booking visual, favorites, subscriptions and demand form. Shared layouts, SVG icons and tokens serve both themes. Only isolated supplied illustrations use raster crop windows. Explicit preview fixtures are isolated from live service data and cannot create bookings or submit requests. No hosted schema, production or legacy resources changed. Pending: browser QA, preview acceptance and phase-three booking/schema work. See REFERENCE_SCREENS for mapping and mockup discrepancies.

Phase-two code checkpoint: `efd2e9828fd89e80b3f6b331c5ec2856ebb2e11b`, Actions run `43204427550` succeeded: typecheck/lint, 32 domain/PostgreSQL tests, production build and all five Playwright suites. Phase-two suite captured 16 variants and checked fixed-offer selection, filtering, favorites and no preview mutations. Preview https://7d2ca014.sekka-go.pages.dev deployed successfully and was visually reviewed. Visual review identified inherited canvas typography and planner/header alignment issues, fixed in follow-up. Screenshots demonstrate review coverage, not pixel-equivalence. No authenticated hosted/production or payment journeys are certified by these tests.

## Phase three — booking/subscriptions UI (owner map 16–22)
Built shared dark/light summary, EGP 100 security/shortfall, confirmation snapshot, subscription details, rider declaration, receipt timeline, and management/support views. Captain offer handoff replaces phase-two booking placeholder; read-only terms persist into the summary. Demo quotes use the tested domain function with an explicitly illustrative calendar. Native dialog explains held top-up/renewal/cancellation actions. No real-money activation or reservation endpoint is wired to the new UI; authenticated quote/declaration/refresh/dispute adapters use existing API contracts. Hosted acceptance remains blocked by the previously recorded migration/auth/provider/calendar policies. Pending local/CI/browser verification and preview deployment evidence. No production/database/infrastructure changes.

Phase-three verification checkpoint: code `1f2724bb2bf4fe3bcc1efe39d92abe834343029b`, GitHub Actions `43232954337` passed typecheck, lint, all 32 domain/PostgreSQL tests, build and all six Playwright suites. Stage-three suite captures all 14 dark/light variants and verifies the EGP 1,527 fixture calculation, immutable date display, insufficient security, top-up hold dialog, staged declaration/receipt/dispute states and no preview service mutations. Phase-two selection is also tested through handoff to summary, preserving weekly/outbound EGP 850 terms. Preview https://dc48f430.sekka-go.pages.dev deployed and was reviewed in browser. Visual review found the review-scenario aside inherited legacy sidebar styling and the step fraction needed LTR; follow-up fixes scope both. Hosted authenticated/financial workflows remain unverified and gated. No Supabase/production/data migration or retirement occurred.

## Phase four — 12 November 2026

Implemented WalletFlow 24–30 with shared dark/light branding, available versus reserved balance, top-up amount selection and validation, explicit illustrative pending/failed/success states, held withdrawal flow, transaction filters/details, current/history subscription tabs and empty states. Read-only live data uses existing authenticated wallet/bookings API; no hosted financial integration is claimed. No top-up or withdrawal writes exist in this UI. Demonstration balance never changes, even in the explicitly labelled success illustration. Live guests never receive sample records.

Local typecheck, lint and production build passed. Added Playwright coverage for all fourteen views, overflow, state isolation, negative amount validation, transaction filter/details, empty history and guest protection; hosted CI pending at commit time. No production cutover or resource retirement.

Phase-four CI evidence: commit 633237a98dc414eaaf47144c552d66636fdcfaf1, Actions run 43246005067, all checks including all seven Playwright suites passed. Preview bbbbe44c deployed successfully. Browser review checked dark wallet and light transaction layout; follow-up compacts the preview-only checkbox and reconciles the illustrative ledger to the displayed EGP 50 available / 100 reserved balance.

## Wallet wording/minimum correction

Renamed reserved wallet security to «تأمين جدية الحجز» with explicit refundable, separate-from-subscription copy. Top-up minimum is EGP 100, quick amounts 100/200/300; invalid amounts cannot advance the preview. No financial activation or balance-floor restriction. Typecheck/lint/build passed locally; browser regression includes rejection of 99 and acceptance of 100 for preview only. Hosted server/provider enforcement remains a prerequisite for future real-money activation.

## Phase five — communication and account

Implemented six dark/light screens (31–36): searchable conversation list, threaded chat with whitespace/length guard, unread notification filtering, profile navigation/theme preferences, preview name editing, FAQ accordions and support form. Added empty, guest, error/retry and busy states. URL retains live conversation selection across refresh. Existing authenticated conversation/message/notification/support reads and sends remain adapters; no hosted-backend acceptance claim. No fake online presence, message receipts, live notifications, or successful real profile update. Added 12-view Playwright screenshots and interaction/isolation regression. Typecheck/lint passed locally; deployment and hosted browser verification pending at commit time.

## Phase 6 — captain onboarding, screens 37–43
Implemented dark/light native welcome, captain information, local document selection,
vehicle information, vehicle documents, review and status screens. Preview uses
`?screen=37&theme=dark&preview=phase6`. Drafts exist only in component memory;
files are never read or uploaded, and only their names are displayed. Reload clears drafts.
Category capacities are PRIME 3, SAVER 4, SPACE 9, MAX 13. Missing fields/documents block review.
Live application submission remains gated pending identity-verification, retention and
private-storage policies. Existing application status is read through the authenticated
captain API; captain approval alone does not imply vehicle/document approval.
No database migration or production cutover. Added a mobile, both-theme E2E journey
including validation, all four file selections and zero POST requests. CI pending this commit.
Previous phase 5 CI run 43298400773 passed all checks and 8 E2E suites.

## Approved map74 reconciliation — 12 November 2026
This section supersedes the historical phase numbering above. Product stages are now
1 onboarding 1–7, 2 discovery 8–15, 3 booking 16–22, 4 rider account/wallet 23–35,
5 captain onboarding 36–42, 6 routes 43–50, 7 operations 51–62, 8 admin 63–74.

Reviewed all existing themed screens. Changed 6 to profile completion and 7 to optional
permissions, consolidated captain documents into39, moved vehicle details to38, added
color, and added guarded activation42. Public URLs/titles/pickers now use map74.
A central adapter preserves internal view keys; those are not public screen numbers.
Old numeric bookmarks may now identify a different screen, as required by the new map.
Removed captain identity from public results and added filters for direction, price and
availability. Added a protected contact read used by13 and links from confirmed booking.
A forward-only migration strips identities from search/route/favorites and requires an
owned committed booking for contact and messaging. Verified on embedded PostgreSQL;
NOT applied to hosted Supabase or production. Existing data is untouched.

Scope remains staged: 43–74 are registered but not all rebuilt. Newly specified views
without implementation display an honest pending-state page, not fabricated operations.
Authentication/SMS, live profile saving, private document submission, payment partner,
withdrawal, renewal and offer amendment policies remain pending. No claim of production
readiness or full74-screen completion. See SCREEN_MAP74_REVIEW.md for the review matrix.
