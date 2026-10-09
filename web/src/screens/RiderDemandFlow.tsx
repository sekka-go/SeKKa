import { useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import LocationSearchField from "../components/LocationSearchField";
import { api } from "../api";
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

export default function RiderDemandFlow({ session, notify, onBack, onRequestCreated }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onRequestCreated: () => Promise<void>;
}) {
  const [vehicle, setVehicle] = useState<"private_car" | "hiace">("private_car");
  const [tripDate, setTripDate] = useState(() => shiftDate(todayInCairo(), 1));
  const [arrivalTime, setArrivalTime] = useState("08:00");
  const [pickup, setPickup] = useState<MapPoint | null>(null);
  const [dropoff, setDropoff] = useState<MapPoint | null>(null);
  const [pickupText, setPickupText] = useState("");
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
      notify("حدد مكان الركوب والوصول من نتائج البحث أو الخريطة.", "error"); return;
    }
    setLoading(true); setSubmitted(null);
    try {
      const result = await api<{ lines: SearchLine[] }>("/rider/lines/search", { method: "POST", token: session.token, body: {
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      } });
      setLines(result.lines); setSearched(true);
    } catch (error) { notify(error instanceof Error ? error.message : "تعذر البحث عن الرحلات.", "error"); }
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
      notify(result.line ? "تم تسجيل طلبك وربطه بمسار مناسب." : "تم تسجيل طلبك وسيجمعه التطبيق مع الطلبات المشابهة.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "تعذر تسجيل طلب الرحلة.", "error"); }
    finally { setLoading(false); }
  };

  return <div className="booking-layout">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">طلب رحلة</span><h2>ابحث عن مسار مناسب</h2><p>لو ما لقيناش مسارًا مناسبًا، نسجل طلبك ونجمعه مع الطلبات القريبة والمتشابهة.</p></div><span className="surface-icon">⌖</span></div>
      {submitted ? <section className="booking-review" role="status"><div className="booking-review-heading"><div><span className="eyebrow">تم تسجيل طلبك</span><h3>{submitted.line ? "وجدنا مسارًا مناسبًا" : "هنبحث لك عن مشوار"}</h3></div><span className="status-chip status-waiting">{submitted.line ? "تمت المطابقة" : "بانتظار المطابقة"}</span></div><p>{submitted.line ? `${submitted.line.origin_label} ← ${submitted.line.destination_label} · وصول ${submitted.line.arrival_time.slice(0,5)}` : "سيجمع التطبيق طلبك مع طلبات الركاب المتشابهة، ويربطها بمسار مناسب عند توفره."}</p><button type="button" className="button button-outline" onClick={() => { setSubmitted(null); setSearched(false); setLines([]); }}>طلب رحلة أخرى</button></section> : <>
        <form className="form-stack" onSubmit={search}>
          <label>نوع المركبة<select value={vehicle} onChange={(event) => setVehicle(event.target.value as "private_car" | "hiace")}><option value="private_car">ملاكي</option><option value="hiace">هاي إس</option></select></label>
          <LocationSearchField kind="pickup" title="نقطة الركوب" value={pickupText} token={session.token} onChange={(value) => { setPickupText(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupText(point.label ?? ""); }} onChooseMap={() => { setMapTarget("pickup"); setMapOpen(true); }} onFocus={() => undefined} pointSelected={pickup?.lat != null && pickup.lng != null} />
          <LocationSearchField kind="dropoff" title="نقطة الوصول" value={dropoffText} token={session.token} onChange={(value) => { setDropoffText(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffText(point.label ?? ""); }} onChooseMap={() => { setMapTarget("dropoff"); setMapOpen(true); }} onFocus={() => undefined} pointSelected={dropoff?.lat != null && dropoff.lng != null} />
          <div className="time-row"><label>تاريخ الرحلة<input type="date" min={todayInCairo()} value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></label><label>وقت الوصول<input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label></div>
          {mapOpen && <section className="booking-map-panel" aria-label="تحديد الموقع على الخريطة"><div className="booking-map-toolbar"><p className="map-instruction">حدد {mapTarget === "pickup" ? "نقطة الركوب" : "نقطة الوصول"}</p><button type="button" className="map-close-button" onClick={() => setMapOpen(false)}>×</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? "موقع محدد على الخريطة"); } else { setDropoff(point); setDropoffText(point.label ?? "موقع محدد على الخريطة"); } setMapOpen(false); }} /></div></section>}
          <button className="button button-primary button-wide" disabled={loading}>{loading ? "جارٍ البحث…" : "ابحث عن مسار"}</button>
        </form>
        {searched && <section className="group-list trips-group-list" aria-live="polite">{lines.length ? <><div className="section-title-row"><div><h3>مسارات مناسبة</h3><p>سجّل طلبك وسيجمعه التطبيق مع الطلبات المشابهة.</p></div><span className="section-count">{lines.length}</span></div>{lines.map((line) => <article className="surface offer-card" key={line.id}><h3>{line.origin_label} ← {line.destination_label}</h3><p>{line.vehicle_type_id === "hiace" ? "هاي إس" : "ملاكي"} · {line.arrival_time.slice(0,5)} · {line.seats_available} مقاعد متاحة · {line.price_per_seat.toLocaleString("ar-EG")} جنيه للمقعد</p></article>)}<button className="button button-primary button-wide" disabled={loading} onClick={() => void requestRide()}>{loading ? "جارٍ تسجيل الطلب…" : "سجّل طلب الرحلة"}</button></> : <article className="surface empty-state"><span className="empty-state-icon">⌖</span><h3>مافيش مسار مناسب حاليًا</h3><p>سجّل طلبك، والتطبيق هيجمعه مع الطلبات المشابهة تلقائيًا.</p><button className="button button-primary button-small" disabled={loading} onClick={() => void requestRide()}>{loading ? "جارٍ تسجيل الطلب…" : "سجّل طلب الرحلة"}</button></article>}</section>}
      </>}
      <button type="button" className="button button-quiet button-small" onClick={onBack}>رجوع</button>
    </section>
  </div>;
}
