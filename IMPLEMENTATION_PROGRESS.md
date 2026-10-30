# MVP product decisions implementation

## Adopted behavior

- New rider demand remains open until the rider chooses a published captain line; automatic captain assignment has been removed from the SQLite API and Supabase Edge API.
- Platform commission is fixed at 0% for new records. Existing ledger rows are preserved. Package discounts remain separate from commission.
- Completing a trip no longer records payment as if received. The captain must explicitly confirm the actual amount received after completion.
- New and migrated captain accounts use Prime (3), Daily (4), Space (9), or Max (13). Private-car profiles map to Daily and HiAce profiles map to Max; service categories and pricing rows migrate accordingly. Legacy vehicle-type rows remain only for foreign-key/history compatibility, and historical trip records are not rewritten.

## Changed files

- `server/src/finance/*`, `server/src/routes/*`, `server/src/trip/lifecycle.ts`: local API behavior.
- `server/migrations/015_mvp_no_commission.sql`: guard new SQLite ledger entries.
- `supabase/functions/sekka-api/index.ts`: hosted API behavior.
- `supabase/migrations/20261028215727_align_mvp_product_decisions.sql`: hosted DB defaults, commission guard, explicit payment RPC, and disable automatic demand matching.
- `supabase/tests/mvp_product_decisions.test.sql`: pgTAP coverage.
- `web/src/screens/CaptainWorkspace.tsx`, `web/src/components/AdminControlPanel.tsx`, and locale files: payment confirmation UI and fixed commission display.
- `server/migrations/016_vehicle_classes.sql`, `supabase/migrations/20261029153000_add_vehicle_classes.sql`, and registration/search screens: four approved classes and seat validation.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (201 passed), `pnpm build`, and `git diff --check` passed.
- GitHub Actions: project quality, security, routing, and Supabase database/pgTAP checks passed on PR #143.
- Local `supabase test db` could not connect because Docker Desktop was unavailable; pgTAP passed in GitHub Actions.

## Remaining rollout work

- The published-line selection screen exists, but its current CTA still enters the legacy group-creation flow. A rider-selected line is not yet persisted as a line-specific join request. Do not describe selection/join as fully implemented until this workflow is connected end-to-end.
- Applied both Supabase migrations to project `uorxfakceqnhxqnaawdy` and deployed Edge Function `sekka-api` version 61. Verified `/config` returns Prime 3, Daily 4, Space 9, and Max 13.
- Cloudflare Pages production serves the merged build (`/assets/index-eprgweBN.js`); its HTML and JS return HTTP 200 and include the new vehicle classes.
- Local untracked brand files (`web/src/components/SikkaMark.tsx`, `SikkaSplash.tsx`, `web/src/light-theme.css`) were preserved and are outside this implementation; they are not referenced by the current app.

## Current rebuild pass — rider-selected line requests (2026-10-29)

### Screen and workflow audit

- Added [`docs/SCREEN_MAP.md`](docs/SCREEN_MAP.md), a route/role map based on the live `NavKey`, path guards, and screen components. It covers public/auth, rider, captain, admin, shared sections, and known gaps; it is not a claim that all MVP behavior is complete.
- Kept two rider concepts separate: published captain lines are searchable offers; rider demand requests are submitted only when the rider needs coverage. This directly fixes the previous UI handoff that turned a chosen published line into an unrelated legacy pool-group flow.

### Implemented locally

- Added `captain_line_join_requests` with RLS and API-only table access, route/date/stops validation, 3 pending-request limit and configurable 12-hour expiry. The configured pickup/drop-off tolerance defaults to 500 m.
- Added server-side create/list/decision endpoints for riders and captains. Captain acceptance locks the published line row and checks accepted seat reservations for the selected date and direction before accepting, preventing concurrent over-capacity acceptance. A rider’s accepted line prevents subsequent line edits. The route offer action now creates a real selected-line request, and the two role workspaces show the request and captain decision. Outbound and return legs are offered independently with reversed route stops and the correct time.
- Added captain/rider notifications for new and decided line requests.
- Added `supabase/tests/captain_line_join_requests_security.test.sql` for authorization, ownership, seat-capacity, and accepted-line guards. It has **not** been executed because Docker Desktop/Supabase local is unavailable.

### Remaining scope and release status

- Current line requests cover one selected service date. They are not a recurring weekly/monthly subscription, do not create an existing `trips` occurrence, and are not connected to the full direct-payment lifecycle. Therefore the full rider-to-captain subscription flow is still **partial**.
- The older pool/group offer path remains in the captain workspace and old records remain supported. Removing or migrating historical pool data was not part of this local schema addition.
- The new migration and Edge Function changes are local only. No Supabase production migration, Edge deployment, Pages deployment, PR merge, or other production mutation occurred in this pass.
- Validation after the implementation changes: `pnpm lint`, `pnpm typecheck`, `pnpm test` (201/201), `pnpm build`, `deno check supabase/functions/sekka-api/index.ts`, and `git diff --check` passed. Supabase local status is blocked by the unavailable Docker Desktop Linux engine, so the new pgTAP test and migration remain unverified by Postgres execution.

## Follow-up cleanup — product decisions and fallback requests (2026-10-29)

### Implemented in the current working tree

- Rider-created fallback requests stay open and separate from published captain rides. A suitable ride now produces an actionable notification and a home suggestion; neither trigger assigns a captain or changes the request/group to `matched`.
- New fallback requests cluster only with other open fallback requests. They are no longer attached to legacy groups already assigned to a captain.
- New captain-published rides accept only captain-set seat prices and cash/InstaPay. The old automatic 7–11 EGP/km pricing constraint is removed in a forward migration; the legacy `price_per_km` column stays for schema compatibility and is set to zero for new/updated rows.
- New ride/request forms use the four approved vehicle classes and their configured capacities. Legacy type IDs remain in the database for historical foreign keys but are not offered in new forms.
- The rider no-results copy now clearly separates (1) a published ride the rider can request to join from (2) a fallback request that receives suggestions the rider may choose.
- The rider's nearby-trips empty state now has a direct **Create ride request** action and opens the request form with the known starting point prefilled.
- Added a pgTAP assertion for notification-on-suggestion while keeping the demand open and unassigned.

### Current validation

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (201/201), `pnpm build`, `deno check supabase/functions/sekka-api/index.ts`, locale JSON parsing, and `git diff --check` all passed after these changes.
- The new Supabase migration and pgTAP test are not applied locally yet. The previous local reset attempt failed because Docker Desktop's Linux engine was unavailable. Do not treat the DB changes as execution-verified until database tests run.
- No production migration, Edge Function deployment, Pages deployment, commit, or push was performed in this pass.

### Deliberately preserved

- Existing matched demand groups, old vehicle-type foreign keys, and past payment/ledger rows remain readable; they are historical data and are not rewritten or deleted by this cleanup.
- The older pool/commute feature remains available for its existing trip records. It is separate from the new published-ride request flow. Removing it would require a distinct product/data migration beyond retiring the conflicting new-ride behavior.
- Existing untracked `SikkaMark.tsx`, `SikkaSplash.tsx`, and `light-theme.css` files remain untouched.

## Mobile preview refinement — 2026-10-30

- Made the development-only rider screen map behave like a mobile app at narrow widths: the desktop sidebar is hidden, a five-item fixed bottom navigation appears, and the hero, map illustration, search controls, and spacing use phone-sized proportions.
- Replaced the preview's text-character brand mark with the unchanged original SeKKa logo asset.
- Suppressed the PWA installation prompt only on development `/redesign-*` preview routes so it does not cover the preview navigation or screen content.
- This is a preview-shell improvement only. It does not complete the 24 rider screens, connect preview forms to real data, or count as production UI delivery.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (201/201), `pnpm build`, and `git diff --check` passed. Final screenshot verification was interrupted by the browser screenshot tool after HMR; the page DOM was inspected at 390×844 and confirmed to contain the new bottom navigation and original logo.
- Figma screen creation remains incomplete: the original file is view-only, and the new file's screen-building call failed due to a font API error; subsequent retries reached the Starter-plan MCP call limit. The new file currently contains only its reference capture and design-system pages.
