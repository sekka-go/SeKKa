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
