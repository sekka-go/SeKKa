import { t } from "../i18n/runtime";
import { useEffect, useRef, useState } from "react";
import MapPicker from "./MapPickerLoader";
import type { MapPickMode, MapPoint } from "../MapPicker";
import { api, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { errorText } from "../lib/formatters";
import { addressParts, reverseGeocode, safeAddressLabel } from "../lib/location-address";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import LocationSearchField from "./LocationSearchField";
import TimePicker12h from "./TimePicker12h";
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
  const [editingPoint, setEditingPoint] = useState<MapPickMode | null>(null);
  const [savingPoint, setSavingPoint] = useState<MapPickMode | null>(null);
  const addressRequests = useRef<Record<MapPickMode, number>>({ pickup: 0, dropoff: 0 });
  const pointSaveRequests = useRef<Record<MapPickMode, number>>({ pickup: 0, dropoff: 0 });
  const routeRef = useRef(route);
  routeRef.current = route;
  const frequentAddressRequest = useRef(0);
  const resolvedFrequentPlaces = useResolvedLocationPoints(token, preferences.frequent_places.map((place) => ({ lat: place.lat, lng: place.lng, label: place.label })));

  const publishSavedPlaces = (kind: MapPickMode, point: MapPoint | null) => {
    const current = { ...routeRef.current, [kind]: point };
    routeRef.current = current;
    const places: SavedPlace[] = [];
    if (current.pickup && hasPoint(current.pickup)) places.push({ place_type: "home", label: current.pickup.label ?? "", lat: current.pickup.lat, lng: current.pickup.lng });
    if (current.dropoff && hasPoint(current.dropoff)) places.push({ place_type: "work", label: current.dropoff.label ?? "", lat: current.dropoff.lat, lng: current.dropoff.lng });
    window.dispatchEvent(new CustomEvent<SavedPlace[]>("sekka:rider-preferences", { detail: places }));
  };

  const savePoint = async (kind: MapPickMode, point: MapPoint) => {
    if (!hasPoint(point)) return;
    const requestId = ++pointSaveRequests.current[kind];
    setSavingPoint(kind);
    setError("");
    try {
      const placeType = kind === "pickup" ? "home" : "work";
      const { place } = await api<{ place: SavedPlace }>(`/rider/saved-places/${placeType}`, { method: "PUT", token, body: { label: point.label || query[kind], lat: point.lat, lng: point.lng } });
      if (requestId !== pointSaveRequests.current[kind]) return;
      const savedPoint = { ...point, label: place.label };
      setRoute((current) => ({ ...current, [kind]: savedPoint }));
      setQuery((current) => ({ ...current, [kind]: place.label }));
      publishSavedPlaces(kind, savedPoint);
      setEditingPoint(null);
      notify(`تم حفظ ${kind === "pickup" ? "نقطة الركوب" : "نقطة الوصول"} المفضلة.`, "success");
    } catch (cause) {
      if (requestId === pointSaveRequests.current[kind]) setError(errorText(cause));
    } finally {
      if (requestId === pointSaveRequests.current[kind]) setSavingPoint((current) => current === kind ? null : current);
    }
  };

  const deletePoint = async (kind: MapPickMode) => {
    if (savingPoint === kind) return;
    const requestId = ++pointSaveRequests.current[kind];
    setSavingPoint(kind);
    setError("");
    try {
      const placeType = kind === "pickup" ? "home" : "work";
      await api(`/rider/saved-places/${placeType}`, { method: "DELETE", token });
      if (requestId !== pointSaveRequests.current[kind]) return;
      addressRequests.current[kind]++;
      setRoute((current) => ({ ...current, [kind]: null }));
      setQuery((current) => ({ ...current, [kind]: "" }));
      setEditingPoint(null);
      publishSavedPlaces(kind, null);
      notify(`تم حذف ${kind === "pickup" ? "نقطة الركوب" : "نقطة الوصول"} المفضلة.`, "success");
    } catch (cause) {
      if (requestId === pointSaveRequests.current[kind]) setError(errorText(cause));
    } finally {
      if (requestId === pointSaveRequests.current[kind]) setSavingPoint((current) => current === kind ? null : current);
    }
  };

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
    setEditingPoint(null);
    if (point.label && hasPoint(point)) { void savePoint(kind, selected); return; }
    if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
    void reverseGeocode(token, point.lat, point.lng).then((address) => {
      if (requestId !== addressRequests.current[kind]) return;
      const resolved = { ...point, kind, ...address, primaryLabel: address.primary, secondaryLabel: address.secondary };
      setRoute((current) => ({ ...current, [kind]: resolved }));
      setQuery((current) => ({ ...current, [kind]: address.label }));
      void savePoint(kind, resolved);
    }).catch(() => {
      if (requestId !== addressRequests.current[kind]) return;
      const fallback = { ...point, kind, label: "موقع محدد على الخريطة", primaryLabel: "موقع محدد على الخريطة", secondaryLabel: "" };
      setRoute((current) => ({ ...current, [kind]: fallback }));
      setQuery((current) => ({ ...current, [kind]: fallback.label! }));
      void savePoint(kind, fallback);
    });
  };

  const save = async () => {
    if (onboarding && (!hasPoint(route.pickup) || !hasPoint(route.dropoff))) {
      setError(t("حدد نقطة الركوب المفضلة ونقطة الوصول المفضلة أولًا."));
      return;
    }
    if (!preferences.usual_days.length || !preferences.usual_departure_time || !preferences.usual_return_time || preferences.usual_return_time <= preferences.usual_departure_time) {
      setError(t("حدد يومًا واحدًا على الأقل وتأكد أن وقت العودة بعد وقت الذهاب."));
      return;
    }
    setSaving(true); setError("");
    try {
      const savedPreferences = await api<{ preferences: RiderCommuterPreferences }>("/rider/commuter-preferences", { method: "PUT", token, body: preferences });
      window.dispatchEvent(new CustomEvent<RiderCommuterPreferences>("sekka:rider-commuter-preferences", { detail: savedPreferences.preferences }));
      if (!onboarding) notify(t("تم تحديث نقاطك المفضلة."), "success");
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
  const title = onboarding ? "نحدد طريقك المعتاد" : "مشاويرك المفضلة";
  if (loading) return <section className="surface route-preferences-card"><p role="status">{t("بنحمّل مشاويرك المفضلة…")}</p></section>;

  return <details className="surface route-preferences-card settings-disclosure route-preferences-disclosure" aria-labelledby="route-preferences-title" open={onboarding}>
    <summary className="surface-heading"><span className="route-preferences-heading-copy">{onboarding && <span className="eyebrow">{t("خطوة إعداد الحساب")}</span>}<strong id="route-preferences-title">{title}</strong><small>{onboarding ? t("حدد نقطة الركوب والوصول المعتادتين لتظهر اقتراحات أقرب لخطك.") : t("احفظ طريقك المعتاد، وسنقترح عليك مشاوير تناسبك وتوفّر وقت البحث.")}</small></span><span className="route-preferences-heading-actions"><span className="surface-icon" aria-hidden="true">⌖</span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></span></summary>
    <div className="route-preferences-content">
    <details className="settings-disclosure route-point-disclosure" open={onboarding}>
      <summary><span><strong>{t("نقطة الركوب والوصول")}</strong><small>{t("اختر النقطتين اللتين تسلكهما غالبًا")}</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div className="settings-disclosure-panel">
        <div className="route-point-choices">{(["pickup", "dropoff"] as const).map((kind) => {
          const point = pointFor(kind);
          const label = kind === "pickup" ? "نقطة الركوب" : "نقطة الوصول";
          return <div className={`route-point-choice-wrap ${kind === "dropoff" ? "is-dropoff" : ""}`} key={kind}>
            <button type="button" className="route-point-choice" aria-expanded={editingPoint === kind} disabled={savingPoint === kind} onClick={() => { setEditingPoint((current) => current === kind ? null : kind); setQuery((current) => ({ ...current, [kind]: point?.label ?? "" })); }}>
              <span className="route-point-choice-mark" aria-hidden="true">{kind === "pickup" ? t("١") : t("٢")}</span>
              <span><strong>{label}</strong><small>{hasPoint(point) ? point.primaryLabel || point.label : t("اضغط لاختيار النقطة")}</small>{hasPoint(point) && point.secondaryLabel && <small>{point.secondaryLabel}</small>}</span>
              <span className="route-point-choice-status" aria-hidden="true">{hasPoint(point) ? "✓" : "+"}</span>
            </button>
            {hasPoint(point) && <button type="button" className="route-point-delete" aria-label={`حذف ${label} المفضلة`} title={`حذف ${label}`} disabled={savingPoint === kind} onClick={() => void deletePoint(kind)}>{savingPoint === kind ? "…" : "×"}</button>}
          </div>;
        })}</div>
        {editingPoint && <div className="route-point-editor"><LocationSearchField kind={editingPoint} title={editingPoint === "pickup" ? t("نقطة الركوب المفضلة") : t("نقطة الوصول المفضلة")} value={query[editingPoint]} token={token}
          onChange={(value) => { addressRequests.current[editingPoint]++; setQuery((current) => ({ ...current, [editingPoint]: value })); }}
          onSelect={(point) => { const kind = editingPoint; setPoint(kind, point); }} onChooseMap={() => { setMapTarget(editingPoint); setMapOpen(true); }} onFocus={() => undefined} pointSelected={hasPoint(pointFor(editingPoint))} />
          {savingPoint === editingPoint && <small role="status">{t("جارٍ حفظ النقطة…")}</small>}
        </div>}
        <small className="location-search-attribution">{t("بيانات الأماكن © OpenStreetMap contributors")}</small>
      </div>
    </details>
    <details className="settings-disclosure commuter-disclosure" open={onboarding}>
      <summary><span><strong>{t("أيام ومواعيد مشوارك المعتاد")}</strong><small>{t("تقدر تغيّرها وقت ما تحب")}</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <fieldset className="commuter-preferences-schedule"><legend className="visually-hidden">{t("أيام ومواعيد مشوارك المعتاد")}</legend><div className="commuter-preferences-days">{WEEK_DAYS.map((day, index) => <label key={day} className={preferences.usual_days.includes(index) ? "selected" : ""}><input type="checkbox" checked={preferences.usual_days.includes(index)} onChange={(event) => setPreferences((current) => ({ ...current, usual_days: event.target.checked ? [...current.usual_days, index].sort() : current.usual_days.filter((value) => value !== index) }))} />{day}</label>)}</div><div className="commuter-preferences-times"><TimePicker12h label="وقت الذهاب المعتاد" value={preferences.usual_departure_time.slice(0, 5)} onChange={(value) => setPreferences((current) => ({ ...current, usual_departure_time: value }))} /><TimePicker12h label="وقت العودة المعتاد" value={preferences.usual_return_time.slice(0, 5)} onChange={(value) => setPreferences((current) => ({ ...current, usual_return_time: value }))} /></div></fieldset>
    </details>
    <details className="settings-disclosure frequent-disclosure" open={onboarding}>
      <summary><span><strong>{t("أماكن بتتردد عليها")}</strong><small>{t("اختياري · لحد ٥ أماكن داخل القاهرة الكبرى")}</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary>
      <div className="commuter-preferences-frequent"><LocationSearchField kind="pickup" title={t("أضف مكانًا متكررًا")} value={frequentQuery} token={token} onChange={(value) => { frequentAddressRequest.current++; setFrequentQuery(value); }} onSelect={addFrequentPlace} onChooseMap={() => setFrequentMapOpen(true)} onFocus={() => undefined} pointSelected={false} /><div className="commuter-preferences-place-list">{resolvedFrequentPlaces.map((place) => <span key={`${place.lat}:${place.lng}`}>{place.label}<button type="button" onClick={() => setPreferences((current) => ({ ...current, frequent_places: current.frequent_places.filter((item) => item.lat !== place.lat || item.lng !== place.lng) }))} aria-label={`حذف ${place.label}`}>×</button></span>)}</div></div>
    </details>
    {frequentMapOpen && <section className="booking-map-panel" aria-label={t("إضافة مكان متكرر من الخريطة")}><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد مكانًا متكررًا داخل القاهرة الكبرى.")}</p><button type="button" className="map-close-button" onClick={() => setFrequentMapOpen(false)} aria-label={t("إغلاق الخريطة")}>×</button></div><div className="booking-map"><MapPicker pickup={null} dropoff={null} mode="pickup" restrictToGreaterCairo onOutsidePick={() => setError(t("اختار نقطة داخل القاهرة الكبرى فقط."))} onPick={(_kind, point) => { addFrequentPlace(point); setFrequentMapOpen(false); }} /></div></section>}
    {mapOpen && <section className="booking-map-panel" aria-label={t("اختيار النقطة المفضلة من الخريطة")}><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد")} {mapTarget === "pickup" ? t("نقطة الركوب المفضلة") : t("نقطة الوصول المفضلة")}  {t("على الخريطة.")}</p><button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label={t("إغلاق الخريطة")}>×</button></div><div className="booking-map"><MapPicker pickup={route.pickup} dropoff={route.dropoff} mode={mapTarget} restrictToGreaterCairo onOutsidePick={() => setError(t("اختار نقطة داخل القاهرة الكبرى فقط."))} onPick={(kind, point) => { setPoint(kind, point); setMapOpen(false); }} /></div></section>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="route-preferences-footer"><small>{onboarding ? t("تُحفظ كل نقطة فور اختيارها. احفظ الأيام والمواعيد والأماكن للمتابعة.") : t("النقاط تحفظ فور اختيارها. احفظ الأيام والمواعيد والأماكن عند تعديلها.")}</small><button type="button" className="button button-primary button-small" onClick={() => void save()} disabled={saving || (onboarding && (!hasPoint(route.pickup) || !hasPoint(route.dropoff)))}>{saving ? t("جارٍ حفظ التفضيلات…") : onboarding ? t("حفظ التفضيلات والمتابعة") : t("حفظ التفضيلات")}</button></div>
    </div>
  </details>;
}

