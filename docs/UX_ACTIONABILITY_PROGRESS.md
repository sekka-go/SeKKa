# seKKa v3.1 — UX actionability verification (ongoing)

Canonical product rules: [PRD v3.1](PRD.md).
Review branch: `rebuild/subscriptions-navigation-fix-20261114`, based on the unfinished PR #168 (not production).

This is **targeted functional review**, not certification that all 73 screens or all 359 currently indexed controls are usable.

## Inspected / implemented

| Feature / screens (public IDs) | Finding | Change | Evidence |
|---|---|---|---|
| Captain chats (56–57) | Refreshing a conversation pushed another browser-history entry and broke Back | Refresh in place; demo thread/messages survive reload within session | `web/src/v2/CaptainOperations.tsx`; `web/e2e/prd31.spec.ts` |
| Rider favorites (13) | E2E wrongly expected a removed favorite to reappear after switching dark → light | Assert persistence of the user's removal | `web/e2e/replacement.spec.ts` |
| Captain route management (49) | Paused offers had no way to resume new bookings | Add Resume CTA and retain available seats from moment of pause, strictly as mock state | `web/src/v2/CaptainRoutes.tsx`, `web/src/v2/Discovery.tsx`, `web/e2e/prd31.spec.ts` |
| Save offer and discovery errors (12–13) | Guest could see a login/error message without direct next action | Add sign-in/create-account CTA for guest favorite; retry action on failed save; return-to-search action on loading failure | `web/src/v2/Discovery.tsx` |
| Booking summary (15) | Sign-in prerequisite showed copy but no actionable link beside it | Direct sign-in/create-account CTA through navigation preserving original query context | `web/src/v2/BookingFlow.tsx` |
| Booking security (16) | Insufficient wallet balance offered unavailable top-up with no direct path to inspect wallet | Add Review wallet action; top-up remains explicitly disabled until provider and policy approval | `web/src/v2/BookingFlow.tsx`, `web/e2e/prd31.spec.ts` |
| Subscription management (21) | Cancellation-warning dialog instructed contact support without direct action | Add Write review request to focus the existing form; guest requires sign-in CTA | `web/src/v2/BookingFlow.tsx`, `web/e2e/prd31.spec.ts` |
| Wallet transaction history (26) | A filtered-empty result had no direct reset | Show all transactions action | `web/src/v2/WalletFlow.tsx`, `web/e2e/prd31.spec.ts` |
| Rider chats and notifications (29, 31) | Empty filtered results made recovery harder | Clear search and Show all notifications actions | `web/src/v2/AccountFlow.tsx`, `web/e2e/prd31.spec.ts` |

## Verification

- At baseline commit `d6ca5ebcb8459b3165bff6ee6d031fa7ea252272`, CI [43639364609](https://github.com/sekka-go/SeKKa/actions/runs/43639364609) passed lint, typecheck, unit tests, production build and **28 browser E2E tests**.
- Newer fixes are **not** considered passed until the latest GitHub Actions run for the final branch commit succeeds.
- Tested UX is **mock frontend only**. There is no real authentication session, wallet funding, captain messaging persistence or payment.
- Independent screen-by-screen visual inspection, all interactive states, accessibility and complete localization still require further acceptance.

## Next prioritized acceptance passes

1. Check all 73 screens in Arabic RTL and English LTR, both themes, at small mobile viewport; maintain itemized evidence rather than marking a screen complete from its existence.
2. Execute guest/rider/captain/admin flows; inventory each warning, modal, empty state and blocked submission for its contextual next action.
3. Verify all Back actions, Android browser back gestures, draft preservation and recovery after authentication/profile completion.
4. Reconcile mock state snapshots across subscription renewal, wallet transactions, captain subscribers and admin dashboards.
5. Document backend-dependent gates separately; never simulate real paid transactions or claim production persistence.

**No merge to main, deploy, database writes or real finance operations.**
