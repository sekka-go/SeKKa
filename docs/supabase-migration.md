# Supabase backend migration status

Project: `seKKa` (`uorxfakceqnhxqnaawdy`). The project was confirmed active and empty before the first migration. No schema or functions from the unrelated Elnarges project were used.

## Applied migrations

The repository's `server/migrations/001–013` are SQLite scripts. They were reviewed and converted into one atomic PostgreSQL baseline because the target project had no data or migration history. Applying those SQLite files verbatim to PostgreSQL would fail.

- `20261001000000_postgres_baseline.sql`: auth/session, captain, booking/matching, trip/payment ledgers, pool categories/groups/members/subscriptions/trips/stops/cancellations, escrow, notifications, and push-subscription tables; catalog seeds; database role guards; append-only ledger guards; RLS enabled with no grants for browser roles.
- `20261001000001_backend_security_indexes.sql`: indexes for foreign keys and a service-role-only policy on each backend table.
- `20261001000002_auth_rate_limit.sql`: atomic login/password rate-limit storage and RPC.
- `20261001000003_pool_deadline_processor.sql`: PostgreSQL deadline processor, with a `pg_cron` job scheduled every minute.
- `20261001000004_deadline_scheduled_trips.sql`: covers unstaffed trips that remain `scheduled` as well as `needs_captain` after departure.
- `20261001000005_captain_otp_feature_flag.sql`: adds an RLS-protected, service-role-only OTP switch, defaulting to disabled.
- `20261001000006_app_feature_flags_security.sql`: adds an explicit service-role policy and index for the feature flag audit actor.

All seven migrations were applied successfully and verified in the Supabase migration history. OTP is disabled by default. A review found that the first deadline query skipped trips still marked `scheduled`; the additive fourth migration corrected this without changing or deleting data. A first attempt at the baseline failed before applying; the project remained empty, the quoting defect was corrected in GitHub, and the corrected migration applied successfully.

The old predictable development admin password was deliberately not copied. Create an admin account through a controlled operator process; never use the previous default password in a live environment.

## Deployed function

`supabase/functions/sekka-api/index.ts` is deployed as the active `sekka-api` Edge Function. Gateway JWT verification is disabled because the handler validates the application's opaque session token against `public.sessions` on every protected request. Database tables are accessible only through server-side credentials; no secret key is present in the repository or browser bundle.

The active `sekka-api` Edge Function includes admin-controlled captain phone OTP through Twilio Verify. OTP remains disabled by default, validates the signed-in captain's registered number, applies per-captain rate limits, and never returns or logs codes. The admin can enable it without redeploying once provider secrets exist. It implements health/config/catalog; account registration, login/logout, session and password changes; daily rider requests, matching, cancellation, trip history and disputes; pool groups, invitations, price decisions, seat completion, day/package cancellation, waiting decisions, notifications and push-subscription registration; captain profiles, pool preferences/offers, trip acceptance, stop order/arrival/completion/absence and legacy trip lifecycle; and admin captain review, pricing, payment dispute resolution, and analytics.

The deadline processor runs in PostgreSQL through the named `pg_cron` job `sekka-process-pool-deadlines`, once per minute. It notifies groups at 72 hours and records cancellations/refund entitlements when unstaffed service dates pass. Payment capture and actual refund execution remain disabled.

## Web client connection

The web API client keeps local development on the same-origin `/api` proxy. Hosted builds default to the confirmed SeKKa Edge Function URL:

`https://uorxfakceqnhxqnaawdy.supabase.co/functions/v1/sekka-api`

Set `VITE_API_BASE_URL` only when overriding that endpoint. `VITE_SUPABASE_PUBLISHABLE_KEY` is also optional because the project's public `sb_publishable_...` key is a non-secret fallback in the client. Never put a Supabase service-role key in frontend variables. The Cloudflare build does not need a manual API URL setting for the confirmed SeKKa project.

## Operator setup still required

The reviewed migrations and backend deployment are complete. The latest hosted frontend build succeeded and defaults to the confirmed SeKKa Edge Function URL. These runtime integrations still need operator configuration:

- **Private routing:** deploy an OSRM-compatible service reachable from Supabase Edge Functions and set `SEKKA_ROUTING_URL` as an Edge Function secret. The loopback default is for local development only and cannot be reached from hosted Supabase. Do not use a public router unless the owner explicitly approves sending rider coordinates there.
- **OTP:** the Twilio Verify integration is implemented and the database flag is disabled. Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` as Supabase secrets, then enable OTP through the admin panel when desired.
- **Web Push delivery:** public-key lookup and subscription registration/removal work; the Edge Function does not send push messages yet. In-app notifications remain available.
- **Admin access:** no predictable admin password was seeded into this project. Provision an administrator through a controlled process and do not reuse development credentials.
- **Payments:** collection, settlement and real refunds remain deferred; the API records calculations and pending ledger entries only.

The Cloudflare preview confirms that the latest frontend commit builds. It does not replace live route-by-route testing after private routing and operator credentials are configured.
 
## Rollback

Supabase applies each migration transactionally; a failed migration leaves no partial DDL. The first failed attempt was checked and left no tables. The manual rollback at `supabase/rollback/20261001000000_postgres_baseline_001_013.sql` refuses to run if any user or operational rows exist. It drops only this SeKKa schema, not Supabase Auth/Storage or unrelated project objects. Supabase's migration history is append-only; rollback must be coordinated with a database snapshot and migration-history repair by the operator.
