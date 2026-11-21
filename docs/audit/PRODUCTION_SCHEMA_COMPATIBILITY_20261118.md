# Production v3.1 schema compatibility — verified read-only audit

**Date:** 18 November 2026 · **PR:** #185 (Draft) · **Source HEAD observed:** `a574b0d7135b2cea73842f25801a9ab837b8101e`.

**Production:** `uorxfakceqnhxqnaawdy` · **Staging:** `zgcvumykzivsvnlflbyp`.

## Evidence and reliability

Compared the two Supabase projects with **generate_typescript_types**. Both
succeeded, despite Production database SQL, `list_tables`, and
`list_migrations` returning `28P01` password authentication failures.
Generated types are schema evidence, but **not** sufficient to verify grants,
RLS, Storage, SQL bodies, function overloads, or applied migration history.

Independently, Cloudflare `sekka-go` Production-configured preview builds
failed the read-only `production-release-preflight.mjs` with
`PRODUCTION_GATE_PUBLIC_CAPACITY_RPC_UNAVAILABLE: PGRST202`.
This establishes the public capacity RPC as unavailable through Production
Data API. The source was not merged and the live Production site was not
changed.

## Concrete schema differences

| Object | Production | Staging |
| --- | ---: | ---: |
| Tables prefixed `v31_` | 13 | 20 |
| Distinct type-generated `v31_` RPC names | 9 | 13 |

**Tables present in Staging type definitions but not Production:**

- `v31_captain_applications`
- `v31_captain_approval_audit`
- `v31_captain_documents`
- `v31_vehicle_colors`
- `v31_vehicle_makes`
- `v31_vehicle_models`
- `v31_vehicle_service_categories`

**RPC names present in Staging type definitions but not Production:**

- `v31_create_vehicle_route_draft`
- `v31_published_route_available_seats`
- `v31_register_captain_document`
- `v31_submit_captain_application`

**Columns present in Staging but not Production definitions for shared tables:**

| Shared table | Staging-only columns |
| --- | --- |
| `v31_routes` | `vehicle_id` |
| `v31_trip_requests` | `direction`, `return_time` |
| `v31_vehicles` | `color_code`, `color_other`, `enabled_categories`, `make_id`, `manufacture_year`, `vehicle_model_id`, `vehicle_type` |

No Production-only column was observed among these shared tables. This is
not a comparison of constraints, indexes, security policies or SQL bodies.

**IMPORTANT:** Type generation does not enumerate every privileged or
overloaded RPC. Missing types do not prove absence of particular SQL
functions. Reconcile `v31_save_captain_application`,
`v31_save_captain_vehicle_intent`, and `v31_admin_decide_captain`
directly after restoring database access.

## Candidate migration sources — NOT Production-ready without review

- `20261115130000_v31_staging_captain_review.sql`: Captain application,
  private documents, review audit, Storage policies and related RPCs.
- `20261115150000_v31_mandatory_captain_registration.sql`: vehicle catalogs,
  vehicle/route/application columns, approval and publishing guards.
- `20261117183000_v31_captain_quality_document_upload.sql`: stricter
  private Storage policies, document validation and registration.
- `20261115110000_v31_staging_public_route_capacity.sql`: aggregate public
  available-seat RPC.
- `20261118015000_v31_rider_request_direction_and_duplicate_guard.sql`,
  `20261118015500_v31_rider_duplicate_guard_alias_fix.sql`: direction
  and duplicate constraints.
- `20261118115000_v31_roundtrip_booking_preserves_both_legs.sql`:
  check the latest booking flow's round-trip semantics.

These source files include **Staging-only** comments, replace policy/function
definitions and depend on each other. **Never replay them wholesale on
Production.** In particular, `20261115090000_v31_staging_catalog_reconciliation.sql`
is a full baseline reconstruction and explicitly MUST NOT be applied to
Production.

## Owner-authorized safe release sequence

1. Restore Supabase Production database-management connectivity and
   independently confirm read-only catalog and migration-history access.
2. Compare `supabase_migrations.schema_migrations`, constraints, grants,
   actual Production functions, RLS and private Storage with the approved
   Staging schema. Preserve all existing data and least-privilege rules.
3. Author small, forward-only, non-destructive reviewed migrations for the
   **confirmed missing** elements. Avoid replaying old baseline migrations.
4. Rehearse each migration on the existing safe Staging project or another
   cost-free isolated test environment without copying personal data.
5. Apply reviewed changes using the authorized migration tool. Verify
   real Postgres schema, PostgREST RPC reachability and RLS/Storage security.
6. Verify real Google-authenticated Captain Android 1/4 → refresh → 4/4
   upload, Passenger booking concurrency, and Admin authorization.
7. Require green exact-HEAD CI and successful Production-configured preview
   preflight before merging PR #185 to main. Verify the canonical Production
   deployment's SHA after merge.

## Unresolved blockers

- Production database SQL/migration inspection: `28P01`.
- Production capacity RPC through Data API: `PGRST202`.
- Seven type-generated tables, four type-generated RPC names, and multiple
  columns missing from Production relative to Staging.
- Real authenticated Android Captain upload: not yet accepted. The most
  recent Staging private bucket count was zero; mocked upload tests passing
  do not establish real upload functionality.

**Live remains at the last stable `f2bb7e9` release. No Production migration,
data edit, RLS relaxation, main merge or live deployment was executed.**
