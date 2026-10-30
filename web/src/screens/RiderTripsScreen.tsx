import { useEffect, useMemo, useState, type FormEvent } from "react";
import { sekkaApi, type SekkaApiError } from "../lib/sekka-api";
import "./rider-trips-screen.css";

type Place = { label: string; primary: string; secondary: string; lat: number; lng: number };
type Line = { id: number; origin_label: string; destination_label: string; vehicle_type_id: string; arrival_time: string; return_arrival_time: string | null; service_days: number[]; seats?: number; seats_available?: number; price_per_seat: number | null; captain_name: string; captain_verified: boolean; pickup_distance_km: number; dropoff_distance_km: number };
type Props = { supabase: unknown; mode: "available" | "mine"; onHome: () => void };
type Order = "recent" | "price";
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const categories = [{ id: "prime", label: "Prime" }, { id: "daily", label: "Daily" }, { id: "space", label: "Space" }, { id: "max", label: "Max" }];

function Icon({ name }: { name: "back" | "pin" | "calendar" | "clock" | "people" | "car" | "search" | "home" | "bag" | "chat" | "user" }) {
  const p: Record<string, React.ReactNode> = { back: <path d="m15 18-6-6 6-6"/>, pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 15c3 0 5 1.8 5 5"/></>, car: <><path d="m5 11 2-5h10l2 5 2 2v6h-2v-2H5v2H3v-6l2-2Z"/><path d="M5 11h14"/></>, search: <><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16 16 5 5"/></>, home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>, bag: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></>, chat: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 11h.1M12 11h.1M16 11h.1"/></>, user: <><circle cx="12" cy="7" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></> };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

function statusLabel(value?: string) { return ({ open: "قيد المتابعة", matched: "تم العثور على مسار", pending: "قيد المراجعة", completed: "مكتمل", cancelled: "ملغي" } as Record<string, string>)[value ?? ""] ?? value ?? "غير متاح"; }

export default function RiderTripsScreen({ mode, onHome }: Props) {
  const mine = mode === "mine";
  const [lines, setLines] = useState<Line[]>([]);
  const [requests, setRequests] = useState<Record<string, any>[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fromPlace, setFromPlace] = useState<Place | null>(null); const [toPlace, setToPlace] = useState<Place | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<Place[]>([]); const [toSuggestions, setToSuggestions] = useState<Place[]>([]);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA")); const [time, setTime] = useState("08:00"); const [passengers, setPassengers] = useState(1);
  const [searched, setSearched] = useState(false); const [order, setOrder] = useState<Order>("recent"); const [vehicleFilter, setVehicleFilter] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false); const [selected, setSelected] = useState<Line | null>(null);
  const [loading, setLoading] = useState(true); const [searching, setSearching] = useState(false); const [requesting, setRequesting] = useState(false); const [requestError, setRequestError] = useState(""); const [createdRequest, setCreatedRequest] = useState<Record<string, any> | null>(null); const [error, setError] = useState(""); const [actionBusyId, setActionBusyId] = useState<string|null>(null); const [queryKey, setQueryKey] = useState(0);

  useEffect(() => {
    if (mine || from.trim().length < 3 || fromPlace?.label === from.trim()) { setFromSuggestions([]); return; }
    let active = true; const timer = window.setTimeout(async () => {
      try { const data = await sekkaApi<{ suggestions: Place[] }>("/locations/search", { method: "POST", body: { query: from.trim() } }); if (active) setFromSuggestions(data.suggestions ?? []); }
      catch { if (active) setFromSuggestions([]); }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [from, fromPlace, mine]);
  useEffect(() => {
    if (mine || to.trim().length < 3 || toPlace?.label === to.trim()) { setToSuggestions([]); return; }
    let active = true; const timer = window.setTimeout(async () => {
      try { const data = await sekkaApi<{ suggestions: Place[] }>("/locations/search", { method: "POST", body: { query: to.trim() } }); if (active) setToSuggestions(data.suggestions ?? []); }
      catch { if (active) setToSuggestions([]); }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [to, toPlace, mine]);

  useEffect(() => {
    let active = true;
    async function load() {
      setError(""); setLoading(true);
      try {
        if (mine) {
          const [requestData, dailyData, tripData] = await Promise.all([
            sekkaApi<{ requests: Record<string, any>[] }>("/rider/demand-requests"),
            sekkaApi<{ requests: Record<string, any>[] }>("/rider/requests"),
            sekkaApi<{ trips: Record<string, any>[] }>("/rider/trips"),
          ]);
          if (active) { setRequests([...(requestData.requests ?? []), ...(dailyData.requests ?? []).map((item) => ({ ...item, _daily: true })), ...(tripData.trips ?? []).map((item) => ({ ...item, id: String(item.trip?.id ?? item.id), _completed_trip: true }))]); setLines([]); }
        } else { if (active) { setLines([]); setRequests([]); } }
      } catch (cause) { if (active) setError(apiMessage(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [mine, queryKey]);

  const results = useMemo(() => lines.filter((line) => (vehicleFilter === "all" || line.vehicle_type_id === vehicleFilter) && (line.seats_available ?? line.seats ?? 0) >= passengers)
    .sort((a, b) => order === "price" ? (a.price_per_seat ?? Number.MAX_SAFE_INTEGER) - (b.price_per_seat ?? Number.MAX_SAFE_INTEGER) : (a.pickup_distance_km + a.dropoff_distance_km) - (b.pickup_distance_km + b.dropoff_distance_km)), [lines, order, vehicleFilter, passengers]);
  const selectedCategory = categories.find((category) => category.id === vehicleFilter);
  const retry = () => { setLoading(true); setQueryKey((key) => key + 1); };

  async function submitSearch(event: FormEvent) {
    event.preventDefault(); setError(""); setSearched(true);
    if (!fromPlace || !toPlace) { setError("اختر نقطة الانطلاق والوجهة من اقتراحات العناوين قبل البحث."); return; }
    if (!date || !time) { setError("حدد تاريخ الرحلة وموعد الوصول."); return; }
    setSearching(true);
    try {
      const types = vehicleFilter === "all" ? categories.map((category) => category.id) : [vehicleFilter];
      const responses = await Promise.all(types.map((vehicle_type_id) => sekkaApi<{ lines: Line[] }>("/rider/lines/search", { method: "POST", body: { vehicle_type_id, trip_date: date, arrival_time: time, pickup_lat: fromPlace.lat, pickup_lng: fromPlace.lng, dropoff_lat: toPlace.lat, dropoff_lng: toPlace.lng } })));
      const merged = responses.flatMap((response) => response.lines ?? []);
      const unique = [...new Map(merged.map((line) => [line.id, line])).values()];
      setLines(unique);
    } catch (cause) { setLines([]); setError(apiMessage(cause)); }
    finally { setSearching(false); }
  }
  async function createDemandRequest() {
    if (!selected || !fromPlace || !toPlace || requesting) return;
    setRequesting(true); setRequestError("");
    try {
      const result = await sekkaApi<{ request: Record<string, any>; demand_group?: Record<string, any> | null }>("/rider/demand-requests", { method: "POST", body: { vehicle_type_id: selected.vehicle_type_id, seats: passengers, trip_date: date, arrival_time: time, pickup_label: fromPlace.label, dropoff_label: toPlace.label, pickup_lat: fromPlace.lat, pickup_lng: fromPlace.lng, dropoff_lat: toPlace.lat, dropoff_lng: toPlace.lng } });
      setCreatedRequest({ ...result.request, demand_group: result.demand_group ?? null });
      setSelected(null);
    } catch (cause) { setRequestError(apiMessage(cause)); }
    finally { setRequesting(false); }
  }
  async function cancelDailyRequest(request: Record<string, any>) {
    const id = String(request.id);
    if (request.status !== "open" || actionBusyId) return;
    if (!window.confirm("هل تريد إلغاء طلب التنقل المفتوح؟")) return;
    setActionBusyId(id); setError("");
    try {
      const { request: cancelled } = await sekkaApi<{ request: Record<string, any> }>(`/rider/requests/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      setRequests((items) => items.map((item) => item._daily && String(item.id) === id ? { ...item, ...cancelled, _daily: true } : item));
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setActionBusyId(null); }
  }
  async function disputeTrip(request: Record<string, any>) {
    const tripId = String(request.trip?.id ?? request.id);
    if (request.payment_status !== "confirmed" || actionBusyId) return;
    const reason = window.prompt("اكتب سبب الاعتراض على مبلغ الرحلة:");
    if (!reason?.trim()) return;
    setActionBusyId(tripId); setError("");
    try {
      await sekkaApi(`/rider/trips/${encodeURIComponent(tripId)}/dispute`, { method: "POST", body: { reason: reason.trim().slice(0, 1000) } });
      setRequests((items) => items.map((item) => item._completed_trip && String(item.trip?.id ?? item.id) === tripId ? { ...item, payment_status: "disputed" } : item));
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setActionBusyId(null); }
  }
  const selectPlace = (place: Place, which: "from" | "to") => {
    if (which === "from") { setFrom(place.label); setFromPlace(place); setFromSuggestions([]); }
    else { setTo(place.label); setToPlace(place); setToSuggestions([]); }
  };
  const lineCard = (line: Line) => <article className="rider-trip-card" key={line.id}>
    <div className="trip-card-price"><span className="trip-seat-badge"><Icon name="people"/> {line.seats_available ?? line.seats ?? "—"} مقاعد متاحة</span><strong>{line.price_per_seat == null ? "السعر غير محدد" : `${new Intl.NumberFormat("ar-EG").format(line.price_per_seat)} ج.م`}</strong><small>للمقعد</small><button className="rider-trip-detail-button" onClick={() => setSelected(line)}>تفاصيل الرحلة <Icon name="back"/></button></div>
    <div className="trip-card-route"><div className="trip-route-place"><i className="trip-route-dot"/><span>{line.origin_label}</span></div><div className="trip-route-connector"/><div className="trip-route-place"><i className="trip-route-dot"/><span>{line.destination_label}</span></div><div className="trip-route-datetime"><span><Icon name="calendar"/>{(line.service_days ?? []).map((day) => days[day]).filter(Boolean).join("، ") || date}</span><span><Icon name="clock"/>{line.arrival_time?.slice(0, 5) || time}</span></div></div>
    <div className="trip-card-captain"><span className="trip-captain-avatar"><Icon name="people"/></span><strong>{line.captain_name || "كابتن سِكّة"}</strong><span>{line.captain_verified ? "كابتن معتمد" : "كابتن"}</span><span><Icon name="car"/> {categories.find((category) => category.id === line.vehicle_type_id)?.label ?? line.vehicle_type_id}</span></div>
  </article>;
  const placeField = (which: "from" | "to", label: string, value: string, setValue: (value: string) => void, suggestions: Place[]) => <label className="rider-trip-place-field"><span>{label} <Icon name="pin"/></span><input value={value} onChange={(event) => { setValue(event.target.value); if (which === "from") setFromPlace(null); else setToPlace(null); }} placeholder={which === "from" ? "نقطة الانطلاق" : "الوجهة"} autoComplete="off"/>{suggestions.length > 0 && <div className="rider-place-suggestions" role="listbox">{suggestions.map((place, index) => <button type="button" key={`${place.lat}-${place.lng}-${index}`} onClick={() => selectPlace(place, which)}><strong>{place.primary}</strong><small>{place.secondary}</small></button>)}</div>}</label>;

  return <main className="rider-trips-screen" dir="rtl" lang="ar">
    <header className="rider-trips-header"><img src="/brand/sekka-mark.png" alt="سِكّة"/><div><span>{mine ? "طلباتك ورحلاتك المسجلة" : "اكتشف الخطوط التي تناسبك"}</span><h1>{mine ? "رحلاتي" : "البحث عن رحلة"}</h1></div><button onClick={onHome} aria-label="العودة للرئيسية"><Icon name="back"/></button></header>
    {!mine && <form className="rider-trip-search" onSubmit={submitSearch}>
      <div className="rider-trip-search-grid">
        <label><span>تاريخ الرحلة <Icon name="calendar"/></span><input type="date" value={date} min={new Date().toLocaleDateString("en-CA")} onChange={(event) => setDate(event.target.value)}/></label>
        {placeField("to", "إلى أين؟", to, setTo, toSuggestions)}
        {placeField("from", "من أين؟", from, setFrom, fromSuggestions)}
      </div><div className="rider-trip-search-bottom"><label className="rider-passengers-label"><span>موعد الوصول</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)}/></label><label className="rider-passengers-label"><span>عدد الركاب</span><span className="rider-passenger-control"><button type="button" onClick={() => setPassengers((count) => Math.max(1, count - 1))} disabled={passengers <= 1} aria-label="تقليل عدد الركاب">−</button><b>{passengers} راكب</b><button type="button" onClick={() => setPassengers((count) => Math.min(13, count + 1))} disabled={passengers >= 13} aria-label="زيادة عدد الركاب">+</button></span></label><button className="rider-trip-submit" type="submit" disabled={searching}><Icon name="search"/> {searching ? "جارٍ البحث…" : "ابحث عن الرحلات"}</button></div>
    </form>}
    <section className="rider-trips-list-section">
      <div className="rider-trips-results-heading"><div><span>{mine ? "البيانات المسجلة في حسابك" : "نتائج المطابقة حسب المسار والوقت"}</span><h2>{mine ? "طلباتي ورحلاتي" : searched ? "الرحلات المناسبة لك" : "الرحلات المتاحة"}</h2></div>{!mine && !loading && !error && <span className="rider-results-count">{results.length} رحلة</span>}</div>
      {!mine && <div className="rider-trip-filters"><div className="rider-trip-filter-row" aria-label="ترتيب وتصفية الرحلات"><button className={order === "recent" && vehicleFilter === "all" ? "selected" : ""} onClick={() => { setOrder("recent"); setVehicleFilter("all"); }}>كل الرحلات <span>☷</span></button><button className={order === "price" ? "selected" : ""} onClick={() => setOrder("price")}>الأقل سعرًا <span>◉</span></button><button aria-expanded={categoryOpen} aria-controls="trip-category-options" className={vehicleFilter !== "all" ? "selected" : ""} onClick={() => setCategoryOpen((open) => !open)}>{selectedCategory ? `الفئة: ${selectedCategory.label}` : "تصفية بالفئة"} <span>⚙</span></button></div>{categoryOpen && <div id="trip-category-options" className="rider-trip-category-options" role="group" aria-label="فئة المركبة"><button className={vehicleFilter === "all" ? "selected" : ""} onClick={() => { setVehicleFilter("all"); setCategoryOpen(false); }}>كل الفئات</button>{categories.map((category) => <button key={category.id} className={vehicleFilter === category.id ? "selected" : ""} onClick={() => { setVehicleFilter(category.id); setCategoryOpen(false); }}>{category.label}</button>)}</div>}</div>}
      {!mine && <>{createdRequest && <div className="rider-trips-state" role="status"><strong>تم تسجيل طلب البحث</strong><p>رقم الطلب: {createdRequest.id}. حالة الطلب: {statusLabel(createdRequest.status)}. تسجيل الطلب لا يضمن توافر رحلة أو قبول الكابتن.</p><button onClick={() => window.location.assign("/my-trips")}>متابعة طلباتي</button></div>}<p className="rider-search-limit-note">تُطابق النتائج مواقعك وموعد الوصول مع العروض النشطة عبر خدمة سِكّة. يعرض النظام سعة الخط المعلنة؛ اختيار عدد الركاب لا يحجز مقاعد.</p></>}
      {loading ? <div className="rider-trips-state" role="status"><strong>جارٍ تحميل البيانات</strong><p>نحمّل البيانات من حسابك.</p></div> : error ? <div className="rider-trips-state rider-trips-error" role="alert"><strong>تعذر تحميل البيانات</strong><p>{error}</p>{mine && <button onClick={retry}>إعادة المحاولة</button>}</div> : mine ? requests.length ? <div className="rider-trips-results">{requests.map((request, index) => <article className="rider-trip-card" key={`${request.id}-${index}`}><div className="trip-card-route"><div className="trip-route-place"><i className="trip-route-dot"/><span>{request.pickup_label || request.stops?.[0]?.label || (request._daily ? "طلب تنقّل يومي" : "موقع الانطلاق المسجل")}</span></div><div className="trip-route-connector"/><div className="trip-route-place"><i className="trip-route-dot"/><span>{request.dropoff_label || request.stops?.at?.(-1)?.label || (request._daily ? "بانتظار تحديد مسار" : "وجهة الطلب")}</span></div><div className="trip-route-datetime"><span><Icon name="calendar"/>{request.trip_date || request.trip?.completed_at?.slice(0, 10) || request.requested_at?.slice(0, 10) || "—"}</span><span><Icon name="clock"/>{statusLabel(request._completed_trip ? "completed" : request.status)}</span></div>{request._daily&&request.status==="open"&&<button className="rider-trip-detail-button" disabled={actionBusyId!==null} onClick={()=>void cancelDailyRequest(request)}>{actionBusyId===String(request.id)?"جارٍ الإلغاء…":"إلغاء الطلب المفتوح"}</button>}{request._completed_trip&&request.payment_status==="confirmed"&&<button className="rider-trip-detail-button" disabled={actionBusyId!==null} onClick={()=>void disputeTrip(request)}>{actionBusyId===String(request.trip?.id??request.id)?"جارٍ الإرسال…":"اعتراض على المبلغ"}</button>}{request._completed_trip&&request.payment_status==="disputed"&&<span className="trip-seat-badge">الاعتراض قيد المراجعة</span>}</div></article>)}</div> : <div className="rider-trips-state"><strong>لا توجد طلبات أو رحلات مسجلة</strong><p>عند إرسال طلب أو إكمال رحلة ستظهر بياناتها هنا.</p><button onClick={() => window.location.assign("/trips")}>استكشف الرحلات</button></div> : results.length ? <div className="rider-trips-results">{results.map(lineCard)}</div> : <div className="rider-trips-state"><strong>{searched ? "لم نعثر على رحلات مطابقة" : "ابدأ البحث عن رحلة"}</strong><p>{searched ? "جرّب اختيار مواقع قريبة أو موعد وصول آخر." : "حدد الانطلاق والوجهة والتاريخ، ثم اختر كل عنوان من الاقتراحات."}</p></div>}
    </section>
    <nav className="rider-trips-bottom-nav" aria-label="التنقل الرئيسي"><a href="/home"><Icon name="home"/><span>الرئيسية</span></a><a className={!mine ? "active" : ""} aria-current={!mine ? "page" : undefined} href="/trips"><Icon name="search"/><span>البحث</span></a><a className={mine ? "active" : ""} aria-current={mine ? "page" : undefined} href="/my-trips"><Icon name="bag"/><span>طلباتي</span></a><a href="/journey/conversations"><Icon name="chat"/><span>المحادثات</span></a><a href="/journey/profile"><Icon name="user"/><span>المزيد</span></a></nav>
    {selected && <div className="rider-trip-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="rider-trip-modal" role="dialog" aria-modal="true" aria-labelledby="trip-detail-title"><button className="rider-trip-modal-close" onClick={() => setSelected(null)} aria-label="إغلاق">×</button><span className="rider-trip-published">عرض نشط</span><h2 id="trip-detail-title">{selected.origin_label} ← {selected.destination_label}</h2><p><Icon name="calendar"/> أيام التشغيل: {(selected.service_days ?? []).map((day) => days[day]).filter(Boolean).join("، ") || "حسب التاريخ المختار"}</p><p><Icon name="clock"/> موعد الوصول: {selected.arrival_time?.slice(0, 5) || "غير محدد"}</p><p><Icon name="car"/> فئة المركبة: {categories.find((category) => category.id === selected.vehicle_type_id)?.label ?? selected.vehicle_type_id}</p><p><Icon name="people"/> المقاعد المتاحة: {selected.seats_available ?? selected.seats ?? "—"}</p><p>السعر للمقعد: {selected.price_per_seat == null ? "غير محدد" : `${selected.price_per_seat} ج.م`}</p><p>الكابتن: {selected.captain_name}{selected.captain_verified ? " • معتمد" : ""}</p><p className="rider-trip-modal-note">إرسال طلب البحث لا يحجز مقعدًا ولا يضمن قبول الرحلة. سيراجع النظام التوافق وحالة اعتماد حسابك.</p>{requestError && <p className="rider-trips-error" role="alert">{requestError}</p>}<button className="rider-trip-submit" disabled={requesting} onClick={() => void createDemandRequest()}>{requesting ? "جارٍ تسجيل الطلب…" : "إرسال طلب البحث عن رحلة"}</button></section></div>}
  </main>;
}

function apiMessage(cause: unknown) {
  if (cause && typeof cause === "object" && "status" in cause && (cause as SekkaApiError).status === 401) return "انتهت جلسة الدخول. سجّل الدخول مجددًا للمتابعة.";
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("القاهرة الكبرى") || message.includes("موعد") || message.includes("راجع بيانات")) return message;
  if (message.includes("تعذر الاتصال")) return "تعذر الاتصال بخدمة سِكّة. تحقق من الإنترنت ثم أعد المحاولة.";
  return message || "تعذر إتمام البحث الآن. حاول مرة أخرى.";
}
