# v3.1 Atomic Seat Reservation — 2026-11-15

## Implemented in connected Supabase
- `public.v31_bookings` stores rider, route, seat count, pending/confirmed/cancelled/completed state and unique rider-scoped idempotency UUID.
- Client users have **SELECT of their own bookings only** via RLS. No direct write grants.
- `public.v31_reserve_seats(route_id,seats,idempotency_uuid)` is an authenticated-only, tightly scoped SECURITY DEFINER RPC. It reads `auth.uid()`, locks the target route row `FOR UPDATE`, confirms it is published, rejects a captain booking their own route, checks pending plus confirmed reserved seats and inserts a **pending** booking if capacity permits; no payment is implied. Concurrent bookings on the same route serialize on the route lock.
- UI helper `web/src/v2/reservations.ts` wraps the RPC but is **not wired to complete payment or open booking** until end-to-end reservation checks and lifecycle screens are ready.
- All calls with the same rider/idempotency key return the same booking (or reject changed arguments). Do not generate a new key on retry of the same request.
- Monetary transactions, payment confirmation and actual OTP **remain OFF**.

## Verification performed
- Checked `v31_bookings` RLS is enabled.
- Checked `authenticated` has no INSERT or UPDATE grant on `v31_bookings`, only SELECT, and has RPC EXECUTE.
- Verified route locking appears in the deployed function.
- No real bookings inserted during verification. New reservations start as **pending**, never confirmed automatically.

## Required before production reservations
1. Run database integration and concurrency tests with isolated test accounts and test route, including parallel last-seat races, insufficient capacity, idempotency, rollback and cancellation.
2. Implement server-controlled cancellation and release, booking lifecycle states, reliable inventory display and separate payment evidence.
3. Test existing Google-to-first-booking path. OTP is postponed and must not block booking; browser storage must never be used for authentication proof.
4. Review SECURITY DEFINER routine as privileged API; Supabase security advisor warns because signed-in users can invoke it intentionally. Audit `auth.uid()`, object ownership, arguments, `search_path`, error handling and grants.
5. Verify notifications, retries and business rules before enabling public booking.

## Security advisor
The advisor may flag `authenticated_security_definer_function_executable` for this intentionally authenticated RPC, plus the separate password-leak-protection setting. Treat the former as an explicit privileged-function review item, not a green security check.
