# SeKKa migration and deployment recovery

**Scope:** upcoming release branch migrations and Cloudflare Pages deployment. This is a recovery procedure, not evidence that a backup was created or restoration tested.

## Recovery prerequisites and current status

- A remote `pg_dump` was attempted for Supabase project `uorxfakceqnhxqnaawdy` on 24 October 2026. It failed before creating a dump because this network cannot connect to the database's IPv6 endpoint (`LegacyDbConfigIpv6Error`). No dump file exists.
- Before any production database write, obtain an IPv4-compatible Supabase connection (the project's connection pooler) and database password through the Supabase dashboard/secret manager, then create and verify a private full database dump outside the repository. Do not paste the password into chat, a shell history, or a tracked file.
- A SQL dump does not include Storage object contents. The 11 synthetic verification objects must be separately exported to a private encrypted backup location before making a production change that depends on restoring them. Preserve bucket IDs, object paths, metadata, MIME type, and access policies.
- A restore has not been rehearsed. Do not claim point-in-time recovery on the Free plan. If a restore is needed, restore to an isolated project/database first and validate it before any cutover.

## Frontend and Edge Function rollback

1. Stop the release sequence if the Cloudflare Pages preview or production smoke check fails.
2. If the bad build is live, use the Cloudflare Pages deployment rollback control only if it is available for this project and confirms the prior successful production deployment. Otherwise, prepare a Git revert commit for the release merge commit and merge it through a reviewed PR so the Git-integrated Pages deployment returns to known source.
3. If the Supabase Edge Function was deployed, redeploy the exact previously captured `sekka-api` source version after confirming the database remains compatible. Do not overwrite runtime secrets or disable authentication checks.
4. Verify health, login/signup, policy-acceptance recording, and the affected workflows after rollback. Record deployment IDs and actual results.

## Migration-specific compensation

All migrations below are additive or privilege-tightening. The normal compensation is to roll the application code back while keeping safe schema and audit history. Do not drop data-bearing tables or delete accepted-policy records as a routine rollback.

| Migration | Change | Safe recovery / compensation |
|---|---|---|
| `20261023225118_release_security_privileges.sql` | Removes direct `service_role` execution from the demand-match helper; trigger functions continue the match path as their owner. | Keep the revoke in place. If matching fails, repair the trigger/backend path and test it; do not re-grant arbitrary direct execution as a shortcut. |
| `20261024000000_policy_acceptance_audit.sql` | Adds the append-only policy acceptance table and atomic signup RPC. | Roll back the Edge/API and UI together if signup fails. Leave the table, RPC, and recorded rows in place while repairing compatibility; preserve consent evidence. |
| `20261024000100_policy_acceptance_privileges.sql` | Restricts the acceptance table/identity sequence to read-only access for `service_role`; signup writes through the definer RPC. | Keep the restriction. If signup fails, repair the definer RPC ownership/grants and retest. Do not grant direct table or sequence writes to the API role. |

Migrations are transactionally applied by Supabase CLI in CI and should fail atomically on DDL error. On a production migration error, stop the deployment and inspect the actual migration history and schema before retrying. Never edit or delete a row in `supabase_migrations.schema_migrations` to force a retry. If the migration completed but application deployment failed, deploy/restore compatible application code and leave additive schema intact.

## Data safety

- Do not run `DROP TABLE`, `TRUNCATE`, destructive `ALTER`, account deletion, or bulk Storage cleanup during release rollback.
- Keep user-account, ride, payment, consent, and audit data intact. Any data repair must be a separately reviewed, idempotent forward migration with a verified pre-change backup.
- Test-only status was confirmed by the project owner on 24 October 2026. This does not replace a backup or restore test.
