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

Photon contributes discovery results and can be unavailable or omit some local features. The public endpoint is a best-effort demo. Keep requests debounced, capped, cancellable and briefly cached. At higher traffic the zero-license-cost path is self-hosted Photon with an Egypt extract on existing compute when available, or an explicitly permitted geocoder. No capacity or uptime is assumed. An OSM line or area only gives context. Its returned point cannot be chosen as a stop. Use a precise mapped point or the separately checked GPS flow. No synthetic POI coordinates are bundled.

## Staging verification

Stage SQL checks cover valid source geometry, exact boundary points, existing stop compatibility, outside writes, outside search, and preservation of active registered areas. Unit and browser tests cover the client. Browser tests with intercepted Photon or Supabase requests are regression fixtures. Live Photon observations and authenticated acceptance should be reported independently.
