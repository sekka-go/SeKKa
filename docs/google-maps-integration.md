# Google Maps address search and routing

## Runtime configuration

Use separate Google Maps API keys:

- Browser key: set `VITE_GOOGLE_MAPS_EMBED_KEY` in Cloudflare Pages production and preview build variables. Enable and API-restrict it to **Maps Embed API**. Restrict HTTP referrers to `https://sekka-go.pages.dev/*` and `https://*.sekka-go.pages.dev/*`.
- Server key: set `GOOGLE_MAPS_SERVER_API_KEY` in Supabase Edge Function secrets for project `uorxfakceqnhxqnaawdy`. Enable and restrict it to **Places API (New)** and **Routes API**. Never expose it to the browser or commit it.
- Billing must be enabled in Google Cloud for the enabled services. Add Google Cloud budget alerts and service-level quotas as an additional guard. SeKKa enforces a stricter combined cap in Postgres before every server API request.
- The public privacy notice and terms are available at [sekka-go.pages.dev/privacy.html](https://sekka-go.pages.dev/privacy.html) and [sekka-go.pages.dev/terms.html](https://sekka-go.pages.dev/terms.html). Support: [sekkago.app@gmail.com](mailto:sekkago.app@gmail.com).

The public `GET /config` API returns only `maps.address_search_enabled` as a boolean; it never returns a key. Address search appears only when the server key and browser key are both configured. Until then, booking keeps the OpenStreetMap click-to-select fallback. Saved Google Place IDs and Google-derived routes require the browser key to display and show a clear unavailable message if it is absent. The app does not silently draw Google route geometry on OpenStreetMap.

## Limits and retention

- Each rider account can submit two distinct address searches per Cairo calendar day.
- The same normalized query cannot be submitted twice for the same account. The raw query is sent to Google for search but is not stored by SeKKa; a SHA-256 fingerprint is retained for duplicate prevention.
- A single database counter limits the combined number of Places Autocomplete, Place Details, and Routes requests to 10,000 per UTC calendar month. The request is reserved before it is sent; failed upstream attempts still use the app quota.
- Maps Embed loads are outside this server-side counter and are subject to Google's own billing and quota controls.
- Place IDs are retained to keep saved ride routes working. Google Places labels are returned to the current browser and are not written to the database. Coordinate-bearing data and route geometry are deleted after 30 days by the scheduled database cleanup. API usage counters are removed after 90 days.
- Coordinate-only route requests use the configured `SEKKA_ROUTING_URL`, or the public OSRM routing endpoint when no private routing URL is configured. Route coordinates are sent to that routing provider for calculation. OpenStreetMap tiles are loaded by the browser.

## API

Authenticated rider endpoints:

- `POST /locations/search` with `{ "query": "..." }`; returns up to five transient suggestions, the search ID, and remaining quotas.
- `POST /locations/resolve` with `{ "search_id": "...", "place_id": "...", "label": "..." }`; returns coordinates for the selected suggestion. Coordinates are retained only for the route cache window.
- New group creation accepts selected place IDs without persisting result labels or resolving coordinates. Joining an existing group resolves the two selected points, checks the 3 km corridor, and recomputes the quote.

Route requests use Google Routes API when the server key is configured. Coordinate-only selections retain the existing OSRM fallback.

## Data and attribution

The app displays Places-derived suggestions with Google Maps attribution and uses Google Maps Embed for place-based maps and Google-derived routes. Places and route place IDs are stored long-term; Google coordinates and route geometry are removed after 30 days. See the public [privacy notice](/privacy.html) and [terms](/terms.html), and Google's [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Routes policies](https://developers.google.com/maps/documentation/routes/policies), [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms), and [Google Privacy Policy](https://policies.google.com/privacy).

## Database source tracking

The production Supabase migration history includes the map foundation versions `20261002075543`, `20261002075655`, and `20261002080159`, which were applied online before this repository branch and are not present as SQL files in the repository. The follow-up retention migration in this branch is tracked as `20261002082524`. Backfill the earlier SQL sources from the approved project change record before using a fresh-database migration replay.
