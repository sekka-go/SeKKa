export type RoutingPoint = { lat: number; lng: number };
export type RouteSegment = {
  from_stop_sequence: number;
  to_stop_sequence: number;
  distance_km: number;
  duration_min: number;
};
export type OsrmRouteResult = {
  provider: "osrm" | "osrm_demo";
  distance_km: number;
  duration_min: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  segments: RouteSegment[];
};

export class RoutingError extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
    this.name = "RoutingError";
  }
}

function isValidPoint(point: RoutingPoint) {
  return Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
    Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180;
}

function samePoint(a: RoutingPoint, b: RoutingPoint) {
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function routeWithOsrm(
  points: RoutingPoint[],
  options: { baseUrl?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<OsrmRouteResult> {
  if (points.length < 2 || points.length > 24 || !points.every(isValidPoint)) {
    throw new RoutingError("اختر نقطتين صحيحتين على الأقل لحساب الطريق.", 400);
  }

  const distinct: RoutingPoint[] = [];
  const pointIndexes: number[] = [];
  for (const point of points) {
    if (distinct.length === 0 || !samePoint(distinct[distinct.length - 1], point)) {
      distinct.push(point);
    }
    pointIndexes.push(distinct.length - 1);
  }
  if (distinct.length < 2) {
    throw new RoutingError("نقطتا بداية ونهاية الطريق متطابقتان.", 400);
  }

  const configuredBase = (options.baseUrl ?? "https://router.project-osrm.org").trim().replace(/\/+$/, "");
  let base: URL;
  try {
    base = new URL(configuredBase);
  } catch {
    throw new RoutingError("عنوان خدمة التوجيه غير صالح.", 503);
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new RoutingError("عنوان خدمة التوجيه يجب أن يكون HTTP أو HTTPS صالحًا.", 503);
  }

  const coordinates = distinct.map(({ lng, lat }) => `${lng},${lat}`).join(";");
  const requestUrl = new URL(`${base.toString().replace(/\/$/, "")}/route/v1/driving/${coordinates}`);
  requestUrl.searchParams.set("overview", "full");
  requestUrl.searchParams.set("geometries", "geojson");
  requestUrl.searchParams.set("steps", "false");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetcher ?? fetch)(requestUrl, {
      headers: {
        "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)",
        "Referer": "https://sekka-go.pages.dev/",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new RoutingError("تعذر الوصول إلى خدمة حساب الطريق. حاول مرة أخرى.", 503);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new RoutingError("خدمة حساب الطريق أعادت استجابة غير صالحة.", 502);
    }
    const data = payload as {
      code?: unknown;
      routes?: Array<{
        distance?: unknown;
        duration?: unknown;
        geometry?: { type?: unknown; coordinates?: unknown };
        legs?: Array<{ distance?: unknown; duration?: unknown }>;
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !finiteNonNegative(route.distance) ||
      !finiteNonNegative(route.duration) || route.geometry?.type !== "LineString" ||
      !Array.isArray(coordinates) || coordinates.length < 2 ||
      coordinates.length > 20_000 ||
      !coordinates.every((coordinate) =>
        Array.isArray(coordinate) && coordinate.length >= 2 &&
        Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]) &&
        coordinate[0] >= -180 && coordinate[0] <= 180 &&
        coordinate[1] >= -90 && coordinate[1] <= 90
      ) ||
      !Array.isArray(route.legs) || route.legs.length !== distinct.length - 1 ||
      !route.legs.every((leg) => finiteNonNegative(leg.distance) && finiteNonNegative(leg.duration))) {
      throw new RoutingError("خدمة حساب الطريق أعادت بيانات غير مكتملة؛ لم نعرض خطًا تقريبيًا.", 502);
    }

    const segments: RouteSegment[] = [];
    for (let index = 0; index < points.length - 1; index++) {
      const fromIndex = pointIndexes[index];
      const toIndex = pointIndexes[index + 1];
      if (fromIndex === toIndex) {
        segments.push({
          from_stop_sequence: index + 1,
          to_stop_sequence: index + 2,
          distance_km: 0,
          duration_min: 0,
        });
        continue;
      }
      const leg = route.legs[fromIndex];
      if (!leg) throw new RoutingError("تعذر مطابقة أجزاء الطريق مع ترتيب المحطات.", 502);
      segments.push({
        from_stop_sequence: index + 1,
        to_stop_sequence: index + 2,
        distance_km: Number(leg.distance) / 1000,
        duration_min: Number(leg.duration) / 60,
      });
    }

    return {
      provider: base.hostname === "router.project-osrm.org" ? "osrm_demo" : "osrm",
      distance_km: route.distance / 1000,
      duration_min: route.duration / 60,
      geometry: {
        type: "LineString",
        coordinates: (coordinates as [number, number][]).map(([lng, lat]) => [lng, lat]),
      },
      segments,
    };
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RoutingError("انتهت مهلة حساب الطريق. تحقق من الاتصال وحاول مرة أخرى.", 503);
    }
    throw new RoutingError("خدمة حساب الطريق غير متاحة الآن. لم يتغير الحجز.", 503);
  } finally {
    clearTimeout(timeout);
  }
}
