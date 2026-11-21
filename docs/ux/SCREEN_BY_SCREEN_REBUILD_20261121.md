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
| P0 | Search S009 | Pick origin/destination, time, no wrong locality assumptions | Verified point selection, swap, saved draft/back, loading/error | Next |
| P0 | Results S011 | Choose a published ride by nearby pickup and time | Real database rows, empty, nearest-match honesty, filters | Planned |
| P0 | Details S012 | Understand pickup, direction, price, available seats | Stop-order + capacity revalidation, back to matching results | Planned |
| P0 | Booking flow | Review → confirm once → see pending state | Atomic server reservation, no fake payment confirmation, errors | Planned |
| P1 | My bookings / requests | See next action and status; clear cancellations/requests | State machine and server-owned actions | Planned |
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

