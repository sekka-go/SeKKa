# seKKa Phase 02 — Google OAuth, accounts, role authorization, navigation

**Date:** 17 November 2026  
**PR:** [#185](https://github.com/sekka-go/SeKKa/pull/185) (Draft, never merge without owner approval)  
**Execution-plan phase:** 02 (the owner-approved conversation handoff numbering; older repository roadmap places OAuth in Phase 03).  
**Acceptance:** **BLOCKED — changes implemented and mock regressions added; real authenticated Staging E2E not yet demonstrated.**

## Changes delivered

- `web/src/v2/MobileApp.tsx`: after successful server-side `v31_is_admin` verification, the common Google completion return path `/?tab=login&view=6` lands an authorized Admin on `/?tab=admin&view=62`. Explicit deep links (Passenger bookings, Captain onboarding, Admin subpages, selected route) retain their destination.
- Auth-sensitive tabs (login, profile, booking, Captain onboarding, Captain routes, bookings and notifications) wait for session verification before rendering a signed-out gate or authenticated content. The existing loading status is shown instead.
- Guest prerequisites save their own return path and explicit Rider intent before beginning Google sign-in. Bookings, notifications, profile completion and booking return destinations no longer inherit stale Captain intent or an unrelated return target.
- Existing Google OAuth provider, Supabase client persistence, refresh, URL detection, Admin RPC and approved screens remain unchanged. No OTP, payment, wallet or production changes.
- `web/e2e/admin-authorization-mocked.spec.ts`: mock regression cases for Admin login-completion routing, non-Admin denial, explicit deep-link preservation and identity-verification loading.
- `web/e2e/mobile-navigation-role.spec.ts`: mock guest-prerequisite return intent regression.

These tests are synthetic frontend fixtures. They **do not** demonstrate Google provider login or live Staging user permissions.

## Read-only Staging observations (not user-session acceptance)

Staging project: `zgcvumykzivsvnlflbyp`. No database writes or migrations were performed.

- The deployed `public.v31_is_admin()` is SECURITY DEFINER; it checks `auth.uid()`, verified Google identity, confirmed email and the server-side `v31_admin_allowlist`. Execute permission was unavailable to `anon`, available to `authenticated`; the function performs internal authorization.
- `v31_admin_overview` and two `v31_admin_decide_captain` signatures were also unavailable to `anon` and executable by `authenticated`; their body checks and unauthorized actor behavior still need real-session testing.
- Profile SELECT/INSERT/UPDATE policies require `user_id = auth.uid()`; the Captain-profile SELECT and enrollment INSERT policies are owner-scoped, and the Captain application SELECT allows the owner or an authorized Admin.
- This is an inspection of live metadata and policy definitions, **not** proof that cross-account RLS, Admin decisions or token expiry behavior pass in a real browser.

## Automated and manual acceptance matrix

| Scenario | Current evidence | Acceptance |
|---|---|---|
| Guest Welcome → Role → Google UI | Existing synthetic Playwright | NOT REAL-VERIFIED |
| Google sign-in / callback / cancellation / retry | No authorized real Google browser session available to this execution | BLOCKED |
| Admin verified login-completion landing | New mocked regression + source fix | MOCK ONLY; real Staging BLOCKED |
| Non-Admin direct Admin URL denial | Mocked regression + observed RPC/RLS design | MOCK ONLY; real Staging BLOCKED |
| Explicit booking/Captain/Admin deep-link preservation | Browser fixtures + source review | MOCK ONLY; real Staging BLOCKED |
| Guest return intent to booking/profile/notifications | New frontend regression | MOCK ONLY; real Staging BLOCKED |
| Session loading and refresh | Browser fixture + source review | MOCK ONLY; real Staging BLOCKED |
| Sign-out and stale back-navigation with real tokens | No real account session | BLOCKED |
| Profile save/read across refresh and separate account | Backend policies source/read-only inspection only | BLOCKED |
| Captain role state and pending/approved gate | Existing mocked screens, server approvals not exercised | BLOCKED |
| Cross-account permissions / Admin negative tests | Cannot be inferred from policies alone | BLOCKED |

## Owner-assisted real Staging acceptance (required to mark PASS)

Use three **authorized** Google sessions representing Passenger, pending/approved Captain and allowlisted Admin. Owner logs into Google directly on the Staging preview; never provide passwords, cookies, OTPs or access tokens to the agent. Use separate browser profiles or isolated contexts.

1. Passenger: cold start → Welcome → select Rider → Google success → profile completion/save → refresh and reopen → Home; verify profile and selected language/theme persisted.
2. Passenger: guest bookings, notifications and route booking sign-in entry → Google → return to **the same** intended destination, with route/stops if provided. Test browser Back/Forward and Google cancellation/retry.
3. Captain: select Captain → Google → Captain onboarding, save and resume a real draft; unapproved Captain cannot publish routes. Full document uploads, Admin approvals and fleet creation are Phase 03 acceptance, not presumed done here.
4. Admin: authenticate the allowlisted Google identity → real `v31_is_admin=true` → Admin dashboard, refresh and direct `/?tab=admin&view=64` subpage; verify a non-Admin Google identity is denied. Admin must not be selectable as a signup role.
5. Sign-out all roles; refresh and browser back to a formerly protected URL. The prior authenticated screen must no longer be accessible; return to Welcome/sign-in gates.
6. Test invalid/expired session, connectivity failure and Admin RPC unavailable with truthful retry; check console/network for real errors without recording secrets.
7. Verify on Android PWA if owner can use an installed test device, at 360×800 and 390×844, Arabic/English, Light/Dark. Synthetic browser screenshots cannot replace these observations.

Do not run staging scripts that insert records, grant approval, publish routes or reserve seats without checking their effects and obtaining explicit permission. Never modify Production project `uorxfakceqnhxqnaawdy`.

## Release and carry-forward

- **Phase 02 is not PASS** until real authorized Google sessions, role gates, refresh/logout and negative permissions are evidenced.
- Full Captain enrollment/approval is Phase 03; route/vehicle lifecycle Phase 04; Passenger search Phase 05; booking atomicity Phase 06; Admin modules Phase 09; 73-screen visual acceptance Phase 10; deep security isolation Phase 11; installed-device full E2E Phase 12.
- Verify current PR HEAD and latest GitHub Actions status separately before citing automated-test success. Keep the PR Draft, do not merge or deploy Production.


## Owner-directed Phase 02 continuation — 17 November 2026 (not yet accepted)

Baseline branch HEAD before these changes: `2d0386864bbd50ccd1142cfebb022f6824be0755`. This continuation stays on Draft PR #185. **Phase 02 is still BLOCKED for real Google account acceptance.** The earlier partial work described above is preserved; none of the following is evidence of real Google authentication.

### Code and tests changed

- `web/e2e/mobile-navigation-role.spec.ts`: correct the owner-approved physical header positions (Arabic language LEFT, English language RIGHT) and keep the logo centered. Extend 320/390 checks to 360/412. Fix the test's per-navigation `addInitScript` preference overwrite so reload persistence is genuinely tested.
- `web/src/v2/LiveProfile.tsx`: do not claim a saved profile until a same-user Supabase read-back confirms the intended name and optional phone. Show a localized retry for failed profile loads and handle rejected reads without leaving a permanent loading state.
- `web/src/v2/MobileApp.tsx`: identity-verification failures remain signed out, show a localized actionable session-retry control, and must not reveal previously authenticated content.
- `web/src/main.tsx` and `web/src/v2/LaunchSplash.tsx`: restrict developer gallery detection to `/dev/screens` and `/dev/screens/`, not similarly prefixed routes.
- `web/e2e/admin-authorization-mocked.spec.ts`: add MOCKED regressions for profile read-after-write success/failure and a temporary identity-verification server failure followed by retry.
- `web/e2e/mobile-pwa-navigation.spec.ts`: verify that `/dev/screens-copy` is not mistaken for the developer gallery.

### Evidence separation and known verification

- Previous run [44156981554](https://github.com/sekka-go/SeKKa/actions/runs/44156981554) had 59 passing and 6 failing mocked navigation tests before the correction. The four header assertions encoded the superseded layout; two persistence tests re-seeded Arabic on reload.
- A subsequent intermediate run [44165300867](https://github.com/sekka-go/SeKKa/actions/runs/44165300867) revealed a TypeScript JSX typo in the newly added profile retry fragment. This was fixed in commit `bcf1fd337ce92bbad60e819feda1b60ba2553db7`. **Do not cite the intermediate run as a passing CI result.**
- Newest CI for the final documentation commit must be checked independently. Automated results are **PENDING VERIFICATION** until the exact final HEAD and corresponding jobs complete; do not mark A1 PASS ahead of evidence.
- Read-only Staging Supabase inspection confirmed `zgcvumykzivsvnlflbyp` is `ACTIVE_HEALTHY`. `v31_is_admin`, `v31_admin_overview`, and both `v31_admin_decide_captain` overloads are not executable by `anon`; `v31_is_admin` checks `auth.uid()`, confirmed email, a Google identity and a server-side allowlist. `v31_profiles` SELECT/INSERT/UPDATE policies check `user_id = auth.uid()`, with UPDATE `WITH CHECK`. These observations **do not constitute real-account cross-user authorization tests**.
- The Staging captain-review and real-journey scripts create/update durable rows, uploads, approvals or reservations; they were inspected but **not run**. No database migration, data deletion, or production write was performed as part of this continuation.
- No authorized Google browser sessions were available to this execution. Passenger/Captain/Admin OAuth, token expiry, real profile read-after-write, role-specific navigation and negative permissions therefore remain **BLOCKED** pending owner-assisted authenticated tests.
- The 73-screen screenshot collector and Cloudflare previews are distinct from real OAuth acceptance. Check deployment source SHA before claiming preview correctness.

### Acceptance decision

**BLOCKED — actual code improvements and synthetic regression tests exist, but a passing exact-HEAD CI run and independently verified Passenger, Captain and Admin Google sessions are required.** Retain Phase 02 numbering from the owner-approved handoff. Do not automatically advance to Phase 03.


## Real-device owner report — 18 November 2026: functional follow-up, not yet accepted

The owner supplied a ~4m43s Android recording demonstrating the following Staging failures despite previous green CI:

1. **Passenger no-match request:** selecting origin and destination, searching for a published route and attempting to confirm a trip request displays a "Review your search details" error rather than saving the request. Root-cause source review found that `Discovery` passed an empty `period` to `LiveRouteSearch` for an ordinary non-filtered search, then `LiveTripRequests.create` rejected the empty period. The current fix passes the selected period independently of route filtering, visibly offers Weekly/Monthly and departure-time choices, handles unauthenticated users with a Google sign-in CTA and verifies owned persisted request rows after inserting.
2. **Captain documents:** Android file selection returns to the document stage with `0/4` and no saved document. Current code formerly relied on `File.type`, which Android document providers can supply as a blank or generic MIME. The revised upload validates the actual JPG/PNG/PDF signatures using the first bytes, selects the matching content type, displays the chosen filename while uploading and reports selection/upload errors. **The exact device failure has NOT been independently reproduced or proven fixed by a real authenticated Android upload yet.**
3. **Navigation:** important actions were scattered across the Passenger home and account screens. Owner requested a consolidated left menu. The application now adds an accessible drawer on the physical LEFT regardless of Arabic RTL / English LTR, keeping original core tabs, authorized Captain/Admin links and language/theme preferences. The scattered home quick-action shortcuts were removed only from the real app; the approved developer gallery stays unchanged.

### Read-only Staging evidence at investigation time
- Staging project: `zgcvumykzivsvnlflbyp`, no Production change.
- `v31_captain_applications`: 6 rows (5 drafts, 1 submitted), showing that some registration data was saved.
- `v31_captain_documents`: 0 rows. The private Staging document Storage bucket also contained 0 objects.
- `v31_trip_requests`: 0 rows. Published `v31_routes`: 0 rows.
- Private Storage bucket upload policy permits authenticated owners with draft/rejected applications; bucket is private with 5 MB limit for JPEG/PNG/PDF. This metadata inspection is not a real-device Storage acceptance test.

### Required acceptance after these fixes
- Use the same authorized Android Google session on the **new exact-SHA Staging preview**. Upload four real allowed test documents, check each of four progress increments, refresh and verify documents still appear, then submit and verify status via a read.
- Search an unmatched origin/destination and choose Weekly or Monthly; confirm a request and verify it appears in the Passenger's own requests after refresh and in the database. Do not fabricate a published Captain offer or reservation.
- Verify the physical-left drawer, close/Back behavior, role permissions, AR/EN and Light/Dark across 360/390 widths, with no button overlap.
- Run local/CI automated tests and distinguish synthetic MOCKED test success from authenticated Staging browser success. This follow-up and Phase 02 remain **BLOCKED** on real-device acceptance until observed.
