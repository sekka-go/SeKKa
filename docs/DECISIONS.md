# Current implementation decisions

Authority: [PRD v3.1](PRD.md), 73 screens across eight stages. These notes record implementation choices; they do not change the PRD.

- Preserve React, TypeScript, Vite and existing official assets.
- Keep stable internal view IDs behind the 73-screen public registry. Captain identity belongs inside post-booking subscription details.
- Theme and language are independent: device defaults, persistent manual override, instant application. Settings remain in rider 32 and captain 60.
- Monthly calculations end at the end of the starting calendar month, not the anniversary date. Cairo time and approved eligible-day rules remain mandatory.
- This task is frontend-only. Authentication, real booking inventory, financial providers and production backend operations remain disconnected.
- Local preview booking snapshots are session-only simulations. They cannot authorize real transfers or prove a real booking.
- Full English coverage and consolidated cross-stage preview state are still incomplete; see the [current audit](PRD_V31_AUDIT.md).

[Historical decisions](archive/pre-v3.1/DECISIONS.md) are retained for context only and are superseded.
