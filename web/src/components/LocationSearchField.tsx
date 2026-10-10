import { t } from "../i18n/runtime";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, type SavedPlace } from "../api";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { addressParts, reverseGeocode, safeAddressLabel, type LocationSuggestion } from "../lib/location-address";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import type { MapPoint, MapPickMode } from "../MapPicker";

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
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [showSavedPlaces, setShowSavedPlaces] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing] = useState(!pointSelected);
  const resolvedSavedPlaces = useResolvedLocationPoints(token, savedPlaces.map((place) => ({ lat: place.lat, lng: place.lng, label: place.label })));
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const activeSearch = useRef<AbortController | null>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => { setEditing(!pointSelected); }, [pointSelected]);
  useEffect(() => () => {
    requestId.current++;
    activeSearch.current?.abort();
    activeSearch.current = null;
  }, []);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const query = value.trim();
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    activeSearch.current = controller;
    const isCoordinate = /^-?\d{1,3}(?:\.\d+)?\s*[,،]\s*-?\d{1,3}(?:\.\d+)?$/.test(query);
    if (query.length < 3 || isCoordinate || query.startsWith("موقعي الحالي ·")) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      void api<{ suggestions: LocationSuggestion[] }>("/locations/search", {
        method: "POST",
        token,
        body: { query },
        signal: controller.signal,
      }).then((result) => {
        if (currentRequest !== requestId.current) return;
        const seenLabels = new Set<string>();
        const seenCoordinates = new Set<string>();
        const uniqueSuggestions = result.suggestions.filter((item) => {
          const labelKey = item.label.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-EG");
          const coordinateKey = `${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;
          if (seenLabels.has(labelKey) || seenCoordinates.has(coordinateKey)) return false;
          seenLabels.add(labelKey);
          seenCoordinates.add(coordinateKey);
          return true;
        });
        setSuggestions(uniqueSuggestions);
        if (uniqueSuggestions.length === 0) {
          setError(t("مفيش نتائج داخل القاهرة الكبرى. جرّب اسم شارع أو منطقة أقرب."));
        }
      }).catch((cause) => {
        if (currentRequest !== requestId.current) return;
        setError(cause instanceof Error ? cause.message : "تعذر البحث الآن. حاول مرة أخرى.");
        setSuggestions([]);
      }).finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (activeSearch.current === controller) activeSearch.current = null;
      if (requestId.current === currentRequest) requestId.current++;
    };
  }, [value, token]);

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError(t("تحديد الموقع غير متاح على هذا الجهاز. استخدم البحث النصي أو الخريطة."));
      return;
    }

    setLocating(true);
    activeSearch.current?.abort();
    setError("");
    const locationRequest = ++requestId.current;
    setSuggestions([]);
    setShowSavedPlaces(false);
    setSearchOpen(false);
    setEditing(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        if (locationRequest !== requestId.current) return;
        if (!isInsideGreaterCairo(lat, lng)) {
          setError(t("موقعك الحالي خارج القاهرة الكبرى. ابحث عن موقع داخل نطاق الخدمة أو حدده على الخريطة."));
        } else {
          skipNextSearch.current = true;
          try {
            const address = await reverseGeocode(token, lat, lng);
            if (locationRequest === requestId.current) onSelect({ lat, lng, kind, label: address.label, primaryLabel: address.primary, secondaryLabel: address.secondary });
          } catch {
            if (locationRequest === requestId.current) onSelect({ lat, lng, kind, label: "موقعي الحالي داخل القاهرة الكبرى", primaryLabel: "موقعي الحالي", secondaryLabel: "القاهرة الكبرى" });
          }
        }
        if (locationRequest === requestId.current) setLocating(false);
      },
      (cause) => {
        if (locationRequest !== requestId.current) return;
        setError(cause.code === cause.PERMISSION_DENIED
          ? "اسمح للتطبيق بالوصول لموقعك أو استخدم البحث النصي أو الخريطة."
          : "تعذر تحديد موقعك الآن. حاول مرة أخرى أو استخدم البحث النصي أو الخريطة.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const selectSuggestion = (item: LocationSuggestion) => {
    activeSearch.current?.abort();
    requestId.current++;
    skipNextSearch.current = true;
    onSelect({ lat: item.lat, lng: item.lng, kind, label: item.label, primaryLabel: item.primary, secondaryLabel: item.secondary });
    setSuggestions([]);
    setLoading(false);
    setShowSavedPlaces(false);
    setSearchOpen(false);
    setEditing(false);
    setError("");
  };
  const searchPrecisely = () => {
    const query = value.trim().replace(/\s+/g, " ");
    if (query.length < 3 || /^-?\d{1,3}(?:\.\d+)?\s*[,،]\s*-?\d{1,3}(?:\.\d+)?$/.test(query)) return;
    const currentRequest = ++requestId.current;
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setLoading(true);
    setError("");
    setSearchOpen(true);
    setShowSavedPlaces(false);
    void api<{ suggestions: LocationSuggestion[] }>("/locations/search/precise", {
      method: "POST",
      token,
      body: { query },
      signal: controller.signal,
    }).then((result) => {
      if (currentRequest !== requestId.current) return;
      const seen = new Set<string>();
      const unique = result.suggestions.filter((item) => {
        const key = item.label.normalize("NFKC").trim().replace(/[\s،,]+/g, " ").toLocaleLowerCase("ar-EG");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSuggestions(unique);
      setError(unique.length ? "" : "ملقيناش عنوانًا أدق. اختار من الاقتراحات القريبة أو حدّد المكان على الخريطة.");
    }).catch((cause) => {
      if (currentRequest === requestId.current) setError(cause instanceof Error ? cause.message : "تعذر البحث الدقيق الآن. اختار من الاقتراحات الظاهرة.");
    }).finally(() => {
      if (activeSearch.current === controller) activeSearch.current = null;
      if (currentRequest === requestId.current) setLoading(false);
    });
  };
  const selectSavedPlace = (place: SavedPlace, resolvedLabel?: string) => {
    activeSearch.current?.abort();
    requestId.current++;
    skipNextSearch.current = true;
    const address = safeAddressLabel(resolvedLabel || place.label) || "موقع محدد على الخريطة";
    const parts = addressParts(address);
    onSelect({ lat: place.lat, lng: place.lng, kind, label: address, primaryLabel: parts.primary, secondaryLabel: parts.secondary });
    setSuggestions([]);
    setLoading(false);
    setShowSavedPlaces(false);
    setSearchOpen(false);
    setEditing(false);
    setError("");
  };
  const editSelection = () => {
    setEditing(true);
    setSearchOpen(true);
    window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };
  return <div className={`location-search-field location-search-${kind}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setSearchOpen(false); setShowSavedPlaces(false); } }}>
    <div className="location-search-heading">
      <i className={`point-dot ${kind === "pickup" ? "pickup-dot" : "dropoff-dot"}`} />
      <strong>{title}</strong>
      <span className={pointSelected ? "location-point-status is-selected" : "location-point-status"} title={pointSelected ? t("تم التحديد") : t("اختيار مطلوب")} aria-label={pointSelected ? t("تم تحديد الموقع") : t("يجب اختيار الموقع من النتائج")}>{pointSelected ? "✓" : "!"}</span>
      <button type="button" className="location-device-pin" onClick={useDeviceLocation} disabled={locating} aria-label={`استخدم موقعك الحالي لتحديد ${title}`} title={t("استخدم موقعي الحالي")}>{locating ? "…" : "⌖"}</button>
      <button type="button" className="location-map-pin" onClick={() => { setShowSavedPlaces(false); onChooseMap(); }} aria-label={`اختيار ${title} من الخريطة`} title={t("اختيار من الخريطة")}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" />
        </svg>
      </button>
    </div>
    <div className="location-search-form" role="search">
      <input
        ref={inputRef}
        aria-label={`ابحث عن ${title}`}
        value={value}
        readOnly={pointSelected && !editing}
        onClick={() => { if (pointSelected && !editing) editSelection(); }}
        onChange={(event) => {
          requestId.current++;
          onChange(event.target.value);
          setSearchOpen(true);
          setShowSavedPlaces(true);
          setSuggestions([]);
          setError("");
          setLoading(false);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            searchPrecisely();
          } else if (event.key === "Escape") {
            setSearchOpen(false);
            setShowSavedPlaces(false);
          }
        }}
        onFocus={() => { if (!pointSelected || editing) { setSearchOpen(true); setShowSavedPlaces(value.trim().length === 0); onFocus(); } }}
        placeholder={kind === "pickup" ? t("ابحث عن نقطة الركوب") : t("ابحث عن نقطة النزول")}
        autoComplete="off"
      />
    </div>
    {loading && <p className="location-search-message" role="status">{t("جاري البحث…")}</p>}
    {error && <p className="location-search-message" role="status">{error}</p>}
    {searchOpen && (showSavedPlaces && savedPlaces.length > 0 || suggestions.length > 0) && <ul className="location-search-results" aria-label={`نتائج ${title}`}>
      {showSavedPlaces && savedPlaces.length > 0 && <li className="location-search-saved-heading">{t("نقاطك المفضلة")}</li>}
      {showSavedPlaces && savedPlaces.map((place, index) => <li key={`favorite-${place.place_type}-${place.lat}-${place.lng}`}>
        <button type="button" className="location-search-saved-option" onClick={() => selectSavedPlace(place, resolvedSavedPlaces[index]?.label)}><span className="location-search-saved-mark">⌖</span><span><strong>{place.place_type === "home" ? t("الركوب المفضل") : place.place_type === "work" ? t("الوصول المفضل") : t("مكان متكرر")}</strong><small>{safeAddressLabel(resolvedSavedPlaces[index]?.label || place.label)}</small></span><span className="location-suggestion-action">{t("اختيار")}</span></button>
      </li>)}
      {suggestions.map((item) => <li key={`${item.lat.toFixed(5)}-${item.lng.toFixed(5)}`}>
        <button type="button" className="location-suggestion-option" onClick={() => selectSuggestion(item)}><span className="location-suggestion-copy"><strong>{item.primary || addressParts(item.label).primary}</strong>{item.secondary && <small>{item.secondary}</small>}</span><span className="location-suggestion-action">{t("اختيار")}</span></button>
      </li>)}
    </ul>}
    {searchOpen && value.trim().length >= 3 && <button type="button" className="location-search-precise" onMouseDown={(event) => event.preventDefault()} onClick={searchPrecisely} disabled={loading}>
      {loading ? t("جارٍ البحث الدقيق…") : t("بحث دقيق بالعنوان")}
    </button>}
  </div>;
}
