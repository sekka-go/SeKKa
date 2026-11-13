# seKKa v3.1 — Frontend Gap Audit (initial, evidence-based)

Authoritative product requirements: [PRD v3.1](./PRD.md). This is an initial code/document inspection, **not** a validated 73-screen completion report. No real wallet/payment or deployment changes have been performed.

## Confirmed deviations

| Priority | Source path | Observed | Required |
|---|---|---|---|
| P0 | `SCREEN_IMPLEMENTATION_TRACKER.md` | 78-screen inventory and v2/v1 sources | Reconcile to the v3.1 73-screen / 8-stage functional inventory |
| P0 | `docs/product/PRD.md` | v1 PRD; permits captain identity before commitment and rider-selected offer options | Replace active authority with v3.1; keep v1 historical until migration is fully verified |
| P0 | `docs/product-spec/SeKKa_Master_PRD_MVP_v2_AR.md` | Legacy v2 active-looking spec | Historical only; remove active references |
| P0 | `docs/product-spec/SeKKa_Master_Screen_Map_MVP_v1_AR.md` | Different screen taxonomy and scope | Historical only; migrate map references |
| P0 | `web/src/screens/RiderTripsScreen.tsx` | Category labels Prime/Daily/Space/Max; API response type includes `captain_name` | PRIME/SAVER/SPACE/MAX; conceal identifying information before booking |
| P0 | `web/src/styles/sekka-theme.css` | Brand tokens use green and different yellow, background | Align to approved v3.1 yellow/black/light/dark tokens while preserving component contrast |
| P0 | `web/src/App.tsx` | Legacy route and titles map: receipt, payment proof, payment-code, grouped journeys | Reconcile navigation to v3.1. Do not delete routes blindly |
| P1 | `web/src/screens/RiderTripsScreen.tsx` | Search and direct request/API activity are intertwined | Show 'اطلب رحلة' only following zero matches; prefill review form; simulation only in this phase |
| P1 | `web/src/App.tsx` and CSS | Arabic titles hard-coded | Localize application strings, persisting independent system/manual language and theme |
| P1 | `web/src/lib/rider-matching.test.mjs` | Existing matching tests only | Add flow, stop order, return mapping, privacy, calendar/proration and preferences tests |

## Key structural findings

- `web/` is a React 19 + TypeScript 6 + Vite 8 SPA; navigation in `web/src/App.tsx` derives views from paths and role.
- A set of large journey components handles many logical screens. File count is **not** a screen count.
- The repository currently contains a Pages Functions API proxy and Supabase-connected code. Preserve these while keeping the present PRD implementation phase frontend-only.
- Existing Supabase project contains real tables and records; never reset it to match mock-only assumptions.
- Existing Cloudflare Pages project is `sekka-go` with production branch `main`. Do not deploy this work automatically.

## Prioritized implementation checklist

- [x] Install provided v3.1 verbatim as `docs/PRD.md` on an isolated GitHub branch.
- [x] Record confirmed deviations and keep historical specs intact pending content migration.
- [ ] Fully enumerate 73 functional screens and map each to actual views/actions/states.
- [ ] Replace references to legacy authorities in trackers and project documentation.
- [ ] Correct category terminology, privacy, request gating and rider stop selection.
- [ ] Implement round-trip automatic reversal with eligibility checks.
- [ ] Implement mock-only booking-security/payment acknowledgement state machine.
- [ ] Implement Cairo-aware subscription calendar and proration with tests.
- [ ] Add persistent independent system/manual theme and locale, RTL/LTR and translations.
- [ ] Verify navigation and responsive UX for every functional screen.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build` from `web/` in an executable checkout.

## Historical information needing separate disposition

Earlier documents include operational details, API contracts, legal pages, and backend security context not necessarily duplicated in v3.1. Preserve as historical references until reviewed individually; do not import conflicting behavior into v3.1 or delete source code.

## Verification limits

Connector-based inspection was performed; no local build, test suite, browser E2E, or deployment has been executed. No screen is marked fully compliant solely because its component exists.
