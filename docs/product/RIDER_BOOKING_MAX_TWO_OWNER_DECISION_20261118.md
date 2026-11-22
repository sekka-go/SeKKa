# seKKa — Owner decision: maximum two people per rider (18 Nov 2026)

**Status:** New explicit owner requirement; authoritative over earlier unrestricted seat counts in PRD v3.1. **Implementation scope:** current Draft PR #185, staging only until release approval.

## Business rule

- Each rider/account may reserve **one or two seats**, never more than two seats for the same published route across concurrent active (`pending` or `confirmed`) bookings.
- The Captain's vehicle category/capacity (`PRIME`, `SAVER`, `SPACE`, `MAX`) remains unchanged; this limit is on a **single rider account**, not the full vehicle.
- A genuine no-match Passenger trip request likewise allows **one or two seats**, not three or more.
- The accepted-offer conversion also creates a booking, so it is subject to the same server-side limit.
- Idempotent retries must not consume additional seats. Completed/cancelled bookings do not count as active reservations for this cap.
- Existing historical request rows remain intact. Do not silently rewrite or delete any existing row, including rows created before this rule with larger seat counts. A legacy request that still asks for >2 cannot become a new booking until its requested number is brought into compliance through an owner-approved workflow.
- This restriction is **server enforced**, not only an HTML input maximum. The frontend shows a localized, actionable limit message.

## Implementation evidence

- Frontend shared constant: `web/src/v2/reservations.ts` (`MAX_SEATS_PER_RIDER = 2`). Enforced in both reservation RPC wrappers, `V31BookingJourney`, `LiveRouteSearch`, and `LiveTripRequests`.
- Staging Supabase: migration `supabase/migrations/20261117231135_v31_limit_two_people_per_rider.sql` (deployed with migration name `v31_limit_two_people_per_rider`). A `v31_trip_requests` trigger rejects new inserts or seat updates above two; a `v31_bookings` trigger rejects bookings with >2 seats, and serializes against the locked route before counting the same rider's existing active bookings on that route.
- Real database proof: read-only inspection found **0** existing bookings, **4** trip requests with **2** legacy requests above two seats. These historical requests were **not modified**. Transactional temporary-table probes confirmed newly submitted requests accept 1 and 2, reject 3, and bookings reject 3. The probe transaction was rolled back.
- Browser regression: `web/e2e/admin-authorization-mocked.spec.ts` verifies the no-match rider form restricts max=2, disables submission on 3, and submits 2 using isolated mock data.
- The older CI run [44192345153](https://github.com/sekka-go/SeKKa/actions/runs/44192345153) failed three **menu-related** E2E assertions (two drawer visibility, one old five-buttons count) before this change. The navigation semantics and those tests were corrected here. Recheck current-HEAD CI; do not claim it passed until the workflow finishes.

## Acceptance still needed

- **Actual Google-authenticated Staging:** attempt to book 1, 2, and 3 seats on a real published route and try a separate booking that would increase the active total above 2. Confirm backend rejection; verify cancel-and-rebook.
- **Passenger request:** attempt 3 (blocked), request 2 (stored and read back), and confirm accepting a legacy >2-seat offer cannot create a new noncompliant booking.
- Current Staging has no published Captain route, so live reservation E2E is **blocked** until a real approved Captain publishes a route; do not create fake users or routes or claim mock tests as real acceptance.
- No OTP, wallet or payments; no Production writes or deployment; no merge.
