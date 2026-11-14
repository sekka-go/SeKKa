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
- [x] Baseline updated E2E suite on CI (18/18 at `3f9a44a`); local browser launch blocked by host socket restrictions. Further translation tests are tracked separately.

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

Typecheck, lint and production build passed locally. All 37 domain/historical PostgreSQL tests passed (17 domain + 20 historical database tests; not evidence of backend integration). All 18 browser E2E tests passed in GitHub Actions run 43526866452, including 73 guest entries, failed-search request reuse, stop selection, theme/language persistence and captain offer publication. Browser-dependent E2E cannot launch locally (`socket() failed: Operation not permitted`). No claim of full translation or all-screen acceptance.

## Localization continuation

Added an explicit English catalog and translated onboarding 1–7 plus rider account/communication 29–34, including accessibility names, support copy and dates. User-entered names and messages remain unchanged. All 73 browser page titles have English counterparts. This is partial localization: other stage content remains to translate, and full visual acceptance is still outstanding. Added browser tests for unsupported locale fallback, English onboarding, draft retention across language changes and captain settings persistence.

## Booking simulation continuation

An interactive search-to-booking preview now stores a cloned offer, selected stops and calculated quote in session storage on confirmation. Its separate virtual EGP 100 security requires both simulated acknowledgements to release and repeated confirmations cannot duplicate the release. Pure domain tests cover snapshot independence, insufficient balance, capacity and both acknowledgement orders. Direct screen-review fixtures remain explicitly illustrative. This session-only state is **not** a real reservation, durable database or wallet; captain operations and wallet overview still use separate fixtures and need consolidation before full acceptance. The preview uses the documented fixed fixture date/calendar, not a claim of approved current holidays.

Localization CI run 43527334833 passed all checks including 21 browser tests. The booking interaction test also passed in run 43527661792: all 22 browser tests and 40 domain/historical database checks passed at `98bbffac`.

Historical decisions and phase completion reports were also moved into `docs/archive/pre-v3.1/`. Current `DECISIONS.md` and `IMPLEMENTATION_STATUS.md` now describe only v3.1 implementation status. Other useful historical engineering documents carry explicit non-authoritative labels.

### Cross-stage preview state

Interactive bookings are now visible to the demo captain with their locked price, period, selected stops and payment status. The captain acknowledges receipt on public screen 55. Rider screen 20 reads the resulting status; wallet balances and transaction history derive from the same session ledger. Unused demo galleries keep their sample fixtures when the session has no interactive bookings.

### Interaction review checkpoint

The reproducible TypeScript source inventory (`node web/scripts/audit-controls.cjs` from the repository root) lists 354 control declarations, including conditional disabled states and implicit/form actions. It is a source index, not evidence that every possible action has been exercised.

- Favorites now links unauthenticated riders to registration and empty saved lists to search. Direct request-review entry without an eligible search links back to search.
- Registration/profile prerequisites retain the originating query and provide a return action. Captain route fields and unpublished stop input survive navigation and reload in the same browser session. Successful publication clears the draft; failed persistence keeps it for retry.
- Incomplete publication links to the relevant missing step. Automated coverage includes return from favorites sign-in and captain draft reload, back navigation and missing-stop recovery.
- Outstanding: exhaustive bilingual acceptance, app-wide preservation of in-progress forms across prerequisites, mock OTP/resend and provider-dependent submit states, and exhaustive role-by-role failure/retry auditing. Frontend simulations cannot validate real payment, identity or multi-user concurrency.

English wallet retry and amount preservation passed in CI run 43577020386 alongside the existing browser suite. Captain onboarding screens 35–41 now render English form labels, vehicle categories, document names and review states. Independent bilingual visual verification and role-wide interaction testing remain open.
