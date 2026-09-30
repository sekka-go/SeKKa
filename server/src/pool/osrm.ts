/** Server-side adapter for any OSRM-compatible routing service. */
export interface RoadRoute {
  distanceKm: number;
  durationMin: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface RoutePoint { lat: number; lng: number }

export async function getRoadRoute(points: RoutePoint[]): Promise<RoadRoute> {
  if (points.length < 2) throw new Error("A route needs at least two stops.");
  // Keep rider coordinates local by default. Point this at an operator-managed
  // OSRM instance explicitly if routing is hosted separately.
  const baseUrl = (process.env.SEKKA_ROUTING_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
  const coordinates = points.map(({ lat, lng }) => `${lng},${lat}`).join(";");
  const url = `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Sekka-Pool/1.0 (server-side route estimates)" },
    });
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);
    const body = await response.json() as {
      code?: string;
      routes?: Array<{ distance?: number; duration?: number; geometry?: { type?: string; coordinates?: unknown } }>;
    };
    const route = body.routes?.[0];
    const coordinatesOut = route?.geometry?.coordinates;
    if (body.code !== "Ok" || !route || typeof route.distance !== "number" || typeof route.duration !== "number" ||
        !Array.isArray(coordinatesOut) || coordinatesOut.length < 2 ||
        !coordinatesOut.every((point) => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === "number" && Number.isFinite(n)))) {
      throw new Error("Routing service returned an invalid route.");
    }
    return {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round((route.duration / 60) * 100) / 100,
      geometry: { type: "LineString", coordinates: coordinatesOut as [number, number][] },
    };
  } finally {
    clearTimeout(timeout);
  }
}
