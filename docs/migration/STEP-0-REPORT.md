# Step 0 — Safety baseline

**Date:** 24 October 2026 (Africa/Cairo)
**Status:** PARTIAL — data classification confirmed; required database and Storage backup not completed.

## Project and data scope

- Confirmed Supabase target: `uorxfakceqnhxqnaawdy` (`seKKa`, `eu-central-1`, Postgres 17.6, active/healthy).
- Read-only aggregate inspection found 8 users, 4 phone values matching an Egyptian mobile-number shape, 0 payment rows, 11 captain-verification rows, and 11 objects in the private `verification-documents` bucket.
- Names, phone numbers, and document contents were not returned or inspected. The owner explicitly confirmed that all current accounts, phone numbers, verification rows, and files are entirely synthetic test data.
- This confirmation is the basis for proceeding with the authorized test project. It does not establish that a tested backup exists.

## Backup attempt

- Attempted `supabase db dump --project-ref uorxfakceqnhxqnaawdy --file D:\SeKKa-private-backups\sekka-test-project-schema-20261024.sql`.
- Result: failed before file creation with `LegacyDbConfigIpv6Error` (“IPv6 is not supported on your current network”; CLI suggested linking the project to configure an IPv4 connection).
- **Dump:** not created. **Storage object backup:** not created. **Restore rehearsal:** not run.
- No database or Storage writes were made. Before the first production migration, establish an IPv4 pooler connection without exposing the DB password, create a private full `pg_dump`, separately export private Storage objects, record checksums outside Git, and verify that the dump is readable.

## Recovery procedure

`docs/migration/ROLLBACK.md` documents frontend/Edge rollback, compensation for each new migration, and data-preservation rules. Actual rollback and restoration remain unverified.

## Logo baseline

Protected source/manifest/icon inventory and the existing ten-file SHA-256 baseline are in `logo-assets.md` and `logo-checksums.txt`. Hashes are rechecked in CI before merge. The build command no longer runs the icon-generation script, so a build does not rewrite brand assets.

## Open blockers

1. Remote DB connection for a private dump: IPv4 pooler route plus database password entered only into Supabase CLI's secure prompt/credential storage.
2. Private Storage export for the 11 synthetic verification objects.
3. No database restore test has been completed.
