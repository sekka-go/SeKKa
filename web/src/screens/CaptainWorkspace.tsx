import { useCallback, useEffect, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import { ApiError, api, type CaptainOffer, type CaptainProfile, type PoolStop, type RouteGeometry } from "../api";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, EmptyState, ErrorState, LoadingCard } from "../components/workspace-shared";
export default function CaptainWorkspace({ session, section, notify }: {
  session: Session; section: NavKey; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [vehicle, setVehicle] = useState("private_car");
  const [license, setLicense] = useState("");
  const [plate, setPlate] = useState("");
  const [hasAc, setHasAc] = useState(true);
  const [tiers, setTiers] = useState<string[]>(["faster", "saver"]);
  const [radius, setRadius] = useState(4);
  const [offers, setOffers] = useState<CaptainOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [visibleOfferMap, setVisibleOfferMap] = useState<number | null>(null);
  const [myTrips, setMyTrips] = useState<{ trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null }; stops: PoolStop[]; route: RouteGeometry | null }[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [assignedTripsLoaded, setAssignedTripsLoaded] = useState(false);
  const [assignedTripsLoading, setAssignedTripsLoading] = useState(false);
  const [assignedTripsError, setAssignedTripsError] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const preferences = await api<{ radius_km: number; has_ac: boolean; service_tiers: string[] }>("/captain/pool/preferences", { token: session.token });
      setRadius(preferences.radius_km);
      setHasAc(preferences.has_ac);
      setTiers(preferences.service_tiers);
    } catch (error) { notify(errorText(error), "error"); }
    try {
      const result = await api<{ profile: CaptainProfile }>("/captain/profile", { token: session.token });
      setProfile(result.profile); setVehicle(result.profile.vehicle_type_id); setLicense(result.profile.license_number); setPlate(result.profile.vehicle_plate);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) notify(errorText(error), "error");
      setProfile(null);
    } finally { setProfileLoaded(true); }
  }, [session.token, notify]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const refreshTrips = useCallback(async () => {
    setOffersLoading(true);
    setOfferError("");
    try {
      // Pool trip ownership is exposed through the accepted offers already cached in the active dashboard.
      const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token });
      setOffers(result.offers ?? []);
    } catch (error) { setOfferError(errorText(error)); }
    finally { setOffersLoaded(true); setOffersLoading(false); }
  }, [session.token]);
  useEffect(() => {
    if (!profileLoaded || !profile || profile.verification_status !== "approved" || section !== "offers") return;
    void refreshTrips();
  }, [profileLoaded, profile?.verification_status, section, refreshTrips]);
  useEffect(() => {
    if (!profileLoaded || !profile || profile.verification_status !== "approved" || section !== "offers") return;
    const timer = window.setInterval(() => { void refreshTrips(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [profileLoaded, profile?.verification_status, section, refreshTrips]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ profile: CaptainProfile }>("/captain/profile", { method: "POST", token: session.token, body: { vehicle_type_id: vehicle, license_number: license, vehicle_plate: plate } }); setProfile(result.profile); window.dispatchEvent(new Event("sekka:verification-refresh")); notify("تم حفظ بيانات المركبة. هتظهر للأدمن للمراجعة.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const saveCapabilities = async () => {
    try { await api("/captain/pool/capabilities", { method: "PUT", token: session.token, body: { has_ac: hasAc, service_tiers: tiers } }); await api("/captain/pool/search-radius", { method: "PATCH", token: session.token, body: { radius_km: radius } }); notify("تم حفظ تفضيلات السيارة والمسارات.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
  };
  const updateLocation = async () => {
    if (!navigator.geolocation) { notify("المتصفح لا يدعم تحديد الموقع.", "error"); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try { const result = await api<{ profile: CaptainProfile }>("/captain/location", { method: "POST", token: session.token, body: { current_lat: coords.latitude, current_lng: coords.longitude } }); setProfile(result.profile); notify("تم تحديث موقعك الحالي.", "success"); }
      catch (error) { notify(errorText(error), "error"); }
    }, () => notify("اسمح للمتصفح بالوصول لموقعك ثم حاول مرة أخرى.", "error"), { enableHighAccuracy: true, timeout: 10_000 });
  };
  const acceptOffer = async (offer: CaptainOffer) => {
    setBusy(true);
    try { await api(`/captain/pool/trips/${offer.trip.id}/accept`, { method: "POST", token: session.token }); setOffers((current) => current.filter((item) => item.trip.id !== offer.trip.id)); setSelectedOfferId(null); notify("تم قبول المسار. هتلاقي تفاصيله في رحلاتي.", "success"); await refreshTrips(); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const loadAssignedTrips = useCallback(async () => {
    setAssignedTripsLoading(true);
    setAssignedTripsError("");
    try {
      const result = await api<{ trips: { trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null; route_geometry: RouteGeometry | null }; stops: PoolStop[] }[] }>("/captain/pool/trips", { token: session.token });
      setMyTrips(result.trips.map((item) => ({ trip: item.trip, stops: item.stops, route: item.trip.route_geometry })));
    } catch (error) {
      setAssignedTripsError(errorText(error));
      throw error;
    } finally { setAssignedTripsLoaded(true); setAssignedTripsLoading(false); }
  }, [session.token]);
  useEffect(() => { if (section === "captainTrips") void loadAssignedTrips().catch((error) => notify(errorText(error), "error")); }, [section, loadAssignedTrips, notify]);
  useEffect(() => {
    if (section !== "captainTrips") return;
    const timer = window.setInterval(() => { void loadAssignedTrips().catch((error) => notify(errorText(error), "error")); }, 30_000);
    return () => window.clearInterval(timer);
  }, [section, loadAssignedTrips, notify]);
  const selected = myTrips.find((item) => item.trip.id === selectedTrip) ?? null;
  const selectedStopPoints = useResolvedLocationPoints(session.token, selected?.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence })) ?? []);
  const selectedOffer = offers.find((offer) => offer.trip.id === selectedOfferId) ?? null;
  const visibleOffer = offers.find((offer) => offer.trip.id === (selectedOfferId ?? visibleOfferMap)) ?? null;
  const offerStopPoints = useResolvedLocationPoints(session.token, visibleOffer?.trip.stops?.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence })) ?? []);

  if (!profileLoaded) return <LoadingCard text="بنجهز ملف الكابتن…" />;
  if (section === "account") return <div className="captain-account"><section className="surface onboarding-card"><div className="surface-heading"><div><span className="eyebrow">ملف الكابتن</span><h2>{profile ? "بيانات المركبة" : "ابدأ التوثيق"}</h2><p>أكمل بياناتك عشان تقدر تستقبل مسارات.</p></div><span className="surface-icon">⌖</span></div>
    {!profile ? <form className="form-stack" onSubmit={saveProfile}><label>نوع المركبة<select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="private_car">سيارة خاصة</option><option value="hiace">ميكروباص / Hiace</option></select></label><label>رقم الرخصة<input value={license} onChange={(e) => setLicense(e.target.value)} required /></label><label>رقم اللوحة<input value={plate} onChange={(e) => setPlate(e.target.value)} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ البيانات"}</button></form>
      : <><div className="captain-status-box"><span className={`status-chip status-${profile.verification_status}`}>{statusLabel(profile.verification_status)}</span><p>{profile.verification_status === "approved" ? "حسابك موثّق. حدّث موقعك وتفضيلات سيارتك عشان توصلك المسارات." : profile.verification_status === "pending" ? "بياناتك وصلت للإدارة. تقدر تجهز تفضيلاتك، والمسارات هتظهر بعد الموافقة." : "تم رفض الملف. تواصل مع الدعم لتحديث بيانات المركبة."}</p></div><div className="profile-data-grid"><div><small>المركبة</small><strong>{profile.vehicle_type_id === "hiace" ? "Hiace" : "سيارة خاصة"}</strong></div><div><small>رقم اللوحة</small><strong>{profile.vehicle_plate}</strong></div><div><small>رقم الرخصة</small><strong>{profile.license_number}</strong></div></div></>}
    <details className="captain-settings-details settings-disclosure"><summary><span><strong>تفضيلات استقبال المسارات</strong><small>النطاق، موقع العمل، والفئات المقبولة</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary><div className="captain-preferences"><p className="muted-text">النطاق {radius} كم · الكابتن يحدد موقعه عند بداية الدوام.</p><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث موقعي الحالي</button><div className="capability-list"><label className="toggle-row"><input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} /><span>سيارتي مكيفة</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("faster")} onChange={() => setTiers((items) => items.includes("faster") ? items.filter((x) => x !== "faster") : [...items, "faster"])} /><span>أقبل Faster</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("saver")} onChange={() => setTiers((items) => items.includes("saver") ? items.filter((x) => x !== "saver") : [...items, "saver"])} /><span>أقبل Saver</span></label></div><label className="range-label">نطاق البحث <strong>{radius} كم</strong><input type="range" min={4} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><small>من ٤ إلى ١٠ كم، بدون تأثير على السعر.</small></label><button className="button button-primary button-small" onClick={() => void saveCapabilities()}>حفظ التفضيلات</button>
    </div></details></section><AccountPanel session={session} notify={notify} /></div>;

  if (section === "captainTrips") return <div className="trips-page">
    <div className="section-toolbar"><div><h2>المسارات المسندة إليك</h2><p>تابع نقاط التوقف بالترتيب وسجّل الوصول</p></div><button className="button button-outline button-small" disabled={assignedTripsLoading} onClick={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))}>{assignedTripsLoading ? "جارٍ التحديث…" : "تحديث ↻"}</button></div>
    {assignedTripsError && myTrips.length > 0 && <ErrorState title="تعذر تحديث المسارات" text={assignedTripsError} action="إعادة المحاولة" onAction={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))} />}
    {!assignedTripsLoaded || assignedTripsLoading ? <LoadingCard text="بنحمّل المسارات المسندة إليك…" /> : assignedTripsError && !myTrips.length ? <ErrorState text={assignedTripsError} action="إعادة المحاولة" onAction={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))} /> : selected ? <section className="surface captain-trip-detail">
      <div className="detail-hero-top"><span className="status-chip status-assigned">{statusLabel(selected.trip.status)}</span><strong>مجموعة #{selected.trip.group_id} · {formatDate(selected.trip.service_date)}</strong><span>{selected.trip.direction === "outbound" ? "ذهاب" : "عودة"}</span></div>
      <MapPicker pickup={null} dropoff={null} mode="pickup" direction={selected.trip.direction === "return" ? "return" : "outbound"} route={selected.route} routePlaces={selectedStopPoints} readOnly onPick={() => undefined} />
      <div className="stop-list">{selected.stops.map((stop, index) => <div className="stop-row" key={stop.id}>
        <span className={stop.stop_type === "pickup" ? "point-dot pickup-dot" : "point-dot dropoff-dot"} />
        <div><strong>{stop.stop_type === "pickup" ? "ركوب راكب" : "نزول راكب"} · محطة {stop.sequence}</strong><small>{selectedStopPoints[index]?.primaryLabel ?? "جارٍ تحديد العنوان…"}</small>{selectedStopPoints[index]?.secondaryLabel && <small>{selectedStopPoints[index].secondaryLabel}</small>}</div>
        {stop.reached_at ? <span className="stop-done">✓ تم</span> : <button className="button button-outline button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/stops/${stop.id}/reached`, { method: "POST", token: session.token }); await loadAssignedTrips(); notify("تم تسجيل الوصول.", "success"); } catch (error) { notify(errorText(error), "error"); } }}>وصلت</button>}
      </div>)}</div>
      <div className="trip-actions"><button className="button button-primary button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/complete`, { method: "POST", token: session.token }); notify("تم إغلاق الرحلة.", "success"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إنهاء الرحلة</button><button className="button button-quiet button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/report-absence`, { method: "POST", token: session.token }); notify("بدأ البحث عن كابتن بديل لهذا اليوم.", "info"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إبلاغ عن عدم التمكن</button></div>
    </section> : myTrips.length ? <div className="offer-grid">{myTrips.map(({ trip }) => <button className="surface offer-card" key={trip.id} onClick={() => setSelectedTrip(trip.id)}><span className="status-chip status-assigned">{statusLabel(trip.status)}</span><h3>مجموعة #{trip.group_id}</h3><p>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? "ذهاب" : "عودة"} · {trip.departure_at.slice(11, 16)}</p><span className="text-action">عرض نقاط التوقف ←</span></button>)}</div> : <EmptyState icon="↗" title="لسه مفيش مسارات مسندة" text="اقبل مسارًا من قائمة المسارات المتاحة وسيظهر هنا." />}
  </div>;
  const openVerification = () => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); window.setTimeout(() => document.getElementById("verification-center")?.scrollIntoView({ behavior: "smooth", block: "start" }), 180); };
  if (!profile || profile.verification_status !== "approved" || profile.status === "suspended_grace_expired") return <div className="approval-state surface verification-required-banner" role="status"><span className="approval-icon">⌖</span><span className="eyebrow">خطوة قبل استقبال المشاوير</span><h2>{profile?.status === "suspended_grace_expired" ? "أكمل المستندات المؤجلة" : "وثّق حسابك لاستقبال المسارات"}</h2><p>{profile?.status === "suspended_grace_expired" ? "انتهت مهلة المستندات. ارفعها واطلب من الدعم إعادة تفعيل حسابك." : "أرسل مستندات الهوية والمركبة ووثّق رقم هاتفك. سنعرض المسارات بعد اكتمال المراجعة."}</p><button className="button button-primary button-small" onClick={openVerification}>وثّق حسابك الآن</button></div>;
  const loadOffers = () => refreshTrips();
  if (section === "offers" && (!offersLoaded || offersLoading)) return <LoadingCard text="بندور على المسارات المناسبة لسيارتك…" />;
  if (section === "offers" && offerError && !offers.length) return <ErrorState text={offerError} action="تحديث المسارات" onAction={() => void loadOffers()} />;
  return <div className="captain-offers-page"><div className="offer-toolbar"><div><div className="online-pill"><i /> جاهز لاستقبال المسارات</div><p>موقعك الحالي يحدد المسارات القريبة منك.</p></div><div className="offer-actions"><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث الموقع</button><button className="button button-primary button-small" onClick={() => void loadOffers()} disabled={offersLoading}>{offersLoading ? "جارٍ التحديث…" : "تحديث المسارات ↻"}</button></div></div>{offerError && <div className="inline-error" role="alert">{offerError}<button className="button button-primary button-small" onClick={openVerification}>وثّق حسابك الآن</button></div>}
    {selectedOffer && <section className="surface captain-offer-review" aria-labelledby="captain-offer-review-title"><div className="captain-offer-review-heading"><div><span className="eyebrow">مراجعة قبل القبول</span><h2 id="captain-offer-review-title">تأكيد المسار المتاح</h2></div><span className="status-chip status-needs_captain">بانتظار كابتن</span></div><div className="captain-offer-review-grid"><div><small>المجموعة</small><strong>#{selectedOffer.group_id}</strong></div><div><small>التاريخ والاتجاه</small><strong>{formatDate(selectedOffer.trip.service_date)} · {selectedOffer.trip.direction === "outbound" ? "ذهاب" : "عودة"}</strong></div><div><small>موعد الانطلاق</small><strong>{selectedOffer.trip.departure_at.slice(11, 16)}</strong></div><div><small>المسافة</small><strong>{selectedOffer.route_distance_km ?? "—"} كم</strong></div><div><small>الفئة</small><strong>{categoryName({ id: selectedOffer.category_id, speed_tier: selectedOffer.category_id.includes("saver") ? "saver" : "faster", has_ac: selectedOffer.category_id.includes("ac") ? 1 : 0, seats: selectedOffer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 })}</strong></div><div><small>سعر المقعد</small><strong>{money(selectedOffer.seat_day_fare)}</strong></div></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={selectedOffer.route_geometry} routePlaces={offerStopPoints} onPick={() => undefined} /><div className="captain-offer-review-actions"><button type="button" className="button button-outline" onClick={() => setSelectedOfferId(null)} disabled={busy}>العودة لقائمة المسارات</button><button type="button" className="button button-primary" onClick={() => void acceptOffer(selectedOffer)} disabled={busy}>{busy ? "جارٍ قبول المسار…" : "تأكيد قبول المسار"}</button></div></section>}
    {offers.length ? <div className="offer-grid route-offer-grid">{[...offers].sort((a, b) => a.trip.departure_at.localeCompare(b.trip.departure_at) || a.trip.id - b.trip.id).map((offer) => {
      const category = categoryName({ id: offer.category_id, speed_tier: offer.category_id.includes("saver") ? "saver" : "faster", has_ac: offer.category_id.includes("ac") ? 1 : 0, seats: offer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 });
      const pickupStops = offer.trip.stops?.filter((stop) => stop.stop_type === "pickup").length;
      const dropoffStops = offer.trip.stops?.filter((stop) => stop.stop_type === "dropoff").length;
      return <article className="surface offer-card route-offer-card" key={offer.trip.id}>
        <div className="route-offer-top"><span className="status-chip status-needs_captain"><i /> مسار متاح</span><time dateTime={offer.trip.departure_at}>{formatDate(offer.trip.service_date)}</time></div>
        <div className="route-offer-title"><div><small>مجموعة #{offer.group_id}</small><h3>{category}</h3></div><div className="route-offer-price"><small>سعر المقعد</small><strong>{money(offer.seat_day_fare)}</strong></div></div>
        <div className="route-offer-timeline" aria-label="محطات المسار"><div className="route-offer-stop pickup"><span aria-hidden="true" /><div><strong>نقاط الركوب</strong><small>{pickupStops === undefined ? "ضمن خط السير" : `${pickupStops} محطات`}</small></div></div><div className="route-offer-stop dropoff"><span aria-hidden="true" /><div><strong>نقاط النزول</strong><small>{dropoffStops === undefined ? "ضمن خط السير" : `${dropoffStops} محطات`}</small></div></div></div>
        <div className="route-offer-facts"><div><small>المسافة</small><strong>{offer.route_distance_km ?? "—"} كم</strong></div><div><small>موعد الانطلاق</small><strong>{offer.trip.departure_at.slice(11, 16)}</strong></div><div><small>نوع الرحلة</small><strong>{offer.trip.direction === "outbound" ? "ذهاب" : "عودة"}</strong></div></div>
        <button className="button button-outline button-small route-offer-map-toggle" aria-expanded={visibleOfferMap === offer.trip.id} onClick={() => setVisibleOfferMap((current) => current === offer.trip.id ? null : offer.trip.id)}>{visibleOfferMap === offer.trip.id ? "إخفاء الخريطة" : "عرض خط السير"}</button>
        {visibleOfferMap === offer.trip.id && <MapPicker pickup={null} dropoff={null} mode="pickup" route={offer.route_geometry} routePlaces={visibleOfferMap === selectedOfferId ? offerStopPoints : offer.trip.stops?.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence }))} readOnly onPick={() => undefined} />}
        <button className="button button-primary button-wide route-offer-accept" disabled={busy} onClick={() => setSelectedOfferId(offer.trip.id)}>{selectedOfferId === offer.trip.id ? "المسار قيد المراجعة" : "مراجعة المسار وقبوله"}</button>
      </article>;
    })}</div> : <EmptyState icon="⌖" title="مفيش مسارات قريبة دلوقتي" text="حدّث موقعك ونطاق البحث، وهنعرض المسارات المطابقة لسيارتك هنا." action="تحديث المسارات" onAction={() => void loadOffers()} />}</div>;
}

