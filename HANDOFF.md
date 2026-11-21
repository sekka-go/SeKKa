# HANDOFF — seKKa / Sekka Go vNext work-in-progress
Date: 2026-11-21 | Branch: `feat/real-app-google-auth-foundation-20261115` (PR #185)
Status: **PARTIAL; NOT ACCEPTED FOR PRODUCTION.** Never merge to `main` as a substitute for acceptance.

## Completed this iteration
- Recorded the owner's decision to revise v3.1 product UX and map rules. See `docs/product/RECURRING_COMMUTE_VNEXT_20261121.md`; `docs/PRD.md`, `docs/DECISIONS.md` and `docs/product/PRODUCT_RULES.md` now explicitly link/precede to it.
- Installed / store-facing name **Sekka Go**; in-app Arabic brand **سِكّة**.
- Earlier icon pass preserved the old Arabic mark under `sekka-go-192.png` / `sekka-go-512.png`; **owner superseded that decision** with their purple white `seKKa` wordmark and yellow road image. New 192/512 mobile icons: `web/public/brand/sekka-go-road-192.png` / `sekka-go-road-512.png`, derived from the uploaded artwork.
- Updated PWA manifest, browser/favicon, Apple touch icon and launch splash to the new purple road icon. Incremented service-worker cache name to avoid stale icon. Original assets remain available.
- Began light/dark energetic brand tokens in `web/src/v2/theme.css` and mobile shell overrides. Not all legacy screens and embedded screenshot assets are recolored yet.
- Added pure client-side helper `web/src/v2/recurringGeo.ts` and tests for metres/kilometres, approximate walking time, deterministic stop order, 50m dedupe, coverage and optional routing adapter. **These are not server-side PostGIS replacements**.

## Entry UX implementation — video reference 1000645126.mp4 (2026-11-21)
- Inspected the supplied 118-second Poparide reference video. Its useful interaction sequence is: welcoming illustration and one CTA -> carpool-not-taxi explanation -> simple onboarding principles -> progressively collected profile information -> rider/driver role -> permissions -> completion -> ride search.
- Reproduced the core **interaction pattern** without copying Poparide branding or silently imposing unapproved age, gender, mandatory selfie, bio, SMS/OTP, marketing permissions, or payment fields.
- New public guest flow is **Welcome -> share-ride explanation -> practical pickup/time/price details -> select Passenger or Captain -> real Google OAuth -> existing verified profile form / Captain enrollment**. 3 introductory slides run inside production S002; role selection is production S003; Google retains S004 and its existing trusted callback; profile remains S006.
- Files: `web/src/v2/GuestEntry.tsx`, `guest-entry.css`, `guestEntryCopy.ts`; `Onboarding.tsx` links production entry and retains untouched `/dev/screens` legacy gallery. SVG artwork is decorative, all real trip data remains backend sourced.
- UX: RTL/LTR, light/dark, back/skip, per-step progress, semantic radio options, accessible focus/touch targets, reduced-motion support and screen-safe vertical scrolling. The PWA's user-selected purple/yellow road icon is reused without redrawing.
- Auth: no new auth providers, no fake login and no role authorization by client state. Captain roles remain server-verified. The existing Supabase `LiveProfile` handles persistent name/optional phone and read-back verification.
- Tests: `web/e2e/guest-entry-vnext.spec.ts` covers 320/360/390/412px in Arabic/English light/dark, Captain role persistence and Google prerequisite; `mobile-navigation-role.spec.ts` follows all new slides. `production-shell-geometry.spec.ts` continues to compare Search/Filter geometry to original gallery, while entry has its own regression gate because the owner explicitly changed the design. `mobile-pwa-navigation.spec.ts` assertions now follow the approved brand palette.
- Manual check: open logged-out root -> press primary three times -> pick Captain -> Google screen -> browser Back restores chosen role; repeat Passenger -> authenticated Google callback -> profile -> real search. Check Skip intro and "Sign in with Google" on first screen, 320px and 390px both themes, portrait with screen reader, reduced motion, and browser back/forward.
- Limit: this is a new **entry** flow, not an implementation of still-deferred payments, upload/avatar review, age verification, push notifications, or backend commute/map matching. Full authenticated Google and device visual acceptance remain mandatory before production.

## Passenger journey redesign — 2026-11-21 (implementation, not release)
- **Public navigation:** after verified Google Rider sign-in, the root Home now renders `RiderJourneyHome` instead of the old screen-8 mock-looking shell. The separate developer gallery is unchanged.
- **First visit:** energetic practical home shows «ظبّط مشوارك» leading to the existing real service-area/OSM point search. No route count, pilot price, captain rating, seat availability or departure data is invented.
- **Repeat visits:** a validated search is saved to `localStorage` under the **specific Google user UUID**, retaining selected service/map stops, outward/return time and weekly/monthly preference. A button restores the exact search draft and opens **real** RPC-powered results in one action; edit returns to the location search. Storage is explicitly labeled on-device, not a cross-device subscription or a server demand signal.
- **Three-step UX:** Search (view 9) → published results (view 11) → actual route details (view 12) → existing server-gated booking flow. New headings/copy and bright purple/coral/yellow light/dark styling are production-scoped. The original Gallery remains separately accessible to developers.
- **Result ranking:** `riderRank.ts` orders geographically measured pickup stops first (unknown distances last), with departure-time tie-break, and keeps real price/seats sort options. `riderCommute.ts` validates saved content before restoration.
- **Distance truth:** distances come from `v31_search_published_routes` / geographically published stops, formatted in correct Arabic/English units, with **approximate** walking time derived from 1.3× straight line / 80m per minute; never claim this is measured pedestrian routing.
- **Actual nearby map:** `RiderStopMap` displays a selected **published pickup stop** using OpenStreetMap embed, attribution, and accessible item buttons. It intentionally sends the PUBLIC stop coordinates, **not a Rider GPS coordinate**, to the third-party map service. This is an interim map, **NOT** yet the planned all-marker Leaflet/PostGIS geospatial map.
- **No policy changes:** role restrictions, Google OAuth, published offer RPCs, capacity revalidation, booking transition and financial/renewal behavior remain in their existing server-verified state.
- **Automated tests:** `riderCommute.test.mjs`, `riderRank.test.mjs`, expanded `recurringGeo.test.mjs`, plus `e2e/rider-journey-vnext.spec.ts` (mocked verified Rider) cover account isolation, saved commute restoration, nearest-stop sort, coordinates, real RPC request and zero fake booking success. Mock browser tests are not real staging OAuth acceptance.
- **Manual acceptance:** Sign in with authorized Rider Google account on staging; first visit → search area or OSM map result → valid origin/destination/time → Search → check server-returned results/empty → Home → the saved route appears → tap once to rerun real search → edit and repeat → open a route → verify capacity/prerequisites with real booking only after server confirmation. Test location denial/manual search, 320/360/390/480 widths, Arabic/English, light/dark and back navigation.
- **Still blocked:** full Leaflet pin/distance-ring map, verified weekday recurrence/search RPC, backend saved-demand aggregation `demand_by_*`, authoritative PostGIS data migration, walking-route service, and unresolved subscription/payment policy. No production or staging database writes in this phase.

## Not implemented / blocked
- Staging project `zgcvumykzivsvnlflbyp` was inspected **read-only**: PostGIS is NOT currently installed. There have been NO staging schema writes or migrations in this iteration; Production was not accessed.
- No new `places`, recurring templates, saved-search or demand data model has been deployed yet. No nearby_rides/demand_by_* RPC exists from this change.
- No real Leaflet component or OSM map connected to real route/query data. No sample counts/paid quotes may be shown as live supply.
- Passenger home + first search/results UX have been redesigned in production-facing code; the full map/recurrence backend is still incomplete, and no fake booking confirmation is authorized.
- Subscription duration, EGP 100 deposit, payment/renewal/reporting effects and captain pre-booking identity remain POLICY DECISIONS. Existing protected logic must stay unchanged until expressly decided.
- The requested `docs/prototype/sekka-app-v2.html` was absent in the reviewed PR head. User-supplied `معاينة التطبيق.html` illustrates mock interactions but is not a live GIS/backend implementation.

## Next technical steps
1. Reconcile payment/subscription, prebooking identity and seven-day operational availability with owner decisions.
2. Install/verify PostGIS in isolated STAGING only (prefer `extensions` schema, first check ownership/existing extensions). Validate extension and migration parity; never drop existing extension or tables.
3. Add additive `places`, recurring templates, stop, and saved-search tables and scoped RLS, then thresholded aggregate demand RPCs (>=5), and authorized nearby_rides RPC with geographic distance.
4. Add Leaflet/OSM tiles and attribution, keyboard-accessible markers, location fallback and map size skeleton. Avoid public OSRM demo in production.
5. Wire Passenger recurring saved search → map → results → gated join, and Captain saved template → demand → edit/publish, with real data only.
6. Visual audit of every real app screen in Arabic RTL/English, light/dark, 320/360/390/480 widths and reduced motion.
7. Run `npm --prefix web run typecheck`, `npm --prefix web run lint`, `npm --prefix web test`, `npm --prefix web run build`, and relevant Playwright journeys. Validate authenticated Google sessions and Staging schema after database work.

## Manual smoke checklist after wiring is completed
- **Rider:** Google login → select rider → saved recurring commute present → change pickup/time → grant GPS or deny and set location manually → see real OSM attribution and unique nearby pickup pins → tap pin to filter, reset all → open join sheet → pick days → verify server capacity+payment prerequisites and real booking state → cancel/save search if no match. Check outside-coverage message and never substitute fake coordinates.
- **Captain:** Google login → approved Captain → saved route numbered on OSM → view legitimate demand counts only for buckets >=5 → one-tap publish after server validation → edit destination, tap new stop, verify 50m reuse, automatic sorted stops → toggle days/return/women-only → publish → see authorized joined riders and seat meter.
- **Accessibility:** keyboard-focus map markers, 44px controls, proper focus order, screen reader labels, reduced motion, safe-area and no overlap at 320px.
- **Privacy:** no exact rider location in demand aggregates; no captain identity exposed before approved policy; no overselling/concurrent booking failures.

**Current validation:** GitHub Actions were triggered by branch changes; final check status must be read from latest head. GitHub Actions are the verification authority in this environment; no local repository checkout or real authenticated device test has been executed.
