# Current implementation decisions

Authority: [vNext owner-approved changes](product/RECURRING_COMMUTE_VNEXT_20261121.md) for recurring UX/map/brand only. [PRD v3.1](PRD.md) remains the legacy baseline for unresolved subscription, payment, vehicle and reporting decisions. No production rollout is authorized.

- Preserve React, TypeScript, Vite and existing official icon geometry; recolor the original mark only. The new identity uses warm violet/coral/yellow, with external name Sekka Go and in-app name سِكّة.
- Keep stable internal view IDs behind the 73-screen public registry. Captain identity belongs inside post-booking subscription details.
- Theme and language are independent: device defaults, persistent manual override, instant application. Settings remain in rider 32 and captain 60.
- Monthly calculations end at the end of the starting calendar month, not the anniversary date. Cairo time and approved eligible-day rules remain mandatory.
- This task is frontend-only. Authentication, real booking inventory, financial providers and production backend operations remain disconnected.
- Local preview booking snapshots are session-only simulations. They cannot authorize real transfers or prove a real booking.
- Full English coverage and consolidated cross-stage preview state are still incomplete; see the [current audit](PRD_V31_AUDIT.md).

For the 2026-11-21 owner change, follow the vNext document only where it explicitly overrides v3.1. Pending financial/subscription/disclosure policies require separate written decisions; code must preserve existing behavior until then.
