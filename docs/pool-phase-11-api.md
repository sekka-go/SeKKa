# Commute Pool — Phase 11 API

All routes are under `/api`. Requests and responses use JSON. Authenticated routes require `Authorization: Bearer <session-token>`; rider, captain, and admin access is checked against the user role stored in the database.

## The rider flow

1. Read the four available categories from `GET /pool/categories`.
2. Start with `POST /rider/pool/groups`. The server first tries to add the rider to the oldest waiting group with the exact same category, package, dates, and times, provided both points are within 3 km of its road route and a seat remains. If none qualifies, it creates a group and returns HTTP 201; an automatic join returns HTTP 200 with `auto_matched: true`. Existing groups can still be joined by ID with `POST /rider/pool/groups/:id/join`.
3. For an existing group, a captain can instead create invitations with `POST /captain/pool/groups`. Each invited rider reviews the category and price, then accepts or declines with `POST /rider/pool/groups/:id/confirm`.
4. Faster routes start with two riders; Saver routes start with three. One rider can reserve all remaining seats using `POST /rider/pool/groups/:id/complete-seats`. The price is still divided by the category's full capacity.
5. When the minimum is met, the server snapshots the price and creates one outbound and one return trip for every selected service date. The group appears in nearby captains' offers.
6. Riders can review their groups with `GET /rider/pool/groups`, cancel one service day or a whole package, and respond to route price changes.

## Categories and service dates

`GET /pool/categories` is public and returns category pricing, capacity, and minimum rider count.

| Category | Seats | Minimum riders | Base | Per km | Per minute |
| --- | ---: | ---: | ---: | ---: | ---: |
| Faster – Non-AC | 3 | 2 | 10 | 7.3 | 0.50 |
| Faster – AC | 3 | 2 | 12 | 8.2 | 0.60 |
| Saver – Non-AC | 4 | 3 | 15 | 7.3 | 0.75 |
| Saver – AC | 4 | 3 | 17 | 8.2 | 0.85 |

Prices are EGP. A group request body contains `category_id`, `package_type` (`daily`, `weekly`, or `monthly`), `service_dates`, `morning_departure`, `return_departure`, and the rider's `pickup_lat`, `pickup_lng`, `dropoff_lat`, and `dropoff_lng`.

- A daily package has one selected date, a weekly package has five dates in the same Sunday–Thursday service week, and a monthly package has 22 dates in one calendar month.
- Riders choose the dates; every date must fall Sunday through Thursday. Departure times use `HH:mm`; return time must be later than morning departure.
- Requested `HH:mm` times are interpreted in `Africa/Cairo`; generated trip timestamps are returned as ISO UTC values.
- A group ID can be shared with other riders. Their pickup and drop-off must each be within 3 km of the current OSRM road route.
- Group responses include `route_geometry`, an object with outbound and return GeoJSON `LineString`s. Coordinates use GeoJSON `[longitude, latitude]` order. This is route data for clients; this backend phase does not serve map tiles or add a UI.

## Rider endpoints

| Method and path | Purpose |
| --- | --- |
| `POST /rider/pool/groups` | Create a group with the authenticated rider as its first member. |
| `GET /rider/pool/groups` | List the rider's invitations, groups, trips, stops, and own subscription summary. |
| `POST /rider/pool/groups/:id/join` | Join a group with personal pickup/drop-off coordinates. |
| `POST /rider/pool/groups/:id/confirm` | Accept or decline a captain-created invitation; body: `{"action":"accept"}` or `{"action":"decline"}`. |
| `POST /rider/pool/groups/:id/complete-seats` | Reserve all remaining seats for the rider's group. Returns the updated quote; payment is deferred. |
| `POST /rider/pool/groups/:id/price-decision` | Accept or decline a revised quote; body: `{"action":"accept"}` or `{"action":"decline"}`. A decline removes that rider without a fee. |
| `POST /rider/pool/groups/:id/days/:date/cancel` | Cancel both legs for one service date. At least 12 hours before morning departure is free; later cancellation charges that service day. |
| `POST /rider/pool/groups/:id/cancel` | Cancel the subscription. Weekly/monthly refunds cover unused days less the 10% fee. A daily subscription follows the same 12-hour rule as a service-day cancellation. |
| `GET /pool/notifications` | Read the authenticated user's in-app notification inbox. |
| `POST /pool/notifications/:id/read` | Mark one notification as read. |
| `GET /pool/push/vapid-public-key` | Public; returns the VAPID public key when Web Push is configured. |
| `PUT /pool/push/subscriptions` | Authenticated; register or update this device's browser subscription. |
| `DELETE /pool/push/subscriptions` | Authenticated; remove this user's subscription for the supplied endpoint. |

If a price increase is more than 15%, every active rider must accept the new amount. A rider who declines is removed without a cancellation fee. If that leaves fewer than the minimum riders (and no rider has booked the whole car), the route is cancelled and the full amount due is recorded as refundable. No payment or refund is executed in this phase.

## Captain endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /captain/verify/status` | Authenticated captain; reports whether phone verification is enabled by an administrator and whether the SMS provider is configured. |
| `POST /captain/verify/request` | Authenticated captain; sends an SMS OTP to the phone number on the account, only while enabled. Limited to one send per minute and five per hour. |
| `POST /captain/verify/confirm` | Authenticated captain; body: `{"otp":"123456"}`. The provider validates the code and the server marks the phone verified. Codes are not returned, stored, or logged. |

| Method and path | Purpose |
| --- | --- |
| `POST /captain/pool/groups` | Create a pre-formed group invitation. Body includes category/package/date/time fields and `riders: [{rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng}]`. Riders must confirm before activation. |
| `PUT /captain/pool/capabilities` | Register the vehicle's AC status and supported tiers; body: `{"has_ac":true,"service_tiers":["faster","saver"]}`. Offers require a matching vehicle capability. |
| `PATCH /captain/pool/search-radius` | Set the offer search radius; body: `{"radius_km":4}` through `{"radius_km":10}`. Default is 4 km. |
| `GET /captain/pool/offers` | List eligible nearby route offers. The response omits the captain's empty-drive distance. |
| `GET /captain/pool/trips/:id` | Review the stop sequence for an eligible offer or assigned trip. |
| `POST /captain/pool/trips/:id/accept` | Accept a route. The first successful acceptance wins. Weekly/monthly acceptance assigns the captain to the package; a one-day replacement applies only to that date. |
| `POST /captain/pool/groups/:id/reorder` | Change future stop order; body: `{"member_ids":[3,1,2]}`. Return stops are generated as the reverse of outbound stops. Riders receive a route-change notification. |
| `POST /captain/pool/trips/:id/stops/:stopId/reached` | Confirm arrival at the next stop in sequence. |
| `POST /captain/pool/trips/:id/complete` | Confirm the leg is complete and write a separate ledger row per rider. All stops must have been reached. |
| `POST /captain/pool/trips/:id/report-absence` | Mark a captain absence and make that date available to replacement captains. The fixed captain remains assigned to other package dates. |

The backend rejects a captain whose current location is more than the saved effective radius from the first pickup. It also checks overlapping trips and estimated deadhead travel between areas. Each absence reduces the captain's effective radius by 1 km, down to the 4 km default floor.

## Admin OTP controls

| Method and path | Purpose |
| --- | --- |
| `GET /admin/settings/otp` | Admin-only; returns OTP enabled state, provider name, and whether the server-side provider credentials are ready. |
| `PATCH /admin/settings/otp` | Admin-only; body: `{"enabled":true}` or `{"enabled":false}`. Defaults to disabled and refuses enablement until all Twilio secrets are configured. |

Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` as Supabase Edge Function secrets, never in GitHub or Cloudflare frontend variables. The admin toggle can then enable or disable OTP without a redeploy. SMS charges are controlled by the Twilio account and begin only when requests are sent.

## Fare, cancellation, and accounting

- The daily seat fare is the two-way route fare divided by full category capacity. Weekly pricing applies 5% off five service days; monthly pricing applies 10% off 22 days.
- Subscription amounts and cancellation refund entitlements are calculated and recorded on `pool_subscriptions`; neither payment capture nor refund execution is implemented.
- Completion records the gross list and rider prices plus deferred settlement fields: the captain share is 80% of list price, and the company share is 20% minus any package discount absorbed by the company. Each ledger row is marked `pending`; no payment capture or payout action is performed.
- New individual requests can automatically join one compatible `waiting` group. The group must match category/package/service dates/departure times exactly; both new points must be within 3 km of its saved outbound road route. Matching skips groups with unconfirmed captain invitations, respects remaining capacity under an immediate transaction, and activates the route if the Faster/Saver minimum is met. Route expansion is compared with the current OSRM fare estimate; increases over 15% put the quote into `price_review` for all active riders. Manual joins use the same baseline rule.
- Captain stop reordering updates route geometry, distance, duration, and estimated arrival times, but never changes the confirmed seat fare or opens a price review. Any added route distance from a captain-selected order is absorbed by the captain.
- A fixed captain's absence opens both legs for the same weekly/monthly service date. The first qualified replacement captain who accepts is assigned both legs for that date; the package's fixed captain remains unchanged for other dates.
- When a weekly/monthly fixed captain is first assigned, migration `012_pool_captain_escrow.sql` records a reserve estimate covering up to four service days from the captain's 80% share. If a replacement completes a trip, `pool_captain_escrow_transfers` records the amount due, reserve-funded amount, and any uncovered balance. Unused reserve is released in the accounting record when the package ends. These are calculation records only; no funds are held or transferred.
- The 72-hour waiting notification is created by a one-minute server timer and appears in the inbox with `wait`, `book_remaining_seats`, and `cancel_free` options. Waiting is the default if the rider takes no action.
- If all selected dates pass while the group is still waiting, it is cancelled free and riders are asked to create a group with future dates. If a confirmed route activates after some dates have passed, only remaining future dates are scheduled and billed.
- If no replacement captain accepts by the scheduled departure, the service date's two legs are cancelled and the date amount is removed from the amount due; later dates in a weekly/monthly package remain scheduled.
- The API persists in-app notifications and accepts browser push-subscription registration/removal. This Supabase Edge Function does not send Web Push messages yet; the inbox remains available. Captain SMS OTP is implemented through Twilio Verify, but stays disabled until an admin turns it on after provider secrets are configured.

## Implementation boundaries

- Phase 11 data lives in its own tables from migration `010_pool_domain.sql`; deferred settlement fields are added by migration `011_pool_settlement.sql`, and fixed-captain reserve records by `012_pool_captain_escrow.sql`. The existing `matches`, `trips`, and `trip_stops` model is unchanged.
- Routing uses an OSRM-compatible server-side service. The default is local `http://127.0.0.1:5000`; set `SEKKA_ROUTING_URL` to an operator-managed OSRM endpoint if needed. Outbound and reverse waypoint routes are requested separately, and both road distance and duration are used in pricing. The server never accepts client-supplied route totals. If routing is unavailable, new group creation fails with HTTP 503 rather than silently pricing straight-line distances.
- OSRM can run locally for free with OpenStreetMap road data. The public OSRM demo and public OSM tile servers are community resources without a production availability guarantee; rider coordinates are not sent to the public demo by this implementation. No geocoder or tile service is configured, and clients must provide coordinates.
- Payment gateway and refund execution remain deferred as requested. `amount_due` and `refund_amount` are calculation fields only. `pool_ledger` also stores `discount_amount`, `company_share_amount`, `captain_share_amount`, `company_commission_rate`, and `settlement_status` so a later payment integration can settle without recomputing historical fares.
- Grok is not integrated: routing, fare calculations, cancellation rules, and eligibility checks are deterministic backend rules and do not benefit from an LLM call.
- Keep VAPID private keys in Supabase Edge Function secrets, not GitHub or browser build variables. Push subscriptions require HTTPS and browser permission; local development does not register the production service worker.
- The return route reverses the outbound stop list and swaps each rider's pickup/drop-off role. OSRM computes the road geometry for each direction independently. The default outbound sequence is pickup order followed by drop-off order; captains can reorder the pickup sequence.
