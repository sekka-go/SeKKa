# seKKa Phase 01 — Baseline report

**Audit scope:** PR #185, Phase 01 only. No product implementation, migration, approval, booking, or Production operation was performed.

## Repository and deployment baseline

| Item | Observed value |
|---|---|
| Repository | `sekka-go/SeKKa` |
| PR | [#185 — Start real v3.1 app: Google OAuth foundation and legacy API isolation](https://github.com/sekka-go/SeKKa/pull/185) |
| PR state | OPEN, Draft |
| Target branch | `feat/real-app-google-auth-foundation-20261115` |
| Original baseline audit source SHA | `97d534a6d231948212fd8b5c56b322f89d37d997` |
| Latest application SHA represented by visual evidence | `9c9dca9351c323b4c3e5211d5baf58e2f4d587c0` |
| Current PR documentation head at closure | `bcdfe4b13c2fceb347813c731427a7b3a3df3c52` |
| Branch synchronization | Local, fetched origin branch, and PR head matched; divergence `0 / 0` |
| Working tree at start | Same branch and SHA; untracked `docs/audit/layout-*.png` evidence present |
| Preservation | Existing untracked PNGs were not edited, removed, staged, or committed |
| Existing CI evidence | `verify` PASS and `collect` PASS at the baseline source SHA |
| Cloudflare Staging | PR status PASS; commit-specific preview `https://8c131b41.sekka-staging-web.pages.dev` returned HTTP 200 |
| Deployment identity | Cloudflare status reports commit `97d534a`; branch preview also returned HTTP 200 |
| Frontend Supabase target | Deployed JS contains Staging project ref `zgcvumykzivsvnlflbyp`; Production ref `uorxfakceqnhxqnaawdy` absent |
| Public bundle scan | No service-role/private-key marker found in the local production bundle or deployed Staging bundle |

This report describes the source code at the audited SHA. The deliverable commit changes audit documentation and the generated source-control index only; no application behavior or deployment configuration was changed.

## Controlling requirements and conflicts

Reviewed in full: `docs/PRD.md`, `docs/REAL_APPLICATION_ROADMAP.md`, `docs/ACTIVE_GAPS_V31.md`, `docs/PRD_V31_AUDIT.md`, `docs/audit/APPROVED_73_SCREEN_INTEGRATION_MATRIX.md`, `docs/audit/ANDROID_PWA_JOURNEY_VIDEO_REVIEW_20261115.md`, and `docs/product/CAPTAIN_ENROLLMENT_OWNER_REQUIREMENTS_20261115.md`.

The canonical inventory remains **exactly 73 public screens**. The newer owner-approved roadmap supersedes older PRD flows that require phone OTP, wallet security, or payment; Google OAuth is the only launch provider. The 15 November Captain requirements supersede older optional-field/category notes: required profile, vehicle, and document details; private cars enable PRIME and SAVER; capacities are server-owned; no auto-approval. Cairo/Giza, bilingual RTL/LTR, system preferences with independent overrides, and the original assets/branding remain in scope.

No undocumented business rule was inferred. The owner requirements conflict with earlier in-repository matrix statements that Captain documents/vehicle intent were optional; this report follows the newer owner document and separately marks live Staging acceptance as incomplete.

## Architecture and data boundaries

- `web/src/main.tsx` is the production entry. It renders `LaunchSplash` and `MobileApp` except for paths beginning `/dev/screens`, which render `SubscriptionApp`.
- `web/src/v2/MobileApp.tsx` is the live mobile shell. It owns URL-backed tabs, Google session validation, role-specific route gates, preferences, bottom navigation, and the production components.
- `web/src/v2/App.tsx` is the original 73-screen developer/preview application. Its seed records, phase selectors, simulated Admin actions, and session-only booking preview are not live production behavior. `/dev/screens` remains preview-only.
- `web/src/v2/api.ts` builds the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. When absent, the client is `null`; legacy `api()` calls fail closed with `V31_DOMAIN_BACKEND_NOT_READY`.
- Production-connected components call Supabase directly for route/service-area reads and capacity, pending booking/reservation, Captain application/vehicle/document workflow, profile, notifications, and Admin overview/review. These are **wired**, not real-user accepted.
- `Discovery`, `BookingFlow`, `WalletFlow`, `AccountFlow`, `CaptainRoutes`, `CaptainOperations`, and `AdminDashboard` also contain preview/local/session state. In particular, the gallery booking/security ledger is `sessionStorage` state, not a durable reservation or wallet.
- User preferences persist in `localStorage`; OAuth role/return intent and rider search drafts use `sessionStorage`. Neither is a substitute for server authorization.
- Google role selection is not Admin authorization. The live shell calls `v31_is_admin`; Captain and Admin actions must also pass backend/RLS checks.

## Staging read-only evidence

The deployed Staging bundle provided the public Supabase URL/key in the same manner as any frontend. The key was used in-memory only for read-only health/settings and `HEAD`/`GET limit=0` probes; it is not included in this repository or report. No row payloads, names, account identifiers, or documents were fetched.

| Probe | Result | Interpretation |
|---|---|---|
| Auth settings | HTTP 200; Google provider enabled | Confirms the public Staging Auth settings endpoint responds and the configured provider is Google |
| Active service areas | Aggregate count 9 | Publicly readable aggregate only; no area records copied into the report |
| Publicly visible rows in profiles, Captain profiles, vehicles, routes, stops, bookings, trip requests/offers, notifications | Aggregate count 0 for each | Anonymous/RLS-visible counts only, **not global table totals** |
| Public vehicle make/model/color catalog | Aggregate active count visible to anonymous role: 0 for each | The committed source migration restricts catalog reads to `authenticated`; zero anonymous-visible rows are expected under that source policy and do **not** establish empty catalogs or a broken Captain selector |
| Captain application, document, approval-audit, Admin allowlist | Anonymous reads denied (`42501`) | Consistent with private access; does not prove authenticated owner/Admin policies |
| `v31_is_admin` as anonymous | HTTP 401 | No anonymous Admin grant |
| `v31_published_route_available_seats` for a nonexistent UUID | HTTP 200, `null` | Public aggregate boundary returns no availability for an unknown/unpublished route |
| Applied migration ledger, authenticated RLS policies, storage privacy, advisor findings | BLOCKED | No Supabase management/authenticated operator credentials or CLI were available; anon API cannot inspect these catalogs |

The committed `20261115150000_v31_mandatory_captain_registration.sql` seeds active make/model/color catalogs and grants `SELECT` to `authenticated` with active-row/Admin policies (not to `anon`). The public API's zero-count observations are therefore RLS-scoped and **not** evidence of empty tables or migration drift. Migration history, authenticated catalog access, and effective live policies remain unknown; do not call the Captain selector broken without those checks.

The owner independently reported a read-only Supabase inspection finding 20 public tables with RLS enabled, 37 RLS policies, 22 v31 functions, 7 migration records, a private Captain document bucket, 21 security-advisor findings, and 29 performance-advisor findings. These findings were not verified by this Codespace, and authenticated permissions were not tested.

Security-definer source review: `v31_is_admin` derives identity from `auth.uid()` plus the Google-backed server allowlist; `v31_admin_overview` calls that check; reservation, cancellation, route publication, Captain submission, and Admin decision functions check authenticated identity/ownership/role in their bodies and the committed migration revokes public/anon execution; trigger notification functions are trigger handlers; and the public capacity function is `STABLE`, returns only an aggregate for a published route, and was verified with an unknown route. These are **migration-source findings**, not confirmation of live grants or advisor status. No blanket “security clean” conclusion is made.

No migrations were applied. `test:staging:captain-review` and `test:staging:journey` were not run because they create records, upload files, approve applications, publish routes, reserve/cancel seats, and leave test data behind. The preflight script was inspected but not run: it POSTs to mutation RPCs with fake IDs, so it is not strictly read-only even though it expects rejection.

## Verification results

Local commands were run from `web/` after `npm ci`:

| Command | Result |
|---|---|
| `npm ci` | PASS; lockfile install completed. npm reported 9 moderate dependency advisories (0 high/critical); not auto-fixed |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 78 tests, 0 failed, including 9 visual-evidence provenance tests |
| `npm run test:structure` | PASS |
| `npm run build` | PASS; Vite warns the main JS chunk is 631 kB (500 kB advisory threshold) |
| `npm run test:e2e` | See [acceptance report](./PHASE_01_ACCEPTANCE.md); executed against a clean copy of the exact source SHA so existing untracked screenshots were not overwritten |
| Current-head GitHub Actions | Both required jobs passed at the source SHA; CI ran typecheck, lint, unit, structure, build, focused browser/layout tests, full Playwright suite, and explicitly mocked auth tests |

The CI “staging-safe” journey and Admin/Captain UI fixtures are synthetic/unauthenticated browser checks. They do not prove a real Google session, a database write, a Captain review, a booking, or an Admin journey.

## Visual, PWA, and deployment evidence

- Current-SHA artifacts are attached to [Actions run 43740353641](https://github.com/sekka-go/SeKKa/actions/runs/43740353641): `sekka-original-vs-integrated-layout` and `subscription-ui-evidence`. They contain guest screenshots and UI tests, not authenticated Staging acceptance.
- I inspected representative S002 Welcome, S003 role, S009 Search, S010 Filters, Google sign-in, and Admin guest-gate screenshots from the current-SHA artifact. No clipping/overlap was confirmed in those inspected examples; this is not 73-screen visual approval.
- The dedicated 73-screen workflow resolves the successful Cloudflare Staging check for its exact source SHA, then verifies that the preview's `build-info.json` reports the same SHA before capture. Existing [post-fix run](https://github.com/sekka-go/SeKKa/actions/runs/44128308727) captured all 584 pairs with 0 capture failures; source and deployed SHA both equal `9c9dca9351c323b4c3e5211d5baf58e2f4d587c0`. The provenance issue is fixed. Of the 584 pairs, 568 are explicitly non-comparable due to auth gates, deferred features, or absent equivalent routes; capture is not visual approval.
- The PWA manifest is standalone, rooted at `/`, and declares the branded 192/512 icons. The service worker caches only same-origin static assets; navigation, Auth/OAuth, Supabase, and `/dev/` are not cached. Production registration is after load.
- Automated splash/manifest/refresh tests pass. No installed Android/iOS PWA session was available; installability and native behavior remain unaccepted.

## Baseline decision

**BLOCKED.** Baseline documentation is complete, but no real authenticated Google journey has been accepted. The owner-reported Supabase inspection is not Codespace-verified, and authenticated permissions were not tested. Real Google OAuth, role authorization, Captain/Admin journeys, and cross-account RLS acceptance remain outstanding; see [closure](./PHASE_01_CLOSURE.md).

### Machine-readable status summary

```json
{
  "source_sha": "97d534a6d231948212fd8b5c56b322f89d37d997",
  "canonical_public_screens": 73,
  "screens": {
    "VERIFIED_REAL": 0,
    "PARTIAL_REAL": 32,
    "MOCK_ONLY": 14,
    "UI_ONLY": 14,
    "DEFERRED_BY_OWNER": 13,
    "BROKEN": 0,
    "NOT_TESTED": 0
  },
  "defects": {"P0": 0, "P1": 2, "P2": 4, "P3": 0},
  "local_unit_tests": {"passed": 78, "failed": 0},
  "local_e2e": "see PHASE_01_ACCEPTANCE.md",
  "staging_authenticated_acceptance": "BLOCKED",
  "decision": "BLOCKED"
}
```
