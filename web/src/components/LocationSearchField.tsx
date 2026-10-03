import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, type SavedPlace } from "../api";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import type { MapPoint, MapPickMode } from "../MapPicker";

type Suggestion = { label: string; lat: number; lng: number };

export default function LocationSearchField({
  kind,
  title,
  value,
  token,
  onChange,
  onSelect,
  onChooseMap,
  onFocus,
  pointSelected,
  savedPlaces = [],
}: {
  kind: MapPickMode;
  title: string;
  value: string;
  token: string;
  onChange: (value: string) => void;
  onSelect: (point: MapPoint) => void;
  onChooseMap: () => void;
  onFocus: () => void;
  pointSelected: boolean;
  savedPlaces?: SavedPlace[];
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const requestId = useRef(0);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const query = value.trim();
    const currentRequest = ++requestId.current;
    const isCoordinate = /^-?\d{1,3}(?:\.\d+)?\s*[,،]\s*-?\d{1,3}(?:\.\d+)?$/.test(query);
    if (query.length < 3 || isCoordinate || query.startsWith("موقعي الحالي ·")) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void api<{ suggestions: Suggestion[] }>("/locations/search", {
        method: "POST",
        token,
        body: { query },
      }).then((result) => {
        if (currentRequest !== requestId.current) return;
        setSuggestions(result.suggestions);
        if (result.suggestions.length === 0) {
          setError("مفيش نتائج داخل القاهرة الكبرى. جرّب اسم شارع أو منطقة أقرب.");
        }
      }).catch((cause) => {
        if (currentRequest !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : "تعذر البحث الآن. حاول مرة أخرى.");
        setSuggestions([]);
      }).finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [value, token]);

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError("تحديد الموقع غير متاح على هذا الجهاز. استخدم البحث النصي أو الخريطة.");
      return;
    }

    setLocating(true);
    setError("");
    setSuggestions([]);
    setShowSavedPlaces(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        if (!isInsideGreaterCairo(lat, lng)) {
          setError("موقعك الحالي خارج القاهرة الكبرى. ابحث عن موقع داخل نطاق الخدمة أو حدده على الخريطة.");
        } else {
          skipNextSearch.current = true;
          const label = `موقعي الحالي · ${lat.toFixed(5)}، ${lng.toFixed(5)}`;
          onSelect({ lat, lng, kind, label });
        }
        setLocating(false);
      },
      (cause) => {
        setError(cause.code === cause.PERMISSION_DENIED
          ? "اسمح للتطبيق بالوصول لموقعك أو استخدم البحث النصي أو الخريطة."
          : "تعذر تحديد موقعك الآن. حاول مرة أخرى أو استخدم البحث النصي أو الخريطة.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const selectSuggestion = (item: Suggestion) => {
    skipNextSearch.current = true;
    onSelect({ lat: item.lat, lng: item.lng, kind, label: item.label });
    setSuggestions([]);
    setShowSavedPlaces(false);
    setError("");
  };
  return <div className={`location-search-field location-search-${kind}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) window.setTimeout(() => setShowSavedPlaces(false), 100); }}>
    <div className="location-search-heading">
      <i className={`point-dot ${kind === "pickup" ? "pickup-dot" : "dropoff-dot"}`} />
      <strong>{title}</strong>
      <span className={pointSelected ? "location-point-status is-selected" : "location-point-status"} title={pointSelected ? "تم التحديد" : "اختيار مطلوب"} aria-label={pointSelected ? "تم تحديد الموقع" : "يجب اختيار الموقع من النتائج"}>{pointSelected ? "✓" : "!"}</span>
      <button type="button" className="location-device-pin" onClick={useDeviceLocation} disabled={locating} aria-label={`استخدم موقعك الحالي لتحديد ${title}`} title="استخدم موقعي الحالي">{locating ? "…" : "⌖"}</button>
      <button type="button" className="location-map-pin" onClick={() => { setShowSavedPlaces(false); onChooseMap(); }} aria-label={`اختيار ${title} من الخريطة`} title="اختيار من الخريطة">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" />
        </svg>
      </button>
    </div>
    <div className="location-search-form" role="search">
      <input
        aria-label={`ابحث عن ${title}`}
        value={value}
        onChange={(event) => {
          requestId.current++;
          onChange(event.target.value);
          setShowSavedPlaces(true);
          setSuggestions([]);
          setError("");
          setLoading(false);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
          } else if (event.key === "Escape") {
            setShowSavedPlaces(false);
          }
        }}
        onFocus={(event) => { setShowSavedPlaces(true); onFocus(); }}
        placeholder={kind === "pickup" ? "ابحث عن نقطة الركوب" : "ابحث عن نقطة النزول"}
        autoComplete="off"
      />
    </div>
    {loading && <p className="location-search-message" role="status">جاري البحث…</p>}
    {error && <p className="location-search-message" role="status">{error}</p>}
    {(showSavedPlaces && savedPlaces.length > 0 || suggestions.length > 0) && <ul className="location-search-results" aria-label={`نتائج ${title}`}>
      {showSavedPlaces && savedPlaces.length > 0 && <li className="location-search-saved-heading">نقاطك المفضلة</li>}
      {showSavedPlaces && savedPlaces.map((place) => <li key={`favorite-${place.place_type}-${place.lat}-${place.lng}`}>
        <button type="button" className="location-search-saved-option" onClick={() => { onSelect({ lat: place.lat, lng: place.lng, kind, label: place.label }); setShowSavedPlaces(false); setSuggestions([]); setError(""); }}><span className="location-search-saved-mark">⌖</span><span><strong>{place.place_type === "home" ? "الركوب المفضل" : place.place_type === "work" ? "الوصول المفضل" : "مكان متكرر"}</strong><small>{place.label}</small></span><span>اختيار ←</span></button>
      </li>)}
      {suggestions.map((item, index) => <li key={`${item.lat}-${item.lng}-${index}`}>
        <button type="button" onClick={() => selectSuggestion(item)}>{item.label}<span>اختيار ←</span></button>
      </li>)}
    </ul>}
  </div>;
}
