# seKKa — Recurring Commute Experience vNext
Date: 2026-11-21
Status: Owner-approved redesign direction; NOT a production release or a database migration approval.
Scope: Passenger and Captain experience, map/distance/matching, visual identity. No production writes.

## 1. Product premise
- سِكّة is an Arabic-first RTL platform for regular recurring shared commutes, with optional English.
- Installed app/store label: **Sekka Go**. In-app brand and prose: **سِكّة**.
- Both roles prefer saved recurring routes. Returning users should be able to start with one or two deliberate taps.
- Demand/suggestions/ratings/prices/seats are based on persisted authorized data only. No synthetic numbers or fake route availability.
- The onboarding, search, booking and publication screens must explain practical user outcomes; no filler marketing promises.
- Captain identity and personal data obey privacy rules; never expose a passenger's precise location through demand aggregation.

## 2. Confirmed UX changes (override the cited legacy PRD mechanics where incompatible)
1. Passenger home: saved origin, destination, time window and selected weekdays; one-action repeat search; explicit edit option.
2. Map: real OpenStreetMap tiles through Leaflet, attribution visible, stable viewport/skeleton; user position, approximate distance rings, unique pickup markers with distances; tapping a marker filters nearby rides, reset by «كل النقط».
3. Location: browser geolocation when permitted; manual point selection on map if denied. When >30 km from all covered points, show «أنت بعيد عن منطقة التغطية», preserve last valid location and offer manual selection. Never substitute fake demo coordinates on a real user screen.
4. Results: search only real eligible recurring trips, ordered by geodesic distance to pickup and then departure time. Show pickup, metres, approximate walking minutes, schedule, seats and advertised price. The first eligible result may be marked «الأنسب». Do not claim an unapproved or unpublished offer is available.
5. When no eligible trips match, show «مفيش رحلات في الوقت ده لسه» and «احفظ البحث». Saved searches feed demand analytics, deduplicated per authenticated user and active request; saving a search is NOT booking a seat.
6. Join sheet: map route from current user position to pickup, weekday picker defaulting to Sunday–Thursday, price and «انضم للرحلة». A successful booking state is ONLY shown after server-side capacity/eligibility and any required financial prerequisites succeed; no frontend-only success pretence.
7. Captain home: saved route on a real numbered map and a one-tap «انشر الرحلة دي» for a validated approved template; «عدّل المسار أو الميعاد» edits the template. Publishing must still pass eligibility and server validation.
8. Captain editing: destination, ordered stops, departure-time demand chips, all seven weekday chips (default Sunday–Thursday), seats, price, optional return trip and women-only preference; display demand badges only above an approved minimum (default 5).
9. Tapping a map point to add a stop: reuse an existing place within 50 metres and notify the user; otherwise create an unverified place for moderation. Stop order is computed automatically by decreasing ST_Distance to destination for the NEW template UX (this supersedes the manual order instruction in PRD v3.1 STOPS-01). Validate connectivity/direction before publishing; straight-line ordering alone is not road-network routing.
10. Captain «رحلاتي»: published recurring offerings, seat meter and joined riders visible only to authorized captain within permitted disclosure stages.

## 3. Geospatial technical contract
- PostGIS geography is server authority for location distances; geog generated from WGS84 latitude/longitude. Location data must be permission-scoped, validated (-90..90 latitude, -180..180 longitude).
- places(id, name, kind pickup|destination, lat, lng, geog, area, created_by, is_verified).
- Recurring template stores captain, destination_id, depart_time, smallint[] days with Sat=0 … Fri=6, seats, price, women_only and optional return_time. Stop records hold place ids and computed position. The approved vehicle/role/capacity validation still applies.
- RLS ON for every new exposed table, least privilege for demand reads and write access; avoid untrusted SECURITY DEFINER RPCs.
- RPC nearby_rides(lat,lng,destination_id,time_band,women_only) returns eligible offers with distance_m to pickup; enforce a safe bounded result set, authenticated scopes and no captain identifying data before permitted disclosure.
- RPC demand_by_stop(destination_id) and demand_by_time(destination_id) aggregate *active* saved searches and requests (per-user deduplication; anonymous buckets with minimum k=5); never expose individual riders or precise saved-search positions.
- Distances displayed <1000 m as nearest 10 metres ("320 م"), >=1000 m in one decimal kilometres ("1.4 كم"). Walking time estimated as distance×1.3÷80 m/min, clearly labeled approximate. Pickup-to-destination *straight-line* distance explicitly labeled تقريبًا. Encapsulate walking estimate behind an interface for later real route engines.
- Do NOT use the public OSRM demo server in production. No paid map APIs or hard-coded API keys. .env.example for supported settings.

## 4. New visual system / approved app icon
- **Owner override 2026-11-21:** installed app icon is now the owner-uploaded square **purple seKKa white wordmark with yellow road swoosh**, in `web/public/brand/sekka-go-road-192.png` and `sekka-go-road-512.png`. This supersedes the earlier instruction to recolor the Arabic icon only. Keep original Arabic and orange icon assets in the repository for reference. In-app terminology/brand name remains «سِكّة».
- New palette: background #FFF9F5, ink #35134F, primary purple #6412B1, hot coral #FF663D, magenta #F73587, sunny yellow #FFCD38, teal highlight #00BEAD. Strong legible dark mode required.
- Youthful, energetic but functional: meaningful hierarchy; smooth navigation; no needlessly long onboarding; accessible contrast, 44px minimum actions, focus-visible, RTL, prefers-reduced-motion.
- React/Vite/TypeScript implementation should use existing Tajawal brand font unless an approved bundled alternative is explicitly adopted. Existing repo brand asset wins on shape; new palette overrides legacy black/yellow.
- Splash and PWA favicons use the selected purple road icon. Do not introduce any alternative logo without owner approval.
- Bilingual strings centrally located in translation resources; no hardcoded Arabic inside new React components.

## 5. Superseded or unresolved legacy policy
The owner explicitly chose to revise existing PRD rules, rather than force the new UX into PRD v3.1 as-is.
- **Superseded for redesigned recurring template UX:** manual stop ordering (STOPS-01), fixed Sunday–Thursday *selection-only* UI (the UI now allows seven selectable weekdays; actual service-date constraints require owner/policy validation), legacy branding palette and store label.
- **Requires explicit product resolution before changing financial/booking code:** whether weekly/monthly subscription cycles continue, whether «انضم» is a subscription reservation or instant per-ride booking, EGP 100 security hold, proration, refunds, payment confirmations, cancellation/renewal deadlines and reporting semantics. Preserve existing backend rules until approved decision; do not silently remove money, ledgers, or user records.
- **Requires explicit privacy approval:** exact captain name/rating on the pre-booking list conflicts with PRD v3.1 BOOK-05. Until approved, show a non-identifying operator indicator, and keep full identity post-booking.
- Vehicle classes and capacity limits are NOT renamed or weakened in this work; existing eligibility rules remain until separately approved.
- Google OAuth already working in the app must remain intact. Do not add OTP as part of this redesign.
- Legacy PRD v3.1 and 73-screen gallery remain historical references; never treat simulated prototype bookings as real state.

## 6. Delivery/acceptance
Work on PR #185 or a review branch derived from it, no production merge. Migrate additively on staging only after audited schema inventory; use no destructive production SQL. Sequence: (1) updated source of truth and brand (2) schema/RLS/RPC tests (3) Leaflet map and geospatial helpers (4) passenger recurrence (5) captain recurrence (6) polish and HANDOFF.md. Run typecheck, lint, unit/database tests, build and Playwright before claiming acceptance. Require real Google authenticated staging smoke for both roles.
