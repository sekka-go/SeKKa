import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { RouteGeometry, RouteSegment } from "./api";
import { GREATER_CAIRO_BOUNDS, isInsideGreaterCairo } from "./lib/greater-cairo";

export type MapPoint = {
  lat: number | null;
  lng: number | null;
  kind?: "pickup" | "dropoff";
  sequence?: number;
  label?: string;
};
export type MapPickMode = "pickup" | "dropoff";
type RouteDirection = "outbound" | "return";

type MapPickerProps = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  mode: MapPickMode;
  route?: RouteGeometry | null;
  routePlaces?: MapPoint[];
  direction?: RouteDirection;
  readOnly?: boolean;
  restrictToGreaterCairo?: boolean;
  onOutsidePick?: () => void;
  onPick: (mode: MapPickMode, point: MapPoint) => void;
};

const CAIRO: L.LatLngExpression = [30.0444, 31.2357];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function hasCoordinates(point: MapPoint | null | undefined): point is MapPoint & { lat: number; lng: number } {
  return typeof point?.lat === "number" && Number.isFinite(point.lat) &&
    typeof point.lng === "number" && Number.isFinite(point.lng);
}

function validLine(line: RouteGeometry["outbound"] | undefined): line is NonNullable<RouteGeometry["outbound"]> {
  return line?.type === "LineString" && Array.isArray(line.coordinates) &&
    line.coordinates.length > 1 && line.coordinates.every(([lng, lat]) =>
      Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
      Number.isFinite(lat) && lat >= -90 && lat <= 90
    );
}

function selectedSegments(route: RouteGeometry | null | undefined, direction?: RouteDirection) {
  const selected: Array<{ direction: RouteDirection; label: string; segments?: RouteSegment[] }> = [];
  if (!direction || direction === "outbound") {
    selected.push({ direction: "outbound", label: "الذهاب", segments: route?.outbound_segments });
  }
  if (!direction || direction === "return") {
    selected.push({ direction: "return", label: "العودة", segments: route?.return_segments });
  }
  return selected;
}

export default function MapPicker({
  pickup,
  dropoff,
  mode,
  route,
  routePlaces = [],
  direction,
  readOnly = false,
  restrictToGreaterCairo = false,
  onOutsidePick,
  onPick,
}: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const onOutsidePickRef = useRef(onOutsidePick);
  const modeRef = useRef(mode);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(() => { onOutsidePickRef.current = onOutsidePick; }, [onOutsidePick]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    const cairoBounds = L.latLngBounds(
      [GREATER_CAIRO_BOUNDS.south, GREATER_CAIRO_BOUNDS.west],
      [GREATER_CAIRO_BOUNDS.north, GREATER_CAIRO_BOUNDS.east],
    );
    const map = L.map(elementRef.current, {
      zoomControl: false,
      attributionControl: true,
      ...(restrictToGreaterCairo ? { maxBounds: cairoBounds, maxBoundsViscosity: 1 } : {}),
    }).setView(CAIRO, restrictToGreaterCairo ? 10 : 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    let failedTiles = 0;
    const tileTimeout = window.setTimeout(() => setTileError(true), 12_000);
    const tiles = L.tileLayer(TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19,
    });
    tiles.on("loading", () => setTilesLoaded(false));
    tiles.on("load", () => {
      window.clearTimeout(tileTimeout);
      setTilesLoaded(true);
      setTileError(failedTiles > 0);
    });
    tiles.on("tileerror", () => {
      failedTiles += 1;
      setTileError(true);
    });
    tiles.on("tileload", () => {
      failedTiles = Math.max(0, failedTiles - 1);
      if (failedTiles === 0) setTileError(false);
    });
    tiles.addTo(map);

    map.on("click", (event) => {
      if (!readOnly) {
        if (restrictToGreaterCairo && !isInsideGreaterCairo(event.latlng.lat, event.latlng.lng)) {
          onOutsidePickRef.current?.();
          map.panInsideBounds(cairoBounds, { animate: true });
          return;
        }
        onPickRef.current(modeRef.current, {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          kind: modeRef.current,
        });
      }
    });

    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    const resize = () => map.invalidateSize();
    window.setTimeout(resize, 0);
    window.addEventListener("resize", resize);

    return () => {
      window.clearTimeout(tileTimeout);
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [readOnly, restrictToGreaterCairo]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const fitPoints: L.LatLngExpression[] = [];
    const orderedStops = routePlaces.length
      ? routePlaces
      : [pickup, dropoff].filter((point): point is MapPoint => point !== null);

    orderedStops.forEach((point, index) => {
      if (!hasCoordinates(point)) return;
      const sequence = Number.isInteger(point.sequence) && Number(point.sequence) > 0
        ? Number(point.sequence)
        : index + 1;
      const kind = point.kind ?? (index === 0 ? "pickup" : "dropoff");
      const markerHtml = `<span class="map-stop-badge map-stop-${kind}">${sequence}</span>`;
      const icon = L.divIcon({
        className: "sekka-map-marker",
        html: markerHtml,
        iconSize: [36, 42],
        iconAnchor: [18, 38],
      });
      const marker = L.marker([point.lat, point.lng], {
        icon,
        keyboard: true,
        draggable: !readOnly && routePlaces.length === 0,
      });
      marker.bindTooltip(point.label ?? (kind === "pickup" ? `ركوب · محطة ${sequence}` : `نزول · محطة ${sequence}`));
      if (!readOnly && routePlaces.length === 0) {
        marker.on("dragend", () => {
          const moved = marker.getLatLng();
          if (restrictToGreaterCairo && !isInsideGreaterCairo(moved.lat, moved.lng)) {
            marker.setLatLng([point.lat, point.lng]);
            onOutsidePickRef.current?.();
            return;
          }
          onPickRef.current(kind, { lat: moved.lat, lng: moved.lng, kind, label: point.label });
        });
      }
      marker.addTo(layers);
      fitPoints.push([point.lat, point.lng]);
    });

    for (const item of selectedSegments(route, direction)) {
      if (route?.provider === "google") continue;
      const line = route?.[item.direction];
      if (!validLine(line)) continue;
      const latLngs = line.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
      L.polyline(latLngs, {
        color: item.direction === "outbound" ? "#d9a900" : "#138e94",
        weight: 5,
        opacity: 0.88,
      }).addTo(layers);
      fitPoints.push(...latLngs);
    }

    if (fitPoints.length > 1) {
      map.fitBounds(L.latLngBounds(fitPoints), { padding: [28, 28], maxZoom: 14 });
    } else if (fitPoints.length === 1) {
      map.setView(fitPoints[0], 14);
    }
  }, [pickup, dropoff, route, routePlaces, direction]);

  const visibleStops = routePlaces.length
    ? routePlaces
    : [pickup, dropoff].filter((point): point is MapPoint => point !== null);
  const segmentRoutes = selectedSegments(route, direction);
  const hasRouteGeometry = route?.provider !== "google" && segmentRoutes.some(({ direction: routeDirection }) =>
    validLine(route?.[routeDirection])
  );
  const hasVisibleStops = visibleStops.some(hasCoordinates);

  return <div className={`map-picker${readOnly ? " map-picker-readonly" : ""}`}>
    <div className="map-canvas">
      <div ref={elementRef} className="leaflet-map" role="application" tabIndex={0} aria-label="خريطة اختيار وعرض مسار الرحلة" />
      {!tilesLoaded && !tileError && <div className="map-state" role="status">جاري تحميل الخريطة…</div>}
      {tileError && <div className="map-state map-state-warning" role="status">تعذر تحميل بعض بلاطات الخريطة. يمكنك الاستمرار في اختيار الموقع.</div>}
      {!hasVisibleStops && !hasRouteGeometry && readOnly && <div className="map-state map-state-warning" role="status">لا توجد بيانات موقع كافية لعرض هذا المسار.</div>}
      {hasVisibleStops && !hasRouteGeometry && readOnly && <div className="map-state map-state-warning" role="status">تعذر تحميل الطريق الفعلي؛ لن نعرض خطًا تقريبيًا بدلًا منه.</div>}
      {!readOnly && <div className="map-hint">اضغط على الخريطة لتحديد {mode === "pickup" ? "نقطة الركوب" : "نقطة النزول"}{restrictToGreaterCairo ? " · القاهرة الكبرى فقط" : ""}</div>}
      {readOnly && <div className="map-hint">خريطة OpenStreetMap · الطريق الفعلي</div>}
    </div>

    {visibleStops.length > 0 && <ol className="map-stop-list" aria-label="ترتيب محطات الرحلة">
      {visibleStops.map((point, index) => {
        const sequence = Number.isInteger(point.sequence) && Number(point.sequence) > 0
          ? Number(point.sequence)
          : index + 1;
        const kind = point.kind ?? (index === 0 ? "pickup" : "dropoff");
        const label = point.label ?? `${kind === "pickup" ? "ركوب" : "نزول"} · محطة ${sequence}`;
        return <li key={`${kind}-${sequence}-${index}`}>
          <span className={`map-stop-list-number map-stop-${kind}`}>{sequence}</span>
          <span>{label}</span>
          {!hasCoordinates(point) && <small>الموقع غير متاح</small>}
        </li>;
      })}
    </ol>}

    {segmentRoutes.some((item) => item.segments?.length) && <div className="map-segments">
      {segmentRoutes.map((item) => item.segments?.map((segment) =>
        <div className="map-segment-row" key={`${item.direction}-${segment.from_stop_sequence}-${segment.to_stop_sequence}`}>
          <strong>{item.label} · من محطة {segment.from_stop_sequence} إلى {segment.to_stop_sequence}</strong>
          <span>{segment.distance_km.toFixed(1)} كم</span>
          <span>حوالي {Math.round(segment.duration_min)} د</span>
        </div>
      ))}
    </div>}
    <p className="map-data-caption">أوقات الطريق تقديرية ولا تشمل حركة المرور الحية.</p>
  </div>;
}
