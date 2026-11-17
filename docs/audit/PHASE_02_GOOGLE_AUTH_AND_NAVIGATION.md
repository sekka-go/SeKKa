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
