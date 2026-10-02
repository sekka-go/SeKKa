# SeKKa maps and routing handoff

## User-selected operating mode

- Use a zero-cost, click-to-select map. There is no text address search and no Google Maps or Places request.
- Render map tiles in the existing Leaflet map with the exact public OpenStreetMap raster tile URL and visible attribution. The service worker skips OpenStreetMap hosts; it does not cache or prefetch tiles.
- Calculate road routes server-side through the OSRM-compatible endpoint in `SEKKA_ROUTING_URL`. The default is the public OSRM demo host. No route key is required.
- Payment and route pricing rules are unchanged. No table, migration, Supabase secret, production function, or production setting was modified as part of this GitHub change.

## Frontend behavior

- Rider booking sends only pickup/drop-off latitude and longitude selected by clicking the map.
- Group details display ordered pickup/drop-off stops and the real outbound/return route geometry.
- Captain offer and assigned-trip maps display each available stop in sequence and the direction assigned to that trip.
- The map fits visible route geometry and stops. It shows loading and tile-failure states, and warns when stored coordinates or road geometry are unavailable.
- Missing route geometry is never replaced with a straight line. OSM tile failure does not disable map clicks; routing failure prevents the backend from accepting a new or changed route.
- OSM attribution remains visible. The browser sets `strict-origin-when-cross-origin` so tile requests have a normal Referer header.

The existing project already uses Leaflet. It remains in place to preserve its click handler, raster tile layer, and PWA bundle; switching to MapLibre would add a vector-style/worker stack without helping this click-only OSM flow.

## Routing API and data

- The Supabase Edge Function validates every stop coordinate and calls `/route/v1/driving/{longitude,latitude;...}`.
- The server requires OSRM `code: "Ok"`, a valid GeoJSON `LineString`, totals, and a leg for every distinct adjacent stop. Coordinates remain in GeoJSON order: `[longitude, latitude]`.
- Consecutive identical stops are collapsed in the upstream request and kept as a zero-length leg in the returned stop-sequence summary.
- `route_geometry` remains backward-compatible with `outbound`, `return`, and `provider`. New quotes also include `outbound_segments` and `return_segments`, each with stop-sequence endpoints and distance/time.
- Route requests do not reorder rider-selected stops. Return uses the existing reverse sequence.
- The existing `/locations/search` and `/locations/resolve` routes remain explicit, authenticated HTTP 410 responses. They do not call an external geocoder.
- Legacy Place IDs are not resolved by this build. Historical Google route geometry is not drawn over OSM tiles. A legacy group without retained coordinates/OSRM geometry needs new click-selected coordinates before it can be re-quoted.

## Configuration and deployment boundary

- The repository now tracks the source of the already-active `sekka-api` Edge Function under `supabase/functions/sekka-api`, plus `supabase/config.toml` pinned to the user-confirmed project `uorxfakceqnhxqnaawdy`.
- `verify_jwt = false` matches the existing function's custom bearer-session and role checks. Keep those checks in the function.
- `SEKKA_ROUTING_URL` is optional. Its example points at the community OSRM demo. Set a different URL only when an operator has a compatible service. Do not put credentials in this example or frontend variables.
- This change is prepared on the existing GitHub pull request branch. It has not deployed the modified Edge Function, changed Supabase production data, or triggered a production Cloudflare deploy. Review the PR and its CI checks before merging/deploying.
- No database migration is required for route segments: they are additive keys inside the existing `route_geometry` JSONB value. Existing tables and RLS stay unchanged.

## Provider limits and privacy

- OpenStreetMap's public tile service is donation-funded, has limited capacity and no SLA. Use its exact tile URL, retain visible attribution, respect normal caching, and do not bulk-download, prefetch, or use it as an offline map.
- The OSRM public demo is a best-effort demonstration endpoint; availability and usage are not guaranteed. A public service may limit or withdraw access. Production growth requires a routing host operated by SeKKa.
- OSM sees the user's network address and requested visible tiles. The OSRM host receives trip coordinates for route calculation. Existing Supabase cleanup job `sekka-purge-expired-location-data` is enabled every 15 minutes and removes location-bearing data after the configured 30-day retention window.
- Treat each provider as a separate service: map-tile failure leaves coordinate selection available, while route-provider failure returns an API error with no fabricated route.

## Verification

GitHub Actions runs the routing helper format/lint checks, deterministic unit tests with a mocked OSRM response, and a Deno type-check of the full Edge Function. Cloudflare Pages separately builds the React app on the pull request; the CSS syntax error from the old patch was removed.
