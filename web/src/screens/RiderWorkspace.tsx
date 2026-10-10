import { getDirection, getLanguage, t } from "../i18n/runtime";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";
import AppIcon from "../components/AppIcon";
import type { MapPickMode, MapPoint } from "../MapPicker";
import LocationSearchField from "../components/LocationSearchField";
import TimePicker12h, { formatTime12h } from "../components/TimePicker12h";
import RiderDemandFlow from "./RiderDemandFlow";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { reverseGeocode } from "../lib/location-address";
import { api, type Category, type GroupView, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { defaultDates, isServiceDay, serviceDatesFromStart, shiftDate, todayInCairo } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import type { ThemePreference } from "../components/ThemePreferenceCard";
import AppSettings from "../components/AppSettings";
import {
  AccountPanel, EmptyState, ErrorState, GroupDetail, GroupSummary, LoadingCard,
  TripList,
} from "../components/workspace-shared";

const hasSelectedPoint = (point: MapPoint | null) =>
  typeof point?.lat === "number" && Number.isFinite(point.lat) &&
  typeof point?.lng === "number" && Number.isFinite(point.lng);
export default function RiderWorkspace({ session, section, setSection, refreshNotifications, registerPoolRefresh, notify, themePreference, resolvedTheme, onThemePreferenceChange }: {
  session: Session; section: NavKey; setSection: (section: NavKey, historyMode?: "push" | "replace") => void;
  refreshNotifications: () => Promise<void>; registerPoolRefresh: (refresh: () => Promise<void>) => void; notify: (text: string, tone?: Toast["tone"]) => void;
  themePreference: ThemePreference; resolvedTheme: "light" | "dark"; onThemePreferenceChange: (value: ThemePreference) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [demandRequests, setDemandRequests] = useState<{ id: number; pickup_label: string; dropoff_label: string; trip_date: string; arrival_time: string; vehicle_type_id: string; status: string; demand_groups?: { status: string; captain_line_id: number | null } | null; line?: { origin_label: string; destination_label: string; arrival_time: string; price_per_seat: number; captain_name: string } | null }[]>([]);
  const visibleGroups = groups.filter(({ group }) => !["cancelled", "canceled"].includes(group.status.trim().toLowerCase()));
  const [loading, setLoading] = useState(true);
  const [quickRideDate, setQuickRideDate] = useState(() => shiftDate(todayInCairo(), 1));
  const [quickArrivalTime, setQuickArrivalTime] = useState("08:00");
  const [initialLoadError, setInitialLoadError] = useState("");
  const pendingNotificationEdit = useRef<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"new" | "join" | "edit">("new");
  const [bookingPickup, setBookingPickup] = useState<MapPoint | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [bookingStep, setBookingStep] = useState<"route" | "price" | "review">("route");
  const [priceInfoOpen, setPriceInfoOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [packageType, setPackageType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dates, setDates] = useState<string[]>(() => defaultDates("daily"));
  const [morning, setMorning] = useState("07:30");
  const [returnTime, setReturnTime] = useState("17:00");
  const [pickup, setPickup] = useState<MapPoint | null>(null);
  const [dropoff, setDropoff] = useState<MapPoint | null>(null);
  const [pickupSearch, setPickupSearch] = useState("");
  const [dropoffSearch, setDropoffSearch] = useState("");
  const [pickMode, setPickMode] = useState<MapPickMode>("pickup");
  const [mapOpen, setMapOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [priceQuotes, setPriceQuotes] = useState<Record<string, { daily: number; weekly: number; monthly: number; seat_day_fare: number }> | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const mapAddressRequests = useRef<Record<MapPickMode, number>>({ pickup: 0, dropoff: 0 });
  const editAddressRequest = useRef(0);
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const selected = visibleGroups.find((view) => view.group.id === selectedGroup) ?? null;
  const priceLabel = (type: "daily" | "weekly" | "monthly", selectedCategoryId = categoryId) => {
    const selectedQuote = selectedCategoryId ? priceQuotes?.[selectedCategoryId] : null;
    if (selectedQuote) return money(selectedQuote[type]);
    return priceLoading ? "جارٍ حساب الأسعار…" : priceError ? "تعذر حساب السعر" : "السعر بعد تحديد الفئة";
  };

  const openBooking = (mode: "new" | "join", prefill?: { groupId: number; pickup: MapPoint; dropoff: MapPoint }, savedPickup?: SavedPlace) => {
    editAddressRequest.current++;
    setBookingMode(mode);
    setEditingGroupId(null);
    if (mode === "new") { setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily")); setBookingPickup(savedPickup ? { lat: savedPickup.lat, lng: savedPickup.lng, label: savedPickup.label, primaryLabel: savedPickup.label, kind: "pickup" } : null); }
    if (mode === "join") {
      setInviteCode(prefill ? String(prefill.groupId) : "");
      setPickup(prefill?.pickup ?? null); setDropoff(prefill?.dropoff ?? null);
      setPickupSearch(prefill?.pickup.label ?? ""); setDropoffSearch(prefill?.dropoff.label ?? "");
    }
    setBookingStep("route");
    setPriceInfoOpen(false);
    setSection("booking");
  };

  const startEditingGroup = (view: GroupView) => {
    const group = view.group;
    const member = view.members.find((item) => item.status === "active" && item.rider_user_id === session.user.id);
    if (!member || group.status !== "waiting" || group.created_by_user_id !== session.user.id || view.members.filter((item) => item.status === "active").length !== 1 || view.trips.length) {
      notify(t("يمكن تعديل مشوارك قبل انضمام ركاب آخرين وبدء تفعيله فقط."), "error");
      return;
    }
    let serviceDates: string[] = [];
    try { const value = JSON.parse(group.service_dates) as unknown; if (Array.isArray(value)) serviceDates = value.filter((item): item is string => typeof item === "string"); } catch { serviceDates = []; }
    setEditingGroupId(group.id);
    setBookingMode("edit");
    setBookingStep("route");
    setCategoryId(group.category_id);
    setPackageType(group.package_type);
    setDates(serviceDates);
    setMorning(group.morning_departure.slice(0, 5));
    setReturnTime(group.return_departure.slice(0, 5));
    const requestId = ++editAddressRequest.current;
    const nextPickup = { lat: member.pickup_lat, lng: member.pickup_lng, kind: "pickup" as const, label: "جارٍ استرجاع العنوان…", primaryLabel: "جارٍ استرجاع العنوان…" };
    const nextDropoff = { lat: member.dropoff_lat, lng: member.dropoff_lng, kind: "dropoff" as const, label: "جارٍ استرجاع العنوان…", primaryLabel: "جارٍ استرجاع العنوان…" };
    setPickup(nextPickup); setDropoff(nextDropoff);
    setPickupSearch(nextPickup.label); setDropoffSearch(nextDropoff.label);
    if (hasSelectedPoint(nextPickup) && hasSelectedPoint(nextDropoff)) {
      void Promise.all([reverseGeocode(session.token, nextPickup.lat!, nextPickup.lng!), reverseGeocode(session.token, nextDropoff.lat!, nextDropoff.lng!)])
        .then(([pickupAddress, dropoffAddress]) => {
          if (requestId !== editAddressRequest.current) return;
          const pickupPoint = { ...nextPickup, ...pickupAddress, primaryLabel: pickupAddress.primary, secondaryLabel: pickupAddress.secondary };
          const dropoffPoint = { ...nextDropoff, ...dropoffAddress, primaryLabel: dropoffAddress.primary, secondaryLabel: dropoffAddress.secondary };
          setPickup(pickupPoint); setDropoff(dropoffPoint); setPickupSearch(pickupAddress.label); setDropoffSearch(dropoffAddress.label);
        }).catch(() => {
          if (requestId !== editAddressRequest.current) return;
          setPickup((point) => point ? { ...point, label: t("موقع محدد على الخريطة"), primaryLabel: t("موقع محدد على الخريطة") } : point);
          setDropoff((point) => point ? { ...point, label: t("موقع محدد على الخريطة"), primaryLabel: t("موقع محدد على الخريطة") } : point);
          setPickupSearch(t("موقع محدد على الخريطة")); setDropoffSearch(t("موقع محدد على الخريطة"));
        });
    }
    setSection("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const openGroupEditor = (event: Event) => {
      const groupId = (event as CustomEvent<number>).detail;
      if (loading) { pendingNotificationEdit.current = groupId; return; }
      const view = groups.find((item) => item.group.id === groupId);
      if (!view) {
        notify(t("لم نتمكن من العثور على المجموعة. حدّث قائمة رحلاتك وحاول مرة أخرى."), "error");
        setSection("trips");
        return;
      }
      startEditingGroup(view);
    };
    window.addEventListener("sekka:edit-group", openGroupEditor);
    return () => window.removeEventListener("sekka:edit-group", openGroupEditor);
  }, [groups, loading, notify, setSection]);

  useEffect(() => {
    const groupId = pendingNotificationEdit.current;
    if (loading || groupId === null) return;
    pendingNotificationEdit.current = null;
    const view = groups.find((item) => item.group.id === groupId);
    if (view) startEditingGroup(view);
    else {
      notify(t("لم نتمكن من العثور على المجموعة. حدّث قائمة رحلاتك وحاول مرة أخرى."), "error");
      setSection("trips");
    }
  }, [groups, loading, notify, setSection]);

  const continueToPrice = () => {
    const missing = [
      !hasSelectedPoint(pickup) ? "pickup" : null,
      !hasSelectedPoint(dropoff) ? "dropoff" : null,
    ].filter((kind): kind is "pickup" | "dropoff" => kind !== null);
    if (missing.length > 0) {
      const firstMissing = missing[0]!;
      const field = document.querySelector<HTMLElement>(`.location-search-${firstMissing}`);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      notify(t(firstMissing === "pickup" ? "اختار نقطة الركوب من نتائج البحث أو حددها بالدبوس قبل المتابعة." : "اختار نقطة النزول من نتائج البحث أو حددها بالدبوس قبل المتابعة."), "error");
      return;
    }
    if (!isInsideGreaterCairo(pickup!.lat!, pickup!.lng!) || !isInsideGreaterCairo(dropoff!.lat!, dropoff!.lng!)) { notify(t("المشاوير متاحة داخل القاهرة الكبرى فقط."), "error"); return; }
    if (!morning || !returnTime) { notify(t("حدد وقت الذهاب والعودة قبل المتابعة."), "error"); return; }
    setBookingStep("price");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueToReview = () => {
    if (bookingMode === "join") {
      const groupId = Number(inviteCode);
      if (!Number.isInteger(groupId) || groupId < 1) { notify(t("اكتب رقم مجموعة صحيحًا قبل المتابعة."), "error"); return; }
      if (!hasSelectedPoint(pickup) || !hasSelectedPoint(dropoff)) { notify(t("اختار نقطة الركوب والوصول من نتائج البحث أو الخريطة."), "error"); return; }
      if (!isInsideGreaterCairo(pickup!.lat!, pickup!.lng!) || !isInsideGreaterCairo(dropoff!.lat!, dropoff!.lng!)) { notify(t("المشاوير متاحة داخل القاهرة الكبرى فقط."), "error"); return; }
    } else {
      if (!categoryId) { notify(t("اختار الفئة قبل مراجعة المشوار."), "error"); return; }
      const expectedDates = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;
      if (dates.length !== expectedDates) { notify(t("راجع أيام الخدمة للباقة قبل المتابعة."), "error"); return; }
      if (!morning || !returnTime) { notify(t("حدد وقت الذهاب والعودة قبل المتابعة."), "error"); return; }
      if (!priceQuotes?.[categoryId] || priceLoading) { notify(t("انتظر اكتمال حساب السعر قبل مراجعة المشوار."), "info"); return; }
    }
    setBookingStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToPrice = () => {
    setBookingStep("price");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToRoute = () => {
    setBookingStep("route");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const refreshGroups = useCallback(async () => {
    const result = await api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token });
    setGroups(result.groups ?? []);
  }, [session.token]);
  const refreshDemandRequests = useCallback(async () => {
    const result = await api<{ requests: typeof demandRequests }>("/rider/demand-requests", { token: session.token });
    setDemandRequests(result.requests ?? []);
  }, [session.token]);
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setInitialLoadError("");
    const results = await Promise.allSettled([
      api<{ categories: Category[] }>("/pool/categories"),
      api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token }),
      api<{ places: SavedPlace[] }>("/rider/saved-places", { token: session.token }),
      api<{ requests: typeof demandRequests }>("/rider/demand-requests", { token: session.token }),
    ]);
    const errors: string[] = [];
    const [categoryResult, groupResult, savedPlaceResult, demandResult] = results;
    if (categoryResult?.status === "fulfilled") setCategories(categoryResult.value.categories ?? []);
    else if (categoryResult?.status === "rejected") errors.push(errorText(categoryResult.reason));
    if (groupResult?.status === "fulfilled") setGroups(groupResult.value.groups ?? []);
    else if (groupResult?.status === "rejected") errors.push(errorText(groupResult.reason));
    if (savedPlaceResult?.status === "fulfilled") setSavedPlaces(savedPlaceResult.value.places ?? []);
    else if (savedPlaceResult?.status === "rejected") errors.push(errorText(savedPlaceResult.reason));
    if (demandResult?.status === "fulfilled") setDemandRequests(demandResult.value.requests ?? []);
    const message = errors[0] ?? "";
    setInitialLoadError(message);
    if (message) notify(message, "error");
    setLoading(false);
  }, [session.token, notify]);
  useEffect(() => { void loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    let active = true;
    void api<{ preferences: RiderCommuterPreferences }>("/rider/commuter-preferences", { token: session.token }).then(({ preferences }) => {
      if (active) setSavedPlaces((current) => [...current.filter((place) => place.place_type !== "frequent"), ...(preferences.frequent_places ?? []).map((place) => ({ ...place, place_type: "frequent" as const }))]);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session.token]);

  useEffect(() => {
    const syncPreferences = (event: Event) => setSavedPlaces((event as CustomEvent<SavedPlace[]>).detail ?? []);
    const syncCommuterPreferences = (event: Event) => {
      const preferences = (event as CustomEvent<RiderCommuterPreferences>).detail;
      setSavedPlaces((current) => [...current.filter((place) => place.place_type !== "frequent"), ...(preferences.frequent_places ?? []).map((place) => ({ ...place, place_type: "frequent" as const }))]);
    };
    window.addEventListener("sekka:rider-preferences", syncPreferences);
    window.addEventListener("sekka:rider-commuter-preferences", syncCommuterPreferences);
    return () => { window.removeEventListener("sekka:rider-preferences", syncPreferences); window.removeEventListener("sekka:rider-commuter-preferences", syncCommuterPreferences); };
  }, []);

  // A trip detail should only open after the rider chooses a group. Leaving
  // the trips section clears that transient selection so Back never reopens
  // a stale detail panel when the rider returns later.
  useEffect(() => {
    if (section !== "trips") setSelectedGroup(null);
  }, [section]);

  useEffect(() => {
    const handleBookingMode = (event: Event) => {
      const mode = (event as CustomEvent<"new" | "join">).detail;
      if (mode === "new" || mode === "join") { setBookingMode(mode); setEditingGroupId(null); if (mode === "new") { setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily")); } setBookingStep("route"); }
    };
    window.addEventListener("sekka:booking-mode", handleBookingMode);
    return () => window.removeEventListener("sekka:booking-mode", handleBookingMode);
  }, []);

  useEffect(() => {
    if (bookingMode === "join" || !pickup || !dropoff) {
      setPriceQuotes(null); setPriceError(""); setPriceLoading(false);
      return;
    }
    let active = true;
    setPriceLoading(true); setPriceError("");
    const timer = window.setTimeout(() => {
      void api<{ prices: Array<{ category_id: string; daily: number; weekly: number; monthly: number; seat_day_fare: number }> }>("/rider/pool/quote", {
        method: "POST", token: session.token,
        body: { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng },
      }).then((result) => {
        if (active) setPriceQuotes(Object.fromEntries(result.prices.map((price) => [price.category_id, price])));
      }).catch((error) => {
        if (active) { setPriceQuotes(null); setPriceError(errorText(error)); }
      }).finally(() => { if (active) setPriceLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [bookingMode, pickup, dropoff, session.token]);

  const refresh = useCallback(async () => {
    try { await refreshGroups(); await refreshNotifications(); }
    catch (error) { notify(errorText(error), "error"); }
  }, [refreshGroups, refreshNotifications, notify]);

  useEffect(() => { registerPoolRefresh(refresh); }, [registerPoolRefresh, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (bookingStep !== "review") {
      notify(t("راجع تفاصيل المشوار قبل تأكيد الإنشاء."), "error");
      return;
    }
    if (!pickup || !dropoff) { notify(t("اختار نقطة الركوب والنزول بالدبوس أو البحث أو الخريطة."), "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify(t("المشاوير متاحة داخل القاهرة الكبرى فقط."), "error"); return; }
    if (!categoryId || dates.length !== (packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22)) { notify(t("اختار الفئة وتأكد من إعدادات الباقة قبل المتابعة."), "error"); return; }
    setSubmitting(true);
    try {
      const editing = bookingMode === "edit" && editingGroupId !== null;
      const editedGroupId = editingGroupId;
      await api(editing ? `/rider/pool/groups/${editedGroupId}` : "/rider/pool/groups", { method: editing ? "PUT" : "POST", token: session.token, body: {
        category_id: categoryId, package_type: packageType, service_dates: dates,
        morning_departure: morning, return_departure: returnTime,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      } });
      await refreshGroups(); await refreshNotifications();
      setBookingMode("new"); setEditingGroupId(null); setSelectedGroup(null); setSection("trips", "replace"); setPickup(null); setDropoff(null);
      notify(editing ? "تم تعديل المشوار." : "تم إنشاء المجموعة. شارك رقمها مع الركاب اللي رايحين نفس اتجاهك.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (bookingStep !== "review") { notify(t("راجع رقم المجموعة ونقطتي الركوب والوصول قبل الانضمام."), "error"); return; }
    if (!pickup || !dropoff) { notify(t("اختار نقطتي الركوب والنزول بالدبوس أو البحث أو الخريطة."), "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify(t("المشاوير متاحة داخل القاهرة الكبرى فقط."), "error"); return; }
    setSubmitting(true);
    try {
      const result = await api<{ group: { id: number } }>(`/rider/pool/groups/${Number(inviteCode)}/join`, { method: "POST", token: session.token,
        body: { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng } });
      await refreshGroups(); setSelectedGroup(result.group.id); setSection("trips", "replace"); setPickup(null); setDropoff(null); setInviteCode("");
      notify(t("انضممت للمجموعة بنجاح."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const groupAction = async (groupId: number, action: string, body?: unknown) => {
    setSubmitting(true);
    try {
      await api(`/rider/pool/groups/${groupId}/${action}`, { method: "POST", token: session.token, body });
      await refresh(); notify(t("تم تحديث المشوار."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const chooseMap = (mode: MapPickMode) => {
    setPickMode(mode);
    setMapOpen(true);
    window.setTimeout(() => {
      const mapContainer = document.querySelector(".booking-map");
      mapContainer?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => mapContainer?.querySelector<HTMLElement>(".leaflet-map")?.focus({ preventScroll: true }), 250);
    }, 0);
  };
  const setMapPoint = (mode: MapPickMode, point: MapPoint) => {
    editAddressRequest.current++;
    const label = t("جارٍ تحديد العنوان…");
    const requestId = ++mapAddressRequests.current[mode];
    const selected = { ...point, label, primaryLabel: label, secondaryLabel: "" };
    if (mode === "pickup") { setPickup(selected); setPickupSearch(label); }
    else { setDropoff(selected); setDropoffSearch(label); }
    if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
    void reverseGeocode(session.token, point.lat, point.lng).then((address) => {
      if (requestId !== mapAddressRequests.current[mode]) return;
      const resolved = { ...point, ...address, primaryLabel: address.primary, secondaryLabel: address.secondary };
      if (mode === "pickup") { setPickup(resolved); setPickupSearch(address.label); }
      else { setDropoff(resolved); setDropoffSearch(address.label); }
    }).catch(() => {
      if (requestId !== mapAddressRequests.current[mode]) return;
      const fallback = { ...point, label: t("موقع محدد على الخريطة"), primaryLabel: t("موقع محدد على الخريطة"), secondaryLabel: "" };
      if (mode === "pickup") { setPickup(fallback); setPickupSearch(fallback.label); }
      else { setDropoff(fallback); setDropoffSearch(fallback.label); }
    });
  };

  const dataErrorBanner = initialLoadError ? <ErrorState title={t("تعذر تحديث بعض البيانات")} text={initialLoadError} action="إعادة المحاولة" onAction={() => void loadInitialData()} /> : null;
  const welcomeBanner = <section className="rider-hero"><div className="rider-hero-copy"><span className="eyebrow">{t("تنقّل أسرع بطريقة أذكى")}</span><h2>{t("مشوارك اليومي،")}<br /><em>{t("على سِكّة أسهل.")}</em></h2><p>{t("شارك الطريق مع ناس رايحة في نفس اتجاهك، وخلي كل مشوار أسهل.")}</p><div className="rider-hero-actions"><button type="button" className="button button-primary" onClick={() => openBooking("new")}>{t("ابحث عن رحلة")} <span aria-hidden="true">←</span></button><span className="rider-service-area"><i />{t("متاح في القاهرة والجيزة")}</span></div></div></section>;

  const requestCards = <div className="rider-request-list">{demandRequests.map((request) => <article className="surface rider-request-card" key={request.id}><div className="rider-request-card-top"><span className={`status-chip status-${request.status}`}>{request.status === "matched" ? t("تم العثور على مسار") : request.status === "open" ? t("نبحث عن مسار") : request.status === "cancelled" ? t("ملغي") : t("منتهي")}</span><span>{request.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</span><time>{formatDate(request.trip_date)} · {request.arrival_time.slice(0, 5)}</time></div><div className="rider-request-route"><span className="rider-route-timeline" aria-hidden="true"><i /><b /><i /></span><div><strong>{request.pickup_label}</strong><strong>{request.dropoff_label}</strong></div></div><p className="rider-request-note">{request.demand_groups?.status === "matched" ? t("جمع التطبيق طلبك مع طلبات مشابهة.") : t("سيجمع التطبيق الطلبات المتقاربة تلقائيًا.")}</p>{request.line && <div className="rider-match-summary"><strong>{t("المسار المطابق")}: {request.line.origin_label} ← {request.line.destination_label}</strong><span>{request.line.captain_name} · {t("· وصول")} {request.line.arrival_time.slice(0, 5)} · {money(Number(request.line.price_per_seat))} {t("للمقعد")}</span></div>}</article>)}</div>;

  if (section === "account") return <div className="rider-account-experience">{dataErrorBanner}<section className="rider-profile-heading"><div><span className="eyebrow">{t("حسابك في سِكّة")}</span><h2>{t("الملف الشخصي والإعدادات")}</h2><p>{t("بياناتك وأماكنك المحفوظة وتفضيلات التطبيق في مكان واحد.")}</p></div></section><AccountPanel session={session} notify={notify} /><AppSettings session={session} themePreference={themePreference} resolvedTheme={resolvedTheme} onThemePreferenceChange={onThemePreferenceChange} notify={notify} /></div>;

  if (section === "requests") return <div className="rider-requests-page">{dataErrorBanner}<section className="rider-section-intro"><span className="eyebrow">{t("كل طلباتك في مكان واحد")}</span><h2>{t("طلبات رحلاتك")}</h2><p>{t("تابع حالة طلباتك والمسارات التي تم العثور عليها")}</p></section>{demandRequests.length ? requestCards : initialLoadError ? null : <EmptyState icon="⌖" title={t("مافيش طلبات رحلات لسه")} text="ابحث عن مسار مناسب، ولو مافيش هنسجل طلبك ونجمعه مع الطلبات المشابهة." action="ابحث عن رحلة" onAction={() => openBooking("new")} />}</div>;

  if (section === "booking" && bookingMode !== "edit") return <><RiderDemandFlow session={session} notify={notify} onBack={() => setSection("home")} onOpenRequests={() => setSection("requests")} onRequestCreated={refreshDemandRequests} initialPickup={bookingPickup ?? pickup} initialDropoff={dropoff} initialTripDate={quickRideDate} initialArrivalTime={quickArrivalTime} savedPlaces={savedPlaces} />{dataErrorBanner}</>;
  if (loading && section === "home") return <div className="dashboard-grid rider-dashboard"><section className="dashboard-main">{welcomeBanner}<LoadingCard text="loading.riderRequests" /></section></div>;
  if (loading && section === "trips") return <div className="trips-page">{dataErrorBanner}<div className="section-toolbar"><button className="button button-primary button-small" onClick={() => openBooking("new")}>{t("＋ ابحث عن مسار")}</button></div><LoadingCard text="loading.riderRequests" /></div>;
  if (loading) return <LoadingCard text="loading.general" />;
  if (section === "booking") return <div className="booking-layout">{dataErrorBanner}
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">{bookingMode === "join" ? t("الانضمام لمجموعة") : `الخطوة ${bookingStep === "route" ? "الأولى · النقط والمواعيد" : bookingStep === "price" ? "الثانية · السعر" : "الثالثة · المراجعة"}`}</span><h2>{bookingMode === "join" ? (bookingStep === "review" ? t("راجع طلب الانضمام") : t("انضم لمجموعة موجودة")) : bookingStep === "route" ? t("حدد نقطتي مشوارك ومواعيدك") : bookingStep === "price" ? t("اختار الباقة والسعر") : t("راجع تفاصيل مشوارك")}</h2><p>{bookingMode === "join" ? (bookingStep === "review" ? t("تأكد من رقم المجموعة ونقطتي الركوب والوصول قبل إرسال الطلب.") : t("أدخل رقم المجموعة وحدد نقطتي الركوب والوصول.")) : bookingStep === "route" ? t("ابحث عن نقطتي الركوب والوصول وحدد وقت الذهاب والعودة.") : bookingStep === "price" ? t("اختار الباقة والفئة المناسبة وراجع السعر التقديري.") : t("راجع التفاصيل مرة واحدة، ويمكنك الرجوع لتعديل أي اختيار قبل الإنشاء.")}</p></div><span className="surface-icon">{bookingMode !== "join" ? "⌖" : "＋"}</span></div>
      <div className="booking-stepper" dir={getDirection()} aria-label={bookingMode === "join" ? t("خطوات الانضمام للمجموعة") : t("خطوات إنشاء المشوار")}>
        {bookingMode === "join" ? <>
          <button type="button" className={bookingStep === "route" ? "booking-step active" : "booking-step complete"} aria-current={bookingStep === "route" ? "step" : undefined} onClick={returnToRoute}><span>{t("١")}</span><strong>{t("البيانات")}</strong></button>
          <i className={bookingStep === "review" ? "complete" : ""} />
          <div className={bookingStep === "review" ? "booking-step active" : "booking-step"} aria-current={bookingStep === "review" ? "step" : undefined}><span>{t("٢")}</span><strong>{t("المراجعة")}</strong></div>
        </> : <>
          <button type="button" className={bookingStep === "route" ? "booking-step active" : "booking-step complete"} aria-current={bookingStep === "route" ? "step" : undefined} onClick={returnToRoute}><span>{t("١")}</span><strong>{t("النقط والمواعيد")}</strong></button>
          <i className={bookingStep === "price" || bookingStep === "review" ? "complete" : ""} />
          <button type="button" className={bookingStep === "price" ? "booking-step active" : bookingStep === "review" ? "booking-step complete" : "booking-step"} aria-current={bookingStep === "price" ? "step" : undefined} disabled={bookingStep === "route"} onClick={returnToPrice}><span>{t("٢")}</span><strong>{t("السعر")}</strong></button>
          <i className={bookingStep === "review" ? "complete" : ""} />
          <div className={bookingStep === "review" ? "booking-step active" : "booking-step"} aria-current={bookingStep === "review" ? "step" : undefined}><span>{t("٣")}</span><strong>{t("المراجعة")}</strong></div>
        </>}
      </div>
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        if (bookingStep !== "review") { notify(t("راجع البيانات أولًا قبل تأكيد العملية."), "info"); return; }
        if (bookingMode === "join") void joinGroup(event);
        else void createGroup(event);
      }}>
        {bookingStep === "route" && <>
        {bookingMode === "join" && <><label>{t("رقم المجموعة")}<input type="number" min="1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder={t("مثال: 124")} required /></label><div className="info-note">{t("لازم نقط الركوب والنزول تكون في حدود ٣ كم من مسار المجموعة.")}</div></>}
        <div className="location-search-stack">
          <LocationSearchField kind="pickup" title={t("نقطة الركوب")} value={pickupSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { mapAddressRequests.current.pickup++; editAddressRequest.current++; setPickupSearch(value); setPickup(null); }} onSelect={(point) => { mapAddressRequests.current.pickup++; setPickup(point); setPickupSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("pickup")} onFocus={() => undefined} pointSelected={hasSelectedPoint(pickup)} />
          <LocationSearchField kind="dropoff" title={t("نقطة النزول")} value={dropoffSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { mapAddressRequests.current.dropoff++; editAddressRequest.current++; setDropoffSearch(value); setDropoff(null); }} onSelect={(point) => { mapAddressRequests.current.dropoff++; setDropoff(point); setDropoffSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("dropoff")} onFocus={() => undefined} pointSelected={hasSelectedPoint(dropoff)} />
        </div>
        <small className="location-search-attribution">{t("بيانات الأماكن © OpenStreetMap contributors")}</small>
        {bookingMode !== "join" && <div className="time-row"><TimePicker12h label="وقت الذهاب" value={morning} onChange={setMorning} /><TimePicker12h label="وقت العودة" value={returnTime} onChange={setReturnTime} /></div>}
        {mapOpen && <section className="booking-map-panel" aria-label={t("اختيار الموقع من الخريطة")}>
          <div className="booking-map-toolbar">
            <p className="map-instruction">{t("انقر أو اسحب الدبوس لتحديد")} {pickMode === "pickup" ? t("نقطة الركوب") : t("نقطة النزول")}  {t("· القاهرة الكبرى فقط")}</p>
            <button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label={t("إغلاق الخريطة")}>×</button>
          </div>
          <div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={pickMode} restrictToGreaterCairo onOutsidePick={() => notify(t("اختار نقطة داخل القاهرة الكبرى فقط."), "error")} onPick={setMapPoint} /></div>
        </section>}
        </>}
        {bookingMode !== "join" && bookingStep === "price" && <>
          <section className="category-picker"><div className="field-heading"><strong>{t("الفئة والسعر")}</strong><div className="category-heading-actions">{priceLoading && <span>{t("جارٍ تحديث الأسعار…")}</span>}<button type="button" className="price-info-trigger" aria-label={t("شرح الأسعار")} aria-expanded={priceInfoOpen} onClick={() => setPriceInfoOpen((open) => !open)}>{t("؟")} <span>{t("عن الأسعار")}</span></button></div></div>
            {priceInfoOpen && <div className="price-info-popover" role="note">{t("الأسعار تقديرية للفرد. يبدأ الجدول تلقائيًا من يوم الخدمة القادم، مع استثناء الجمعة والسبت في الباقات الأسبوعية والشهرية.")}</div>}
            {priceError && <p className="price-error">{priceError}</p>}
            <div className="category-select-label" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCategoryMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setCategoryMenuOpen(false); }}>
              <span>{t("اختار الفئة")}</span>
              <button type="button" className="category-select-trigger" aria-haspopup="listbox" aria-expanded={categoryMenuOpen} aria-controls="category-options" disabled={categories.length === 0} onClick={() => setCategoryMenuOpen((open) => !open)}>
                <span>{selectedCategory ? `${categoryName(selectedCategory)} · ${selectedCategory.seats} مقاعد` : categories.length > 0 ? t("اختر الفئة للمتابعة") : t("لا توجد فئات متاحة")}</span>
                <strong>{priceLabel(packageType, selectedCategory?.id ?? "")}</strong>
                <span className="category-select-chevron" aria-hidden="true">{categoryMenuOpen ? "⌃" : "⌄"}</span>
              </button>
              {categoryMenuOpen && <div className="category-select-options" id="category-options" role="listbox" aria-label={t("الفئات المتاحة")}>
                {categories.map((category) => {
                  const quote = priceQuotes?.[category.id];
                  const fare = quote ? money(quote[packageType]) : priceLoading ? t("جارٍ حساب السعر…") : priceError ? t("تعذر حساب السعر") : t("السعر غير متاح");
                  const chosen = category.id === categoryId;
                  return <button type="button" key={category.id} role="option" aria-selected={chosen} className={chosen ? "category-select-option selected" : "category-select-option"} onClick={() => { setCategoryId(category.id); setCategoryMenuOpen(false); }}>
                    <span><strong>{categoryName(category)}</strong><small>{category.seats}  {t("مقاعد ·")} {t(category.speed_tier === "faster" ? "أسرع" : "أوفر")}</small></span>
                    <b>{fare}</b>
                  </button>;
                })}
              </div>}
            </div>
            
          </section>
          <label>{t("نوع الباقة")}<div className="package-options">
            {(["daily", "weekly", "monthly"] as const).map((type) => <button type="button" key={type} className={packageType === type ? "package-option selected" : "package-option"} onClick={() => { setPackageType(type); setDates(serviceDatesFromStart(dates[0] && isServiceDay(dates[0]) ? dates[0] : defaultDates(type)[0]!, type)); }}><strong>{type === "daily" ? t("يومي") : type === "weekly" ? t("أسبوعي") : t("شهري")}</strong><small>{type === "daily" ? t("يوم واحد") : type === "weekly" ? t("٥ أيام خدمة · خصم ٥٪") : t("٢٢ يوم خدمة · خصم ١٠٪")}</small><b>{priceLabel(type)}</b></button>)}
          </div></label>
        </>}
        {bookingStep === "review" && <section className="booking-review" aria-labelledby="booking-review-title">
          <div className="booking-review-heading"><div><span className="eyebrow">{t("ملخص قبل التأكيد")}</span><h3 id="booking-review-title">{t("تأكد من بيانات المشوار")}</h3></div><span className="status-chip status-waiting">{t("مراجعة")}</span></div>
          {bookingMode === "join" ? <>
            <div className="booking-review-row"><span>{t("رقم المجموعة")}</span><strong>#{inviteCode}</strong></div>
            <div className="booking-review-row"><span>{t("نقطة الركوب")}</span><strong>{pickup?.label || "لم يتم تحديدها"}</strong><button type="button" className="text-action" onClick={returnToRoute}>{t("تعديل")}</button></div>
            <div className="booking-review-row"><span>{t("نقطة الوصول")}</span><strong>{dropoff?.label || "لم يتم تحديدها"}</strong><button type="button" className="text-action" onClick={returnToRoute}>{t("تعديل")}</button></div>
            <p className="booking-review-note">{t("سيُرسل طلب الانضمام للمجموعة بعد تأكيدك.")}</p>
          </> : <>
            <div className="booking-review-section"><div className="booking-review-section-title"><strong>{t("المسار")}</strong><button type="button" className="text-action" onClick={returnToRoute}>{t("تعديل")}</button></div>
              <div className="booking-review-row"><span>{t("نقطة الركوب")}</span><strong>{pickup?.label || "لم يتم تحديدها"}</strong></div>
              <div className="booking-review-row"><span>{t("نقطة الوصول")}</span><strong>{dropoff?.label || "لم يتم تحديدها"}</strong></div>
            </div>
            <div className="booking-review-section"><div className="booking-review-section-title"><strong>{t("الباقة والسعر")}</strong><button type="button" className="text-action" onClick={returnToPrice}>{t("تعديل")}</button></div>
              <div className="booking-review-row"><span>{t("الباقة")}</span><strong>{packageType === "daily" ? t("يومية") : packageType === "weekly" ? t("أسبوعية") : t("شهرية")} · {dates.length} {dates.length === 1 ? t("يوم خدمة") : t("أيام خدمة")}</strong></div>
              <div className="booking-review-row"><span>{t("أول موعد خدمة")}</span><strong>{dates[0] ? formatDate(dates[0]) : "—"}</strong></div>
              <div className="booking-review-row"><span>{t("وقت الذهاب والعودة")}</span><strong>{formatTime12h(morning)} · {formatTime12h(returnTime)}</strong></div>
              <div className="booking-review-row"><span>{t("الفئة")}</span><strong>{selectedCategory ? `${categoryName(selectedCategory)} · ${selectedCategory.seats} مقاعد` : t("لم يتم تحديدها")}</strong></div>
              <div className="booking-review-total"><span>{t("السعر التقديري للفرد / يوم")}</span><strong>{priceLabel(packageType)}</strong></div>
            </div>
            <p className="booking-review-note">{t("لن يتم إنشاء المجموعة إلا بعد الضغط على زر التأكيد أدناه.")}</p>
          </>}
        </section>}
        {bookingStep === "route" && bookingMode !== "join" && <button type="button" className="button button-primary button-wide" onClick={continueToPrice}>{t("التالي · السعر")} <span>←</span></button>}
        {bookingStep === "route" && bookingMode === "join" && <button type="button" className="button button-primary button-wide" onClick={continueToReview}>{t("مراجعة طلب الانضمام")} <span>←</span></button>}
        {bookingStep === "price" && <button type="button" className="button button-primary button-wide" disabled={submitting} onClick={continueToReview}>{t("مراجعة المشوار")} <span>←</span></button>}
        {bookingStep === "review" && <div className="booking-review-actions"><button type="button" className="button button-outline" onClick={bookingMode === "join" ? returnToRoute : returnToPrice} disabled={submitting}>{t("رجوع للتعديل")}</button><button type="submit" className="button button-primary" disabled={submitting}>{submitting ? bookingMode === "join" ? t("جارٍ إرسال الطلب…") : t("جارٍ إنشاء المجموعة…") : bookingMode === "join" ? t("تأكيد الانضمام للمجموعة") : bookingMode === "edit" ? t("حفظ التعديلات") : t("تأكيد إنشاء المجموعة")} <span>←</span></button></div>}
      </form>
    </section>
    
  </div>;

  const allTrips = visibleGroups.flatMap((view) => view.trips.map((trip) => ({ ...trip, groupId: view.group.id, categoryId: view.group.category_id, fare: view.group.seat_day_fare })));
  const liveTrip = selected?.trips.find((trip) => !["completed", "cancelled", "canceled"].includes(trip.status));
  const liveTripMember = selected?.members.find((member) => member.status === "active");
  const liveTripStops = liveTrip?.stops ?? [];
  const reachedStops = liveTripStops.filter((stop) => Boolean(stop.reached_at)).length;
  const liveProgress = liveTripStops.length ? Math.round((reachedStops / liveTripStops.length) * 100) : 0;
  if (section === "trips") return <div className="trips-page rider-trips-experience">
    {dataErrorBanner}
    <div className="section-toolbar"><button className="button button-primary button-small" onClick={() => openBooking("new")}>{t("＋ ابحث عن مسار")}</button></div>
    {selectedGroup && selected ? <><button className="button button-quiet button-small trips-back-to-groups" onClick={() => setSelectedGroup(null)}>{t("→ رجوع لمجموعاتي")}</button>{liveTrip && <section className="stitch-live-trip surface" aria-label={t("متابعة الرحلة")}><div className="stitch-live-trip-map"><MapPicker pickup={liveTripMember?.pickup_lat != null && liveTripMember.pickup_lng != null ? { lat: liveTripMember.pickup_lat, lng: liveTripMember.pickup_lng, kind: "pickup", label: t("نقطة الركوب") } : null} dropoff={liveTripMember?.dropoff_lat != null && liveTripMember.dropoff_lng != null ? { lat: liveTripMember.dropoff_lat, lng: liveTripMember.dropoff_lng, kind: "dropoff", label: t("نقطة الوصول") } : null} mode="pickup" route={selected.group.route_geometry} readOnly onPick={() => undefined} /></div><div className="stitch-live-trip-content"><div className="stitch-live-trip-heading"><span><i />{t("تحديث حالة الرحلة كل ٣٠ ثانية")}</span><strong>{statusLabel(liveTrip.status)}</strong></div><h3>{t("متابعة رحلتك")}</h3><p>{formatDate(liveTrip.service_date)} · {liveTrip.departure_at.slice(11, 16)}{liveTrip.estimated_arrival_at ? ` · ${t("وصول متوقع")} ${new Date(liveTrip.estimated_arrival_at).toLocaleTimeString(getLanguage() === "ar" ? "ar-EG" : "en-EG", { hour: "2-digit", minute: "2-digit" })}` : ""}</p><div className="stitch-live-progress"><span style={{ width: `${liveProgress}%` }} /></div><div className="stitch-live-stops">{liveTripStops.length ? liveTripStops.map((stop) => <span key={stop.id} className={stop.reached_at ? "is-reached" : ""}><i />{stop.stop_type === "pickup" ? t("نقطة الركوب") : t("نقطة النزول")}</span>) : <span><i />{t("تم تأكيد الرحلة")}</span>}</div><small>{t("يعرض هذا القسم حالة الرحلة وآخر نقاط التوقف المسجلة، ولا يعرض موقعًا مباشرًا للمركبة.")}</small></div></section>}<GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onEdit={() => startEditingGroup(selected)} currentUserId={session.user.id} token={session.token} /></> : visibleGroups.length ? <section className="group-list trips-group-list" aria-label={t("مجموعات مشاويرك")}>{visibleGroups.map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => setSelectedGroup(view.group.id)} />)}</section> : null}
    {allTrips.length ? <section className="all-trips-section"><div className="section-title-row"><div><h2>{t("مواعيد رحلاتك")}</h2><p>{t("كل مواعيد الذهاب والعودة لرحلاتك")}</p></div><span className="section-count">{allTrips.length}</span></div><TripList trips={allTrips} categories={categories} /></section> : initialLoadError ? null : <EmptyState icon="↗" title={t("لسه مفيش رحلات مجدولة")} text={visibleGroups.length ? "ستظهر مواعيد رحلاتك هنا بعد تفعيلها." : "لما يتطابق طلبك مع مسار كابتن هتلاقي تفاصيله هنا."} />}
    {visibleGroups.length > 1 && selectedGroup && <div className="group-switcher">{visibleGroups.map((view) => <button key={view.group.id} className={view.group.id === selectedGroup ? "group-chip active" : "group-chip"} onClick={() => setSelectedGroup(view.group.id)}>{t("مجموعة #")}{view.group.id} · {statusLabel(view.group.status)}</button>)}</div>}
  </div>;

  return <div className="dashboard-grid rider-dashboard rider-home-experience">
    <section className="dashboard-main">{dataErrorBanner}
      {welcomeBanner}
      <section className="rider-shortcuts"><div className="rider-section-heading"><div><span className="eyebrow">{t("أماكنك المعتادة")}</span><h2>{t("ابدأ من مكانك المفضل")}</h2></div><button type="button" className="text-action" onClick={() => setSection("account")}>{t("إدارة الأماكن")}</button></div>{savedPlaces.length ? <div className="rider-place-list">{savedPlaces.map((place) => <button type="button" className="rider-place-chip" key={`${place.place_type}-${place.label}`} onClick={() => openBooking("new", undefined, place)}><span className="rider-place-icon">{place.place_type === "home" ? "⌂" : place.place_type === "work" ? "▦" : "⌖"}</span><span><small>{place.place_type === "home" ? t("المنزل") : place.place_type === "work" ? t("العمل") : t("مكان محفوظ")}</small><strong>{place.label}</strong></span><b aria-hidden="true">←</b></button>)}</div> : <div className="rider-saved-empty"><span aria-hidden="true">⌖</span><p>{t("احفظ المنزل أو العمل لتبدأ البحث بسرعة في المرة القادمة.")}</p><button type="button" className="button button-outline button-small" onClick={() => setSection("account")}>{t("إضافة مكان محفوظ")}</button></div>}</section>
      <section className="rider-home-requests"><div className="rider-section-heading"><div><span className="eyebrow">{t("متابعة رحلتك")}</span><h2>{t("طلبات رحلاتك")}</h2></div><button className="text-action" type="button" onClick={() => setSection("requests")}>{t("عرض الكل")} {demandRequests.length > 0 && <b>{demandRequests.length}</b>}</button></div>
        {demandRequests.length ? <>{requestCards}<button type="button" className="button button-outline button-small rider-view-all" onClick={() => setSection("requests")}>{t("عرض كل الطلبات")}</button></> : initialLoadError ? null : <EmptyState icon="⌖" title={t("مافيش طلبات رحلات لسه")} text="ابحث عن مسار مناسب، ولو مافيش هنسجل طلبك ونجمعه مع الطلبات المشابهة." action="ابحث عن رحلة" onAction={() => openBooking("new")} />}
      </section>
    </section>
  </div>;
}

