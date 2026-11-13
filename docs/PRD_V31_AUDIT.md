# PRD v3.1 synchronization — audit and execution checklist

Status: **in progress**, not fully compliant or release-ready.
Authority: [PRD.md](PRD.md), preserved byte-for-byte from the owner attachment.

## Architecture discovered

- React 19 / TypeScript / Vite; entry `web/src/main.tsx` renders `v2/App.tsx`.
- URL `screen` plus public/internal adapter (`screenMap.ts`); component-local React state; phase-specific fixtures.
- Shared Tajawal, original logo/reference assets, yellow/dark/light CSS. Hardcoded RTL and Arabic strings remain across components.
- Historical Supabase client/API/SQL exist despite UI-only product status. The active client now returns null; no new endpoints, migrations or finance activation were added.
- No complete translation catalog existed. Preferences now have independent system/manual choices, local storage and device listeners. **This is not equivalent to translating every screen.**

## Priority checklist

- [x] Read all of attached PRD v3.1 before editing.
- [x] Preserve canonical document at `docs/PRD.md` and archive verified older PRDs/maps.
- [x] Public registry: exactly 73 unique IDs, standalone captain details merged into public 18.
- [x] Monthly frontend cycle ends at first day of next month (exclusive); retain Cairo cutoff, service days, holiday coverage and rounding checks.
- [x] Request action only after search with zero matching offers; review reuses input and duplicate confirmation is disabled; no booking/wallet write.
- [x] Published fixture stops, eligibility/order checks, automatic validated return reversal, pass selection to booking summary/details.
- [x] Independent device/manual preference state; controls in rider 32 and captain 60, persistent keys from PRD.
- [ ] Complete all application-owned English strings, localized date/amount formats, accessibility names and LTR visual acceptance.
- [x] Replace route wizard placeholders with local stop authoring, single fixed price/period/direction, capacity validation, approval simulation, publication and pause. Full UI acceptance still pending.
- [ ] Shared preview booking snapshot persisted through reload, robust seat/security simulation and renewal.
- [ ] Validate each of 73 screens against complete functional acceptance (see screen inventory).
- [ ] Full updated E2E suite on CI; local browser launch blocked by host socket restrictions.

## Archived instead of discarded

`docs/archive/pre-v3.1/` contains prior `product/PRD.md`, screen inventory/specifications, `SCREEN_MAP74_REVIEW.md`, and old product-spec PRD/screen map. Other useful historical engineering documents are explicitly labelled historical. Git retains all originals.

Old documents contain backend designs, migration/runbook details, pricing anchors, policy proposals and earlier auth decisions not approved by v3.1. They remain historical; none were silently merged into the new PRD. In particular, older SQL monthly anniversary calculations are not the approved frontend month-end rule and must be redesigned in a future backend task.

## Open details and dependencies

- The official holiday source is still open in the supplied PRD. Preview calendars are explicitly unapproved fixtures; real calculations must fail closed outside approved coverage.
- Weekly proration needs the published cycle anchor; preserve the existing explicit anchor input pending an approved default policy.
- Android/iOS targets are specified; current deliverable remains web UI, not a claimed native build.
- Authentication, role authorization, uploads, atomic inventory, ledger, financial provider, notifications, chat persistence and admin audit persistence are backend-dependent and disconnected.
- This audit does not claim all historical legacy APIs are retired or production cutover complete.

## Executed checks

Typecheck, lint and production build passed locally. All 37 domain/historical PostgreSQL tests passed (17 domain + 20 historical database tests; not evidence of backend integration). Registry uniqueness E2E passed. Browser-dependent E2E could not launch locally (`socket() failed: Operation not permitted`); CI verification pending. No claim of full translation or all-screen acceptance.
