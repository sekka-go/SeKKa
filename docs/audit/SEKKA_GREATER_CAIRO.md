# Greater Cairo location discovery and validation

## Findings at PR #185 head 123db11c23a4726c48f27a0df50f7c6492ac3281

| Severity | File or function | Cause and user impact | Change and regression |
| --- | --- | --- | --- |
| P0 | `geoPlace.ts/inLaunchRegion`, `LiveCaptainDraft.tsx`, `v31_search_published_routes` | A rectangular approximation admitted fringe locations and GPS search could match unapproved endpoints. | Shared versioned polygon, SQL point coverage and matching filter. Tests compare both geometry copies, check edges and reject the mapped Shorouk centre. |
| P0 | `v31_set_draft_stop_coordinates`, both draft overloads, route and stop tables | The old setter only checked global coordinate ranges. A nonconforming historical draft could keep its points when publishing. | Before-write stop and before-publish route guards enforce the region under existing RLS and do not rewrite historical rows. |
| P1 | `geoPlace.ts/serviceMatches`, `captainSearchMatch.ts` | Separate substring and alias rules produced weak Arabic relevance, and broad areas and roads could look like precise stops. | Shared normalization, exact/alias/phrase/prefix/controlled typo ranks, verified context for known aliases and non-selectable broad results. Tests cover Hosary, Fifth Settlement namesakes and unverified OSM records. |
| P1 | `GeoPlaceInput.tsx`, `CaptainPlacePicker.tsx`, `popularCaptainPlaces.ts` | Two different Photon pipelines and automatic selection could confirm the wrong entry. In-flight requests kept going after edits. | Shared debounced and cancellable discovery, keyboard navigation and explicit confirmation. Popular names are lookup prompts. Tests cover Captain and Rider selection. |
| P1 | `NearbyRides.tsx`, `riderCommute.ts`, `Discovery.tsx` | GPS, local draft and commute paths could bypass geocoder filtering. | Validate GPS and published points, reject obsolete cached selections and preserve registered area shortcuts. |
| P1 | `LiveTripRequests.tsx`, Captain-area selection | A real coordinate and an eligible service area grant different capabilities. | Trip requests retain authoritative active service-area IDs. No new IDs or eligibility are derived from the polygon. |

## Source, version and operational scope

The Staging release policy uses `cairo-ucdb-beo-2026-11-v1`. Source data are [EU JRC GHS-UCDB R2024A](https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php), release 2024-11-05, Cairo feature 4605 and 6th of October feature 3516. The [Built Environment Observatory Greater Cairo GIS archive](https://archive.org/details/greater-cairo), dated 2024-04-23, supplies the Greater Cairo outer polygon and the original Sheikh Zayed City polygon. Both sources are distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The result is an operational discovery footprint based on published urban geography. It does not represent a legal boundary or include all land within the Greater Cairo GIS archive.

Reproduction uses the [JRC ArcGIS layer](https://services2.arcgis.com/jUpNdisbWqRpMo35/ArcGIS/rest/services/Urban_Center_Database_2025_GHSL_Infrastructure/FeatureServer/0/query) with `where=ID_UC_G0 IN (3516,4605)`, `outFields=ID_UC_G0,GC_UCN_MAI_2025,GC_UCA_KM2_2025,GC_CNT_GAD_2025`, `outSR=4326` and `f=geojson`. Obtain `Greater Cairo Boundary` and `Zayed` shapefile parts from the archive using the SHA-1 checksums in its metadata. Convert each with `ogr2ogr -f GeoJSON -t_srs EPSG:4326 destination.geojson source.shp`. In Shapely 2.2, union the two GHSL features with the Zayed polygon, intersect with the Greater Cairo polygon, snap to 1e-10 degrees and normalize the result as a MultiPolygon. The compact GeoJSON geometry SHA-256 is `409f7fe6e4897bca3d1c94a7236e82c24cc68f6a3177e7a714620b9f8816fd86`. Coordinates are longitude/latitude. Boundary edges are covered.

Sample point comparisons with source OSM locations place Hosary Square, Fifth Settlement, Sheikh Zayed centre and Obour centre inside. Almost all of Shubra El Kheima's source polygon overlaps the footprint. Shorouk centre remains outside. Only about 1% of the published Shorouk polygon overlaps the footprint. These results classify points without granting new service-area IDs. Sixth of October, New Cairo and the outskirts of Obour have partial source coverage.

The nine registered service areas on Staging remain authoritative for Captain area selection and ID-based trip requests. The shared client checks provider locality for the chosen area, and SQL checks footprint membership on coordinate writes. Per-service-area point-in-polygon proof remains pending verified neighborhood geometries for all nine areas. Historic no-GPS records remain area-matchable.

## Provider behavior

Photon contributes discovery results and can be unavailable or omit some local features. The public endpoint is a best-effort demo. Keep requests debounced, capped, cancellable and briefly cached. At higher traffic the zero-license-cost path is self-hosted Photon with an Egypt extract on existing compute when available, or an explicitly permitted geocoder. No capacity or uptime is assumed. An OSM line or area only gives context. Its returned point cannot be chosen as a stop. Use a precise mapped point or the separately checked GPS flow. No synthetic POI coordinates are bundled. The catalog also carries three publicly verified OSM identifiers and their representative coordinates for immediately available non-selectable context: [Hosary Square](https://www.openstreetmap.org/way/1393055714), [Hosary Mosque](https://www.openstreetmap.org/relation/15576635) and [Fifth Settlement](https://www.openstreetmap.org/way/774635278). The square and neighborhood were checked against Photon and the mosque against the Nominatim search endpoint on 2026-11-21. These references are OpenStreetMap data under the [ODbL](https://www.openstreetmap.org/copyright).

## Staging verification

Stage SQL checks cover valid source geometry, exact boundary points, existing stop compatibility, outside writes, outside search, and preservation of active registered areas. Unit and browser tests cover the client. Browser tests with intercepted Photon or Supabase requests are regression fixtures. Live Photon observations and authenticated acceptance should be reported independently.


## P0 recovery coverage audit

The samples below use representative points for mapped places in WGS84. A point result describes the active discovery geometry. Service-area IDs still come from Staging and do not imply that a representative point establishes a service polygon. The versioned machine-readable samples are in [sekka-cairo-coverage-samples.json](./sekka-cairo-coverage-samples.json). The active geometry has two disconnected exterior rings and no interior rings. The coverage result remains unchanged pending explicit approval for geographic expansion.

| Area | OSM reference (latitude, longitude) | Active coverage | Operational classification |
| --- | --- | --- | --- |
| Downtown Cairo / Tahrir | [30.0443934, 31.2357457](https://www.openstreetmap.org/way/30925727) | Inside | discovery |
| Nasr City | [30.0521177, 31.3422045](https://www.openstreetmap.org/node/768552342) | Inside | registered #3 |
| Heliopolis | [30.1005985, 31.3329136](https://www.openstreetmap.org/node/768591736) | Inside | registered #9 |
| Maadi / Metro building | [29.9601415, 31.2581197](https://www.openstreetmap.org/way/210595249) | Inside | registered #1 |
| New Cairo | [30.0277688, 31.4756825](https://www.openstreetmap.org/way/498580491) | Inside | registered #2 |
| First Settlement | [30.0635786, 31.4471897](https://www.openstreetmap.org/way/252475573) | Inside | inside registered New Cairo context |
| Third Settlement | [29.9808967, 31.4345610](https://www.openstreetmap.org/way/257176943) | Inside | inside registered New Cairo context |
| Shorouk | [30.1491507, 31.6291954](https://www.openstreetmap.org/way/772922707) | Outside | owner approval required for expansion |
| Dokki / Old Dokki | [30.0358515, 31.2098227](https://www.openstreetmap.org/way/1554827288) | Inside | registered #4 |
| Mohandessin / Mostafa Mahmoud Square | [30.0532630, 31.2018612](https://www.openstreetmap.org/way/29222857) | Inside | registered #5 |
| Zamalek | [30.0629925, 31.2196336](https://www.openstreetmap.org/node/13800621826) | Inside | registered #6 |
| Talbia / Haram | [30.0017733, 31.1809495](https://www.openstreetmap.org/node/14124357536) | Inside | discovery |
| King Faisal Street / Bein El Sarayat | [30.0143452, 31.2011267](https://www.openstreetmap.org/way/1133475345) | Inside | discovery |
| 6th of October | [29.9723458, 30.9409205](https://www.openstreetmap.org/node/299523927) | Inside | registered #8 |
| Sheikh Zayed | [30.0483470, 30.9832235](https://www.openstreetmap.org/node/330194927) | Inside | registered #7 |
| Hadayek October | [29.9315563, 31.0617043](https://www.openstreetmap.org/way/1524454794) | Outside | owner approval required for expansion |
| Shubra El Kheima | [30.1285988, 31.2422180](https://www.openstreetmap.org/node/768591737) | Inside | discovery |
| Obour / first police station | [30.2361412, 31.4733717](https://www.openstreetmap.org/way/1531391127) | Inside | point inside only |
| Obour / city tunnel | [30.1636478, 31.4784069](https://www.openstreetmap.org/way/155519945) | Outside | owner approval required for expansion |
| Ferdous City compound | [29.9487671, 31.0512651](https://www.openstreetmap.org/way/691681930) | Outside | outside the named October BEO layer |
| Mall of Arabia | [30.0067645, 30.9761146](https://www.openstreetmap.org/relation/13478008) | Outside | inside BEO October layer, pending discovery approval |
| Mall of Egypt | [29.9721325, 31.0170639](https://www.openstreetmap.org/way/83811548) | Outside | inside BEO October layer, pending discovery approval |
| American University in Cairo | [30.0191701, 31.5037433](https://www.openstreetmap.org/way/155881184) | Inside | inside registered New Cairo context |
| Arkan Plaza | [30.0198973, 31.0053298](https://www.openstreetmap.org/way/1456049142) | Inside | inside registered Sheikh Zayed context |
| Fifth Settlement | [30.0038046, 31.4249357](https://www.openstreetmap.org/way/774635278) | Inside | inside registered New Cairo context |
| Hosary Square | [29.9724456, 30.9448074](https://www.openstreetmap.org/way/1393055714) | Inside | inside registered October context |
| Obour centre | [30.1914000, 31.4505480](https://www.openstreetmap.org/node/311994035) | Inside | discovery, partial city coverage |
| Shorouk centre | [30.1488541, 31.6295623](https://www.openstreetmap.org/node/298439914) | Outside | owner approval required for expansion |

The BEO archive has named municipal layers for October (`Oct_BOU`, named record `6th_oct`), New Cairo (`New_Cairo_City`) and Sheikh Zayed (`Zayed`). Those layers are suitable for owner review. The database labels themselves do not establish that these municipal extents are the approved exact seKKa service boundaries. The archive does not contain equivalent service polygons for Maadi, Nasr City, Dokki, Mohandessin, Zamalek and Heliopolis. The required decision is to identify one approved geometry/version per registered ID before enforcing all nine as exact service polygons.

Approval needed for discovery expansion within existing IDs 2 and 8 includes coverage of the source polygons for New Cairo and 6th of October. Mall of Arabia and Mall of Egypt fall within the BEO October layer and outside the current service footprint. Hadayek October and Shorouk have separate geography and require their own explicit decision. The Obour centre and first police station are inside, while the tunnel sample is outside. No new registered IDs follow from any of these audit results.

### Search and CI recovery

- Playwright reproduced the Passenger toolbar title intercepting menu clicks after the splash had cleared. The decorative title now leaves menu and notification controls clickable. The pending Captain role flow covers all four phone widths.
- The launch artwork, manifest and Welcome action expectations now follow the approved road mark and three-step introduction. Portrait installed viewports above 480 CSS pixels retain a full-width canvas.
- Live Photon responses reached CI tests whose subject was registered-area booking. Those tests now exercise deterministic registered-area fixtures. Separate browser checks retain a populated Photon response and exercise the actual clickable option on each requested viewport, language and theme.
- Synthetic session suites execute in the explicitly configured mocked CI job. The public suite keeps the guest authorization gates. CI retains traces for failed tests.
- The catalog uses individually reviewed OSM references for streets, schools, hospitals, transit and landmarks. Its representative coordinates provide context. The two verified October malls are recognized as outside the active footprint while the approval decision is pending.
- A landmark with one verified in-region registered parent can offer a deliberate whole-area search. Its centroid is excluded from the request. The real Staging public API returned one published match for registered October to New Cairo. Booking persistence and Captain publication require two distinct authorized Google test sessions.
