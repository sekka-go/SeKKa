import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { RouteGeometry } from "./api";

export type MapPoint = { lat: number; lng: number };
export type MapPickMode = "pickup" | "dropoff";

type MapPickerProps = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  mode: MapPickMode;
  route?: RouteGeometry | null;
  onPick: (mode: MapPickMode, point: MapPoint) => void;
};

const CAIRO: L.LatLngExpression = [30.0444, 31.2357];
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MapPicker({ pickup, dropoff, mode, route, onPick }: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const pickRef = useRef(onPick);
  const modeRef = useRef(mode);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    pickRef.current = onPick;
    modeRef.current = mode;
  }, [mode, onPick]);

  useEffect(() => {
    if (!elementRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView(CAIRO, 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const tiles = L.tileLayer(TILE_URL, {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    });
    tiles.on("tileerror", () => setTilesUnavailable(true));
    tiles.on("tileload", () => setTilesUnavailable(false));
    tiles.addTo(map);
    map.on("click", (event) => pickRef.current(modeRef.current, { lat: event.latlng.lat, lng: event.latlng.lng }));
    mapRef.current = map;
    tileLayerRef.current = tiles;
    layersRef.current = L.layerGroup().addTo(map);

    const resize = () => map.invalidateSize();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resize);
    if (elementRef.current) observer?.observe(elementRef.current);
    window.setTimeout(resize, 0);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    const points: L.LatLngExpression[] = [];
    const marker = (point: MapPoint, label: string, className: string) => {
      const icon = L.divIcon({ className: "sekka-map-marker", html: `<span class="${className}">${label}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([point.lat, point.lng], { icon }).addTo(layers);
      points.push([point.lat, point.lng]);
    };
    if (pickup) marker(pickup, "أ", "marker-pickup");
    if (dropoff) marker(dropoff, "و", "marker-dropoff");
    const line = route?.outbound?.coordinates;
    if (line?.length) {
      const latLngs = line.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
      L.polyline(latLngs, { color: "#d9a900", weight: 5, opacity: 0.9 }).addTo(layers);
      points.push(...latLngs);
    }
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 14 });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [pickup, dropoff, route]);

  function useCurrentLocation() {
    setLocationMessage("");
    if (!("geolocation" in navigator)) {
      setLocationMessage("تحديد الموقع غير مدعوم في هذا المتصفح.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      pickRef.current(modeRef.current, point);
      mapRef.current?.setView([point.lat, point.lng], 15);
    }, () => {
      setLocationMessage("تعذر تحديد موقعك. اسمح بالوصول للموقع أو اختر النقطة على الخريطة.");
    }, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 });
  }

  return (
    <div className="map-picker">
      <div ref={elementRef} className="map-canvas" />
      <div className="map-picker-actions">
        <button type="button" className="map-location-button" onClick={useCurrentLocation}>استخدم موقعي</button>
        <div className="map-hint">اضغط على الخريطة لتحديد {mode === "pickup" ? "نقطة الركوب" : "نقطة النزول"}</div>
      </div>
      {(tilesUnavailable || locationMessage) && (
        <div className="map-error" role="status">
          <span>{locationMessage || "تعذر تحميل بعض بلاطات الخريطة. تحقق من الاتصال."}</span>
          {tilesUnavailable && <button type="button" onClick={() => { setTilesUnavailable(false); tileLayerRef.current?.redraw(); }}>إعادة تحميل الخريطة</button>}
        </div>
      )}
    </div>
  );
}
