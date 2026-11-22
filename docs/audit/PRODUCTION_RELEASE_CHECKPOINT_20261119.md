# seKKa — Production v3.1 forward release checkpoint
**Date:** 19 November 2026 · **Environment:** Production `uorxfakceqnhxqnaawdy` · **PR:** #185

## Scope and previous baseline

Historical source audit: `docs/audit/PRODUCTION_SCHEMA_COMPATIBILITY_20261118.md`.
At that time Production had 13 v31 tables, while Staging had 20. Management
SQL access was failing `28P01`, and Production-configured Cloudflare preview
failed with `PGRST202` for the published-capacity RPC.

**The database-management connection was restored on 19 Nov 2026.**
Production catalog and migration history were read successfully using the
connected Supabase management tools. The app branch remains unmerged.

## Forward-only migrations applied on Production

| Applied migration version | Name | Scope |
| --- | --- | --- |
| `20261119010339` | `v31_production_published_route_capacity_forward` | Read-only public aggregate of remaining seats for published routes; EXECUTE limited to anon/authenticated, PUBLIC revoked |
| `20261119010539` | `v31_production_captain_onboarding_documents_forward` | Seven missing tables, private 5 MiB document bucket/RLS policies, document-registration/approval and vehicle catalog/onboarding RPCs |
| `20261119010711` | `v31_production_rider_seats_direction_roundtrip_forward` | Two-seat rule, duplicate-request guard, direction/return fields and correct round-trip booking snapshot |
| `20261119010923` | `v31_production_notification_acknowledge_column_grant` | Idempotent re-grant of an **already existing** column-level privilege; NOT a previously confirmed bug fix |

The first three migrations were applied successfully and verified with
Production read-only catalog and aggregate queries. They were derived from
existing Staging-tested source migrations, reviewed for destructive DDL and
applied through the Supabase migration action. The first is a deliberately
narrow subset of the earlier Staging public-capacity migration. Exact source
is archived without automatic re-application in this PR's `docs/audit/production-applied/20261119*.sql` files. The existing Staging migration files remain the only source scripts in `supabase/migrations`; Production's applied migration history is maintained by Supabase.

### Data preservation verification

Before the onboarding migration: 6 `v31_profiles`, 3 approved Captain
profiles, 0 routes, 0 vehicles, 0 bookings, 0 trip requests, and 7 missing
catalog/application/document tables.

After the migrations: all 6 profiles and all 3 approved Captain records
remain. There are now 20 v31 tables and the expected private bucket. Zero
Production bookings/routes were changed or deleted. These are verified
aggregate counts; no personal account records were accessed for release.

## Verified schema parity (after migrations)

Read-only PostgreSQL catalog comparison of Production and Staging:

| Inventory | Production | Staging | Difference |
| --- | ---: | ---: | --- |
| v31 tables | 20 | 20 | 0 |
| v31 columns (name/type/nullability/default) | 157 | 157 | 0 |
| constraints (name/definition hashes) | 107 | 107 | 0 |
| indexes (name/definition hashes) | 38 | 38 | 0 |
| public v31 policies (name/definitions) | 37 | 37 | 0 |
| triggers (name/definitions) | 10 | 10 | 0 |
| v31 functions (name/signature/normalized definition) | 25 | 25 | 0 |
| v31 RPC privileges and SECURITY DEFINER flags | 25 | 25 | 0 |
| Captain private Storage policies | 2 | 2 | 0 |

Production private document bucket:
`v31-captain-docs-staging`, **public=false**, size limit **5242880 bytes**,
allowed types JPG/PNG/PDF. This bucket name is scoped to the Production
Supabase project, not a cross-project link. The documented SQL role
`anon` has no SELECT privilege on `v31_captain_documents`.

RLS/security advisor warnings now match between the two environments,
including protected Admin allowlist tables without direct client policies,
the published aggregate-capacity RPC, and reviewed SECURITY DEFINER
function entrypoints. These warnings require ongoing focused auditing; parity
is not a substitute for authorization tests.

**Role-grant difference:** 14 tables have differences in direct
`anon`/`authenticated` grants. Production generally retains stricter table
grants than Staging, which reconstructed a broad baseline. Do **not** blindly
copy Staging grants to Production. E.g. Production
`v31_notifications` already allowed `authenticated` to UPDATE
`read_at` at column level BEFORE the 20261119010923 idempotent migration,
while disallowing edits to `user_id` and DELETE/INSERT. This was NOT an
identified bug.

## Verified Cloudflare release-gate behavior

On a Production-configured `sekka-go` preview for
`2c86984a83bae01875a078f9b3e7ba495de84cf5`, build output confirms:

`PRODUCTION_READ_ONLY_PREFLIGHT_OK: correct Production project, 13 schema probes, capacity boundary, Google provider. No data modified.`

The preview succeeded without altering the canonical `main` site.
Separate Staging Cloudflare deployment also succeeded. Do not confuse
a preview with a live Production release.

The release gate itself was hardened on PR #185 to probe all zero-row
tables using GET (not HEAD, which previously masked missing relations),
and to fail closed on unknown 401/403/404 errors. Dedicated regression
tests were added.

## Unresolved release gates — DO NOT claim full acceptance

1. **Real Android / installed-PWA Google-authenticated Captain uploads**:
   still unverified. Requires an authorized real test login, 1/4 → refresh
   → 4/4 server persistence, and Admin-only document review. Mocked
   tests cannot satisfy this requirement.
2. **Authenticated security boundaries**: Captain A vs Captain B document
   access, Passenger access prohibition, server-authorized Admin review and
   unapproved Captain route publishing require real authorized sessions.
3. **Passenger critical journey**: real search, atomic booking and persisted
   result need safe authorized test data. No fake successful bookings.
4. **Exact latest HEAD GitHub CI and both Cloudflare deployments**:
   check workflow conclusions and verify deployed SHA before any merge.
5. **Release readiness**: PR #185 remains Draft. Do not merge into `main`
   or replace the canonical site until all these acceptance gates are met.

### Next assisted test

Use an authorized synthetic test JPG/PNG/PDF on the real Android Chrome/PWA
Staging Captain documents page. Record *only* safe diagnostic stage/code,
running and deployed short SHAs, and the 1/4 → refresh → 4/4 state. Do not
upload personal ID documents for a test or share JWTs, paths, filenames,
Google credentials, or document contents in chat.

**No Production user rows were deleted or reset. A successful database schema
migration is NOT evidence that real document uploads work.**
