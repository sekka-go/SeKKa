# Schema drift audit (2026-10-31)

## Source and safety

The linked Supabase project was `uorxfakceqnhxqnaawdy`. The schema was exported with `supabase db dump --linked --schema public` to a temporary file and compared against the repository migration `20261030133000_remove_legacy_captain_line_pricing_rules.sql`. The linked migration history was read with `supabase migration list --linked`.

No production schema, data, or migration history was changed. A regular `supabase db pull` was not used because the CLI documents that migration mode may record the pulled migration in the remote migration history. A local-only `npx supabase db reset` was later run against the local Supabase containers; no `--linked` flag was used.

## Confirmed differences

- The linked project reports dozens of remote migration versions that are absent from `supabase/migrations/`. The repository's `20261030133000` migration is present locally but absent from the linked project's migration history.
- Live `public.captain_lines` still has `captain_lines_price_per_km_check` enforcing 7-11, accepts `wallet` in `payment_methods`, and has a legacy seat constraint of 1-14. The local migration drops the per-kilometre constraint and changes pricing validation to captain-set `price_per_seat`, setting the legacy `price_per_km` to zero and allowing only `cash`/`instapay`.
- Live `public.enforce_captain_line_pricing()` reads `captain_line_price_per_km` from `app_config` and derives `price_per_seat`. The local migration replaces this with direct seat-price validation.
- Live `public.sekka_match_demand_group(integer)` is a no-op (`RETURN`). The local migration replaces it with matching and notification logic.
- `public.captain_line_join_requests` was not present in the exported live `public` schema. The local migration references it in `set_captain_line_status`, `update_captain_line`, and demand matching, but does not create the table.
- The live `publish_captain_line` signature does not take a seat-price argument. The local migration drops that legacy overload, but this migration does not add a replacement publishing overload.

This is a focused comparison of the objects touched by the current local migration, not a complete table-by-table schema reconciliation.

## Current local state

- `20260101000000_baseline_live_schema.sql` now exists before `20261030132000_create_captain_line_join_requests.sql`.
- `20261030132000` creates `captain_line_join_requests`, its constraints/indexes/RLS grants, and timestamp trigger.
- `20261030133000` consumes that table for line updates and demand suggestions.
- `20261030134000` adds the create/decide/cancel RPCs and the existing direct-message eligibility integration.
- Local-only `npx supabase db reset` successfully applied the baseline and all three later migrations in timestamp order.
- `supabase/tests/join_requests_test.sql` passed on the local Postgres database. `supabase/tests/join_requests_concurrency.sh` passed with two local psql sessions racing for the last seat.

## Production status

The earlier linked schema export still confirms that `public.captain_line_join_requests` is absent from production, and no production migration/function was applied or deployed in this task. Therefore the production schema remains behind the local implementation. Do not mark the production join-request feature complete until the schema and Edge Function are deployed through the approved staging/production process and verified there.

The focused comparison remains limited to objects touched by the current local migrations. No production reset, migration repair, or deployment was run.
