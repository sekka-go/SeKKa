import { getLanguage, t } from "../i18n/runtime";
import { useMemo, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import LocationSearchField from "../components/LocationSearchField";
import AppIcon from "../components/AppIcon";
import { api, type CaptainLine, type SavedPlace } from "../api";
import { errorText, money } from "../lib/formatters";
import type { MapPickMode, MapPoint } from "../MapPicker";
import { shiftDate, todayInCairo } from "../lib/booking-dates";
import type { Session, Toast } from "../types";

type SearchLine = CaptainLine & {
  seats_available: number;
  pickup_distance_km: number;
  dropoff_distance_km: number;
  arrival_difference_minutes: number;
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
  line: { id: number; origin_label: string; destination_label: string; arrival_time: string; price_per_seat: number; captain_name?: string } | null;
};
type FlowScreen = "search" | "results" | "details" | "custom" | "confirmation";
type SortMode = "soonest" | "price";

const initialDate = () => shiftDate(todayInCairo(), 1);

export default function RiderDemandFlow({ session, notify, onBack, onOpenRequests, onRequestCreated, initialPickup = null, initialDropoff = null, initialTripDate = initialDate(), initialArrivalTime = "08:00", savedPlaces = [] }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onOpenRequests: () => void;
  onRequestCreated: () => Promise<void>;
  initialPickup?: MapPoint | null;
  initialDropoff?: MapPoint | null;
  initialTripDate?: string;
  initialArrivalTime?: string;
  savedPlaces?: SavedPlace[];
}) {
  const [vehicle, setVehicle] = useState<"private_car" | "hiace">("private_car");
  const [tripDate, setTripDate] = useState(initialTripDate);
  const [arrivalTime, setArrivalTime] = useState(initialArrivalTime);
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
  const [screen, setScreen] = useState<FlowScreen>("search");
  const [sortMode, setSortMode] = useState<SortMode>("soonest");
  const [selectedLine, setSelectedLine] = useState<SearchLine | null>(null);
  const [submitted, setSubmitted] = useState<DemandResponse | null>(null);

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
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime,
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
      const result = await api<DemandResponse>("/rider/demand-requests", { method: "POST", token: session.token, body: {
        vehicle_type_id: vehicle, trip_date: tripDate, arrival_time: arrivalTime,
        pickup_label: pickup.label ?? pickupText, pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_label: dropoff.label ?? dropoffText, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, seats,
      } });
      setSubmitted(result);
      await onRequestCreated();
      setScreen("confirmation");
      notify(t(result.line ? "تم تسجيل طلبك وربطه بمسار مناسب." : "تم تسجيل طلبك وسيجمعه التطبيق مع الطلبات المشابهة."), "success");
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
  const setSeatCount = (next: number) => setSeats(Math.max(1, Math.min(14, next)));

  const routeTimeline = (origin: string, destination: string) => <div className="stitch-route-timeline"><span className="stitch-route-rail" aria-hidden="true"><i /><b /><i /></span><div><strong>{origin}</strong><strong>{destination}</strong></div></div>;
  const routeInputs = <>
    <LocationSearchField kind="pickup" title={t("نقطة الركوب")} value={pickupText} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setPickupText(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupText(point.label ?? ""); }} onChooseMap={() => showMap("pickup")} onFocus={() => undefined} pointSelected={pickup?.lat != null && pickup.lng != null} />
    <button type="button" className="stitch-swap-route" aria-label={t("تبديل نقطتي الركوب والوصول")} onClick={() => { const oldPickup = pickup; const oldText = pickupText; setPickup(dropoff); setPickupText(dropoffText); setDropoff(oldPickup); setDropoffText(oldText); }}>↕</button>
    <LocationSearchField kind="dropoff" title={t("نقطة الوصول")} value={dropoffText} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setDropoffText(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffText(point.label ?? ""); }} onChooseMap={() => showMap("dropoff")} onFocus={() => undefined} pointSelected={dropoff?.lat != null && dropoff.lng != null} />
  </>;

  const screenTitles: Record<FlowScreen, [string, string]> = {
    search: ["ابحث عن رحلة مشتركة", "اختر نقطتي الركوب والوصول والموعد المناسب"],
    results: ["المسارات المتاحة", "نتائج مطابقة لخط سيرك وموعدك"],
    details: ["تفاصيل المسار", "راجع تفاصيل الكابتن والسيارة والسعر قبل إرسال طلبك"],
    custom: ["سجّل طلب رحلة", "لو لم تجد مسارًا مناسبًا، سِكَّة تجمع طلبك تلقائيًا"],
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
        <form className="stitch-search-form" onSubmit={search}>
          <div className="stitch-location-stack">{routeInputs}</div>
          <div className="stitch-search-grid">
            <label className="stitch-field"><span>{t("تاريخ الرحلة")}</span><input type="date" min={todayInCairo()} value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></label>
            <label className="stitch-field"><span>{t("وقت الوصول")}</span><input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label>
            <label className="stitch-field"><span>{t("نوع المركبة")}</span><select value={vehicle} onChange={(event) => setVehicle(event.target.value as "private_car" | "hiace")}><option value="private_car">{t("ملاكي")}</option><option value="hiace">{t("هاي إس")}</option></select></label>
            <div className="stitch-seat-control"><span>{t("عدد المقاعد")}</span><div><button type="button" onClick={() => setSeatCount(seats - 1)} aria-label={t("تقليل المقاعد")}>−</button><strong>{seats}</strong><button type="button" onClick={() => setSeatCount(seats + 1)} aria-label={t("زيادة المقاعد")}>＋</button></div></div>
          </div>
          <button type="button" className="stitch-map-toggle" onClick={() => setMapOpen((open) => !open)}><AppIcon name="map" size={18} />{mapOpen ? t("إخفاء الخريطة") : t("اختيار الموقع على الخريطة")} <span>{mapOpen ? "⌃" : "⌄"}</span></button>
          {mapOpen && <section className="stitch-map-panel" aria-label={t("اختيار الموقع على الخريطة")}><div className="stitch-map-target"><button type="button" className={mapTarget === "pickup" ? "is-selected" : ""} onClick={() => setMapTarget("pickup")}>{t("نقطة الركوب")}</button><button type="button" className={mapTarget === "dropoff" ? "is-selected" : ""} onClick={() => setMapTarget("dropoff")}>{t("نقطة الوصول")}</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? t("موقع محدد على الخريطة")); } else { setDropoff(point); setDropoffText(point.label ?? t("موقع محدد على الخريطة")); } setMapOpen(false); }} /></div></section>}
          <div className="stitch-payment-note"><span className="stitch-icon-circle"><AppIcon name="wallet" size={18} /></span><div><strong>{t("الدفع مباشرة للكابتن")}</strong><p>{t("سِكَّة لا تحتفظ بأموالك. اتفق مع الكابتن على الدفع نقدًا أو عبر InstaPay بعد الرحلة.")}</p></div></div>
          <button className="button button-primary button-wide stitch-primary-cta" disabled={loading}>{loading ? t("loading.search") : t("اعرض المسارات المتاحة")} <span aria-hidden="true">⌕</span></button>
        </form>
      </section>
      <section className="stitch-saved-places"><div className="stitch-section-heading"><div><span className="eyebrow">{t("اختصاراتك")}</span><h3>{t("أماكنك المعتادة")}</h3></div></div>{savedPlaces.length ? <div className="stitch-place-chips">{savedPlaces.map((place) => <button type="button" key={`${place.place_type}-${place.label}`} onClick={() => { const point = { lat: place.lat, lng: place.lng, label: place.label, primaryLabel: place.label, kind: "pickup" as const }; setPickup(point); setPickupText(place.label); }}><span>{place.place_type === "home" ? "⌂" : place.place_type === "work" ? "▦" : "⌖"}</span><strong>{place.label}</strong></button>)}</div> : <p className="stitch-inline-empty">{t("احفظ المنزل أو العمل من حسابك للوصول إليهما بسرعة.")}</p>}</section>
    </>}

    {screen === "results" && <>
      <section className="stitch-route-summary surface"><div className="stitch-route-summary-icon">⌖</div><div><strong>{pickupText} <span>←</span> {dropoffText}</strong><small>{dateLabel} · {arrivalTime.slice(0, 5)} · {seats} {t("مقاعد")}</small></div><button type="button" onClick={() => setScreen("search")}>{t("تعديل")}</button></section>
      <div className="stitch-filter-row" role="group" aria-label={t("ترتيب المسارات")}><button className={sortMode === "soonest" ? "active" : ""} onClick={() => setSortMode("soonest")} type="button">● {t("الأقرب موعدًا")}</button><button className={sortMode === "price" ? "active" : ""} onClick={() => setSortMode("price")} type="button"><AppIcon name="wallet" size={16} /> {t("الأقل تكلفة")}</button><span>{sortedLines.length} {t("مسارات متاحة")}</span></div>
      {sortedLines.length ? <div className="stitch-results-list">{sortedLines.map((line, index) => <article className="stitch-result-card surface" key={line.id}>
        <div className="stitch-result-top"><div className="stitch-captain-avatar" aria-hidden="true">{(line.captain_name ?? t("كابتن")).slice(0, 1)}</div><div className="stitch-captain-copy"><strong>{line.captain_name ?? t("كابتن معتمد")}</strong><small>{line.captain_verified ? t("كابتن موثق") : t("مسار نشط")} · {line.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</small></div><div className="stitch-fare"><strong>{money(Number(line.price_per_seat))}</strong><small>{t("ج.م / مقعد")}</small></div></div>
        <div className="stitch-vehicle-strip"><AppIcon name="car" size={17} /><span>{line.vehicle_type_id === "hiace" ? t("هاي إس") : t("سيارة ملاكي")}</span><span>{line.seats_available} {t("مقاعد متاحة")}</span></div>
        {routeTimeline(line.origin_label, line.destination_label)}
        <div className="stitch-line-tags"><span>{line.pickup_distance_km.toFixed(1)} {t("كم من نقطة الركوب")}</span><span>{line.dropoff_distance_km.toFixed(1)} {t("كم من نقطة الوصول")}</span>{line.women_only && <span>{t("رحلة مخصصة للسيدات")}</span>}{line.payment_methods.includes("instapay") && <span>InstaPay</span>}{line.payment_methods.includes("cash") && <span>{t("نقدًا")}</span>}</div>
        <div className="stitch-result-times"><span><small>{t("موعد الوصول")}</small><strong>{line.arrival_time.slice(0, 5)}</strong></span><span><small>{t("فرق الوصول")}</small><strong>{line.arrival_difference_minutes > 0 ? `+${line.arrival_difference_minutes}` : line.arrival_difference_minutes} {t("دقيقة")}</strong></span></div>
        <div className="stitch-result-actions"><button className="button button-outline" type="button" onClick={() => notify(t("ستتوفر المحادثة بعد قبول طلب الرحلة."), "info")}><AppIcon name="messages" size={17} />{t("تواصل مع الكابتن")}</button><button className="button button-primary" type="button" onClick={() => { setSelectedLine(line); setScreen("details"); }}>{t("عرض التفاصيل")} <span aria-hidden="true">←</span></button></div>
        {index === 0 && <span className="stitch-match-label">{t("أفضل تطابق")}</span>}
      </article>)}</div> : <section className="stitch-no-results surface"><span className="stitch-no-results-icon">✦</span><div><h3>{t("لم نجد مسارًا مطابقًا الآن")}</h3><p>{t("سجّل طلبك، وسيجمعه نظام سِكَّة تلقائيًا مع الركاب المتجهين في نفس الاتجاه.")}</p></div><button className="button button-primary" type="button" onClick={() => setScreen("custom")}>{t("سجّل طلب رحلة مخصصة")} <span aria-hidden="true">←</span></button></section>}
      {sortedLines.length > 0 && <section className="stitch-custom-prompt"><div><strong>{t("لا يناسبك أي مسار؟")}</strong><p>{t("سِكَّة تنشئ لك طلبًا وتجمعه تلقائيًا مع الطلبات المتشابهة.")}</p></div><button className="button button-outline" type="button" onClick={() => setScreen("custom")}>{t("سجّل طلبًا مخصصًا")}</button></section>}
    </>}

    {screen === "details" && selectedLine && <>
      <section className="stitch-trip-map surface"><div className="stitch-map-art" aria-label={t("خريطة المسار") }><span className="map-road road-one"/><span className="map-road road-two"/><span className="map-road road-three"/><span className="map-route-line"/><i className="map-pin-start">●</i><i className="map-pin-end">●</i><span className="map-car-marker"><AppIcon name="car" size={19} /></span><b>{t("مسار الرحلة")}</b></div><div className="stitch-map-summary"><span>{t("مسار مشترك معتمد")}</span><strong>{t("وقت الرحلة التقديري")}: ٤٠ {t("دقيقة")}</strong></div></section>
      <section className="stitch-detail-card surface"><div className="stitch-section-heading"><div><span className="eyebrow">{t("تفاصيل خط السير")}</span><h3>{t("نقطة الركوب والوصول")}</h3></div><span className="stitch-status-dot">{t("متاح")}</span></div>{routeTimeline(selectedLine.origin_label, selectedLine.destination_label)}<div className="stitch-detail-facts"><span>{t("تاريخ الرحلة")}<strong>{dateLabel}</strong></span><span>{t("موعد الوصول") }<strong>{selectedLine.arrival_time.slice(0, 5)}</strong></span><span>{t("المقاعد المتاحة")}<strong>{selectedLine.seats_available}</strong></span><span>{t("نوع المركبة")}<strong>{selectedLine.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</strong></span></div></section>
      <section className="stitch-detail-card surface"><div className="stitch-section-heading"><div><span className="eyebrow">{t("الكابتن والمركبة")}</span><h3>{selectedLine.captain_name ?? t("كابتن المسار")}</h3></div>{selectedLine.captain_verified && <span className="stitch-verified">✓ {t("موثق")}</span>}</div><p>{selectedLine.vehicle_model ?? (selectedLine.vehicle_type_id === "hiace" ? t("سيارة هاي إس") : t("سيارة ملاكي"))}{selectedLine.vehicle_plate ? ` · ${selectedLine.vehicle_plate}` : ""}</p>{selectedLine.captain_rating != null && <p className="stitch-rating">★ {selectedLine.captain_rating.toFixed(1)} · {selectedLine.captain_rides ?? 0} {t("رحلة مكتملة")}</p>}</section>
      <section className="stitch-payment-note"><span className="stitch-icon-circle"><AppIcon name="wallet" size={18} /></span><div><strong>{t("طريقة الدفع المباشرة")}</strong><p>{t("التكلفة التقديرية للمقعد")} · {money(Number(selectedLine.price_per_seat))} {t("ج.م")}. الدفع للكابتن مباشرة نقدًا أو بالتحويل.</p></div></section>
      <div className="stitch-auto-match-banner"><span className="stitch-icon-circle"><AppIcon name="users" size={18} /></span><div><strong>{t("مهم: عرض المسار لا يحجز مقعدًا")}</strong><p>{t("إرسال طلبك لا يحجز مقعدًا مباشرةً؛ سِكَّة تستخدم بيانات الرحلة لمطابقة الطلب تلقائيًا.")}</p></div></div>
      <button className="button button-primary button-wide stitch-primary-cta" type="button" disabled={loading} onClick={() => void requestRide()}>{loading ? t("جارٍ إرسال الطلب…") : `${t("إرسال طلب الرحلة")} · ${money(Number(selectedLine.price_per_seat * seats))}`} <span aria-hidden="true">✓</span></button>
    </>}

    {screen === "custom" && <>
      <section className="stitch-auto-match-banner"><span className="stitch-icon-circle"><AppIcon name="users" size={18} /></span><div><strong>{t("سِكَّة تجمع الطلبات تلقائيًا")}</strong><p>{t("لا تحتاج إلى إنشاء مجموعة بنفسك. سنقارن طلبك بالطلبات المشابهة ونوصله بكابتن متاح عند توفر تطابق.")}</p></div></section>
      <section className="stitch-search-card surface"><div className="stitch-card-title"><span className="stitch-icon-circle"><AppIcon name="route" size={20} /></span><div><strong>{t("تفاصيل طلبك")}</strong><small>{t("راجع البيانات قبل تسجيل الطلب")}</small></div></div><form className="stitch-search-form" onSubmit={(event) => void requestRide(event)}>
        <div className="stitch-location-stack">{routeInputs}</div>
        {mapOpen && <section className="stitch-map-panel" aria-label={t("اختيار الموقع على الخريطة")}><div className="stitch-map-target"><button type="button" className={mapTarget === "pickup" ? "is-selected" : ""} onClick={() => setMapTarget("pickup")}>{t("نقطة الركوب")}</button><button type="button" className={mapTarget === "dropoff" ? "is-selected" : ""} onClick={() => setMapTarget("dropoff")}>{t("نقطة الوصول")}</button></div><div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={mapTarget} restrictToGreaterCairo onPick={(mode, point) => { if (mode === "pickup") { setPickup(point); setPickupText(point.label ?? t("موقع محدد على الخريطة")); } else { setDropoff(point); setDropoffText(point.label ?? t("موقع محدد على الخريطة")); } setMapOpen(false); }} /></div></section>}
        <div className="stitch-search-grid"><label className="stitch-field"><span>{t("تاريخ الرحلة")}</span><input type="date" min={todayInCairo()} value={tripDate} onChange={(event) => setTripDate(event.target.value)} required /></label><label className="stitch-field"><span>{t("وقت الوصول المطلوب")}</span><input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} required /></label><label className="stitch-field"><span>{t("نوع المركبة")}</span><select value={vehicle} onChange={(event) => setVehicle(event.target.value as "private_car" | "hiace")}><option value="private_car">{t("ملاكي")}</option><option value="hiace">{t("هاي إس")}</option></select></label><div className="stitch-seat-control"><span>{t("عدد المقاعد")}</span><div><button type="button" onClick={() => setSeatCount(seats - 1)} aria-label={t("تقليل المقاعد")}>−</button><strong>{seats}</strong><button type="button" onClick={() => setSeatCount(seats + 1)} aria-label={t("زيادة المقاعد")}>＋</button></div></div></div>
        <div className="stitch-check-row"><span className="stitch-check-mark" aria-hidden="true">✓</span><span>{t("سيجمع التطبيق طلبك تلقائيًا مع الطلبات المشابهة")}</span></div>
        <div className="stitch-estimate-note"><AppIcon name="shield" size={18} /><p>{t("السعر الموصى به تقديري، والدفع يتم مباشرة بين الراكب والكابتن بعد تأكيد الرحلة.")}</p></div>
        <button className="button button-primary button-wide stitch-primary-cta" disabled={loading}>{loading ? t("جارٍ تسجيل الطلب…") : t("تسجيل الطلب للتجميع الآلي")} <span aria-hidden="true">✣</span></button>
      </form></section>
    </>}

    {screen === "confirmation" && submitted && <section className="stitch-confirmation surface" role="status"><div className="stitch-confirmation-mark"><AppIcon name={submitted.line ? "check" : "route"} size={29} /></div><span className="eyebrow">{t("رقم الطلب")} #{submitted.request.id}</span><h3>{submitted.line ? t("تم العثور على مسار مناسب") : t("طلبك بانتظار المطابقة")}</h3><p>{submitted.line ? t("تم ربط طلبك بمسار. راجع تفاصيل الرحلة من قائمة طلباتك.") : t("سِكَّة تجمع طلبك مع الطلبات المشابهة. سنرسل لك إشعارًا عند العثور على مسار مناسب.")}</p><div className="stitch-confirmation-route">{routeTimeline(pickupText, dropoffText)}<span>{dateLabel} · {arrivalTime.slice(0, 5)}</span></div>{submitted.line && <div className="stitch-match-summary"><strong>{submitted.line.origin_label} ← {submitted.line.destination_label}</strong><span>{submitted.line.captain_name ?? t("كابتن")} · {money(Number(submitted.line.price_per_seat))} {t("للمقعد")}</span></div>}<button className="button button-primary button-wide" type="button" onClick={onOpenRequests}>{t("تابع طلباتي")} <span aria-hidden="true">←</span></button><button className="button button-quiet button-wide" type="button" onClick={onBack}>{t("العودة للرئيسية")}</button></section>}
  </div>;
}
