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
- `supabase test db --local` could not run because Docker Desktop's Linux engine was unavailable. No production migration was applied.

## Remaining rollout work

- The published-line selection screen exists, but its current CTA still enters the legacy group-creation flow. A rider-selected line is not yet persisted as a line-specific join request. Do not describe selection/join as fully implemented until this workflow is connected end-to-end.
- Apply the two pending Supabase migrations in order before deploying the Edge Function that calls `confirm_trip_payment`; then verify the hosted deployment and runtime.
- Local untracked brand files (`web/src/components/SikkaMark.tsx`, `SikkaSplash.tsx`, `web/src/light-theme.css`) were preserved and are outside this implementation; they are not referenced by the current app.
