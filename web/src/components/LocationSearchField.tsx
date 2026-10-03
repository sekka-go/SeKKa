import { useState, type KeyboardEvent } from "react";
import { api } from "../api";
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
}: {
  kind: MapPickMode;
  title: string;
  value: string;
  token: string;
  onChange: (value: string) => void;
  onSelect: (point: MapPoint) => void;
  onChooseMap: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError("تحديد الموقع غير متاح على هذا الجهاز. استخدم البحث النصي أو الخريطة.");
      return;
    }

    setLocating(true);
    setError("");
    setSuggestions([]);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        if (!isInsideGreaterCairo(lat, lng)) {
          setError("موقعك الحالي خارج القاهرة الكبرى. ابحث عن موقع داخل نطاق الخدمة أو حدده على الخريطة.");
        } else {
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

  const search = async () => {
    const query = value.trim();
    if (query.length < 3) { setError("اكتب ٣ أحرف على الأقل للبحث."); setSuggestions([]); return; }
    setLoading(true); setError("");
    try {
      const result = await api<{ suggestions: Suggestion[] }>("/locations/search", {
        method: "POST", token, body: { query },
      });
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) setError("مفيش نتائج داخل القاهرة الكبرى. جرّب اسم شارع أو منطقة أقرب.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر البحث الآن. حاول مرة أخرى.");
      setSuggestions([]);
    } finally { setLoading(false); }
  };

  return <div className={`location-search-field location-search-${kind}`}>
    <div className="location-search-heading"><i className={`point-dot ${kind === "pickup" ? "pickup-dot" : "dropoff-dot"}`} /><strong>{title}</strong><button type="button" className="location-device-pin" onClick={useDeviceLocation} disabled={locating} aria-label={`استخدم موقعك الحالي لتحديد ${title}`} title="استخدم موقعي الحالي">{locating ? "…" : "⌖"}</button><button type="button" className="location-map-pin" onClick={onChooseMap} aria-label={`حدد ${title} على الخريطة`} title="حدد على الخريطة">خريطة</button></div>
    <div className="location-search-form" role="search">
      <input aria-label={`ابحث عن ${title}`} value={value} onChange={(event) => { onChange(event.target.value); setSuggestions([]); setError(""); }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder={kind === "pickup" ? "ابحث عن نقطة الركوب" : "ابحث عن نقطة النزول"} autoComplete="off" />
      <button className="location-search-submit" type="button" onClick={() => void search()} disabled={loading} aria-label={`بحث ${title}`}>{loading ? "…" : "⌕"}</button>
    </div>
    {error && <p className="location-search-message" role="status">{error}</p>}
    {suggestions.length > 0 && <ul className="location-search-results" aria-label={`نتائج ${title}`}>
      {suggestions.map((item, index) => <li key={`${item.lat}-${item.lng}-${index}`}><button type="button" onClick={() => { onSelect({ lat: item.lat, lng: item.lng, kind, label: item.label }); setSuggestions([]); setError(""); }}>{item.label}<span>اختيار ←</span></button></li>)}
    </ul>}
    <small className="location-search-attribution">نتائج الأماكن من OpenStreetMap</small>
  </div>;
}
