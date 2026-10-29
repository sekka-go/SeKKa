import { getLanguage, t } from "../i18n/runtime";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import LocationSearchField from "../components/LocationSearchField";
import AppIcon from "../components/AppIcon";
import { api, type CaptainLine, type SavedPlace, type VehicleType } from "../api";
import { useVehicleTypes } from "../lib/use-vehicle-types";
import { errorText, money, vehicleTypeLabel } from "../lib/formatters";
import type { MapPickMode, MapPoint } from "../MapPicker";
import { shiftDate, todayInCairo } from "../lib/booking-dates";
import type { Session, Toast } from "../types";

type SearchLine = CaptainLine & {
  seats_available: number;
  pickup_distance_km: number;
  dropoff_distance_km: number;
  arrival_difference_minutes: number;
  return_arrival_time?: string | null;
  matched_return?: boolean;
  captain_name?: string;
  captain_rating?: number | null;
  captain_rides?: number | null;
  captain_verified?: boolean;
  women_only?: boolean;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
};
type DemandResponse = {
  request: { id: number; status: string };
  demand_group: { id: number; status: string; captain_line_id: number | null } | null;
  line: { id: number; origin_label: string; destination_label: string; arrival_time: string; return_arrival_time?: string | null; price_per_seat: number; captain_name?: string } | null;
};
type SubmittedRequest = DemandResponse & { kind: "line-join" | "custom-demand" };
type FlowScreen = "search" | "results" | "details" | "custom" | "confirmation";
type SortMode = "soonest" | "price";

const initialDate = () => shiftDate(todayInCairo(), 1);

export default function RiderDemandFlow({ session, notify, onBack, onOpenRequests, onRequestCreated, initialPickup = null, initialDropoff = null, initialTripDate = initialDate(), initialArrivalTime = "08:00", initialReturnArrivalTime = "", startWithCustomRequest = false, savedPlaces = [] }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onOpenRequests: () => void;
  onRequestCreated: () => Promise<void>;
  initialPickup?: MapPoint | null;
  initialDropoff?: MapPoint | null;
  initialTripDate?: string;
  initialArrivalTime?: string;
  initialReturnArrivalTime?: string;
  startWithCustomRequest?: boolean;
  savedPlaces?: SavedPlace[];
}) {
  const [vehicle, setVehicle] = useState("");
  const { vehicleTypes, error: vehicleTypesError, retry: retryVehicleTypes } = useVehicleTypes(session.token);
  const tripDate = initialTripDate;
  const [arrivalTime, setArrivalTime] = useState(initialArrivalTime);
  const [returnTime, setReturnTime] = useState(initialReturnArrivalTime);
  const [seats, setSeats] = useState(1);
  const [pickup, setPickup] = useState<MapPoint | null>(initialPickup);
  const [dropoff, setDropoff] = useState<MapPoint | null>(initialDropoff);
  const [pickupText, setPickupText] = useState(initialPickup?.label ?? "");
  const [dropoffText, setDropoffText] = useState(initialDropoff?.label ?? "");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<MapPickMode>("pickup");
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<SearchLine[]>([]);
  const [searched, setSearched] = useState(false);
  const [screen, setScreen] = useState<FlowScreen>(startWithCustomRequest ? "custom" : "search");
  const [sortMode, setSortMode] = useState<SortMode>("soonest");
  const [selectedLine, setSelectedLine] = useState<SearchLine | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedRequest | null>(null);

  useEffect(() => {
    if (vehicleTypes.length && !vehicleTypes.some((item) => item.id === vehicle)) setVehicle(vehicleTypes[0]!.id);
  }, [vehicleTypes, vehicle]);

  const sortedLines = useMemo(() => [...lines].sort((a, b) => sortMode === "price"
    ? Number(a.price_per_seat) - Number(b.price_per_seat)
    : a.arrival_time.localeCompare(b.arrival_time)), [lines, sortMode]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (pickup?.lat == null || pickup.lng == null || dropoff?.lat == null || dropoff.lng == null) {
      notify(t("حدد مكان الركوب والوصول من نتائج البحث أو الخريطة."), "error"); return;
    }
    setLoading(true); setSubmitted(null);
    try {
      const result = await api<{ lines: SearchLine[] }>("/rider/lines/search", { method: "POST", token: session.token, body: {
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime, return_arrival_time: returnTime || null,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, seats,
      } });
      setLines((result.lines ?? []).filter((line) => Number(line.seats_available) >= seats)); setSearched(true); setScreen("results");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLoading(false); }
  };

  const requestRide = async (event?: FormEvent) => {
    event?.preventDefault();
    if (pickup?.lat == null || pickup.lng == null || dropoff?.lat == null || dropoff.lng == null) return;
    setLoading(true);
    try {
      let result: SubmittedRequest;
      if (screen === "details" && selectedLine) {
        const joined = await api<{ request: { id: number; status: string } }>("/rider/line-requests", { method: "POST", token: session.token, body: {
          line_id: selectedLine.id, trip_date: tripDate,
          pickup_label: pickup.label ?? pickupText, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
          dropoff_label: dropoff.label ?? dropoffText, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
          seats, direction: selectedLine.matched_return ? "return" : "outbound",
        } });
        result = { kind: "line-join", request: joined.request, demand_group: null, line: {
          id: selectedLine.id, origin_label: selectedLine.origin_label, destination_label: selectedLine.destination_label,
          arrival_time: selectedLine.arrival_time, return_arrival_time: selectedLine.return_arrival_time,
          price_per_seat: selectedLine.price_per_seat, captain_name: selectedLine.captain_name,
        } };
      } else {
        const custom = await api<DemandResponse>("/rider/demand-requests", { method: "POST", token: session.token, body: {
          vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime, return_arrival_time: returnTime || null,
          pickup_label: pickup.label ?? pickupText, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
          dropoff_label: dropoff.label ?? dropoffText, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, seats,
        } });
        result = { ...custom, kind: "custom-demand" };
      }
      setSubmitted(result);
      await onRequestCreated();
      setScreen("confirmation");
      notify(t(result.kind === "line-join" ? "تم إرسال طلب الانضمام للكابتن." : "تم تسجيل طلبك. سننبهك عند نشر رحلة مناسبة لتراجعها بنفسك."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLoading(false); }
  };

  const showMap = (target: MapPickMode) => { setMapTarget(target); setMapOpen(true); };
  const flowBack = () => {
    if (screen === "search") { onBack(); return; }
    if (screen === "results") setScreen("search");
    else if (screen === "details") setScreen("results");
    else if (screen === "custom") setScreen(searched ? "results" : "search");
    else onBack();
  };
  const dateLabel = new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-EG" : "en-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${tripDate}T12:00:00`));
  const vehicleCapacity = (id: string) => vehicleTypes.find((item) => item.id === id)?.capacity_max ?? 0;
  const setSeatCount = (next: number) => setSeats(Math.max(1, Math.min(vehicleCapacity(vehicle), next)));
  const changeVehicle = (next: string) => {
    setVehicle(next);
    setSeats((current) => Math.min(current, vehicleCapacity(next)));
  };

  const routeTimeline = (origin: string, destination: string) => <div className="stitch-route-timeline"><span className="stitch-route-rail" aria-hidden="true"><i /><b /><i /></span><div><strong>{origin}</strong><strong>{destination}</strong></div></div>;
  const routeInputs = <>
    <LocationSearchField kind="pickup" title={t("نقطة الركوب")} value={pickupText} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setPickupText(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupText(point.label ?? ""); }} onChooseMap={() => showMap("pickup")} onFocus={() => undefined} pointSelected={pickup?.lat != null && pickup.lng != null} />
    <button type="button" className="stitch-swap-route" aria-label={t("تبديل نقطتي الركوب والوصول")} onClick={() => { const oldPickup = pickup; const oldText = pickupText; setPickup(dropoff); setPickupText(dropoffText); setDropoff(oldPickup); setDropoffText(oldText); }}>↕</button>
    <LocationSearchField kind="dropoff" title={t("نقطة الوصول")} value={dropoffText} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setDropoffText(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffText(point.label ?? ""); }} onChooseMap={() => showMap("dropoff")} onFocus={() => undefined} pointSelected={dropoff?.lat != null && dropoff.lng != null} />
  </>;

  const screenTitles: Record<FlowScreen, [string, string]> = {
    search: ["ابحث عن رحلة مشتركة", "اختر نقطتي الركوب والوصول والموعد المناسب"],
    results: ["الرحلات المتاحة", "رحلات نشرها الكباتن وتناسب نقطتيك وموعدك"],
    details: ["تفاصيل الرحلة", "راجع بيانات الرحلة والكابتن والسعر قبل طلب الانضمام"],
    custom: ["أنشئ طلب رحلة", "استخدمه عندما لا تجد رحلة منشورة تناسبك"],
    confirmation: ["تم إرسال طلب الرحلة", "تقدر تتابع حالة الطلب من صفحة طلباتي"],
  };
  const [title, subtitle] = screenTitles[screen];

  return <div className={`stitch-rider-flow stitch-screen-${screen}`}>
    <header className="stitch-screen-header">
      <button className="stitch-back" type="button" onClick={flowBack} aria-label={t("رجوع")}>←</button>
      <div><span className="eyebrow">{t("SeKKa · معاك في السكة")}</span><h2>{t(title)}</h2><p>{t(subtitle)}</p></div>
      <span className="stitch-header-icon" aria-hidden="true"><AppIcon name={screen === "results" ? "search" : screen === "confirmation" ? "check" : "route"} size={20} /></span>
    </header>

    {screen === "search" && <>
      <section className="stitch-search-card surface">
        <div className="stitch-card-title"><span className="stitch-icon-circle"><AppIcon name="route" size={20} /></span><div><strong>{t("من أين وإلى أين؟")}</strong><small>{t("اختر نقاطك على المسار")}</small></div></div>
        {vehicleTypesError && <div className="inline-error" role="alert"><span>{t("تعذر تحميل فئات المركبات")}</span><button type="button" className="button button-outline button-small" onClick={retryVehicleTypes}>{t("إعادة المحاولة")}</button></div>}
        <form className="stitch-search-form" onSubmit={search}>
          <div className="stitch-location-stack">{routeInputs}</div>
          <div className="stitch-search-grid">
            <label className="stitch-field"><span>{t("وقت الذهاب")}</span><input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label>
            <label className="stitch-field"><span>{t("وقت العودة")}</span><input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label>
            <label className="stitch-field"><span>{t("فئة المركبة")}</span><select value={vehicle} onChange={(event) => changeVehicle(event.target.value)} disabled={!vehicleTypes.length}>{vehicleTypes.map((item: VehicleType) => <option key={item.id} value={item.id}>{vehicleTypeLabel(item.id)} · {item.capacity_max} {t(item.capacity_max === 1 ? "راكبًا" : "ركاب")}</option>)}</select></label>
            <div className="stitch-seat-control"><span>{t("عدد المقاعد")}</span><div><button type="button" onClick={() => setSeatCount(seats - 1)} aria-label={t("تقليل المقاعد")}>−</button><strong>{seats}</strong><button type="button" onClick={() => setSeatCount(seats + 1)} aria-label={t("زيادة المقاعد")}>＋</button></div></div>
          </div>
          <p className="stitch-auto-date">{t("تاريخ الرحلة تلقائيًا")}: {dateLabel}</p>
          <button type="button" className="stitch-map-toggle" onClick={() => setMapOpen((open) => !open)}><AppIcon name="map" size={18} />{mapOpen ? t("إخفاء الخريطة") : t("اختيار الموقع على الخريطة")} <span>{mapOpen ? "⌃" : "⌄"}</span></button>
          {mapOpen && <section className="stitch-map-panel" aria-label={t("اختيار الموقع على الخريطة")}><div className="stitch-map-target"><button type="button" className={mapTarget === "pickup" ? "is-selected" : ""} onClick={() => setMapTarget("pickup")}>{t("نقطة الركوب")}</button><button type="button" className={mapTarget === "dropoff" ? "is-selected" : ""} onClick={() => setMapTarget("dropoff")}>{t("نقطة الوصول")}</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? t("موقع محدد على الخريطة")); } else { setDropoff(point); setDropoffText(point.label ?? t("موقع محدد على الخريطة")); } setMapOpen(false); }} /></div></section>}
          <div className="stitch-payment-note"><span className="stitch-icon-circle"><AppIcon name="wallet" size={18} /></span><div><strong>{t("الدفع مباشرة للكابتن")}</strong><p>{t("سِكَّة لا تحتفظ بأموالك. اتفق مع الكابتن على الدفع نقدًا أو عبر InstaPay بعد الرحلة.")}</p></div></div>
          <button className="button button-primary button-wide stitch-primary-cta" disabled={loading || !vehicle}>{loading ? t("loading.search") : t("اعرض الرحلات المتاحة")} <span aria-hidden="true">⌕</span></button>
        </form>
      </section>
      <section className="stitch-saved-places"><div className="stitch-section-heading"><div><span className="eyebrow">{t("اختصاراتك")}</span><h3>{t("أماكنك المعتادة")}</h3></div></div>{savedPlaces.length ? <div className="stitch-place-chips">{savedPlaces.map((place) => <button type="button" key={`${place.place_type}-${place.label}`} onClick={() => { const point = { lat: place.lat, lng: place.lng, label: place.label, primaryLabel: place.label, kind: "pickup" as const }; setPickup(point); setPickupText(place.label); }}><span>{place.place_type === "home" ? "⌂" : place.place_type === "work" ? "▦" : "⌖"}</span><strong>{place.label}</strong></button>)}</div> : <p className="stitch-inline-empty">{t("احفظ المنزل أو العمل من حسابك للوصول إليهما بسرعة.")}</p>}</section>
    </>}

    {screen === "results" && <>
      <section className="stitch-route-summary surface"><div className="stitch-route-summary-icon">⌖</div><div><strong>{pickupText} <span>←</span> {dropoffText}</strong><small>{dateLabel} · {arrivalTime.slice(0, 5)}{returnTime ? ` · ${t("عودة")} ${returnTime.slice(0, 5)}` : ""} · {seats} {t("مقاعد")}</small></div><button type="button" onClick={() => setScreen("search")}>{t("تعديل")}</button></section>
      <div className="stitch-filter-row" role="group" aria-label={t("ترتيب الرحلات")}><button className={sortMode === "soonest" ? "active" : ""} onClick={() => setSortMode("soonest")} type="button">● {t("الأقرب موعدًا")}</button><button className={sortMode === "price" ? "active" : ""} onClick={() => setSortMode("price")} type="button"><AppIcon name="wallet" size={16} /> {t("الأقل تكلفة")}</button><span>{sortedLines.length} {t("رحلات متاحة")}</span></div>
      {sortedLines.length ? <div className="stitch-results-list">{sortedLines.map((line) => <article className="stitch-result-card surface" key={line.id}>
        <div className="stitch-result-top"><div className="stitch-captain-avatar" aria-hidden="true">{(line.captain_name ?? t("كابتن")).slice(0, 1)}</div><div className="stitch-captain-copy"><strong>{line.captain_name ?? t("كابتن معتمد")}</strong><small>{line.captain_verified ? t("كابتن موثق") : t("مسار نشط")} · {vehicleTypeLabel(line.vehicle_type_id)}</small></div><div className="stitch-fare"><strong>{money(Number(line.price_per_seat))}</strong><small>{t("ج.م / مقعد")}</small></div></div>
        <div className="stitch-vehicle-strip"><AppIcon name="car" size={17} /><span>{vehicleTypeLabel(line.vehicle_type_id)}</span><span>{line.seats_available} {t("مقاعد متاحة")}</span></div>
        {routeTimeline(line.origin_label, line.destination_label)}
        <div className="stitch-line-tags"><span>{line.pickup_distance_km.toFixed(1)} {t("كم من نقطة الركوب")}</span><span>{line.dropoff_distance_km.toFixed(1)} {t("كم من نقطة الوصول")}</span>{line.women_only && <span>{t("رحلة مخصصة للسيدات")}</span>}{line.payment_methods.includes("instapay") && <span>InstaPay</span>}{line.payment_methods.includes("cash") && <span>{t("نقدًا")}</span>}</div>
        <div className="stitch-result-times"><span><small>{t("موعد الوصول")}</small><strong>{line.arrival_time.slice(0, 5)}</strong></span>{returnTime && line.return_arrival_time && <span><small>{t("وقت العودة")}</small><strong>{line.return_arrival_time.slice(0, 5)}</strong></span>}<span><small>{t("فرق الوصول")}</small><strong>{line.arrival_difference_minutes > 0 ? `+${line.arrival_difference_minutes}` : line.arrival_difference_minutes} {t("دقيقة")}</strong></span></div>
        <div className="stitch-result-actions"><button className="button button-outline" type="button" onClick={() => notify(t("ستتوفر المحادثة بعد قبول طلب الرحلة."), "info")}><AppIcon name="messages" size={17} />{t("تواصل مع الكابتن")}</button><button className="button button-primary" type="button" onClick={() => { setSelectedLine(line); setScreen("details"); }}>{t("طلب الانضمام للرحلة")} <span aria-hidden="true">←</span></button></div>
      </article>)}</div> : <section className="stitch-no-results surface"><span className="stitch-no-results-icon">✦</span><div><h3>{t("لم نجد رحلة منشورة تناسب بحثك")}</h3><p>{t("أنشئ طلب رحلة وسنخبرك عند نشر رحلة مناسبة، ثم تختار بنفسك إن كنت تريد طلب الانضمام.")}</p></div><button className="button button-primary" type="button" onClick={() => setScreen("custom")}>{t("أنشئ طلب رحلة")} <span aria-hidden="true">←</span></button></section>}
      {sortedLines.length > 0 && <section className="stitch-custom-prompt"><div><strong>{t("لا تناسبك الرحلات المعروضة؟")}</strong><p>{t("أنشئ طلب رحلة لتصلك تنبيهات عند نشر خيارات مناسبة.")}</p></div><button className="button button-outline" type="button" onClick={() => setScreen("custom")}>{t("أنشئ طلب رحلة")}</button></section>}
    </>}

    {screen === "details" && selectedLine && <>
      <section className="stitch-trip-map surface"><span className="eyebrow">{t("خط سير الرحلة")}</span>{routeTimeline(selectedLine.origin_label, selectedLine.destination_label)}<div className="stitch-map-summary"><span>{t("رحلة منشورة من الكابتن")}</span><strong>{t("موعد الوصول")}: {selectedLine.arrival_time.slice(0, 5)}</strong></div></section>
      <section className="stitch-detail-card surface"><div className="stitch-section-heading"><div><span className="eyebrow">{t("تفاصيل خط السير")}</span><h3>{t("نقطة الركوب والوصول")}</h3></div><span className="stitch-status-dot">{t("متاح")}</span></div>{routeTimeline(selectedLine.origin_label, selectedLine.destination_label)}<div className="stitch-detail-facts"><span>{t("تاريخ الرحلة")}<strong>{dateLabel}</strong></span><span>{t("موعد الوصول") }<strong>{selectedLine.arrival_time.slice(0, 5)}</strong></span>{returnTime && selectedLine.return_arrival_time && <span>{t("وقت العودة")}<strong>{selectedLine.return_arrival_time.slice(0, 5)}</strong></span>}<span>{t("المقاعد المتاحة")}<strong>{selectedLine.seats_available}</strong></span><span>{t("نوع المركبة")}<strong>{vehicleTypeLabel(selectedLine.vehicle_type_id)}</strong></span></div></section>
      <section className="stitch-detail-card surface"><div className="stitch-section-heading"><div><span className="eyebrow">{t("الكابتن والمركبة")}</span><h3>{selectedLine.captain_name ?? t("كابتن المسار")}</h3></div>{selectedLine.captain_verified && <span className="stitch-verified">✓ {t("موثق")}</span>}</div><p>{selectedLine.vehicle_model ?? (vehicleTypeLabel(selectedLine.vehicle_type_id))}{selectedLine.vehicle_plate ? ` · ${selectedLine.vehicle_plate}` : ""}</p>{selectedLine.captain_rating != null && <p className="stitch-rating">★ {selectedLine.captain_rating.toFixed(1)} · {selectedLine.captain_rides ?? 0} {t("رحلة مكتملة")}</p>}</section>
      <section className="stitch-payment-note"><span className="stitch-icon-circle"><AppIcon name="wallet" size={18} /></span><div><strong>{t("طريقة الدفع المباشرة")}</strong><p>{t("التكلفة التقديرية للمقعد")} · {money(Number(selectedLine.price_per_seat))} {t("ج.م")}. الدفع للكابتن مباشرة نقدًا أو بالتحويل.</p></div></section>
      <div className="stitch-auto-match-banner"><span className="stitch-icon-circle"><AppIcon name="users" size={18} /></span><div><strong>{t("طلب الانضمام ينتظر موافقة الكابتن")}</strong><p>{t("لن يتأكد مقعدك إلا بعد قبول الكابتن للطلب. الدفع يتم مباشرة بينك وبين الكابتن.")}</p></div></div>
      <button className="button button-primary button-wide stitch-primary-cta" type="button" disabled={loading || !pickup?.lat || !dropoff?.lat} onClick={() => void requestRide()}>{loading ? t("جارٍ إرسال طلب الانضمام…") : `${t("طلب الانضمام للرحلة")} · ${money(Number(selectedLine.price_per_seat * seats))}`} <span aria-hidden="true">✓</span></button>
    </>}

    {screen === "custom" && <>
      <section className="stitch-auto-match-banner"><span className="stitch-icon-circle"><AppIcon name="users" size={18} /></span><div><strong>{t("طلب بديل عند عدم وجود رحلة مناسبة")}</strong><p>{t("سيظل طلبك مستقلًا. سننبهك عند نشر رحلة قد تناسبك، وأنت تختار إن كنت تريد إرسال طلب انضمام للكابتن.")}</p></div></section>
      <section className="stitch-search-card surface"><div className="stitch-card-title"><span className="stitch-icon-circle"><AppIcon name="route" size={20} /></span><div><strong>{t("تفاصيل طلبك")}</strong><small>{t("راجع البيانات قبل تسجيل الطلب")}</small></div></div><form className="stitch-search-form" onSubmit={(event) => void requestRide(event)}>
        <div className="stitch-location-stack">{routeInputs}</div>
        {mapOpen && <section className="stitch-map-panel" aria-label={t("اختيار الموقع على الخريطة")}><div className="stitch-map-target"><button type="button" className={mapTarget === "pickup" ? "is-selected" : ""} onClick={() => setMapTarget("pickup")}>{t("نقطة الركوب")}</button><button type="button" className={mapTarget === "dropoff" ? "is-selected" : ""} onClick={() => setMapTarget("dropoff")}>{t("نقطة الوصول")}</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? t("موقع محدد على الخريطة")); } else { setDropoff(point); setDropoffText(point.label ?? t("موقع محدد على الخريطة")); } setMapOpen(false); }} /></div></section>}
        <div className="stitch-search-grid"><label className="stitch-field"><span>{t("وقت الذهاب")}</span><input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label><label className="stitch-field"><span>{t("وقت العودة")}</span><input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label><label className="stitch-field"><span>{t("فئة المركبة")}</span><select value={vehicle} onChange={(event) => changeVehicle(event.target.value)} disabled={!vehicleTypes.length}>{vehicleTypes.map((item) => <option key={item.id} value={item.id}>{vehicleTypeLabel(item.id)} · {item.capacity_max} {t("ركاب")}</option>)}</select></label><div className="stitch-seat-control"><span>{t("عدد المقاعد")}</span><div><button type="button" disabled={seats <= 1} onClick={() => setSeatCount(seats - 1)} aria-label={t("تقليل المقاعد")}>−</button><strong>{seats}</strong><button type="button" disabled={!vehicle || seats >= vehicleCapacity(vehicle)} onClick={() => setSeatCount(seats + 1)} aria-label={t("زيادة المقاعد")}>＋</button></div></div></div><p className="stitch-auto-date">{t("تاريخ الرحلة تلقائيًا")}: {dateLabel}</p>
        <div className="stitch-check-row"><span className="stitch-check-mark" aria-hidden="true">✓</span><span>{t("سيجمع التطبيق طلبك تلقائيًا مع الطلبات المشابهة")}</span></div>
        <div className="stitch-estimate-note"><AppIcon name="shield" size={18} /><p>{t("السعر الموصى به تقديري، والدفع يتم مباشرة بين الراكب والكابتن بعد تأكيد الرحلة.")}</p></div>
        <button className="button button-primary button-wide stitch-primary-cta" disabled={loading}>{loading ? t("جارٍ تسجيل الطلب…") : t("تسجيل الطلب للتجميع الآلي")} <span aria-hidden="true">✣</span></button>
      </form></section>
    </>}

    {screen === "confirmation" && submitted && <section className="stitch-confirmation surface" role="status"><div className="stitch-confirmation-mark"><AppIcon name={submitted.kind === "line-join" || submitted.line ? "check" : "route"} size={29} /></div><span className="eyebrow">{t("رقم الطلب")} #{submitted.request.id}</span><h3>{t(submitted.kind === "line-join" ? "طلب الانضمام بانتظار رد الكابتن" : submitted.line ? "تم ربط طلبك برحلة مناسبة" : "طلبك بانتظار اقتراح رحلة")}</h3><p>{t(submitted.kind === "line-join" ? "تم إرسال طلب الانضمام للكابتن. ستجد حالة الرد في صفحة طلباتي." : submitted.line ? "تم ربط طلبك برحلة. راجع تفاصيلها من صفحة طلباتي." : "سنرسل لك إشعارًا عند نشر رحلة مناسبة. راجع تفاصيلها واختر بنفسك إن كنت تريد طلب الانضمام.")}</p><div className="stitch-confirmation-route">{routeTimeline(pickupText, dropoffText)}<span>{dateLabel} · {arrivalTime.slice(0, 5)}</span></div>{submitted.line && <div className="stitch-match-summary"><strong>{submitted.line.origin_label} ← {submitted.line.destination_label}</strong><span>{submitted.line.captain_name ?? t("كابتن")} · {money(Number(submitted.line.price_per_seat))} {t("للمقعد")}</span></div>}<button className="button button-primary button-wide" type="button" onClick={onOpenRequests}>{t("تابع طلباتي")} <span aria-hidden="true">←</span></button><button className="button button-quiet button-wide" type="button" onClick={onBack}>{t("العودة للرئيسية")}</button></section>}
  </div>;
}
