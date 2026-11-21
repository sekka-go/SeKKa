# seKKa — Screen-by-screen real UX rebuild

Date: 2026-11-21
Scope: Mobile-first Arabic passenger experience, then Captain. No changes to business rules, Supabase production data, payment/OTP deferrals or Google OAuth. Keep approved purple seKKa / white lettering / yellow road **installed icon**.

## Experience standard

- One visually dominant task per screen, with an explicit back or persistent way home.
- First-time path should require only necessary inputs. Returning Rider should resume a saved commute from the current device in one tap.
- No invented vehicle availability, prices, distances, scores, punctuality claims or GPS permissions. Real data and empty/loading/error states are part of the UI.
- RTL, Tajawal Arabic, 320–480px, 44px+ hit targets, no horizontal scrolling, visible focus and reduced-motion support. English layout must be coherent too.
- Consistent components: ink/cream/purple base, energetic coral and yellow accents, purposeful route/road illustrations and handoff to published ride data.
- Tabs for top-level Rider destinations (Home, Search, Bookings, Account); subflows maintain their own clear Back/confirmation. Side drawer is for account preferences and less frequent actions, not core navigation.
- Maintain full test and staging evidence before marking a screen accepted. NEVER merge production automatically.

## Delivery order / evidence gates

| Priority | Production screen | User action | Evidence before accepted | Status |
| --- | --- | --- | --- | --- |
| P0 | Rider home (root) | Enter commute once / rerun saved commute; find nearby stops | 320/390px screenshots, nav + real RPC handoff, dark/light | **Rebuilt on PR #185; verification pending** |
| P0 | Search S009 | Pick origin/destination, time, no wrong locality assumptions | Verified point selection, swap, saved draft/back, loading/error | Rebuilt; verification pending |
| P0 | Results S011 | Choose a published ride by nearby pickup and time | Real database rows, empty, nearest-match honesty, filters | Rebuilt; verification pending |
| P0 | Details S012 | Understand pickup, direction, price, available seats | Stop-order + capacity revalidation, back to matching results | Rebuilt; verification pending |
| P0 | Booking flow | Review → confirm once → see pending state | Atomic server reservation, no fake payment confirmation, errors | Restyled existing verified flow; verification pending |
| P1 | My bookings / requests | See next action and status; clear cancellations/requests | State machine and server-owned actions | Bookings rebuilt, requests retained; verification pending |
| P1 | Notifications / account | Finish account and manage essentials | Settings, Google-only auth, privacy, sign-out | Planned |
| P1 | Captain entry and home | Publish / reuse usual route in a few steps | Approved captain role, no fake demand badges | Planned |
| P1 | Captain route creation + stop map | Publish a truthful recurring route | Stop order/geocoordinates, distance source, server validations | Planned |
| P1 | Captain trips & bookings | See occupancy and real passengers | Authorized data, capacity and RLS | Planned |

## Screen 1 — Rider Home V3 (implemented code)

- Replaced the old repetitive block layout with a single branded hero, one journey card and one primary CTA.
- Initial user: choose a verified area/map point and start real search.
- Returning user: see saved places/time; change or rerun real published-ride search using the already existing scoped on-device draft; no server-side demand counters are implied.
- Smaller entry points for actual nearby-stop map and My bookings, with no fake trip inventory.
- Rider-only bottom tabs: Home, Search, Bookings, Account. Maintains existing side drawer for language/theme/secondary actions; untouched Captain/Admin menus and unauthenticated onboarding.
- A new, consistent textual seKKa brand header is used on authenticated Rider Home; installed app icon unchanged.
- Files: `RiderJourneyHome.tsx`, `rider-home.css`, `RiderTabBar.tsx`, `rider-tabbar.css`, `riderHomeCopy.ts`, `MobileApp.tsx`.
- Test: `e2e/rider-journey-vnext.spec.ts` includes Rider tab routing, real search RPC, 320/390px screenshots and no simulated booking confirmation. Manual Google OAuth and actual Android walkthrough still required.

## User-approved image implementation — Rider Home (2026-11-21)

The owner supplied a visual reference showing: a deep-purple in-app Arabic brand masthead, smiling carpool passengers with a Cairo-flavored route background, a cream/pink hero and bold Arabic CTA; a white elevated card marked «مشوارك المعتاد» with four rows (from, to, time, days), a violet main button and edit action; two side-by-side peach/yellow tiles for nearby stops and bookings; and four bottom navigation items.

Implemented as **actual React components** in `RiderJourneyHome.tsx`, `rider-home.css`, `rider-tabbar.css`, translated labels in `riderHomeCopy.ts`, plus a lightweight custom SVG scene `web/public/brand/sekka-rider-hero-scene.svg`. It is not a flattened screenshot; labels, states, buttons and route details are accessible, localized and responsive. The **installed icon remains the previously approved purple seKKa white-letter/yellow-road icon** and was not replaced.

**Data integrity deviations from the mock**: «المعادي → التجمع» and 7:30 AM are only displayed when that is the returning Rider's own stored search. For fresh users, fields prompt for information rather than fabricating a ride. The SavedCommute record holds weekly/monthly period but no specific weekday list, so the Days row explains availability is learned from published trip details and does not claim Sunday–Thursday as a confirmed itinerary. Nearby-point results remain actual Supabase-backed data and location requires permission.

Main CTA goes to existing real search/results, Edit opens origin/destination/time, Nearby toggles real nearby discovery, My Rides goes to authenticated bookings; bottom tabs remain real route navigation. Browser validation needs screenshot comparison at 320px and 390px, Arabic and English, light/dark, first-visit empty state, returning saved state, all four actions, back navigation and full keyboard focus. **No production merge.**

## Rider core journey V3 — 2026-11-21

The **production-facing** Rider flow now uses a coherent route-first UI across:
- **Search S009:** new `RiderSearchV3` with genuine service area + OpenStreetMap place picker, swap, optional departure/return time, weekday preferences, a single "Show available rides" action and optional nearby-stop discovery. First visit no longer seeds a fake 07:30/17:00 time. The 73-screen gallery remains untouched.
- **Results S011:** `RiderResultsHero` shows the selected origin, destination and requested times with one-click edit. `LiveRouteSearch` still uses the existing protected RPC and real seats/price/stop data. Cards now prioritize pickup name, time, seat price and explicit selection; sorting and zero-match request pathway remain.
- **Trip details S012:** `RiderTripDetailsV3` shows the server-provided route, pricing, remaining seats, direction and *actual stop order*, with controlled pickup/drop-off selection. It hands the validated stop pair to the existing booking flow and does not claim an unapproved fixed Sunday–Thursday timetable.
- **Booking review:** the existing `V31BookingJourney` retains its server atomic seat reservation, read-after-write verification and status separation; a scoped `rider-booking-v3.css` facelift improves layout. Pending cancellations now require a second explicit confirmation click.
- **My rides:** `RiderBookingsV3` reads current Rider-owned `v31_bookings` records, optionally resolves publicly visible route titles, separates current/previous bookings, and supports protected cancellation confirmation. Captain booking screens were not replaced.
- **The requests and filters sections** still preserve their existing backend workflows; they are not yet fully redesigned. Existing live notifications, profile and Captain flows remain as before.

**Do not overclaim:** Weekdays saved by the Rider do **not** yet filter the v31 search RPC. The UI openly states this, and users should verify a ride's operating days before booking. Pricing shown before booking is indicative, not payment. No new Supabase migration, production writes, paid maps, OTP, or payment handling.

**Automated checks:** `web/e2e/rider-redesign-v3.spec.ts` exercises mock-authenticated Rider Search → Results → Details → Booking (without fake confirmation), including 320/390px layouts, plus active Rider bookings and cancel confirmation. `v31-rider-no-match-request-mocked.spec.ts` remains a regression for the request flow, updated to the new place labels; original Gallery filters geometry remains separately tested. Await CI and actual authenticated staging walkthrough before marking accepted.

## Release rules

A screen is **not approved** solely because a component renders or TypeScript compiles. Pass CI and actual staging, inspect screenshots on a small Android viewport and verify the intended step end to end before marking complete. Avoid claiming that all subsequent screens have been redesigned.

## Rider Home interactive form update — 2026-11-21

- Owner explicitly confirmed that **all four rows** in the new Rider Home must be editable: origin, destination, departure/return time and number of travel days. None should be decorative.
- Tapping From/To opens the real service-area / OpenStreetMap picker, and an unconfirmed free-text place cannot proceed to search.
- Tapping Time opens the outbound time and optional return time editor; leaving the time blank allows a broad search.
- Tapping Days opens a Saturday–Friday picker. The count of distinct selected weekdays is computed from selected days, and weekly/monthly preference can be chosen. Old saved searches without a weekdays array remain valid.
- Selected values survive tab changes as a validated *session-only, Google-account-scoped* draft; a search stores the selected commute for that same account on-device.
- Main button is consistently **«ابحث» / Search**. It sends only verified places and real times to the published-routes search RPC, rather than guessing any inventory.
- **Important limitation:** current v31 Supabase route-search RPC does **not** accept a weekdays parameter. We persist the Rider's preferred weekdays and show an explicit note on the results page; results do **not** claim to be filtered by those days. Supporting real weekday matching requires separate server schema/RPC work and operational approval.
- Added weekday validation/unit tests and browser tests for choosing outbound/return time and 3 distinct weekdays, preserving the form through Home ↔ Search navigation and reaching the search RPC.
- Neither OTP/payment policy nor Captain/Admin access nor the installed seKKa road icon was changed.

