/** Search discovery is intentionally wider than the approved operational geofence.
 * It is a bounded OSM research envelope, NOT an approved service area,
 * and MUST NOT authorize booking, stop writes, or map-pin confirmation.
 * Coverage expansion requires a separate approved, versioned SQL migration.
 */
export const cairoDiscoveryBounds = Object.freeze({
 west: 30.70, south: 29.70, east: 31.80, north: 30.34
});
export function isInsideCairoDiscovery(point: {latitude:number;longitude:number}):boolean {
 return Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&
  point.longitude>=cairoDiscoveryBounds.west&&point.longitude<=cairoDiscoveryBounds.east&&
  point.latitude>=cairoDiscoveryBounds.south&&point.latitude<=cairoDiscoveryBounds.north;
}
