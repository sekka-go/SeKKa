export const GREATER_CAIRO_BOUNDS = {
  south: 29.65,
  west: 30.55,
  north: 30.45,
  east: 31.85,
} as const;

export function isInsideGreaterCairo(lat: number, lng: number) {
  return lat >= GREATER_CAIRO_BOUNDS.south && lat <= GREATER_CAIRO_BOUNDS.north &&
    lng >= GREATER_CAIRO_BOUNDS.west && lng <= GREATER_CAIRO_BOUNDS.east;
}
