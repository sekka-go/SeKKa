import { useEffect, useRef } from "react";
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

export default function MapPicker({ pickup, dropoff, mode, route, onPick }: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView(CAIRO, 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (event) => onPick(mode, { lat: event.latlng.lat, lng: event.latlng.lng }));
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    const resize = () => map.invalidateSize();
    window.setTimeout(resize, 0);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [mode, onPick]);

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

  return <div className="map-picker"><div ref={elementRef} className="map-canvas" /><div className="map-hint">اضغط على الخريطة لتحديد {mode === "pickup" ? "نقطة الركوب" : "نقطة النزول"}</div></div>;
}
