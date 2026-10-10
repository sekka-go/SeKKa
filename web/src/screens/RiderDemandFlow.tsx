import { getLanguage, t } from "../i18n/runtime";
import { useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import LocationSearchField from "../components/LocationSearchField";
import { api } from "../api";
import { errorText } from "../lib/formatters";
import type { CaptainLine } from "../api";
import type { MapPickMode, MapPoint } from "../MapPicker";
import { shiftDate, todayInCairo } from "../lib/booking-dates";
import type { Session, Toast } from "../types";

type SearchLine = CaptainLine & {
  seats_available: number;
  pickup_distance_km: number;
  dropoff_distance_km: number;
  arrival_difference_minutes: number;
};
type DemandResponse = {
  request: { id: number; status: string };
  demand_group: { id: number; status: string; captain_line_id: number | null } | null;
  line: { id: number; origin_label: string; destination_label: string; arrival_time: string; price_per_seat: number } | null;
};

export default function RiderDemandFlow({ session, notify, onBack, onRequestCreated, initialPickup = null }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onRequestCreated: () => Promise<void>;
  initialPickup?: MapPoint | null;
}) {
  const [vehicle, setVehicle] = useState<"private_car" | "hiace">("private_car");
  const [tripDate, setTripDate] = useState(() => shiftDate(todayInCairo(), 1));
  const [arrivalTime, setArrivalTime] = useState("08:00");
  const [pickup, setPickup] = useState<MapPoint | null>(initialPickup);
  const [dropoff, setDropoff] = useState<MapPoint | null>(null);
  const [pickupText, setPickupText] = useState(initialPickup?.label ?? "");
  const [dropoffText, setDropoffText] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<MapPickMode>("pickup");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<SearchLine[]>([]);
  const [searched, setSearched] = useState(false);
  const [submitted, setSubmitted] = useState<DemandResponse | null>(null);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (pickup?.lat == null || pickup.lng == null || dropoff?.lat == null || dropoff.lng == null) {
      notify(t("حدد مكان الركوب والوصول من نتائج البحث أو الخريطة."), "error"); return;
    }
    setLoading(true); setSubmitted(null);
    try {
      const result = await api<{ lines: SearchLine[] }>("/rider/lines/search", { method: "POST", token: session.token, body: {
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      } });
      setLines(result.lines); setSearched(true);
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLoading(false); }
  };

  const requestRide = async () => {
    if (pickup?.lat == null || pickup.lng == null || dropoff?.lat == null || dropoff.lng == null) return;
    setLoading(true);
    try {
      const result = await api<DemandResponse>("/rider/demand-requests", { method: "POST", token: session.token, body: {
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime,
        pickup_label: pickup.label ?? pickupText, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_label: dropoff.label ?? dropoffText, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, seats: 1,
      } });
      setSubmitted(result);
      await onRequestCreated();
      notify(t(result.line ? "تم تسجيل طلبك وربطه بمسار مناسب." : "تم تسجيل طلبك وسيجمعه التطبيق مع الطلبات المشابهة."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLoading(false); }
  };

  return <div className="booking-layout rider-booking-experience">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">{t("طلب رحلة")}</span><h2>{t("ابحث عن مسار مناسب")}</h2><p>{t("لو ما لقيناش مسارًا مناسبًا، نسجل طلبك ونجمعه مع الطلبات القريبة والمتشابهة.")}</p></div><span className="surface-icon">⌖</span></div>
        {submitted ? <section className="booking-review" role="status"><div className="booking-review-heading"><div><span className="eyebrow">{t("تم تسجيل طلبك")}</span><h3>{submitted.line ? t("وجدنا مسارًا مناسبًا") : t("هنبحث لك عن مشوار")}</h3></div><span className="status-chip status-waiting">{submitted.line ? t("تمت المطابقة") : t("بانتظار المطابقة")}</span></div><p>{submitted.line ? <>{submitted.line.origin_label} ← {submitted.line.destination_label} · {t("وصول")} {submitted.line.arrival_time.slice(0,5)}</> : t("سيجمع التطبيق طلبك مع طلبات الركاب المتشابهة، ويربطها بمسار مناسب عند توفره.")}</p><button type="button" className="button button-outline" onClick={() => { setSubmitted(null); setSearched(false); setLines([]); }}>{t("طلب رحلة أخرى")}</button></section> : <>
        <form className="form-stack" onSubmit={search}>
          <label>{t("نوع المركبة")}<select value={vehicle} onChange={(event) => setVehicle(event.target.value as "private_car" | "hiace")}><option value="private_car">{t("ملاكي")}</option><option value="hiace">{t("هاي إس")}</option></select></label>
          <LocationSearchField kind="pickup" title={t("نقطة الركوب")} value={pickupText} token={session.token} onChange={(value) => { setPickupText(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupText(point.label ?? ""); }} onChooseMap={() => { setMapTarget("pickup"); setMapOpen(true); }} onFocus={() => undefined} pointSelected={pickup?.lat != null && pickup.lng != null} />
          <LocationSearchField kind="dropoff" title={t("نقطة الوصول")} value={dropoffText} token={session.token} onChange={(value) => { setDropoffText(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffText(point.label ?? ""); }} onChooseMap={() => { setMapTarget("dropoff"); setMapOpen(true); }} onFocus={() => undefined} pointSelected={dropoff?.lat != null && dropoff.lng != null} />
          <div className="time-row"><label>{t("تاريخ الرحلة")}<input type="date" min={todayInCairo()} value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></label><label>{t("وقت الوصول")}<input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label></div>
          {mapOpen && <section className="booking-map-panel" aria-label={t("تحديد الموقع على الخريطة")}><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد")} {mapTarget === "pickup" ? t("نقطة الركوب") : t("نقطة الوصول")}</p><button type="button" className="map-close-button" onClick={() => setMapOpen(false)}>×</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? t("موقع محدد على الخريطة")); } else { setDropoff(point); setDropoffText(point.label ?? t("موقع محدد على الخريطة")); } setMapOpen(false); }} /></div></section>}
          <button className="button button-primary button-wide" disabled={loading}>{loading ? t("loading.search") : t("ابحث عن مسار")}</button>
        </form>
        {searched && <section className="group-list trips-group-list" aria-live="polite">{lines.length ? <><div className="section-title-row"><div><h3>{t("مسارات مناسبة")}</h3><p>{t("سجّل طلبك وسيجمعه التطبيق مع الطلبات المشابهة.")}</p></div><span className="section-count">{lines.length}</span></div>{lines.map((line) => <article className="surface rider-result-card" key={line.id}><div className="rider-result-route"><span className="rider-route-timeline" aria-hidden="true"><i /><b /><i /></span><div><strong>{line.origin_label}</strong><strong>{line.destination_label}</strong></div></div><div className="rider-result-meta"><span>{line.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</span><span>{t("الوصول")} {line.arrival_time.slice(0,5)}</span><span>{line.seats_available} {t("مقاعد متاحة")}</span><span>{line.price_per_seat.toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")} {t("جنيه للمقعد")}</span></div></article>)}<button className="button button-primary button-wide" disabled={loading} onClick={() => void requestRide()}>{loading ? t("جارٍ تسجيل الطلب…") : t("سجّل طلب الرحلة")}</button></> : <article className="surface empty-state"><span className="empty-state-icon">⌖</span><h3>{t("مافيش مسار مناسب حاليًا")}</h3><p>{t("سجّل طلبك، والتطبيق هيجمعه مع الطلبات المشابهة تلقائيًا.")}</p><button className="button button-primary button-small" disabled={loading} onClick={() => void requestRide()}>{loading ? t("جارٍ تسجيل الطلب…") : t("سجّل طلب الرحلة")}</button></article>}</section>}
      </>}
      <button type="button" className="button button-quiet button-small" onClick={onBack}>{t("رجوع")}</button>
    </section>
  </div>;
}
