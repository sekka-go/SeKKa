import { t } from "../i18n/runtime";
import Button from "../components/Button";
import AppIcon from "../components/AppIcon";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import LocationSearchField from "../components/LocationSearchField";
import { categoryName, errorText, formatDate, money, statusLabel, vehicleCapacity, vehicleTypeLabel } from "../lib/formatters";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import { getRecentDeviceLocation, subscribeToDeviceLocation } from "../lib/device-location";
import { sameData, useSilentRefresh } from "../lib/use-silent-refresh";
import { ApiError, api, type CaptainLine, type CaptainLineJoinRequest, type CaptainOffer, type CaptainProfile, type PoolStop, type RouteGeometry } from "../api";
import type { MapPickMode, MapPoint } from "../MapPicker";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, EmptyState, ErrorState, LoadingCard } from "../components/workspace-shared";
export default function CaptainWorkspace({ session, section, setSection, notify, onInitialReady }: {
  session: Session; section: NavKey; setSection: (section: NavKey) => void; notify: (text: string, tone?: Toast["tone"]) => void; onInitialReady: () => void;
}) {
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [vehicle, setVehicle] = useState("prime");
  const [license, setLicense] = useState("");
  const [plate, setPlate] = useState("");
  const [hasAc, setHasAc] = useState(true);
  const [tiers, setTiers] = useState<string[]>(["faster", "saver"]);
  const [radius, setRadius] = useState(4);
  const [offers, setOffers] = useState<CaptainOffer[]>([]);
  const offersRef = useRef<CaptainOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [visibleOfferMap, setVisibleOfferMap] = useState<number | null>(null);
  const [myTrips, setMyTrips] = useState<{ trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null }; stops: PoolStop[]; route: RouteGeometry | null }[]>([]);
  const myTripsRef = useRef<typeof myTrips>([]);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [assignedTripsLoaded, setAssignedTripsLoaded] = useState(false);
  const [assignedTripsLoading, setAssignedTripsLoading] = useState(false);
  const [assignedTripsError, setAssignedTripsError] = useState("");
  const [earnings, setEarnings] = useState<{ trip: { id: number; group_id?: number; service_date: string; direction: string; departure_at: string; completed_at?: string | null; total_amount?: number; status: string }; stops: PoolStop[]; payment: { amount: number; reported_at?: string } | null }[]>([]);
  const [earningsTotal, setEarningsTotal] = useState(0);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsLoaded, setEarningsLoaded] = useState(false);
  const [earningsError, setEarningsError] = useState("");
  const [lines, setLines] = useState<CaptainLine[]>([]);
  const linesRef = useRef<CaptainLine[]>([]);
  const [publishedLinesLoaded, setPublishedLinesLoaded] = useState(false);
  const [demandGroups, setDemandGroups] = useState<{ id: number; captain_line_id: number; trip_date: string; arrival_time: string; return_arrival_time?: string | null; requests: { id: number; rider_name: string; pickup_label: string; dropoff_label: string; seats: number }[] }[]>([]);
  const demandGroupsRef = useRef<typeof demandGroups>([]);
  const [lineJoinRequests, setLineJoinRequests] = useState<CaptainLineJoinRequest[]>([]);
  const lineJoinRequestsRef = useRef<CaptainLineJoinRequest[]>([]);
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [intermediateStops, setIntermediateStops] = useState<{ point: MapPoint | null; search: string }[]>([]);
  const [linePrice, setLinePrice] = useState("");
  const [lineMapOpen, setLineMapOpen] = useState(false);
  const [lineMapTarget, setLineMapTarget] = useState<MapPickMode | { intermediateIndex: number }>("pickup");
  const [lineDays, setLineDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [lineArrival, setLineArrival] = useState("08:00");
  const [lineReturnArrival, setLineReturnArrival] = useState("");
  const [lineSeats, setLineSeats] = useState(3);
  const [linePaymentMethods, setLinePaymentMethods] = useState<string[]>(["cash"]);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const lastLocationSync = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const lineEditorRef = useRef<HTMLDetailsElement>(null);
  const isLineManagementSection = section === "offers";
  const isCaptainRequestsSection = section === "captainRequests";
  const publishOpen = section === "publish";

  const loadProfile = useCallback(async () => {
    setProfileLoaded(false);
    setProfileLoadError("");
    const preferencesRequest = api<{ radius_km: number; has_ac: boolean; service_tiers: string[] }>("/captain/pool/preferences", { token: session.token }).then((preferences) => {
      setRadius(preferences.radius_km);
      setHasAc(preferences.has_ac);
      setTiers(preferences.service_tiers);
    }).catch((error) => notify(errorText(error), "error"));
    try {
      const result = await api<{ profile: CaptainProfile }>("/captain/profile", { token: session.token });
      setProfile(result.profile); setVehicle(result.profile.vehicle_type_id); setLineSeats((seats) => Math.min(seats, vehicleCapacity(result.profile.vehicle_type_id))); setLicense(result.profile.license_number); setPlate(result.profile.vehicle_plate);
    } catch (error) {
      setProfile(null);
      if (!(error instanceof ApiError && error.status === 404)) setProfileLoadError(errorText(error));
    } finally { setProfileLoaded(true); }
    void preferencesRequest;
  }, [session.token, notify]);
  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const refreshTrips = useCallback(async (quiet = false, signal?: AbortSignal) => {
    if (!quiet) { setOffersLoading(true); setOfferError(""); }
    try {
      // Pool trip ownership is exposed through the accepted offers already cached in the active dashboard.
      const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token, signal, etag: true });
      const next = result.offers ?? []; const changed = !sameData(offersRef.current, next);
      if (changed) { offersRef.current = next; setOffers(next); }
      return changed;
    } catch (error) { if (!quiet) setOfferError(errorText(error)); return false; }
    finally { setOffersLoaded(true); if (!quiet) setOffersLoading(false); }
  }, [session.token]);
  useEffect(() => {
    if (!profileLoaded || !profile || profile.verification_status !== "approved" || !isCaptainRequestsSection) return;
    void refreshTrips(offersLoaded);
  }, [profileLoaded, profile?.verification_status, isCaptainRequestsSection, offersLoaded, refreshTrips]);
  const loadPublishedLines = useCallback(async (signal?: AbortSignal) => {
    const [lineResult, demandResult] = await Promise.all([
      api<{ lines: CaptainLine[] }>("/captain/lines", { token: session.token, signal, etag: true }),
      api<{ groups: typeof demandGroups }>("/captain/demand-groups", { token: session.token, signal, etag: true }),
    ]);
    const nextLines = lineResult.lines ?? [], nextGroups = demandResult.groups ?? [];
    const changed = !sameData(linesRef.current, nextLines) || !sameData(demandGroupsRef.current, nextGroups);
    if (!sameData(linesRef.current, nextLines)) { linesRef.current = nextLines; setLines(nextLines); }
    if (!sameData(demandGroupsRef.current, nextGroups)) { demandGroupsRef.current = nextGroups; setDemandGroups(nextGroups); }
    setPublishedLinesLoaded(true);
    return changed;
  }, [session.token]);
  const loadLineJoinRequests = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api<{ requests: CaptainLineJoinRequest[] }>("/captain/line-requests", { token: session.token, signal, etag: true });
      const next = result.requests ?? [];
      const changed = !sameData(lineJoinRequestsRef.current, next);
      if (changed) { lineJoinRequestsRef.current = next; setLineJoinRequests(next); }
      return changed;
    } catch { return false; }
  }, [session.token]);
  useEffect(() => { if (isCaptainRequestsSection && profile?.verification_status === "approved") void loadLineJoinRequests(); }, [isCaptainRequestsSection, profile?.verification_status, loadLineJoinRequests]);
  useSilentRefresh(loadLineJoinRequests, { enabled: isCaptainRequestsSection && profile?.verification_status === "approved", intervalMs: 20_000 });
  const decideLineJoinRequest = async (request: CaptainLineJoinRequest, decision: "accepted" | "rejected") => {
    setBusy(true);
    try {
      const result = await api<{ request: CaptainLineJoinRequest }>(`/captain/line-requests/${request.id}`, { method: "PATCH", token: session.token, body: { decision } });
      setLineJoinRequests((current) => { const next = current.map((item) => item.id === request.id ? result.request : item); lineJoinRequestsRef.current = next; return next; });
      notify(t(decision === "accepted" ? "تم قبول طلب الانضمام." : "تم رفض طلب الانضمام."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!isLineManagementSection || profile?.verification_status !== "approved") return;
    void loadPublishedLines().catch((error) => { setPublishedLinesLoaded(true); notify(errorText(error), "error"); });
  }, [isLineManagementSection, profile?.verification_status, loadPublishedLines, notify]);
  useSilentRefresh(loadPublishedLines, { enabled: isLineManagementSection && profile?.verification_status === "approved", intervalMs: 20_000 });
  useSilentRefresh((signal) => refreshTrips(true, signal), { enabled: profileLoaded && Boolean(profile?.verification_status === "approved") && isCaptainRequestsSection, intervalMs: 20_000 });
  useEffect(() => {
    if (!profileLoaded) return;
    if (section === "offers" && profile?.verification_status === "approved") {
      if (assignedTripsLoaded && publishedLinesLoaded) onInitialReady();
      return;
    }
    if (section === "captainRequests" && !offersLoaded) return;
    if (section === "captainTrips" && !assignedTripsLoaded) return;
    if (section === "captainEarnings" && !earningsLoaded) return;
    onInitialReady();
  }, [profileLoaded, profile, section, offersLoaded, assignedTripsLoaded, publishedLinesLoaded, earningsLoaded, onInitialReady]);
  useEffect(() => { if (editingLineId !== null) lineEditorRef.current?.setAttribute("open", ""); }, [editingLineId]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ profile: CaptainProfile }>("/captain/profile", { method: "POST", token: session.token, body: { vehicle_type_id: vehicle, license_number: license, vehicle_plate: plate } }); setProfile(result.profile); window.dispatchEvent(new Event("sekka:verification-refresh")); notify(t("تم حفظ بيانات المركبة. هتظهر للأدمن للمراجعة."), "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const resetLineEditor = () => {
    setEditingLineId(null); setOrigin(null); setDestination(null); setOriginSearch(""); setDestinationSearch("");
    setIntermediateStops([]); setLinePrice(""); setLineArrival("08:00"); setLineReturnArrival("");
    setLineDays([0, 1, 2, 3, 4]); setLinePaymentMethods(["cash"]);
  };
  const editLine = (line: CaptainLine) => {
    setEditingLineId(line.id);
    setOrigin({ label: line.origin_label, lat: line.origin_lat, lng: line.origin_lng });
    setOriginSearch(line.origin_label);
    setDestination({ label: line.destination_label, lat: line.destination_lat, lng: line.destination_lng });
    setDestinationSearch(line.destination_label);
    setIntermediateStops((line.intermediate_stops ?? []).map((point) => ({ point: { ...point }, search: point.label })));
    setLinePrice(String(line.price_per_seat)); setLineArrival(line.arrival_time.slice(0, 5));
    setLineReturnArrival(line.return_arrival_time?.slice(0, 5) ?? ""); setLineDays(line.service_days);
    setLineSeats(line.seats); setLinePaymentMethods(line.payment_methods);
    setLineMapOpen(false); setSection("publish");
  };
  const publishLine = async (event: FormEvent) => {
    event.preventDefault();
    const price = Number(linePrice);
    if (!profile || origin?.lat == null || origin.lng == null || destination?.lat == null || destination.lng == null) {
      notify(t("حدد نقطة البداية والنهاية من البحث أو الخريطة."), "error"); return;
    }
    if (intermediateStops.some(({ point }) => point?.lat == null || point.lng == null)) {
      notify(t("أكمل تحديد كل المحطات الوسيطة أو احذف المحطة غير المكتملة."), "error"); return;
    }
    if (!Number.isFinite(price) || price < 0.01) {
      notify(t("أدخل سعرًا صحيحًا أكبر من صفر."), "error"); return;
    }
    setBusy(true);
    const lineBody = {
        vehicle_type_id: profile.vehicle_type_id,
        origin_label: origin.label ?? originSearch, origin_lat: origin.lat, origin_lng: origin.lng,
        destination_label: destination.label ?? destinationSearch, destination_lat: destination.lat, destination_lng: destination.lng,
        intermediate_stops: intermediateStops.map(({ point, search }) => ({ label: point?.label ?? search, lat: point?.lat, lng: point?.lng })),
        price_per_seat: price,
        arrival_time: lineArrival, return_arrival_time: lineReturnArrival || null, service_days: lineDays, seats: lineSeats,
        payment_methods: linePaymentMethods,
    };
    const isEditing = editingLineId !== null;
    try {
      await api(isEditing ? `/captain/lines/${editingLineId}` : "/captain/lines", { method: isEditing ? "PUT" : "POST", token: session.token, body: lineBody });
      resetLineEditor(); setSection("offers");
      notify(t(isEditing ? "تم تحديث مسارك." : "تم نشر مسارك. سنجمع طلبات الركاب المتشابهة تلقائيًا."), "success");
      await loadPublishedLines();
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const cancelLine = async (line: CaptainLine) => {
    if (!window.confirm(t("هل تريد إلغاء هذا المسار؟ لن يظهر للركاب بعد الإلغاء."))) return;
    setBusy(true);
    try {
      await api(`/captain/lines/${line.id}/status`, { method: "PATCH", token: session.token, body: { status: "cancelled" } });
      await loadPublishedLines(); notify(t("تم إلغاء المسار."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const saveCapabilities = async () => {
    try { await api("/captain/pool/capabilities", { method: "PUT", token: session.token, body: { has_ac: hasAc, service_tiers: tiers } }); await api("/captain/pool/search-radius", { method: "PATCH", token: session.token, body: { radius_km: radius } }); notify(t("تم حفظ تفضيلات السيارة والمسارات."), "success"); }
    catch (error) { notify(errorText(error), "error"); }
  };
  useEffect(() => {
    if (!profile || profile.verification_status !== "approved" || profile.status === "suspended_grace_expired") return;
    let active = true;
    let syncInFlight = false;
    const syncLocation = (location: { lat: number; lng: number; updatedAt: number } | null) => {
      if (!active || document.visibilityState === "hidden" || !location || Date.now() - location.updatedAt > 60_000) return;
      const previous = lastLocationSync.current;
      const movedMeters = previous ? Math.hypot((location.lat - previous.lat) * 111_000, (location.lng - previous.lng) * 111_000 * Math.cos(location.lat * Math.PI / 180)) : Infinity;
      const elapsed = previous ? Date.now() - previous.at : Infinity;
      if (syncInFlight || (previous && (elapsed < 30_000 || (movedMeters < 100 && elapsed < 5 * 60_000)))) return;
      syncInFlight = true;
      void api<{ profile: CaptainProfile }>("/captain/location", { method: "POST", token: session.token, body: { current_lat: location.lat, current_lng: location.lng } })
        .then((result) => { if (active) { lastLocationSync.current = { lat: location.lat, lng: location.lng, at: Date.now() }; setProfile((current) => sameData(current, result.profile) ? current : result.profile); } })
        .catch(() => undefined)
        .finally(() => { syncInFlight = false; });
    };
    const unsubscribe = subscribeToDeviceLocation(syncLocation);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") syncLocation(getRecentDeviceLocation()); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [profile?.verification_status, profile?.status, session.token]);
  const acceptOffer = async (offer: CaptainOffer) => {
    setBusy(true);
    try { await api(`/captain/pool/trips/${offer.trip.id}/accept`, { method: "POST", token: session.token }); setOffers((current) => { const next = current.filter((item) => item.trip.id !== offer.trip.id); offersRef.current = next; return next; }); setSelectedOfferId(null); notify(t("تم قبول المسار. هتلاقي تفاصيله في رحلاتي."), "success"); await refreshTrips(); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  const loadAssignedTrips = useCallback(async (quiet = false, signal?: AbortSignal) => {
    if (!quiet) { setAssignedTripsLoading(true); setAssignedTripsError(""); }
    try {
      const result = await api<{ trips: { trip: { id: number; group_id: number; service_date: string; direction: string; departure_at: string; status: string; captain_user_id: number | null; route_geometry: RouteGeometry | null }; stops: PoolStop[] }[] }>("/captain/pool/trips", { token: session.token, signal, etag: true });
      const next = result.trips.map((item) => ({ trip: item.trip, stops: item.stops, route: item.trip.route_geometry }));
      const changed = !sameData(myTripsRef.current, next);
      if (changed) { myTripsRef.current = next; setMyTrips(next); }
      return changed;
    } catch (error) {
      if (!quiet) setAssignedTripsError(errorText(error));
      if (!quiet) throw error;
      return false;
    } finally { setAssignedTripsLoaded(true); if (!quiet) setAssignedTripsLoading(false); }
  }, [session.token]);
  useEffect(() => { if (section === "captainTrips" || section === "offers") void loadAssignedTrips(assignedTripsLoaded).catch((error) => notify(errorText(error), "error")); }, [section, loadAssignedTrips, assignedTripsLoaded, notify]);
  useSilentRefresh((signal) => loadAssignedTrips(true, signal), { enabled: section === "captainTrips" || section === "offers", intervalMs: 20_000 });
  const selected = myTrips.find((item) => item.trip.id === selectedTrip) ?? null;
  const selectedStopPoints = useResolvedLocationPoints(session.token, selected?.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence })) ?? []);
  const selectedOffer = offers.find((offer) => offer.trip.id === selectedOfferId) ?? null;
  const visibleOffer = offers.find((offer) => offer.trip.id === (selectedOfferId ?? visibleOfferMap)) ?? null;
  const offerStopPoints = useResolvedLocationPoints(session.token, visibleOffer?.trip.stops?.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence })) ?? []);
  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true); setEarningsError("");
    try {
      const result = await api<{ earnings: typeof earnings; total_amount: number }>("/captain/earnings", { token: session.token });
      setEarnings(result.earnings ?? []); setEarningsTotal(result.total_amount ?? 0);
    } catch (error) { setEarningsError(errorText(error)); }
    finally { setEarningsLoaded(true); setEarningsLoading(false); }
  }, [session.token]);
  const confirmPaymentReceived = async (tripId: number, suggestedAmount = 0) => {
    const entry = window.prompt(t("المبلغ الذي استلمته فعليًا"), suggestedAmount ? String(suggestedAmount) : "");
    if (entry === null) return;
    const amount = Number(entry);
    if (!Number.isFinite(amount) || amount <= 0) { notify(t("أدخل المبلغ الذي استلمته فعليًا."), "error"); return; }
    try {
      await api(`/captain/trips/${tripId}/confirm-payment`, { method: "POST", token: session.token, body: { amount } });
      notify(t("تم تسجيل استلام المبلغ."), "success");
      await loadEarnings();
    } catch (error) { notify(errorText(error), "error"); }
  };
  useEffect(() => { if (section === "captainEarnings") void loadEarnings(); }, [section, loadEarnings]);

  if (!profileLoaded) return <LoadingCard text="loading.captainProfile" />;
  if (profileLoadError) return <ErrorState title="loading.failure" text={profileLoadError} action="إعادة المحاولة" onAction={() => void loadProfile()} />;
  if (section === "account") return <div className="captain-account captain-stitch captain-stitch-profile"><section className="surface onboarding-card captain-profile-card"><div className="surface-heading"><div><span className="eyebrow">{t("ملف الكابتن")}</span><h2>{profile ? t("بيانات المركبة") : t("ابدأ التوثيق")}</h2><p>{t("أكمل بياناتك عشان تقدر تستقبل مسارات.")}</p></div><span className="surface-icon">⌖</span></div>
    {!profile ? <form className="form-stack" onSubmit={saveProfile}><label>{t("فئة المركبة")}<select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="prime">SeKKa Prime · 3 {t("ركاب")}</option><option value="daily">SeKKa Daily · 4 {t("ركاب")}</option><option value="space">SeKKa Space · 9 {t("ركاب")}</option><option value="max">SeKKa Max · 13 {t("راكبًا")}</option></select></label><label>{t("رقم الرخصة")}<input value={license} onChange={(e) => setLicense(e.target.value)} required /></label><label>{t("رقم اللوحة")}<input value={plate} onChange={(e) => setPlate(e.target.value)} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? t("جاري الحفظ…") : t("حفظ البيانات")}</button></form>
      : <><div className="captain-status-box"><span className={`status-chip status-${profile.verification_status}`}>{statusLabel(profile.verification_status)}</span><p>{profile.verification_status === "approved" ? t("حسابك موثّق. اسمح للتطبيق باستخدام موقعك وتفضيلات سيارتك عشان توصلك المسارات.") : profile.verification_status === "pending" ? t("بياناتك وصلت للإدارة. تقدر تجهز تفضيلاتك، والمسارات هتظهر بعد الموافقة.") : t("تم رفض الملف. راجع بيانات المركبة والرخصة، ثم اطلب من الدعم مراجعة قرار التوثيق.")}</p>{profile.verification_status === "rejected" && <a className="button button-primary button-small" href={`mailto:sekkago.app@gmail.com?subject=${encodeURIComponent(t("طلب مراجعة توثيق حساب الكابتن"))}`}>{t("تواصل مع الدعم لمراجعة القرار")}</a>}</div><div className="profile-data-grid"><div><small>{t("المركبة")}</small><strong>{vehicleTypeLabel(profile.vehicle_type_id)}</strong></div><div><small>{t("رقم اللوحة")}</small><strong>{profile.vehicle_plate}</strong></div><div><small>{t("رقم الرخصة")}</small><strong>{profile.license_number}</strong></div></div></>}
    <details className="captain-settings-details settings-disclosure"><summary><span><strong>{t("تفضيلات استقبال المسارات")}</strong><small>{t("النطاق، موقع العمل، والفئات المقبولة")}</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary><div className="captain-preferences"><p className="muted-text">{t("النطاق")} {radius}  {t("كم · الكابتن يحدد موقعه عند بداية الدوام.")}</p><div className="capability-list"><label className="toggle-row"><input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} /><span>{t("سيارتي مكيفة")}</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("faster")} onChange={() => setTiers((items) => items.includes("faster") ? items.filter((x) => x !== "faster") : [...items, "faster"])} /><span>{t("أقبل Faster")}</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("saver")} onChange={() => setTiers((items) => items.includes("saver") ? items.filter((x) => x !== "saver") : [...items, "saver"])} /><span>{t("أقبل Saver")}</span></label></div><label className="range-label">{t("نطاق البحث")} <strong>{radius}  {t("كم")}</strong><input type="range" min={4} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><small>{t("من ٤ إلى ١٠ كم، بدون تأثير على السعر.")}</small></label><button className="button button-primary button-small" onClick={() => void saveCapabilities()}>{t("حفظ التفضيلات")}</button>
    </div></details></section><AccountPanel session={session} notify={notify} /></div>;

  if (section === "captainEarnings") return <div className="captain-stitch captain-stitch-earnings">
    <section className="captain-earnings-summary surface"><div><span className="eyebrow">{t("سجل الرحلات المكتملة")}</span><h2>{t("المبالغ المسجلة")}</h2><p>{t("هذه المبالغ مبنية على الرحلات المكتملة والمدفوعات المسجلة في حسابك.")}</p></div><strong>{money(earningsTotal)}</strong></section>
    <div className="captain-direct-payment-note"><span className="captain-status-mark"><AppIcon name="wallet" size={20} /></span><div><strong>{t("الدفع مباشرة للكابتن")}</strong><p>{t("يتفق الراكب والكابتن على الدفع نقدًا أو عبر إنستاباي. سِكّة لا تحتفظ بأموال الرحلة.")}</p></div></div>
    <section className="surface captain-earnings-list"><div className="section-title-row"><div><span className="eyebrow">{t("سجل الرحلات")}</span><h2>{t("الرحلات المكتملة")}</h2></div><Button type="button" variant="secondary" size="sm" onClick={() => void loadEarnings()} disabled={earningsLoading}><AppIcon name="refresh" size={17} /> {t("تحديث")}</Button></div>
      {earningsLoading ? <LoadingCard text="loading.assignedTrips" /> : earningsError ? <ErrorState title="loading.failure" text={earningsError} action="إعادة المحاولة" onAction={() => void loadEarnings()} /> : earnings.length ? <div className="captain-earning-rows">{earnings.map(({ trip, payment }) => <article className="captain-earning-row" key={trip.id}><span className="captain-earning-icon"><AppIcon name="trips" size={19} /></span><div className="captain-earning-trip"><strong>{t("رحلة المجموعة")}{trip.group_id ? ` #${trip.group_id}` : ` #${trip.id}`}</strong><small>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? t("ذهاب") : t("عودة")}{trip.completed_at ? ` · ${formatDate(trip.completed_at)}` : ""}</small></div><strong className="captain-earning-amount">{payment ? money(payment.amount) : t("بانتظار تأكيد الاستلام")}</strong>{!payment && <Button type="button" variant="secondary" size="sm" onClick={() => void confirmPaymentReceived(trip.id, trip.total_amount)}>{t("تأكيد استلام المبلغ")}</Button>}</article>)}</div> : <EmptyState icon="↗" title={t("لا توجد رحلات مكتملة حتى الآن")} text={t("سيظهر سجل الرحلات والمبالغ هنا بعد إتمام أول رحلة.")} />}
    </section>
  </div>;

  if (section === "captainTrips") return <div className="trips-page captain-stitch captain-stitch-trips">
    <div className="section-toolbar"><div><h2>{t("المسارات المسندة إليك")}</h2><p>{t("تابع نقاط التوقف بالترتيب وسجّل الوصول")}</p></div><button className="button button-outline button-small" disabled={assignedTripsLoading} onClick={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))}>{assignedTripsLoading ? t("جارٍ التحديث…") : t("تحديث ↻")}</button></div>
    {assignedTripsError && myTrips.length > 0 && <ErrorState title={t("تعذر تحديث المسارات")} text={assignedTripsError} action="إعادة المحاولة" onAction={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))} />}
    {!assignedTripsLoaded || assignedTripsLoading ? <LoadingCard text="loading.assignedTrips" /> : assignedTripsError && !myTrips.length ? <ErrorState text={assignedTripsError} action="إعادة المحاولة" onAction={() => void loadAssignedTrips().catch((error) => notify(errorText(error), "error"))} /> : selected ? <section className="surface captain-trip-detail">
      <div className="detail-hero-top"><span className="status-chip status-assigned">{statusLabel(selected.trip.status)}</span><strong>{t("مجموعة #")}{selected.trip.group_id} · {formatDate(selected.trip.service_date)}</strong><span>{selected.trip.direction === "outbound" ? t("ذهاب") : t("عودة")}</span></div>
      <MapPicker pickup={null} dropoff={null} mode="pickup" direction={selected.trip.direction === "return" ? "return" : "outbound"} route={selected.route} routePlaces={selectedStopPoints} readOnly onPick={() => undefined} />
      <div className="stop-list">{selected.stops.map((stop, index) => <div className="stop-row" key={stop.id}>
        <span className={stop.stop_type === "pickup" ? "point-dot pickup-dot" : "point-dot dropoff-dot"} />
        <div><strong>{stop.stop_type === "pickup" ? t("ركوب راكب") : t("نزول راكب")}  {t("· محطة")} {stop.sequence}</strong><small>{selectedStopPoints[index]?.primaryLabel ?? t("جارٍ تحديد العنوان…")}</small>{selectedStopPoints[index]?.secondaryLabel && <small>{selectedStopPoints[index].secondaryLabel}</small>}</div>
        {stop.reached_at ? <span className="stop-done">{t("✓ تم")}</span> : <button className="button button-outline button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/stops/${stop.id}/reached`, { method: "POST", token: session.token }); await loadAssignedTrips(); notify(t("تم تسجيل الوصول."), "success"); } catch (error) { notify(errorText(error), "error"); } }}>{t("وصلت")}</button>}
      </div>)}</div>
      <div className="trip-actions"><button className="button button-primary button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/complete`, { method: "POST", token: session.token }); notify(t("تم إغلاق الرحلة."), "success"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>{t("إنهاء الرحلة")}</button><button className="button button-quiet button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/report-absence`, { method: "POST", token: session.token }); notify(t("بدأ البحث عن كابتن بديل لهذا اليوم."), "info"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>{t("إبلاغ عن عدم التمكن")}</button></div>
    </section> : myTrips.length ? <div className="offer-grid">{myTrips.map(({ trip }) => <button className="surface offer-card" key={trip.id} onClick={() => setSelectedTrip(trip.id)}><span className="status-chip status-assigned">{statusLabel(trip.status)}</span><h3>{t("مجموعة #")}{trip.group_id}</h3><p>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? t("ذهاب") : t("عودة")} · {trip.departure_at.slice(11, 16)}</p><span className="text-action">{t("عرض نقاط التوقف ←")}</span></button>)}</div> : <EmptyState icon="↗" title={t("لسه مفيش مسارات مسندة")} text="اقبل مسارًا من قائمة المسارات المتاحة وسيظهر هنا." />}
  </div>;
  const openVerification = () => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); window.setTimeout(() => document.getElementById("verification-center")?.scrollIntoView({ behavior: "smooth", block: "start" }), 180); };
  if (!profile || profile.verification_status !== "approved" || profile.status === "suspended_grace_expired") return <div className="approval-state surface verification-required-banner captain-stitch captain-stitch-gate" role="status"><span className="approval-icon">⌖</span><span className="eyebrow">{t("خطوة قبل استقبال المشاوير")}</span><h2>{profile?.status === "suspended_grace_expired" ? t("أكمل المستندات المؤجلة") : t("وثّق حسابك لاستقبال المسارات")}</h2><p>{profile?.status === "suspended_grace_expired" ? t("انتهت مهلة المستندات. ارفعها واطلب من الدعم إعادة تفعيل حسابك.") : t("أرسل مستندات الهوية والمركبة ووثّق رقم هاتفك. سنعرض المسارات بعد اكتمال المراجعة.")}</p><button className="button button-primary button-small" onClick={openVerification}>{t("وثّق حسابك الآن")}</button></div>;
  const loadOffers = () => refreshTrips();
  const lineMapMode: MapPickMode = typeof lineMapTarget === "string" ? lineMapTarget : "pickup";
  const lineRoutePlaces: MapPoint[] = [
    ...(origin ? [{ ...origin, kind: "pickup" as const, sequence: 1 }] : []),
    ...intermediateStops.flatMap(({ point }, index) => point ? [{ ...point, kind: "pickup" as const, sequence: index + 2 }] : []),
    ...(destination ? [{ ...destination, kind: "dropoff" as const, sequence: intermediateStops.length + 2 }] : []),
  ];
  const showCaptainHome = section === "offers";
  const caption = t("أضف نقطة البداية والوصول، ويمكنك إدخال محطات وسيطة بالترتيب.");
  return <div className={`captain-offers-page captain-stitch ${publishOpen ? "captain-stitch-publish" : isCaptainRequestsSection ? "captain-stitch-requests" : "captain-stitch-home"}`}>
    {showCaptainHome && <section className="captain-welcome-panel surface"><div className="captain-welcome-copy"><span className="eyebrow">SeKKa · {t("الكابتن")}</span><h2>{t("أهلاً")} {session.user.full_name.split(" ")[0]}</h2><p>{t("مسارات واضحة، طلبات مناسبة، ورحلات منظمة من مكان واحد.")}</p><div className="captain-welcome-actions"><Button type="button" variant="primary" onClick={() => setSection("publish")}>{t("＋ نشر مسار جديد")}</Button></div></div><div className="captain-welcome-status"><span className="captain-status-mark"><AppIcon name="route" size={24} /></span><strong>{t("جاهز لاستقبال المسارات")}</strong><small>{t("سنطابق مساراتك مع طلبات الركاب القريبة")}</small></div></section>}
    {showCaptainHome && <section className="captain-overview-grid" aria-label={t("ملخص الكابتن")}><article className="captain-overview-tile"><span className="captain-overview-icon"><AppIcon name="route" size={19} /></span><small>{t("مسارات منشورة")}</small><strong>{publishedLinesLoaded ? lines.length : "—"}</strong><span>{t("مساراتك الحالية")}</span></article><article className="captain-overview-tile"><span className="captain-overview-icon"><AppIcon name="inbox" size={19} /></span><small>{t("طلبات مناسبة")}</small><strong>{publishedLinesLoaded ? demandGroups.reduce((total, group) => total + group.requests.length, 0) : "—"}</strong><span>{t("تم تجميعها تلقائيًا")}</span></article><article className="captain-overview-tile"><span className="captain-overview-icon"><AppIcon name="trips" size={19} /></span><small>{t("رحلات قادمة")}</small><strong>{assignedTripsLoaded ? myTrips.length : "—"}</strong><span>{t("المسارات المسندة إليك")}</span></article></section>}
    {isCaptainRequestsSection && offerError && <div className="inline-error" role="alert">{offerError}<Button type="button" variant="primary" size="sm" onClick={() => void loadOffers()}>{t("تحديث الطلبات")}</Button></div>}
    {publishOpen && <details ref={lineEditorRef} className="surface onboarding-card captain-route-editor">
      <summary className="captain-new-line-summary"><span className="surface-icon"><AppIcon name="route" size={21} /></span><span><span className="eyebrow">{t(editingLineId === null ? "مسار جديد" : "تعديل المسار")}</span><strong>{t(editingLineId === null ? "انشر خط سيرك" : "تعديل بيانات المسار")}</strong><small>{caption}</small></span><AppIcon name="chevron" size={18} /></summary>
      <form className="form-stack" onSubmit={publishLine}>
      <LocationSearchField kind="pickup" title={t("نقطة البداية")} value={originSearch} token={session.token} onChange={(value) => { setOriginSearch(value); setOrigin(null); }} onSelect={(point) => { setOrigin(point); setOriginSearch(point.label ?? ""); }} onChooseMap={() => { setLineMapTarget("pickup"); setLineMapOpen(true); }} onFocus={() => undefined} pointSelected={origin?.lat != null && origin.lng != null} />
      <div className="captain-intermediate-stops">{intermediateStops.map((stop, index) => <div className="captain-intermediate-stop" key={index}>
        <LocationSearchField kind="pickup" title={`${t("محطة وسيطة")} ${index + 1}`} value={stop.search} token={session.token}
          onChange={(value) => setIntermediateStops((items) => items.map((item, itemIndex) => itemIndex === index ? { point: null, search: value } : item))}
          onSelect={(point) => setIntermediateStops((items) => items.map((item, itemIndex) => itemIndex === index ? { point, search: point.label ?? "" } : item))}
          onChooseMap={() => { setLineMapTarget({ intermediateIndex: index }); setLineMapOpen(true); }} onFocus={() => undefined} pointSelected={stop.point?.lat != null && stop.point.lng != null} />
        <Button type="button" variant="secondary" size="sm" aria-label={`${t("حذف المحطة الوسيطة")} ${index + 1}`} onClick={() => setIntermediateStops((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</Button>
      </div>)}{intermediateStops.length < 10 && <Button type="button" variant="secondary" size="sm" onClick={() => setIntermediateStops((items) => [...items, { point: null, search: "" }])}>＋ {t("إضافة محطة وسيطة")}</Button>}</div>
      <LocationSearchField kind="dropoff" title={t("نقطة الوصول")} value={destinationSearch} token={session.token} onChange={(value) => { setDestinationSearch(value); setDestination(null); }} onSelect={(point) => { setDestination(point); setDestinationSearch(point.label ?? ""); }} onChooseMap={() => { setLineMapTarget("dropoff"); setLineMapOpen(true); }} onFocus={() => undefined} pointSelected={destination?.lat != null && destination.lng != null} />
      <label>{t("وقت الذهاب المتوقع")}<input type="time" value={lineArrival} onChange={(event) => setLineArrival(event.target.value)} required /></label><label>{t("وقت العودة المتوقع (اختياري)")}<input type="time" value={lineReturnArrival} onChange={(event) => setLineReturnArrival(event.target.value)} /></label>
      <fieldset className="capability-list service-days"><legend>{t("أيام تشغيل المسار")}</legend>{[[0,"الأحد"],[1,"الاثنين"],[2,"الثلاثاء"],[3,"الأربعاء"],[4,"الخميس"],[5,"الجمعة"],[6,"السبت"]].map(([day,label]) => <label className="toggle-row" key={day}><input type="checkbox" checked={lineDays.includes(Number(day))} onChange={() => setLineDays((current) => current.includes(Number(day)) ? current.filter((item) => item !== Number(day)) : [...current, Number(day)])} /><span>{t(String(label))}</span></label>)}</fieldset>
      <div className="form-field"><span className="form-field-label">{t("المقاعد المتاحة")}</span><div className="number-stepper" role="group" aria-label={t("المقاعد المتاحة")}><Button type="button" variant="secondary" size="sm" aria-label={t("تقليل عدد المقاعد")} disabled={lineSeats <= 1} onClick={() => setLineSeats((seats) => Math.max(1, seats - 1))}>−</Button><output aria-live="polite">{lineSeats}</output><Button type="button" variant="secondary" size="sm" aria-label={t("زيادة عدد المقاعد")} disabled={lineSeats >= (vehicleCapacity(profile?.vehicle_type_id ?? "prime"))} onClick={() => setLineSeats((seats) => Math.min(vehicleCapacity(profile?.vehicle_type_id ?? "prime"), seats + 1))}>＋</Button></div></div>
      <label>{t("سعر المقعد بالجنيه")}<input type="number" min="0.01" step="0.01" inputMode="decimal" value={linePrice} onChange={(event) => setLinePrice(event.target.value)} required /><small>{t("أنت تحدد السعر الذي سيظهر للركاب لكل مقعد.")}</small></label>
      <fieldset className="capability-list payment-methods"><legend>{t("طرق الدفع")}</legend>{[["cash","نقدًا"],["instapay","إنستاباي"],["wallet","محفظة إلكترونية"]].map(([method,label]) => <label className="toggle-row" key={method}><input type="checkbox" checked={linePaymentMethods.includes(method)} onChange={() => setLinePaymentMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method])} /><span>{t(String(label))}</span></label>)}</fieldset>
      {lineMapOpen && <section className="booking-map-panel" aria-label={t("تحديد مسار الرحلة")}><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد")} {typeof lineMapTarget === "object" ? `${t("محطة وسيطة")} ${lineMapTarget.intermediateIndex + 1}` : lineMapTarget === "pickup" ? t("نقطة البداية") : t("نقطة الوصول")} {t("على الخريطة")}</p><button type="button" className="map-close-button" onClick={() => setLineMapOpen(false)}>×</button></div><div className="booking-map"><MapPicker pickup={origin} dropoff={destination} routePlaces={lineRoutePlaces} mode={lineMapMode} restrictToGreaterCairo selectionHint={typeof lineMapTarget === "object" ? `${t("اضغط على الخريطة لتحديد")} ${t("محطة وسيطة")} ${lineMapTarget.intermediateIndex + 1}` : undefined} onPick={(mode, point) => { if (typeof lineMapTarget === "object") { const index = lineMapTarget.intermediateIndex; setIntermediateStops((items) => items.map((item, itemIndex) => itemIndex === index ? { point, search: point.label ?? t("موقع محدد على الخريطة") } : item)); } else if (mode === "pickup") { setOrigin(point); setOriginSearch(point.label ?? t("موقع محدد على الخريطة")); } else { setDestination(point); setDestinationSearch(point.label ?? t("موقع محدد على الخريطة")); } setLineMapOpen(false); }} /></div></section>}
      <button className="button button-primary button-small" disabled={busy || !lineDays.length}>{busy ? t(editingLineId === null ? "جارٍ نشر المسار…" : "جارٍ حفظ التعديلات…") : t(editingLineId === null ? "نشر المسار" : "حفظ التعديلات")}</button>
      {editingLineId !== null && <Button type="button" variant="ghost" onClick={() => { resetLineEditor(); setSection("offers"); }}>{t("إلغاء التعديل")}</Button>}
    </form></details>}
    {showCaptainHome && lines.length > 0 && <section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">{t("مساراتك")}</span><h2>{t("المسارات المنشورة")}</h2></div></div><div className="offer-grid">{lines.map((line) => {
      const hasRiders = demandGroups.some((group) => group.captain_line_id === line.id && group.requests.length > 0);
      return <article className="surface offer-card" key={line.id}><span className={`status-chip status-${line.status}`}>{line.status === "active" ? t("نشط") : line.status === "paused" ? t("متوقف مؤقتًا") : t("ملغي")}</span><h3>{line.origin_label} ← {line.destination_label}</h3><p>{vehicleTypeLabel(line.vehicle_type_id)}  {t("· وصول")} {line.arrival_time.slice(0,5)} · {line.seats}  {t("مقاعد ·")} {money(line.price_per_seat)}</p>{line.status !== "cancelled" && <div className="captain-line-actions"><Button type="button" variant="secondary" onClick={async () => { try { await api(`/captain/lines/${line.id}/status`, { method: "PATCH", token: session.token, body: { status: line.status === "active" ? "paused" : "active" } }); await loadPublishedLines(); } catch (error) { notify(errorText(error), "error"); } }}>{line.status === "active" ? t("إيقاف مؤقت") : t("استئناف المسار")}</Button>{!hasRiders && <><Button type="button" variant="secondary" onClick={() => editLine(line)}>{t("تعديل المسار")}</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void cancelLine(line)}>{t("إلغاء المسار")}</Button></>}{hasRiders && <small>{t("لا يمكن تعديل المسار أو إلغاؤه بعد انضمام راكب.")}</small>}</div>}</article>;
    })}</div></section>}
    {showCaptainHome && demandGroups.length > 0 && <section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">{t("طلبات متشابهة")}</span><h2>{t("الركاب المطابقون لمساراتك")}</h2><p>{t("جمع التطبيق طلباتهم المتقاربة تلقائيًا.")}</p></div></div><div className="offer-grid">{demandGroups.map((group) => <article className="surface offer-card" key={group.id}><h3>{t("رحلة")} {formatDate(group.trip_date)}  {t("· وصول")} {group.arrival_time.slice(0,5)}{group.return_arrival_time ? ` · ${t("عودة")} ${group.return_arrival_time.slice(0,5)}` : ""}</h3>{group.requests.map((request) => <p key={request.id}><strong>{request.rider_name}</strong> · {request.pickup_label} ← {request.dropoff_label} · {request.seats}  {t("مقعد")}</p>)}</article>)}</div></section>}
    {isCaptainRequestsSection && lineJoinRequests.length > 0 && <section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">{t("اختارها الركاب من الرحلات المنشورة")}</span><h2>{t("طلبات الانضمام")}</h2></div><Button type="button" variant="secondary" size="sm" onClick={() => void loadLineJoinRequests()}>{t("تحديث")}</Button></div><div className="offer-grid">{lineJoinRequests.map((request) => <article className="surface offer-card" key={request.id}><span className={`status-chip status-${request.status}`}>{t(request.status === "pending" ? "بانتظار ردك" : request.status === "accepted" ? "مقبول" : request.status === "rejected" ? "مرفوض" : "ملغي")}</span><h3>{request.rider_name ?? t("راكب")} · {formatDate(request.trip_date)} · {t(request.direction === "return" ? "عودة" : "ذهاب")}</h3><p>{request.captain_lines?.origin_label} ← {request.captain_lines?.destination_label}</p><p>{request.pickup_label} ← {request.dropoff_label} · {request.seats} {t("مقاعد")}</p><p>{request.captain_lines?.arrival_time?.slice(0, 5)} · {money(Number(request.captain_lines?.price_per_seat ?? 0))} {t("للمقعد")}</p>{request.status === "pending" && <div className="captain-line-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => void decideLineJoinRequest(request, "accepted")}>{t("قبول الطلب")}</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void decideLineJoinRequest(request, "rejected")}>{t("رفض الطلب")}</Button></div>}</article>)}</div></section>}
    {isCaptainRequestsSection && selectedOffer && <section className="surface captain-offer-review" aria-labelledby="captain-offer-review-title"><div className="captain-offer-review-heading"><div><span className="eyebrow">{t("مراجعة قبل القبول")}</span><h2 id="captain-offer-review-title">{t("تأكيد الطلب المتاح")}</h2></div><span className="status-chip status-needs_captain">{t("بانتظار كابتن")}</span></div><div className="captain-offer-review-grid"><div><small>{t("المجموعة")}</small><strong>#{selectedOffer.group_id}</strong></div><div><small>{t("التاريخ والاتجاه")}</small><strong>{formatDate(selectedOffer.trip.service_date)} · {selectedOffer.trip.direction === "outbound" ? t("ذهاب") : t("عودة")}</strong></div><div><small>{t("موعد الانطلاق")}</small><strong>{selectedOffer.trip.departure_at.slice(11, 16)}</strong></div><div><small>{t("المسافة")}</small><strong>{selectedOffer.route_distance_km ?? "—"}  {t("كم")}</strong></div><div><small>{t("الفئة")}</small><strong>{categoryName({ id: selectedOffer.category_id, speed_tier: selectedOffer.category_id.includes("saver") ? "saver" : "faster", has_ac: selectedOffer.category_id.includes("ac") ? 1 : 0, seats: selectedOffer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 })}</strong></div><div><small>{t("سعر المقعد")}</small><strong>{money(selectedOffer.seat_day_fare)}</strong></div></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={selectedOffer.route_geometry} routePlaces={offerStopPoints} onPick={() => undefined} /><div className="captain-offer-review-actions"><button type="button" className="button button-outline" onClick={() => setSelectedOfferId(null)} disabled={busy}>{t("العودة لقائمة الطلبات")}</button><button type="button" className="button button-primary" onClick={() => void acceptOffer(selectedOffer)} disabled={busy}>{busy ? t("جارٍ قبول الطلب…") : t("تأكيد قبول الطلب")}</button></div></section>}
    {isCaptainRequestsSection && (offersLoading || !offersLoaded ? <LoadingCard text="loading.captainHome" /> : offerError && !offers.length ? <ErrorState title="loading.failure" text={offerError} action="تحديث الطلبات" onAction={() => void loadOffers()} /> : offers.length ? <div className="offer-grid route-offer-grid">{[...offers].sort((a, b) => a.trip.departure_at.localeCompare(b.trip.departure_at) || a.trip.id - b.trip.id).map((offer) => {
      const category = categoryName({ id: offer.category_id, speed_tier: offer.category_id.includes("saver") ? "saver" : "faster", has_ac: offer.category_id.includes("ac") ? 1 : 0, seats: offer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 });
      const pickupStops = offer.trip.stops?.filter((stop) => stop.stop_type === "pickup").length;
      const dropoffStops = offer.trip.stops?.filter((stop) => stop.stop_type === "dropoff").length;
      return <article className="surface offer-card route-offer-card" key={offer.trip.id}>
        <div className="route-offer-top"><span className="status-chip status-needs_captain"><i />  {t("طلب متاح")}</span><time dateTime={offer.trip.departure_at}>{formatDate(offer.trip.service_date)}</time></div>
        <div className="route-offer-title"><div><small>{t("مجموعة #")}{offer.group_id}</small><h3>{category}</h3></div><div className="route-offer-price"><small>{t("سعر المقعد")}</small><strong>{money(offer.seat_day_fare)}</strong></div></div>
        <div className="route-offer-timeline" aria-label={t("محطات المسار")}><div className="route-offer-stop pickup"><span aria-hidden="true" /><div><strong>{t("نقاط الركوب")}</strong><small>{pickupStops === undefined ? t("ضمن خط السير") : <>{pickupStops} {t("محطات")}</>}</small></div></div><div className="route-offer-stop dropoff"><span aria-hidden="true" /><div><strong>{t("نقاط النزول")}</strong><small>{dropoffStops === undefined ? t("ضمن خط السير") : <>{dropoffStops} {t("محطات")}</>}</small></div></div></div>
        <div className="route-offer-facts"><div><small>{t("المسافة")}</small><strong>{offer.route_distance_km ?? "—"}  {t("كم")}</strong></div><div><small>{t("موعد الانطلاق")}</small><strong>{offer.trip.departure_at.slice(11, 16)}</strong></div><div><small>{t("نوع الرحلة")}</small><strong>{offer.trip.direction === "outbound" ? t("ذهاب") : t("عودة")}</strong></div></div>
        <button className="button button-outline button-small route-offer-map-toggle" aria-expanded={visibleOfferMap === offer.trip.id} onClick={() => setVisibleOfferMap((current) => current === offer.trip.id ? null : offer.trip.id)}>{visibleOfferMap === offer.trip.id ? t("إخفاء الخريطة") : t("عرض الطلب")}</button>
        {visibleOfferMap === offer.trip.id && <MapPicker pickup={null} dropoff={null} mode="pickup" route={offer.route_geometry} routePlaces={visibleOfferMap === selectedOfferId ? offerStopPoints : offer.trip.stops?.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence }))} readOnly onPick={() => undefined} />}
        <button className="button button-primary button-wide route-offer-accept" disabled={busy} onClick={() => setSelectedOfferId(offer.trip.id)}>{selectedOfferId === offer.trip.id ? t("الطلب قيد المراجعة") : t("مراجعة الطلب وقبوله")}</button>
      </article>;
    })}</div> : lineJoinRequests.length > 0 ? null : <EmptyState icon="⌖" title={t("مفيش طلبات قريبة دلوقتي")} text={t("تأكد من السماح للتطبيق باستخدام موقعك ومن نطاق البحث لعرض الطلبات المناسبة لسيارتك.")} action="تحديث الطلبات" onAction={() => void loadOffers()} />)}
  </div>;
}

