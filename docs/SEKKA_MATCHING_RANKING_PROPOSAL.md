# SeKKa Rider Matching Review and Proposal

Updated: 2026-10-30
Status: proposal only; no ranking policy is approved by this document.

## Confirmed product behavior

The supplied product instruction establishes discovery and recommendation: the system may search and present compatible captain offers, while the rider decides which offer to pursue. A result is not a captain's agreement, a booking, or a promise that a trip will happen. Creating a daily search request must not assign a captain.

## Current implementation found

- `POST /rider/lines/search` is an authenticated, read-only search contract. It receives `vehicle_type_id`, `trip_date`, `arrival_time`, pickup/drop-off coordinates, and optional return time.
- The deployed handler considers active captain lines in the requested vehicle class and service day, uses configured route radius and arrival-time window, estimates remaining seats from matched demand groups, returns at most 20 candidates, and currently sorts by the sum of pickup and drop-off distance.
- It adds captain name and a `captain_verified` boolean after candidate calculation. Unapproved captains are therefore still present in the API response; the web client now fails closed and hides candidates unless `captain_verified === true`.
- Search results do not prove seat reservation. The UI's candidate selection currently calls `POST /rider/demand-requests` without a captain-line ID. That operation creates a general demand request; it does not request to join the displayed line. The UI must not present it as a specific-captain selection.
- `POST /rider/requests` creates a separate daily-commute request containing category and route coordinates only. It has no day, time, or passenger count, and no candidate-search operation is connected to that request.
- Database inspection found a `BEFORE INSERT` guard that checks captain role and an open request. `trg_matches_create_trip` inserts a trip and two stops, then changes the request to `matched`. The trip's current default is `in_progress` at creation. There is no observed atomic captain-eligibility check or unique-match guarantee in this trigger body. RLS on requests and matches is backend-only.

## Ranking policy proposal (not adopted)

Keep mandatory compatibility checks as hard filters: active offer, approved/active captain, requested vehicle class, service day, configured time tolerance, route radius for both endpoints, and enough unreserved seats. For remaining candidates, rank by the existing transparent route-distance sum (pickup distance + drop-off distance), then arrival-time difference, then stable line ID as a deterministic tie-breaker. Do not expose a numerical compatibility score or weights.

This proposal retains the deployed route-distance ordering and adds deterministic tie-breakers. It is not an approved product decision. No client-side reordering or score was added.

## Decisions and backend gaps still requiring resolution

1. **Daily request input contract:** whether the separate daily request should add day, time, passenger count, and service class, or whether candidate search remains only on `/rider/lines/search`. Current table and endpoint lack the first three fields. Adding them requires an approved schema/API change and migration on a staging database first.
2. **Candidate policy:** approve or revise the proposal above, including existing route/time thresholds and maximum candidate count. Their live values and current `LIMIT 20` are implementation details, not a documented product decision.
3. **Specific offer selection:** no verified endpoint accepts a selected `captain_line_id` to create a rider join request. `/rider/demand-requests` is not that operation. Define the server contract and status lifecycle before enabling a “select this captain” action.
4. **Eligibility filtering:** the deployed search API must filter unapproved or inactive captains before returning candidate details. Client-side filtering is defense in depth only and does not prevent API disclosure.
5. **Match trigger lifecycle:** decide whether a recommendation/selection should create a trip. Current match trigger creates an `in_progress` trip immediately, which is unsuitable for a mere search result. A schema/function change is required before using it for candidate discovery or pre-booking.
6. **No-results / retry / expiry:** define whether requests remain open, how long, and when/how the system retries. No expiry or retry policy was confirmed.
7. **Concurrent capacity:** a read-only search can become stale. Seat reservation must be rechecked atomically in the authorized join operation; discovery results alone cannot reserve a seat.

## Safe implementation in this batch

- The rider client now displays only API-confirmed approved captains, candidates with sufficient returned seat availability, and the selected vehicle category; duplicate line IDs are collapsed while retaining server order.
- Added isolated unit tests for those display guards.
- No API endpoint, schema, RLS policy, trigger, production data, ranking order, or automatic captain assignment was changed.

## Release gates

The server-side eligibility filter, a specific-offer join contract, atomic capacity check, and corrected trip lifecycle require a staging backend source/project. No positive-path E2E result can be claimed until disposable rider and captain accounts are available in staging.
