# Supabase backend migration status

Project: `seKKa` (`uorxfakceqnhxqnaawdy`). The project was confirmed active and empty before the first migration. No schema or functions from the unrelated Elnarges project were used.

## Applied migrations

The repository's `server/migrations/001–013` are SQLite scripts. They were reviewed and converted into one atomic PostgreSQL baseline because the target project had no data or migration history. Applying those SQLite files verbatim to PostgreSQL would fail.

- `20261001000000_postgres_baseline.sql`: auth/session, captain, booking/matching, trip/payment ledgers, pool categories/groups/members/subscriptions/trips/stops/cancellations, escrow, notifications, and push-subscription tables; catalog seeds; database role guards; append-only ledger guards; RLS enabled with no grants for browser roles.
- `20261001000001_backend_security_indexes.sql`: indexes for foreign keys and a service-role-only policy on each backend table.
- `20261001000002_auth_rate_limit.sql`: atomic login/password rate-limit storage and RPC.

All three migrations were applied successfully and verified in the Supabase migration history. A first attempt at the baseline failed before applying; the project remained empty, the quoting defect was corrected in GitHub, and the corrected migration applied successfully.

The old predictable development admin password was deliberately not copied. Create an admin account through a controlled operator process; never use the previous default password in a live environment.

## Deployed function

`supabase/functions/sekka-api/index.ts` is deployed as the active `sekka-api` Edge Function. Gateway JWT verification is disabled because the handler validates the application's opaque session token against `public.sessions` on every protected request. Database tables are accessible only through server-side credentials; no secret key is present in the repository or browser bundle.

The function currently implements health/config/catalog, registration/login/logout/session/password change, rider pool create/join/list and price decisions, notifications, captain profile/location/capabilities/offers/trips and completion, and admin captain verification.

## Remaining migration work

This is an in-progress port; it does not yet replace every Express route. Before calling the application fully migrated, port and verify package/day cancellation, remaining-seat reservations, captain-created invitations and stop reordering, legacy rider/captain trip and payment dispute routes, admin pricing/payment/analytics, Web Push, and the 72-hour deadline processor/action flow.

Pool route creation requires an operator-managed OSRM-compatible endpoint. The Edge Function reads `SEKKA_ROUTING_URL`; it defaults to loopback and returns a clear 503 when no remote private routing service is configured. Do not point it at a public router without the owner's privacy approval because rider coordinates would leave the project. Captain OTP also remains disabled until a real SMS/OTP provider is configured; the Edge Function does not expose OTP codes in responses or logs.

## Rollback

Supabase applies each migration transactionally; a failed migration leaves no partial DDL. The first failed attempt was checked and left no tables. The manual rollback at `supabase/rollback/20261001000000_postgres_baseline_001_013.sql` refuses to run if any user or operational rows exist. It drops only this SeKKa schema, not Supabase Auth/Storage or unrelated project objects. Supabase's migration history is append-only; rollback must be coordinated with a database snapshot and migration-history repair by the operator.
