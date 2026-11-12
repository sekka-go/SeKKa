# Decisions

- 2026-11-12: Current owner instruction and checked-in `docs/product/PRD.md` supersede historical trip/ride models. PRIME 3, SAVER 4, SPACE 9, MAX 13.
- Preserve React/Vite; PRD section 14.2 explicitly calls framework choices proposals. Avoid introducing a Next.js runtime migration into the Pages cutover.
- Use a private new schema and a single invoker public API wrapper into a narrowly granted private definer dispatcher, fixed empty search_path and explicit auth.uid ownership checks. Clients get no direct new-table grants; RLS is enabled on every new table. Service access is not based on editable user_metadata.
- Canonical dates are ISO civil dates; cycle end is EXCLUSIVE. Monthly boundaries always derive from the original anchor, clamping to month end without drift. This deterministic implementation convention must be reviewed in acceptance.
- Server timestamp is authoritative. Browser previews never set booking start dates, price, or user id. Submitted quote must match server recomputation; idempotency keys cannot be reused with different route/period/direction.
- Route row locking protects inventory across weekly/monthly overlaps and direction legs. Ledger account locking prevents simultaneous reservations from overspending a wallet. Lock order is account before route/booking.
- Price rounding is exact numeric half-up to whole EGP. A price rounded to zero is permitted; security is still independent EGP 100.
- No holiday dates invented. Admin-approved coverage plus official source is required; pricing fails closed outside coverage. Fixtures are clearly TEST ONLY.
- New legal terms, real-money processing and renewals are disabled until approvals. A second active captain route is conservatively blocked until schedule-duration overlap policy is defined; not described as implemented multi-line support.
- Existing official logo file is reused unchanged. New numbered screen map is a shared UI registry, not a claim that 75 journeys have passed acceptance.

- 2026-11-12 phase-one reference batch: owner explicitly chose appearance-only for password/Google/Facebook registration. SMS, OTP verification, registration and social-provider linking remain disabled. Screen 06 is now a labeled success-state design and screen 07 a registration design; no identity state change is implied.

- Phase two: owner replaced 11/12 with 1000636594/1000636595. Period, direction and price belong to the captain's offer. Rider filters and chooses an offer; view 12 has no editable offer terms. Capacity rules override impossible seat counts in mockups. Supplied subscriptions view maps to screen 29. Stage three not started.

- Owner-approved phase three replaces 16–22 as documented in SCREEN_INVENTORY; 23 compatibility alias renders management. Extend established dark/light style without new reference images. Preserve captain-defined offer terms at handoff; do not reintroduce subscription selection.
- Real top-up and booking reservation remain disabled pending existing provider/policy/holiday/auth launch blockers. Preview actions cannot submit financial writes. Receipt release UI requires both declarations and no dispute; missing confirmation/attendance never forfeits security.

- Phase four continues the existing wallet/account map with screens 24–30, retaining 23 as an alias. The owner requested starting the next stage without new image references; extend established dark/light components. Money activation remains held. Screen 29 keeps its old explicit phase-two preview while the new phase-four gallery uses the wallet family.

- Owner wallet correction: label reserved security as «تأمين جدية الحجز», refundable and separate from the subscription. Minimum top-up is EGP 100; quick amounts 100/200/300. This is a top-up minimum, not a permanent available-balance floor (reservations can reduce available funds). Real money stays disabled; future provider/server integration must enforce the same minimum before credit creation.
