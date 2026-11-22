# v3.1 backend transition status

As of 2026-11-15, Supabase project `uorxfakceqnhxqnaawdy` has been reset from the legacy application schema, without modifying managed `auth` or `storage` schemas.

## Deployed (database)
- `v31_profiles`: Google-authenticated users create/read/update only their own profile; authorization remains independent of user-editable role preference.
- `v31_captain_profiles`: self-enrollment is pending-only; captain approval cannot be self-updated.
- `v31_service_areas`: nine initial Cairo/Giza districts; active-area read for anonymous and authenticated clients.
- `v31_routes`: draft-only captain insert/update and published-only public read, category/seat/time/price constraints.
- `v31_route_stops`: ordered stops with access governed by route visibility/ownership.
- RLS enabled on every exposed table; security advisor showed no notices after migration.
- Legacy `sekka-api` Edge Function replaced by a JWT-protected 410 (retired) response; do not reuse.

## Not yet live
- Production Google OAuth requires dashboard provider credentials, authorized redirect URLs and safe public environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Publishing routes needs server-validated approval, 2+ distinct stops, pickup/drop-off ordering, and an atomic publishing operation. **The browser cannot publish directly yet.**
- Live search, passenger requests, bookings, role security, subscription calculations, notifications and admin actions need v3.1 APIs and tests.
- OTP/mobile sign-in, actual refundable security payments, payment gateway, and real wallet operations are deferred. Never simulate a completed monetary transfer as real.
- The legacy Storage bucket `verification-documents` still contained 11 old objects at last inspection. Delete these through the Storage API/dashboard, not direct SQL edits to storage metadata.

## Release guardrails
Do not merge or ship production until end-to-end auth callback, RLS permissions, user consent, account lifecycle and role authorizations have passed tests. Avoid paid Supabase branches or other metered APIs without checking cost.
