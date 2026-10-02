import { useEffect, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import { api } from "./api";
import type { RouteGeometry } from "./api";

export type MapPoint = {
  lat: number | null;
  lng: number | null;
  placeId?: string;
  searchId?: string;
  label?: string;
};
export type MapPickMode = "pickup" | "dropoff";

type SearchSuggestion = { place_id: string; label: string };
type LocationSearchResponse = {
  search_id: string;
  suggestions: SearchSuggestion[];
  daily_remaining: number;
  monthly_remaining: number;
};

type MapPickerProps = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  mode: MapPickMode;
  route?: RouteGeometry | null;
  routePlaces?: MapPoint[];
  token?: string;
  googleMapsEmbedKey?: string;
  readOnly?: boolean;
  onPick: (mode: MapPickMode, point: MapPoint) => void;
};

const CAIRO: L.LatLngExpression = [30.0444, 31.2357];

function waypoint(point: MapPoint) {
  if (point.placeId) return `place_id:${point.placeId}`;
  if (typeof point.lat === "number" && typeof point.lng === "number") return `${point.lat},${point.lng}`;
  return "";
}

function googleMapUrl(key: string, pickup: MapPoint | null, dropoff: MapPoint | null, routePlaces: MapPoint[] = []) {
  const stops = routePlaces.map(waypoint).filter(Boolean);
  const visibleStops = stops.length >= 2 ? stops : [pickup, dropoff].filter((p): p is MapPoint => Boolean(p)).map(waypoint).filter(Boolean);
  const params = new URLSearchParams({ key });
  if (visibleStops.length >= 2) {
    params.set("origin", visibleStops[0]);
    params.set("destination", visibleStops[visibleStops.length - 1]);
    if (visibleStops.length > 2) params.set("waypoints", visibleStops.slice(1, -1).join("|"));
    return `https://www.google.com/maps/embed/v1/directions?${params}`;
  }
  const point = pickup ?? dropoff;
  if (point) {
    params.set("q", waypoint(point) || "Cairo, Egypt");
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }
  params.set("center", "30.0444,31.2357");
  params.set("zoom", "11");
  params.set("maptype", "roadmap");
  return `https://www.google.com/maps/embed/v1/view?${params}`;
}

export default function MapPicker({
  pickup, dropoff, mode, route, routePlaces = [], token, googleMapsEmbedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY ?? "", readOnly = false, onPick,
}: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const modeRef = useRef(mode);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<LocationSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const googleEnabled = Boolean(googleMapsEmbedKey);
  const googleRequired = route?.provider === "google" || [pickup, dropoff, ...routePlaces].some((point) => Boolean(point?.placeId));
  const activePoint = mode === "pickup" ? pickup : dropoff;

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (googleEnabled || googleRequired || !elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView(CAIRO, 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (event) => {
      if (!readOnly) onPickRef.current(modeRef.current, { lat: event.latlng.lat, lng: event.latlng.lng });
    });
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
  }, [googleEnabled, googleRequired, readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    const points: L.LatLngExpression[] = [];
    const marker = (point: MapPoint, label: string, className: string) => {
      if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
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

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!token || value.length < 3 || searching) return;
    setSearching(true);
    setSearchError("");
    setSearch(null);
    try {
      const result = await api<LocationSearchResponse>("/locations/search", { method: "POST", token, body: { query: value } });
      setSearch(result);
      if (!result.suggestions.length) setSearchError("مفيش نتائج مطابقة. جرّب عنوانًا أو معلمًا أوضح.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "تعذر البحث عن العنوان.");
    } finally {
      setSearching(false);
    }
  };

  const chooseSuggestion = (suggestion: SearchSuggestion) => {
    if (!search) return;
    onPick(mode, {
      lat: null, lng: null, placeId: suggestion.place_id, searchId: search.search_id, label: suggestion.label,
    });
    setQuery("");
    setSearch(null);
    setSearchError("");
  };

  return <div className="map-picker">
    {googleEnabled && !readOnly && token && <div className="map-search">
      <form className="map-search-form" onSubmit={(event) => void submitSearch(event)}>
        <input
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSearch(null); setSearchError(""); }}
          minLength={3}
          maxLength={160}
          placeholder={mode === "pickup" ? "ابحث عن عنوان نقطة الركوب" : "ابحث عن عنوان نقطة النزول"}
          aria-label={mode === "pickup" ? "ابحث عن نقطة الركوب" : "ابحث عن نقطة النزول"}
        />
        <button type="submit" disabled={searching || query.trim().length < 3}>{searching ? "جاري البحث…" : "ابحث"}</button>
      </form>
      <small className="map-search-policy">بحثان جديدان يوميًا لكل حساب؛ لا يمكن تكرار العبارة. الحد الإجمالي 10,000 طلب شهريًا.</small>
      {search && <small className="map-search-remaining">متبقي اليوم: {search.daily_remaining} · من الحد الشهري: {search.monthly_remaining}</small>}
      {searchError && <p className="map-search-error" role="status">{searchError}</p>}
      {search?.suggestions.length ? <div className="map-search-results" role="listbox" aria-label="نتائج Google Maps">
        {search.suggestions.map((suggestion) => <button type="button" role="option" className="map-search-result" key={suggestion.place_id} onClick={() => chooseSuggestion(suggestion)}>{suggestion.label}</button>)}
        <span className="google-maps-attribution" translate="no">Google Maps</span>
      </div> : null}
      {!searchError && activePoint?.label && <p className="map-selected-label">الموقع المحدد: {activePoint.label}</p>}
    </div>}
    <div className="map-canvas">
      {googleEnabled
        ? <iframe title="خريطة Google Maps للموقع أو المسار" src={googleMapUrl(googleMapsEmbedKey, pickup, dropoff, routePlaces)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        : googleRequired
          ? <div className="map-unavailable">إعداد مفتاح Google Maps للعرض مطلوب لهذا المسار.</div>
          : <div ref={elementRef} className="leaflet-map" />}
    </div>
    {!googleEnabled && !googleRequired
      ? <div className="map-hint">{readOnly ? "الخريطة من OpenStreetMap" : `اضغط على الخريطة لتحديد ${mode === "pickup" ? "نقطة الركوب" : "نقطة النزول"}`}</div>
      : googleEnabled ? <div className="google-map-caption" translate="no">Google Maps</div> : null}
  </div>;
}
