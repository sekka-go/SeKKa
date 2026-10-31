# SeKKa — Completion and Cleanup Report

**Date:** 31 October 2026
**Worktree:** isolated `integration/sekka-stable` worktree
**Base:** `origin/main` plus the inspected `codex/sekka-ui-rebuild` integration; no merge commit created.

## Completed in this batch

- Unified captain offer price and payment-method validation in a shared helper used by the captain form and both Edge Function write routes (`POST /captain/lines`, `PUT /captain/lines/{id}`). The API now requires the captain-entered seat price and passes it explicitly to the existing RPC; route distance remains an independent field.
- Captain and rider offer screens label the price as one trip per seat. Monthly subscription amounts are not derived from it. A subscription request is not represented as an active subscription, and the screens remain explicit that no subscription read endpoint is currently available.
- Added support and consistent wording for `wallet` as an external electronic wallet. The UI states payments happen directly between the parties and SeKKa does not hold funds.
- Added a separate, unapplied pricing migration preserving legacy RPC signatures. It removes per-kilometre constraints for captain-line offers, validates the allowed direct payment methods, rejects existing missing/invalid seat prices before changing constraints, and does not rewrite offer rows. It enforces a non-null seat price after the fail-safe preflight.
- Compared the migration’s target columns, constraint names, trigger name, and four RPC overload signatures with read-only metadata from the correct Supabase project (`uorxfakceqnhxqnaawdy`). The live catalog matches the migration’s preflight. A read-only aggregate showed one existing captain-line row, with zero missing and zero non-positive seat prices; no row values were read or modified.
- Added web and Deno pricing tests and included them in the existing test commands.
- Added the approved pricing decisions to the decision log and included the updated PRD 6.1 document without removing other recorded decisions.
- Removed `web/src/auth-login-screen-two.css`, `web/src/lib/use-vehicle-types.ts`, and the obsolete captain home component/style after confirming no active imports or route usage. The legacy login stylesheet and separate pool fare behavior remain intact.
- Added a web `package-lock.json` to make the declared dependencies reproducible and enable `npm audit`.

## Validation

- `npm run typecheck` — passed.
- `npm test` — passed, 11/11 tests.
- `npm run build` — passed; main JS bundle 372.04 kB (107.02 kB gzip).
- `deno task check:edge` — passed.
- `deno task test:edge` — passed, 22/22 tests.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `git diff --check` — passed.

These tests are local unit, type, build, and source-contract checks. They do not establish a successful authenticated staging or production write.

## Remaining blockers and boundaries

- The pricing migration has not been applied or executed against a staging database. Although read-only live metadata and aggregate preflight checks currently match, SQL execution, trigger behavior, and authenticated writes still need testing in a separate safe environment before application.
- No authenticated account tests were performed. Captain offer create/edit, real payment-method persistence, and rider search display still need safe staging accounts.
- Subscription management remains blocked by missing API read/write contracts; no mock subscription data was introduced.
- Admin `pricing_config` and pool fare calculations remain isolated. They were not deleted or repurposed because they are separate backend surfaces and the approved change only retires kilometer-based pricing for captain-line offers.
- The security gate still reports historical secret-shaped values in prior Git history. Values were not disclosed; no history rewrite was attempted. The latest user instruction authorizes a branch push and Preview deployment; the four historical findings remain visible to GitHub Actions and still require credential rotation/revocation and an owner-approved history plan.
- At the time this report was first prepared, no Production database changes, Edge Function deployment, Cloudflare deployment, merge commit, push, or commit had been performed. Follow-up delivery status is recorded below.

## Current integration state

Changes are in the separate integration worktree for review. The source worktree and its local files were not reset or cleaned. The unapplied migration is `supabase/migrations/20261031150000_captain_line_pricing_phase1.sql`; do not apply it until the live-schema preflight is independently confirmed in a safe staging environment.

## Follow-up delivery

Pending at report creation; update this section after the requested branch push and Cloudflare Preview verification.
