# SeKKa actionable feedback and flow audit

**Scope:** source-level review of the available React application plus a limited browser walkthrough of public signup. This is a partial audit, not a claim that every control or authenticated flow was exercised. Business rules remain governed by `سِكّة PRD v1.0`; Stitch exports are visual references.

## Findings and changes

| Priority | Area | Finding | Change / disposition | Verification |
|---|---|---|---|---|
| High | Login and password recovery (`web/src/screens/AuthScreen.tsx`) | “Forgot password?” was only shown after a failed login when an Arabic error string matched exactly. It could disappear for English users or alternate server error text. | Always show the recovery link on the login form. It opens the existing phone + Telegram recovery flow; no backend contract changed. | Browser verified in English and Arabic, including transition to recovery form. No credentials submitted and no recovery request sent. |
| High | Captain verification (`web/src/screens/CaptainWorkspace.tsx`) | A rejected verification state described the issue but did not give a direct way to request a human review. | Add a clear support action with a prefilled review subject using the existing support email channel. | Source fix. Authenticated rejection state was not available for safe browser testing. |
| High | Expired captain grace period (`web/src/components/VerificationCenter.tsx`) | Expiry message did not clearly explain the recovery steps. | State that both documents must be uploaded, then provide a support action to request reactivation. Existing document upload remains available. | Source fix. No production documents were uploaded. |
| Medium | Grace-expiry warning layout (`web/src/styles.css`) | Warning styling assumed a paragraph-only layout, so adding a CTA needed spacing support. | Apply grid spacing and reset paragraph margin in the warning container. | Lint, typecheck, and production build passed; authenticated visual state not browser tested. |
| Medium | Action/error audit | No broad no-op click handlers were found in the searched application source. Retry controls are present on reviewed data-load error states. | No speculative refactor made. | Static source inspection only; not a runtime check of every action. |

## Screen and action coverage

| Screen / flow | Key actions reviewed | Status |
|---|---|---|
| Public landing | Sign-up/navigation link | Browser verified navigation to registration. |
| Registration | Role selection, password visibility, terms/privacy dialogs, consent gate | Browser verified in mobile viewport; no account was submitted or created. |
| Login and password recovery | Phone/password form, recovery entry point, Telegram recovery flow | Source inspected; password recovery link made consistently visible. No credentials submitted and no OTP requested. |
| Captain verification | Upload steps, review/pending/rejected/expired states, support actions | Source inspected. No authenticated captain session or real document upload used. |
| Rider workspace and search | Search, saved places, request/ride state and retry affordances | Source inspected. User-specific backend actions not exercised. |
| Captain workspace | Publish/review/accept/pause, assigned rides and retry affordances | Source inspected. No ride or payment state changed. |
| Admin workspace | Overview refresh and account/action surfaces | Source inspected. No admin mutation exercised. |
| Messages and notifications | Conversation, message, notification navigation and polling | Source inspected. No real messages or notifications changed. |
| Settings, profile, navigation, empty/error states, PWA notices | Controls and recovery affordances | Source-level inventory only; exhaustive per-control runtime verification remains outstanding. |

## Browser walkthrough notes

- Local Vite app was opened at a mobile-sized viewport with light theme and reduced motion.
- Registration role switching, password visibility, reading both policy dialogs, and enabling consent after reading were exercised.
- The registration form was not submitted to avoid creating a real Supabase user.
- Login form was viewed in English and Arabic; recovery entry opened the recovery form in both languages. No credentials were submitted. Authenticated-only captain, rider, and admin flows could not be safely exercised without dedicated test accounts/data.
- External email links and Telegram recovery were not opened or sent.

## Remaining validation

1. Completed: lint, TypeScript check, production build, PWA checks, and all 217 existing server/SQL tests passed.
2. Completed: browser verified recovery entry in Arabic and English; stopped before sending an OTP.
3. With dedicated non-production accounts, exercise captain rejected/expired verification recovery and the critical rider, captain, and admin flows.
4. Add browser automation for signup consent, password recovery entry, verification expiry/rejection, and each role's critical actions. Existing automated tests do not prove full end-to-end behavior for these screens.

No Supabase schema or production data, dependencies, Git history, remote branch, or deployment configuration were changed. The 10 protected brand asset checksums still match.
