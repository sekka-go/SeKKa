import { useEffect, useRef, useState } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "../MapPicker";
import { api, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { errorText } from "../lib/formatters";
import { addressParts, reverseGeocode, safeAddressLabel } from "../lib/location-address";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import LocationSearchField from "./LocationSearchField";
import type { Toast } from "../types";

type SavedRoute = { pickup: MapPoint | null; dropoff: MapPoint | null };
const toPoint = (place?: SavedPlace): MapPoint | null => {
  if (!place) return null;
  const label = safeAddressLabel(place.label);
  const parts = addressParts(label);
  return { lat: place.lat, lng: place.lng, label, primaryLabel: parts.primary, secondaryLabel: parts.secondary };
};
const hasPoint = (point: MapPoint | null): point is MapPoint & { lat: number; lng: number } =>
  typeof point?.lat === "number" && Number.isFinite(point.lat) && typeof point.lng === "number" && Number.isFinite(point.lng);
const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const defaultPreferences: RiderCommuterPreferences = { usual_days: [0, 1, 2, 3, 4], usual_departure_time: "07:30", usual_return_time: "17:00", frequent_places: [] };
const normalizeTime = (value: string | undefined, fallback: string) => (value ?? fallback).slice(0, 5);

export default function RiderRoutePreferences({ token, notify, onComplete, onboarding = false }: {
  token: string;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onComplete?: () => void;
  onboarding?: boolean;
}) {
  const [route, setRoute] = useState<SavedRoute>({ pickup: null, dropoff: null });
  const [query, setQuery] = useState({ pickup: "", dropoff: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mapTarget, setMapTarget] = useState<MapPickMode>("pickup");
  const [mapOpen, setMapOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [frequentQuery, setFrequentQuery] = useState("");
  const [frequentMapOpen, setFrequentMapOpen] = useState(false);
  const addressRequests = useRef<Record<MapPickMode, number>>({ pickup: 0, dropoff: 0 });
  const frequentAddressRequest = useRef(0);
  const resolvedFrequentPlaces = useResolvedLocationPoints(token, preferences.frequent_places.map((place) => ({ lat: place.lat, lng: place.lng, label: place.label })));

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ places: SavedPlace[] }>("/rider/saved-places", { token }),
      api<{ preferences: RiderCommuterPreferences }>("/rider/commuter-preferences", { token }),
    ]).then(([{ places }, { preferences: savedPreferences }]) => {
      if (!active) return;
      const pickup = toPoint(places.find((place) => place.place_type === "home"));
      const dropoff = toPoint(places.find((place) => place.place_type === "work"));
      setRoute({ pickup, dropoff });
      setQuery({ pickup: pickup?.label ?? "", dropoff: dropoff?.label ?? "" });
      setPreferences({
        ...defaultPreferences,
        ...savedPreferences,
        usual_departure_time: normalizeTime(savedPreferences.usual_departure_time, defaultPreferences.usual_departure_time),
        usual_return_time: normalizeTime(savedPreferences.usual_return_time, defaultPreferences.usual_return_time),
        frequent_places: savedPreferences.frequent_places ?? [],
      });
      for (const [kind, point] of [["pickup", pickup], ["dropoff", dropoff]] as const) {
        if (!point) continue;
        void reverseGeocode(token, point.lat!, point.lng!).then((address) => {
          if (!active) return;
          const resolved = { ...point, ...address, primaryLabel: address.primary, secondaryLabel: address.secondary };
          setRoute((current) => ({ ...current, [kind]: resolved }));
          setQuery((current) => ({ ...current, [kind]: address.label }));
        }).catch(() => undefined);
      }
    }).catch((cause) => {
      if (active) setError(errorText(cause));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const setPoint = (kind: MapPickMode, point: MapPoint) => {
    const requestId = ++addressRequests.current[kind];
    const parts = addressParts(point.label);
    const selected = { ...point, kind, primaryLabel: point.primaryLabel ?? (point.label ? parts.primary : "جارٍ تحديد العنوان…"), secondaryLabel: point.secondaryLabel ?? parts.secondary };
    setRoute((current) => ({ ...current, [kind]: selected }));
    setQuery((current) => ({ ...current, [kind]: selected.label ?? "جارٍ تحديد العنوان…" }));
    if (point.label || typeof point.lat !== "number" || typeof point.lng !== "number") return;
    void reverseGeocode(token, point.lat, point.lng).then((address) => {
      if (requestId !== addressRequests.current[kind]) return;
      const resolved = { ...point, kind, ...address, primaryLabel: address.primary, secondaryLabel: address.secondary };
      setRoute((current) => ({ ...current, [kind]: resolved }));
      setQuery((current) => ({ ...current, [kind]: address.label }));
    }).catch(() => {
      if (requestId !== addressRequests.current[kind]) return;
      const fallback = { ...point, kind, label: "موقع محدد على الخريطة", primaryLabel: "موقع محدد على الخريطة", secondaryLabel: "" };
      setRoute((current) => ({ ...current, [kind]: fallback }));
      setQuery((current) => ({ ...current, [kind]: fallback.label! }));
    });
  };

  const save = async () => {
    if (!hasPoint(route.pickup) || !hasPoint(route.dropoff)) {
      setError("حدد نقطة الركوب المفضلة ونقطة الوصول المفضلة أولًا.");
      return;
    }
    if (!preferences.usual_days.length || !preferences.usual_departure_time || !preferences.usual_return_time || preferences.usual_return_time <= preferences.usual_departure_time) {
      setError("حدد يومًا واحدًا على الأقل وتأكد أن وقت العودة بعد وقت الذهاب.");
      return;
    }
    setSaving(true); setError("");
    try {
      const [pickupPlace, dropoffPlace] = await Promise.all([
        api<{ place: SavedPlace }>("/rider/saved-places/home", { method: "PUT", token, body: { label: route.pickup.label || query.pickup, lat: route.pickup.lat, lng: route.pickup.lng } }),
        api<{ place: SavedPlace }>("/rider/saved-places/work", { method: "PUT", token, body: { label: route.dropoff.label || query.dropoff, lat: route.dropoff.lat, lng: route.dropoff.lng } }),
      ]);
      const savedPreferences = await api<{ preferences: RiderCommuterPreferences }>("/rider/commuter-preferences", { method: "PUT", token, body: preferences });
      window.dispatchEvent(new CustomEvent<SavedPlace[]>("sekka:rider-preferences", { detail: [pickupPlace.place, dropoffPlace.place] }));
      window.dispatchEvent(new CustomEvent<RiderCommuterPreferences>("sekka:rider-commuter-preferences", { detail: savedPreferences.preferences }));
      if (!onboarding) notify("تم تحديث نقاطك المفضلة.", "success");
      onComplete?.();
    } catch (cause) {
      setError(errorText(cause));
    } finally { setSaving(false); }
  };

  const pointFor = (kind: MapPickMode) => route[kind];
  const addFrequentPlace = async (point: MapPoint) => {
    if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
    const requestId = ++frequentAddressRequest.current;
    if (preferences.frequent_places.some((place) => place.lat === point.lat && place.lng === point.lng)) { setFrequentQuery(""); return; }
    try {
      const address = point.label ? { label: point.label } : await reverseGeocode(token, point.lat, point.lng);
      if (requestId !== frequentAddressRequest.current) return;
      setPreferences((current) => ({ ...current, frequent_places: [...current.frequent_places, { label: address.label || "موقع محدد على الخريطة", lat: point.lat!, lng: point.lng! }].slice(0, 5) }));
    } catch {
      if (requestId === frequentAddressRequest.current) setPreferences((current) => ({ ...current, frequent_places: [...current.frequent_places, { label: "موقع محدد على الخريطة", lat: point.lat!, lng: point.lng! }].slice(0, 5) }));
    }
    if (requestId === frequentAddressRequest.current) setFrequentQuery("");
  };
  const title = onboarding ? "نحدد طريقك المعتاد" : "نقاطك المفضلة";
  if (loading) return <section className="surface route-preferences-card"><p role="status">بنحمّل نقاطك المفضلة…</p></section>;

  return <section className="surface route-preferences-card" aria-labelledby="route-preferences-title">
    <div className="surface-heading"><div><span className="eyebrow">{onboarding ? "خطوة إعداد الحساب" : "تفضيلات المشوار"}</span><h2 id="route-preferences-title">{title}</h2><p>{onboarding ? "حدد نقطة الركوب والوصول المعتادتين لتظهر اقتراحات أقرب لخطك." : "عدّل النقطتين، وسنستخدمهما لترتيب اقتراحات المشاوير ونتائج البحث."}</p></div><span className="surface-icon" aria-hidden="true">⌖</span></div>
    <div className="route-preferences-fields">
      {(["pickup", "dropoff"] as const).map((kind) => <div className="route-preference-field" key={kind}>
        <LocationSearchField kind={kind} title={kind === "pickup" ? "نقطة الركوب المفضلة" : "نقطة الوصول المفضلة"} value={query[kind]} token={token}
          onChange={(value) => { addressRequests.current[kind]++; setQuery((current) => ({ ...current, [kind]: value })); setRoute((current) => ({ ...current, [kind]: null })); }}
          onSelect={(point) => setPoint(kind, point)} onChooseMap={() => { setMapTarget(kind); setMapOpen(true); }} onFocus={() => undefined} pointSelected={hasPoint(pointFor(kind))} />
      </div>)}
    </div>
    <small className="location-search-attribution">بيانات الأماكن © OpenStreetMap contributors</small>
    <fieldset className="commuter-preferences-schedule"><legend>أيام ومواعيد مشوارك المعتاد <small>تقدر تغيّرها وقت ما تحب</small></legend><div className="commuter-preferences-days">{WEEK_DAYS.map((day, index) => <label key={day} className={preferences.usual_days.includes(index) ? "selected" : ""}><input type="checkbox" checked={preferences.usual_days.includes(index)} onChange={(event) => setPreferences((current) => ({ ...current, usual_days: event.target.checked ? [...current.usual_days, index].sort() : current.usual_days.filter((value) => value !== index) }))} />{day}</label>)}</div><div className="commuter-preferences-times"><label>وقت الذهاب المعتاد<input type="time" value={preferences.usual_departure_time.slice(0, 5)} onChange={(event) => setPreferences((current) => ({ ...current, usual_departure_time: event.target.value }))} /></label><label>وقت العودة المعتاد<input type="time" value={preferences.usual_return_time.slice(0, 5)} onChange={(event) => setPreferences((current) => ({ ...current, usual_return_time: event.target.value }))} /></label></div></fieldset>
    <div className="commuter-preferences-frequent"><div><strong>أماكن بتتردد عليها</strong><small>اختياري · لحد ٥ أماكن داخل القاهرة الكبرى</small></div><LocationSearchField kind="pickup" title="أضف مكانًا متكررًا" value={frequentQuery} token={token} onChange={(value) => { frequentAddressRequest.current++; setFrequentQuery(value); }} onSelect={addFrequentPlace} onChooseMap={() => setFrequentMapOpen(true)} onFocus={() => undefined} pointSelected={false} /><div className="commuter-preferences-place-list">{resolvedFrequentPlaces.map((place) => <span key={`${place.lat}:${place.lng}`}>{place.label}<button type="button" onClick={() => setPreferences((current) => ({ ...current, frequent_places: current.frequent_places.filter((item) => item.lat !== place.lat || item.lng !== place.lng) }))} aria-label={`حذف ${place.label}`}>×</button></span>)}</div></div>
    {frequentMapOpen && <section className="booking-map-panel" aria-label="إضافة مكان متكرر من الخريطة"><div className="booking-map-toolbar"><p className="map-instruction">حدد مكانًا متكررًا داخل القاهرة الكبرى.</p><button type="button" className="map-close-button" onClick={() => setFrequentMapOpen(false)} aria-label="إغلاق الخريطة">×</button></div><div className="booking-map"><MapPicker pickup={null} dropoff={null} mode="pickup" restrictToGreaterCairo onOutsidePick={() => setError("اختار نقطة داخل القاهرة الكبرى فقط.")} onPick={(_kind, point) => { addFrequentPlace(point); setFrequentMapOpen(false); }} /></div></section>}
    {mapOpen && <section className="booking-map-panel" aria-label="اختيار النقطة المفضلة من الخريطة"><div className="booking-map-toolbar"><p className="map-instruction">حدد {mapTarget === "pickup" ? "نقطة الركوب المفضلة" : "نقطة الوصول المفضلة"} على الخريطة.</p><button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label="إغلاق الخريطة">×</button></div><div className="booking-map"><MapPicker pickup={route.pickup} dropoff={route.dropoff} mode={mapTarget} restrictToGreaterCairo onOutsidePick={() => setError("اختار نقطة داخل القاهرة الكبرى فقط.")} onPick={(kind, point) => { setPoint(kind, point); setMapOpen(false); }} /></div></section>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="route-preferences-footer"><small>تقدر تعدّل النقطتين من صفحة الحساب في أي وقت.</small><button type="button" className="button button-primary button-small" onClick={() => void save()} disabled={saving || !hasPoint(route.pickup) || !hasPoint(route.dropoff)}>{saving ? "جارٍ حفظ النقطتين…" : onboarding ? "حفظ النقطتين والمتابعة" : "حفظ النقاط المفضلة"}</button></div>
  </section>;
}
