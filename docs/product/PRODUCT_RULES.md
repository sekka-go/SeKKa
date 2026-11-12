# Approved product rules

Authority: `PRD.md` and owner replacement instruction, 12 November 2026.

- Fixed-route subscription marketplace. No on-demand trips, dispatch, attendance GPS, no-show penalties or per-ride purchases.
- PRIME 3 / SAVER 4 / SPACE 9 / MAX 13. Published seats may be below capacity. No alternative category labels.
- Weekly = seven calendar days; monthly = calendar month from original cycle anchor. End exclusive. Sunday–Thursday minus approved Egyptian holidays. No 22-day cap.
- Proration = full cycle price × remaining eligible operating days / total eligible days, nearest EGP. Round trip counts a service day once.
- Cairo local 00:00:00–00:00:59 can begin today; at 00:01:00 use next eligible day. Start and dates never user-overridable at booking. Server quote is snapshotted.
- EGP 100 refundable security is separate from the FULL subscription paid directly to captain on first service day. It is neither revenue nor discount.
- Rider paid declaration precedes captain receipt. Both required before single release. One declaration is not financial confirmation. Disputes do not create forfeiture.
- Seat and balance reservations are atomic and idempotent. No funds API activation before partner/policy approval.
- Public discovery without login; auth needed for bookings, favorites, messaging and route demand. Captain/vehicle verification before route publication. Staff capabilities are server-assigned.
- Renewals, cancellation/timeout policy, financial operations, legal text and official calendar require unresolved decisions. Do not substitute sample data as approval.
- Phase-three offer terms are read-only: captain-defined duration, direction and full-cycle price carry from results/details into booking. Rider never chooses new terms in summary. Proration changes the payable amount according to eligible days, not the captain's published terms.
- Approved phase-three screen IDs are 16 summary, 17 security, 18 confirmation, 19 subscription, 20 rider paid, 21 receipt follow-up, 22 management. The EGP 100 is never subtracted from captain payment.

## Owner update: map74
Public screen IDs and stages follow SCREEN_INVENTORY.md and SCREEN_SPECIFICATIONS.md.
Screen13 and conversations require an owned committed booking. Public discovery never
returns captain identity or identifying vehicle fields. Captain onboarding is36–42;
route management is43–50. Wallet top-ups must be at least EGP100; the available balance
itself may be below100. Both dark/light layouts are supported. Screens6/7 are profile
completion/permissions, not a success screen/password signup screen.
