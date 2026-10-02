import { useCallback, useEffect, useState, type FormEvent } from "react";
import MapPicker from "../MapPicker";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { ApiError, api, type CaptainOffer, type CaptainProfile, type Notification, type PoolStop, type RouteGeometry } from "../api";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, EmptyState, LoadingCard, NotificationsPanel } from "../components/workspace-shared";
export default function CaptainWorkspace({ session, section, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; notifications: Notification[]; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(Boolean(session.user.verified_at));
  const [otp, setOtp] = useState("");
  const [vehicle, setVehicle] = useState("private_car");
  const [license, setLicense] = useState("");
  const [plate, setPlate] = useState("");
  const [hasAc, setHasAc] = useState(true);
  const [tiers, setTiers] = useState<string[]>(["faster", "saver"]);
  const [radius, setRadius] = useState(4);
  const [offers, setOffers] = useState<CaptainOffer[]>([]);
  const [myTrips, setMyTrips] = useState<{ trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null }; stops: PoolStop[]; route: RouteGeometry | null }[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerError, setOfferError] = useState("");

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
    // Pool trip ownership is exposed through the accepted offers already cached in the active dashboard.
    const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token });
    setOffers(result.offers ?? []);
  }, [session.token]);
  useEffect(() => {
    if (!profileLoaded || !profile || profile.verification_status !== "approved" || section !== "offers") return;
    void refreshTrips().catch((error) => setOfferError(errorText(error)));
  }, [profileLoaded, profile?.verification_status, section, refreshTrips]);
  useEffect(() => {
    if (!profileLoaded || !profile || profile.verification_status !== "approved" || section !== "offers") return;
    const timer = window.setInterval(() => { void refreshTrips().catch((error) => setOfferError(errorText(error))); }, 30_000);
    return () => window.clearInterval(timer);
  }, [profileLoaded, profile?.verification_status, section, refreshTrips]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ profile: CaptainProfile }>("/captain/profile", { method: "POST", token: session.token, body: { vehicle_type_id: vehicle, license_number: license, vehicle_plate: plate } }); setProfile(result.profile); notify("تم حفظ بيانات المركبة. هتظهر للأدمن للمراجعة.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const requestOtp = async () => {
    try { await api("/captain/verify/request", { method: "POST", token: session.token }); notify("تم إنشاء كود التحقق. راجع نافذة الخادم المحلية وأدخله هنا.", "info"); }
    catch (error) { notify(errorText(error), "error"); }
  };
  const confirmOtp = async () => {
    try { await api("/captain/verify/confirm", { method: "POST", token: session.token, body: { otp } }); setPhoneVerified(true); setOtp(""); notify("تم توثيق رقم الهاتف.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
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
    try { await api(`/captain/pool/trips/${offer.trip.id}/accept`, { method: "POST", token: session.token }); notify("تم قبول المسار. هتلاقي تفاصيله في رحلاتي.", "success"); await refreshTrips(); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const loadAssignedTrips = useCallback(async () => {
    const result = await api<{ trips: { trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null; route_geometry: RouteGeometry | null }; stops: PoolStop[] }[] }>("/captain/pool/trips", { token: session.token });
    setMyTrips(result.trips.map((item) => ({ trip: item.trip, stops: item.stops, route: item.trip.route_geometry })));
  }, [session.token]);
  useEffect(() => { if (section === "captainTrips") void loadAssignedTrips().catch((error) => notify(errorText(error), "error")); }, [section, loadAssignedTrips, notify]);
  useEffect(() => {
    if (section !== "captainTrips") return;
    const timer = window.setInterval(() => { void loadAssignedTrips().catch((error) => notify(errorText(error), "error")); }, 30_000);
    return () => window.clearInterval(timer);
  }, [section, loadAssignedTrips, notify]);
  const selected = myTrips.find((item) => item.trip.id === selectedTrip) ?? null;

  if (!profileLoaded) return <LoadingCard text="بنجهز ملف الكابتن…" />;
  if (section === "account") return <div className="captain-account"><section className="surface onboarding-card"><div className="surface-heading"><div><span className="eyebrow">ملف الكابتن</span><h2>{profile ? "بيانات المركبة" : "ابدأ التوثيق"}</h2><p>أكمل بياناتك عشان تقدر تستقبل مسارات.</p></div><span className="surface-icon">⌖</span></div>
    {!profile ? <form className="form-stack" onSubmit={saveProfile}><label>نوع المركبة<select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="private_car">سيارة خاصة</option><option value="hiace">ميكروباص / Hiace</option></select></label><label>رقم الرخصة<input value={license} onChange={(e) => setLicense(e.target.value)} required /></label><label>رقم اللوحة<input value={plate} onChange={(e) => setPlate(e.target.value)} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ البيانات"}</button></form>
      : <><div className="captain-status-box"><span className={`status-chip status-${profile.verification_status}`}>{statusLabel(profile.verification_status)}</span><p>{profile.verification_status === "approved" ? "حسابك موثّق. حدّث موقعك وتفضيلات سيارتك عشان توصلك المسارات." : profile.verification_status === "pending" ? "بياناتك وصلت للإدارة. تقدر تجهز تفضيلاتك، والمسارات هتظهر بعد الموافقة." : "تم رفض الملف. تواصل مع الدعم لتحديث بيانات المركبة."}</p></div><div className="profile-data-grid"><div><small>المركبة</small><strong>{profile.vehicle_type_id === "hiace" ? "Hiace" : "سيارة خاصة"}</strong></div><div><small>رقم اللوحة</small><strong>{profile.vehicle_plate}</strong></div><div><small>رقم الرخصة</small><strong>{profile.license_number}</strong></div></div></>}
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">تأكيد ملكية الحساب</span><h3>توثيق رقم الهاتف</h3></div><span className="verified-mark">{phoneVerified ? "✓" : "•"}</span></div>{phoneVerified ? <div className="success-note">تم توثيق رقم هاتفك.</div> : <div className="otp-row"><button className="button button-outline button-small" onClick={() => void requestOtp()}>إرسال كود تحقق</button><input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="الكود من ٦ أرقام" /><button className="button button-secondary button-small" onClick={() => void confirmOtp()} disabled={otp.length < 4}>تأكيد</button><small>كود التطوير يظهر في سجل الخادم، لا تُرسل SMS حقيقية.</small></div>}
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">استقبال المسارات</span><h3>موقعك وفئات الخدمة</h3></div></div><p className="muted-text">النطاق {radius} كم · الكابتن يحدد موقعه عند بداية الدوام.</p><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث موقعي الحالي</button><div className="capability-list"><label className="toggle-row"><input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} /><span>سيارتي مكيفة</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("faster")} onChange={() => setTiers((items) => items.includes("faster") ? items.filter((x) => x !== "faster") : [...items, "faster"])} /><span>أقبل Faster</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("saver")} onChange={() => setTiers((items) => items.includes("saver") ? items.filter((x) => x !== "saver") : [...items, "saver"])} /><span>أقبل Saver</span></label></div><label className="range-label">نطاق البحث <strong>{radius} كم</strong><input type="range" min={4} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><small>من ٤ إلى ١٠ كم، بدون تأثير على السعر.</small></label><button className="button button-primary button-small" onClick={() => void saveCapabilities()}>حفظ التفضيلات</button>
    </section><AccountPanel session={session} notify={notify} /></div>;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;

  if (section === "captainTrips") return <div className="trips-page"><div className="section-toolbar"><div><h2>المسارات المسندة إليك</h2><p>تابع نقاط التوقف بالترتيب وسجّل الوصول</p></div><button className="button button-outline button-small" onClick={() => void loadAssignedTrips()}>تحديث ↻</button></div>{selected ? <section className="surface captain-trip-detail"><div className="detail-hero-top"><span className="status-chip status-assigned">{statusLabel(selected.trip.status)}</span><strong>مجموعة #{selected.trip.group_id} · {formatDate(selected.trip.service_date)}</strong><span>{selected.trip.direction === "outbound" ? "ذهاب" : "عودة"}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" direction={selected.trip.direction === "return" ? "return" : "outbound"} route={selected.route} routePlaces={selected.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence }))} readOnly onPick={() => undefined} /><div className="stop-list">{selected.stops.map((stop) => <div className="stop-row" key={stop.id}><span className={stop.stop_type === "pickup" ? "point-dot pickup-dot" : "point-dot dropoff-dot"} /><div><strong>{stop.stop_type === "pickup" ? "ركوب راكب" : "نزول راكب"} · محطة {stop.sequence}</strong><small>{typeof stop.lat === "number" && typeof stop.lng === "number" ? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}` : "الموقع غير متاح"}</small></div>{stop.reached_at ? <span className="stop-done">✓ تم</span> : <button className="button button-outline button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/stops/${stop.id}/reached`, { method: "POST", token: session.token }); await loadAssignedTrips(); notify("تم تسجيل الوصول.", "success"); } catch (error) { notify(errorText(error), "error"); } }}>وصلت</button>}</div>)}</div><div className="trip-actions"><button className="button button-primary button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/complete`, { method: "POST", token: session.token }); notify("تم إغلاق الرحلة.", "success"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إنهاء الرحلة</button><button className="button button-quiet button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/report-absence`, { method: "POST", token: session.token }); notify("بدأ البحث عن كابتن بديل لهذا اليوم.", "info"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إبلاغ عن عدم التمكن</button></div></section>
        : myTrips.length ? <div className="offer-grid">{myTrips.map(({ trip }) => <button className="surface offer-card" key={trip.id} onClick={() => setSelectedTrip(trip.id)}><span className="status-chip status-assigned">{statusLabel(trip.status)}</span><h3>مجموعة #{trip.group_id}</h3><p>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? "ذهاب" : "عودة"} · {trip.departure_at.slice(11, 16)}</p><span className="text-action">عرض نقاط التوقف ←</span></button>)}</div> : <EmptyState icon="↗" title="لسه مفيش مسارات مسندة" text="اقبل مسارًا من قائمة المسارات المتاحة وسيظهر هنا." />}</div>;

  if (!profile || profile.verification_status !== "approved") return <div className="approval-state surface"><span className="approval-icon">⌖</span><span className="eyebrow">خطوة قبل استقبال المشاوير</span><h2>{profile ? "ملفك قيد التوثيق" : "أكمل ملف الكابتن"}</h2><p>{profile ? "بمجرد مراجعة بيانات السيارة من الإدارة، هتقدر تحدد موقعك وتستقبل المسارات القريبة." : "أضف بيانات مركبتك من صفحة حسابي ثم تابع حالة التوثيق."}</p><button className="button button-primary button-small" onClick={() => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); }}>فتح حسابي ←</button></div>;
  const loadOffers = async () => { setOfferError(""); try { const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token }); setOffers(result.offers); } catch (error) { setOfferError(errorText(error)); } };
  return <div className="captain-offers-page"><div className="offer-toolbar"><div><div className="online-pill"><i /> جاهز لاستقبال المسارات</div><p>موقعك الحالي يحدد المسارات القريبة منك.</p></div><div className="offer-actions"><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث الموقع</button><button className="button button-primary button-small" onClick={() => void loadOffers()}>تحديث المسارات ↻</button></div></div>{offerError && <div className="inline-error">{offerError}</div>}{offers.length ? <div className="offer-grid">{offers.map((offer) => <article className="surface offer-card" key={offer.trip.id}><div className="offer-card-top"><span className="status-chip status-needs_captain">مسار متاح</span><span>{formatDate(offer.trip.service_date)}</span></div><h3>{categoryName({ id: offer.category_id, speed_tier: offer.category_id.includes("saver") ? "saver" : "faster", has_ac: offer.category_id.includes("ac") ? 1 : 0, seats: offer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 })}</h3><div className="offer-meta"><span>↔ {offer.route_distance_km ?? "—"} كم</span><span>◷ {offer.trip.departure_at.slice(11, 16)}</span><span>سعر المقعد {money(offer.seat_day_fare)}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={offer.route_geometry} onPick={() => undefined} /><button className="button button-primary button-wide" disabled={busy} onClick={() => void acceptOffer(offer)}>{busy ? "جاري القبول…" : "قبول المسار"}<span>←</span></button></article>)}</div> : <EmptyState icon="⌖" title="مفيش مسارات قريبة دلوقتي" text="حدّث موقعك ونطاق البحث، وهنعرض المسارات المطابقة لسيارتك هنا." action="تحديث المسارات" onAction={() => void loadOffers()} />}</div>;
}
