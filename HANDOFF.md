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

## Not implemented / blocked
- Staging project `zgcvumykzivsvnlflbyp` was inspected **read-only**: PostGIS is NOT currently installed. There have been NO staging schema writes or migrations in this iteration; Production was not accessed.
- No new `places`, recurring templates, saved-search or demand data model has been deployed yet. No nearby_rides/demand_by_* RPC exists from this change.
- No real Leaflet component or OSM map connected to real route/query data. No sample counts/paid quotes may be shown as live supply.
- No passenger/captain production journey has been replaced; no fake booking confirmation is authorized.
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

**Current validation:** GitHub Actions were triggered by branch changes; final check status must be read from latest head. Do not report local typecheck/lint/build as executed (no local Git checkout/Node installation was available in this environment).
