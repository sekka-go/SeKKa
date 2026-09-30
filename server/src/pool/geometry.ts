export interface Point { lat: number; lng: number }
export interface PoolRouteMember {
  id: number; pickup_lat: number; pickup_lng: number; dropoff_lat: number; dropoff_lng: number; pickup_order: number;
}
const EARTH_KM = 6371.0088;

export function distanceKm(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointSegmentDistanceKm(point: Point, start: Point, end: Point): number {
  const meanLat = ((point.lat + start.lat + end.lat) / 3) * (Math.PI / 180);
  const x = (p: Point) => p.lng * (Math.PI / 180) * EARTH_KM * Math.cos(meanLat);
  const y = (p: Point) => p.lat * (Math.PI / 180) * EARTH_KM;
  const px = x(point), py = y(point), ax = x(start), ay = y(start), bx = x(end), by = y(end);
  const dx = bx - ax, dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function orderedMembers(members: PoolRouteMember[]): PoolRouteMember[] {
  return [...members].sort((a, b) => a.pickup_order - b.pickup_order || a.id - b.id);
}

export function routeStops(members: PoolRouteMember[], direction: "outbound" | "return") {
  const ordered = orderedMembers(members);
  const forward = [
    ...ordered.map((m) => ({ member_id: m.id, stop_type: "pickup" as const, lat: m.pickup_lat, lng: m.pickup_lng })),
    ...ordered.map((m) => ({ member_id: m.id, stop_type: "dropoff" as const, lat: m.dropoff_lat, lng: m.dropoff_lng })),
  ];
  return direction === "outbound" ? forward : [...forward].reverse().map((stop) => ({
    ...stop, stop_type: stop.stop_type === "pickup" ? "dropoff" as const : "pickup" as const,
  }));
}

export function isWithinGroupPath(point: Point, members: PoolRouteMember[], limitKm = 3): boolean {
  const stops = routeStops(members, "outbound");
  for (let i = 1; i < stops.length; i++) if (pointSegmentDistanceKm(point, stops[i - 1]!, stops[i]!) <= limitKm) return true;
  return false;
}

/** Proximity check against an OSRM GeoJSON LineString ([longitude, latitude]). */
export function isWithinRouteLine(point: Point, coordinates: unknown, limitKm = 3): boolean {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  const line = coordinates.filter((value): value is [number, number] => Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && typeof value[1] === "number" && Number.isFinite(value[1]))
    .map(([lng, lat]) => ({ lat, lng }));
  for (let i = 1; i < line.length; i++) if (pointSegmentDistanceKm(point, line[i - 1]!, line[i]!) <= limitKm) return true;
  return false;
}

export function serviceDates(value: unknown, packageType: string): string[] | null {
  const required = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;
  if (!Array.isArray(value) || value.length !== required || !value.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
  const dates = [...new Set(value as string[])].sort();
  if (dates.length !== required) return null;
  const todayInCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  if (dates[0]! < todayInCairo) return null;
  for (const date of dates) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || [5, 6].includes(parsed.getUTCDay())) return null;
  }
  if (packageType === "weekly") {
    const starts = new Set(dates.map((date) => {
      const parsed = new Date(`${date}T12:00:00Z`);
      parsed.setUTCDate(parsed.getUTCDate() - parsed.getUTCDay());
      return parsed.toISOString().slice(0, 10);
    }));
    if (starts.size !== 1) return null;
  }
  if (packageType === "monthly" && new Set(dates.map((date) => date.slice(0, 7))).size !== 1) return null;
  return dates;
}

export function planDiscount(packageType: string): number { return packageType === "weekly" ? 0.05 : packageType === "monthly" ? 0.10 : 0; }
export function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
