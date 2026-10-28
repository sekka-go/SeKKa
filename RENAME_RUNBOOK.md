# SeKKa Rename Runbook

## Current state

- Working branch: `rename-sekka`.
- Supabase project configured in `supabase/config.toml`: `uorxfakceqnhxqnaawdy` (currently listed as active project `seKKa`). No Supabase development branches are attached to this project.
- Database staging target: **not available yet**. Do not run DDL, storage mutations, function deployments, or migration commands against the configured hosted project until the owner identifies/creates staging.
- A read-only catalog inventory was run against the connected production project on 2026-10-10: 52 public tables, all 52 with RLS enabled; no legacy `sikka` names among relations, routines, types, triggers, policies or storage buckets; no routine definition contained the legacy spelling. The recorded migration head is `20261010043804` (`20261010120000_foreign_key_performance_indexes`). No production data or schema was changed.
- Docker-based local rehearsal was skipped by user direction; online catalog inspection was used instead. The Docker data move to D: is not a prerequisite for this read-only inventory.
- Production backup/PITR point before a database change: **not recorded; no hosted database changes have been made**.
- This branch has not deployed or merged any database changes.

## Staging preflight

1. In Supabase Dashboard, select the `seKKa` project, then use the branch selector in the top bar to create/select a dedicated development branch. Leave **Include data** off unless the owner explicitly requires copied user data. Supabase preview branches isolate Database, Auth, Storage and Realtime; they incur usage-based compute, disk, egress and storage charges. See [Supabase branching](https://supabase.com/docs/guides/deployment/branching) and [branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching).
2. Record the staging branch name, project ref, API URL, database version, and the exact migration-history head in this document before testing. Keep branch credentials in local secret storage only.
3. Create/use a Supabase backup for the source production project before any production schema change. Dashboard path: **Project → Database → Backups**. Record the latest recoverable timestamp (include timezone) and backup type below. For PITR, record the latest point shown in the dashboard. Supabase database backups do not include Storage objects; copy/verify those separately before any bucket deletion. See [Database Backups](https://supabase.com/docs/guides/platform/backups).
4. Apply every new migration to staging first, then run Supabase SQL tests, RLS checks, Edge Function tests and app tests. Record results below. Never run manual dashboard DDL; apply reviewed migration files.
5. Before production rollout, re-check the recorded backup/PITR point and take a fresh backup immediately before the first production migration. Record the exact time and operator.

## Backup record

| Environment | Backup type | Exact timestamp (UTC) | Dashboard evidence / identifier | Operator |
|---|---|---|---|---|
| Production | Pending | Not taken for this task | Not applicable; no database changes made | Pending |
| Staging | Pending branch | Not applicable | No branch exists yet | Pending |

## Migration and rollback ledger

No rename database migration has been created or applied. Static inspection of checked-in Supabase migrations shows existing SQL object identifiers already use lowercase `sekka` prefixes. The live catalog, storage buckets, policies, cron jobs, and publication membership remain unverified until a staging database is available.

For every migration added later, record:

| Migration | Staging applied / tests | Production backup point | Production applied | Matching rollback |
|---|---|---|---|---|
| None yet | Pending staging access | Not recorded | Not applied | None |

Rollback procedure: apply that migration's matching script from `supabase/rollback/` on staging first; verify RLS, grants, triggers, Realtime and app tests; then use the same reviewed rollback against production only if the recorded recovery point is still valid. If a rollback would lose user or Storage data, stop and use the separately reviewed PITR/object-restore plan instead.

## Client/PWA state migration

Current code and service-worker keys already use lowercase `sekka` prefixes. No client-state key rename was necessary in this pass, so no cache-clearing migration or service-worker version bump was made. If a staging/live inventory finds an old spelling, copy the value/cache to its new key first, validate session and offline behavior, then remove the old key and bump the cache version in the same verified release.

## Production rollout checklist

- [ ] Staging ref and credentials recorded; production and staging project refs verified distinct.
- [ ] Full DB backup/PITR timestamp recorded immediately before DDL.
- [ ] Storage object counts and total bytes backed up/verified before any bucket switch or deletion.
- [ ] Reviewed forward and rollback migrations tested on staging.
- [ ] RLS, grants, functions, triggers, Realtime publication, cron and security/performance advisors checked.
- [ ] Edge Function deployment name, JWT verification, CORS and all callers verified on staging.
- [ ] App build, typecheck, lint, unit/security tests and end-to-end flows pass on staging.
- [ ] Production changes have an explicit rollout window and a fresh backup point.
- [ ] Post-rollout smoke tests pass; old names removed only after stored objects and clients are verified.
