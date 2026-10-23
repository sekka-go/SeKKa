# Step 1 — Audit report

**Status:** Initial audit complete; follow-up implementation and repository checks are being recorded below.
**Date:** 2026-10-23 (initial audit), follow-up 2026-10-24.
**Repository at initial audit:** `sekka-go/SeKKa`, branch `design/messaging-experience`, HEAD `e75225a` (upstream tracking branch was gone).
**Application:** SeKKa.

## What was produced

- `docs/migration/gap-analysis.md` — stack/source-of-truth findings, SYSTEM GAP status for PRD §§5–12 and acceptance criteria 1–16, conflicts, 80-screen Stitch mapping, and proposed order/size.
- `docs/migration/logo-assets.md` and `docs/migration/logo-checksums.txt` — protected brand inventory and SHA-256 baseline.
- `docs/migration/OPEN_DECISIONS.md` — the six undecided items from PRD §16; no decisions were assumed.

## Changes and verification

- Only these five audit documents were added. No application source, brand asset, migration, or production setting was changed.
- Logo source files, PWA icons, manifest and referencing HTML were hashed; listed files were not regenerated or edited.
- Tests/build/lint/typecheck were not run during the initial audit-only pass; follow-up results are recorded in the completion addendum below.
- Follow-up confirmed the production Supabase project and read-only advisor/grant details; complete migration-to-schema reconciliation and backup verification remain outstanding.
- No migration, commit, push, PR merge, or deployment was performed.

## Main findings

1. Production frontend defaults to Supabase Edge. README identifies Express+SQLite as an older local-development model; do not treat it as a second production source of truth.
2. Current roles are rider/captain/admin, not passenger/captain/supervisor/admin/owner; core settings and role-granting do not yet match the owner model.
3. The active fare calculation is route-distance/time based, while PRD requires captain-entered full-vehicle price with server-enforced bounds and seat-price flooring. Stitch’s 7–11 value is a separate conflict; PRD v1.0 remains behavior source of truth.
4. Current pool flow can move to `minimum_met` and create trips/subscriptions before the PRD’s full-capacity plus final-captain assignment/payment conditions.
5. Captain withdrawal/replacement at five days, rider exit after completion at 48 hours, server-time 45-second payment confirmation, owner governance, and full categorized support ticketing are missing or materially different.
6. Stitch lists 80 IDs but export lacks SCR-08 and SCR-72, adds `sekka_1..4` references, and includes product ideas excluded by PRD. See mapping and conflicts.

## Outstanding / next action

The master prompt authorizes reversible implementation but not production writes. Read-only Supabase checks and a frontend polling improvement were performed; no migration or deployment was authorized/performed. No claim of production readiness is made.

## Follow-up implementation and verification — 2026-10-24

- Updated `web/src/screens/MessagesWorkspace.tsx`: polling pauses while the page is hidden, runs without overlapping requests, refreshes conversations every 20 seconds, fetches contacts only on initial load/manual conversation refresh, and polls the open conversation every 10 seconds. The read-receipt RPC is no longer called on every poll; it runs when opening a conversation or when a poll finds unread incoming messages.
- Updated `docs/migration/gap-analysis.md` with production source-of-truth clarification and read-only Supabase findings. RLS advisor notices are not treated as confirmed exposure because checked client roles have no table `SELECT` grants. No policies or indexes were changed.
- `Supabase`: no writes, migrations, Edge Function deployment, or destructive action. Edge runtime logs and backup state were not available/verified.
- `Git/Cloudflare`: no commit, push, merge, or deploy. 5,000-user capacity is not demonstrated; no load test was run.
- Validation: `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS (217 tests, 65 suites); `deno test --allow-env --allow-read supabase/functions/sekka-api` PASS (18 tests); `pnpm --filter web exec vite build --configLoader native` PASS; `pnpm --filter web check:pwa` PASS; `pnpm audit --prod` PASS (no known vulnerabilities); `git diff --check` PASS; protected brand checksum check PASS (10/10).
- No web browser E2E test was run; existing automated web tests are not configured. No production write/load test was run.
- Current published Supabase Free quotas are documented in the gap analysis. The project's actual billing tier/current usage was not visible, so zero-cost operation is not verified. Illustrative message-poll workload is ~270k API invocations/month at 100 DAU × 10 minutes/day, and ~1.35m at 500 DAU; at 5,000 simultaneous messaging sessions the estimated polling peak is ~750 requests/second. These are sensitivity cases, not measured forecasts.
- Supabase Free lacks downloadable database backups and may pause after a week of inactivity. No recovery procedure was tested. Cloudflare Pages Free documents up to 500 builds/month and one concurrent build; this does not establish backend capacity.
