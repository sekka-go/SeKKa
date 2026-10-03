import { useState, type FormEvent } from "react";
import { api } from "../api";
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
  const [error, setError] = useState("");

  const search = async (event: FormEvent) => {
    event.preventDefault();
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
    <div className="location-search-heading"><i className="point-dot pickup-dot" /><strong>{title}</strong><button type="button" className="location-map-pin" onClick={onChooseMap} aria-label={`حدد ${title} على الخريطة`} title="حدد على الخريطة">⌖</button></div>
    <form className="location-search-form" onSubmit={(event) => void search(event)}>
      <input aria-label={`ابحث عن ${title}`} value={value} onChange={(event) => { onChange(event.target.value); setSuggestions([]); setError(""); }} placeholder={kind === "pickup" ? "ابحث عن نقطة الركوب" : "ابحث عن نقطة النزول"} autoComplete="off" />
      <button className="location-search-submit" type="submit" disabled={loading} aria-label={`بحث ${title}`}>{loading ? "…" : "⌕"}</button>
    </form>
    {error && <p className="location-search-message" role="status">{error}</p>}
    {suggestions.length > 0 && <ul className="location-search-results" aria-label={`نتائج ${title}`}>
      {suggestions.map((item, index) => <li key={`${item.lat}-${item.lng}-${index}`}><button type="button" onClick={() => { onSelect({ lat: item.lat, lng: item.lng, kind, label: item.label }); setSuggestions([]); setError(""); }}>{item.label}<span>اختيار ←</span></button></li>)}
    </ul>}
    <small className="location-search-attribution">نتائج الأماكن من OpenStreetMap</small>
  </div>;
}
