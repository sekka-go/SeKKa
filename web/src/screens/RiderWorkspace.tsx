import { getDirection, t } from "../i18n/runtime";
import AppIcon from "../components/AppIcon";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";

import type { MapPickMode, MapPoint } from "../MapPicker";
import LocationSearchField from "../components/LocationSearchField";
import TimePicker12h, { formatTime12h } from "../components/TimePicker12h";
import RiderDemandFlow from "./RiderDemandFlow";
import { categoryName, errorText, formatDate, money, vehicleTypeLabel } from "../lib/formatters";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { reverseGeocode } from "../lib/location-address";
import { subscribeToDeviceLocation } from "../lib/device-location";
import { sameData, useSilentRefresh } from "../lib/use-silent-refresh";
import { api, type CaptainLineJoinRequest, type Category, type GroupView, type Notification, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { defaultDates, isServiceDay, serviceDatesFromStart, shiftDate, todayInCairo } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import {
  AccountPanel, EmptyState, ErrorState, GroupDetail, GroupSummary, LoadingCard, TripList,
} from "../components/workspace-shared";

const hasSelectedPoint = (point: MapPoint | null) =>
  typeof point?.lat === "number" && Number.isFinite(point.lat) &&
  typeof point?.lng === "number" && Number.isFinite(point.lng);
type RiderLineOffer = {
  id: number; vehicle_type_id: "prime" | "daily" | "space" | "max" | "private_car" | "hiace"; origin_label: string; origin_lat: number; origin_lng: number;
  destination_label: string; destination_lat: number; destination_lng: number; arrival_time: string; return_arrival_time?: string | null; direction: "outbound" | "return"; service_days: number[];
  intermediate_stops?: Array<{ label: string; lat: number; lng: number }>;
  seats: number; price_per_seat: number; pickup_distance_km: number; dropoff_distance_km: number; captain_name: string; captain_verified: boolean;
};
const nextServiceDate = (days: number[]) => {
  const today = todayInCairo();
  for (let offset = 1; offset <= 7; offset++) {
    const date = shiftDate(today, offset);
    if (days.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) return date;
  }
  return defaultDates("daily")[0];
};
export default function RiderWorkspace({ session, section, setSection, refreshNotifications, registerPoolRefresh, notifications, notify, onInitialReady }: {
  session: Session; section: NavKey; setSection: (section: NavKey, historyMode?: "push" | "replace") => void;
  refreshNotifications: (quiet?: boolean, signal?: AbortSignal) => Promise<void>; registerPoolRefresh: (refresh: () => Promise<void>) => void; notify: (text: string, tone?: Toast["tone"]) => void;
  notifications: Notification[];
  onInitialReady: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [tripOrigin, setTripOrigin] = useState<MapPoint | null>(null);
  const [tripOffers, setTripOffers] = useState<RiderLineOffer[]>([]);
  const [tripOffersLoading, setTripOffersLoading] = useState(false);
  const [tripOffersError, setTripOffersError] = useState("");
  const [tripSearchNonce, setTripSearchNonce] = useState(0);
  const [selectedOffer, setSelectedOffer] = useState<RiderLineOffer | null>(null);
  const [lineJoinPickup, setLineJoinPickup] = useState<MapPoint | null>(null);
  const [lineJoinDropoff, setLineJoinDropoff] = useState<MapPoint | null>(null);
  const [lineJoinPickupSearch, setLineJoinPickupSearch] = useState("");
  const [lineJoinDropoffSearch, setLineJoinDropoffSearch] = useState("");
  const [lineJoinMapOpen, setLineJoinMapOpen] = useState(false);
  const [lineJoinMapMode, setLineJoinMapMode] = useState<MapPickMode>("pickup");
  const [lineJoinRequests, setLineJoinRequests] = useState<CaptainLineJoinRequest[]>([]);
  const [lineJoinSubmitting, setLineJoinSubmitting] = useState(false);
  const [lineJoinRequestsLoading, setLineJoinRequestsLoading] = useState(false);
  const tripOffersLoadedRef = useRef(false);
  const tripOffersRef = useRef<RiderLineOffer[]>([]);
  const [homeSlide, setHomeSlide] = useState(0);
  const tripOriginSource = useRef<"device" | "saved" | "manual" | null>(null);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const groupsRef = useRef<GroupView[]>([]);
  const [demandRequests, setDemandRequests] = useState<{ id: number; pickup_label: string; dropoff_label: string; trip_date: string; arrival_time: string; return_arrival_time?: string | null; vehicle_type_id: string; status: string; demand_groups?: { status: string; captain_line_id: number | null } | null; line?: { origin_label: string; destination_label: string; arrival_time: string; return_arrival_time?: string | null; price_per_seat: number; captain_name: string } | null }[]>([]);
  const demandRequestsRef = useRef(demandRequests);
  const [requestFilter, setRequestFilter] = useState<"all" | "open" | "matched" | "closed">("all");
  const visibleGroups = groups.filter(({ group }) => !["cancelled", "canceled"].includes(group.status.trim().toLowerCase()));
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [riderTripsTab, setRiderTripsTab] = useState<"discover" | "myTrips">("discover");
  const selected = visibleGroups.find((view) => view.group.id === selectedGroup) ?? null;
  const [loading, setLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState("");
  const pendingNotificationEdit = useRef<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"new" | "join" | "edit">("new");
  const [bookingPickup, setBookingPickup] = useState<MapPoint | null>(null);
  const [bookingTripDate, setBookingTripDate] = useState(() => defaultDates("daily")[0] ?? "");
  const [bookingArrivalTime, setBookingArrivalTime] = useState("08:00");
  const [bookingReturnArrivalTime, setBookingReturnArrivalTime] = useState("");
  const [startDemandFlowWithRequest, setStartDemandFlowWithRequest] = useState(false);
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
  const priceLabel = (type: "daily" | "weekly" | "monthly", selectedCategoryId = categoryId) => {
    const selectedQuote = selectedCategoryId ? priceQuotes?.[selectedCategoryId] : null;
    if (selectedQuote) return money(selectedQuote[type]);
    return priceLoading ? "جارٍ حساب الأسعار…" : priceError ? "تعذر حساب السعر" : "السعر بعد تحديد الفئة";
  };

  const openBooking = (mode: "new" | "join", prefill?: { groupId: number; pickup: MapPoint; dropoff: MapPoint }, savedPickup?: SavedPlace) => {
    editAddressRequest.current++;
    setBookingMode(mode);
    setStartDemandFlowWithRequest(false);
    setEditingGroupId(null);
    if (mode === "new") { setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily")); setBookingTripDate(defaultDates("daily")[0] ?? ""); setBookingArrivalTime("08:00"); setBookingReturnArrivalTime(""); setBookingPickup(savedPickup ? { lat: savedPickup.lat, lng: savedPickup.lng, label: savedPickup.label, primaryLabel: savedPickup.label, kind: "pickup" } : null); setDropoff(null); setDropoffSearch(""); }
    if (mode === "join") {
      setInviteCode(prefill ? String(prefill.groupId) : "");
      setPickup(prefill?.pickup ?? null); setDropoff(prefill?.dropoff ?? null);
      setPickupSearch(prefill?.pickup.label ?? ""); setDropoffSearch(prefill?.dropoff.label ?? "");
    }
    setBookingStep("route");
    setPriceInfoOpen(false);
    setSection("booking");
  };
  const createFallbackRequest = () => {
    setBookingMode("new");
    setStartDemandFlowWithRequest(true);
    setBookingPickup(tripOrigin);
    setBookingTripDate(defaultDates("daily")[0] ?? "");
    setBookingArrivalTime("08:00");
    setBookingReturnArrivalTime("");
    setDropoff(null);
    setDropoffSearch("");
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

  const refreshGroups = useCallback(async (signal?: AbortSignal) => {
    const result = await api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token, signal, etag: true });
    if (sameData(groupsRef.current, result.groups ?? [])) return false;
    groupsRef.current = result.groups ?? []; setGroups(result.groups ?? []); return true;
  }, [session.token]);
  const refreshDemandRequests = useCallback(async (signal?: AbortSignal) => {
    const result = await api<{ requests: typeof demandRequests }>("/rider/demand-requests", { token: session.token, signal, etag: true });
    if (sameData(demandRequestsRef.current, result.requests ?? [])) return false;
    demandRequestsRef.current = result.requests ?? []; setDemandRequests(result.requests ?? []); return true;
  }, [session.token]);
  const loadLineJoinRequests = useCallback(async () => {
    setLineJoinRequestsLoading(true);
    try {
      const result = await api<{ requests: CaptainLineJoinRequest[] }>("/rider/line-requests", { token: session.token, etag: true });
      setLineJoinRequests(result.requests ?? []);
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLineJoinRequestsLoading(false); }
  }, [session.token, notify]);
  const requestSelectedLine = async () => {
    if (!selectedOffer || lineJoinSubmitting) return;
    if (!hasSelectedPoint(lineJoinPickup) || !hasSelectedPoint(lineJoinDropoff) || !lineJoinPickup?.label || !lineJoinDropoff?.label) {
      notify(t("حدد نقطتي الركوب والنزول قبل إرسال الطلب."), "error"); return;
    }
    setLineJoinSubmitting(true);
    try {
      const tripDate = nextServiceDate(selectedOffer.service_days);
      const result = await api<{ request: CaptainLineJoinRequest }>("/rider/line-requests", { method: "POST", token: session.token, body: {
        line_id: selectedOffer.id, trip_date: tripDate, pickup_label: lineJoinPickup.label,
        pickup_lat: lineJoinPickup.lat, pickup_lng: lineJoinPickup.lng,
        dropoff_label: lineJoinDropoff.label, dropoff_lat: lineJoinDropoff.lat,
        dropoff_lng: lineJoinDropoff.lng, seats: 1, direction: selectedOffer.direction,
      } });
      setLineJoinRequests((current) => [result.request, ...current.filter((request) => request.id !== result.request.id)]);
      setSelectedOffer(null);
      notify(t("تم إرسال طلب الانضمام للكابتن. تقدر تتابع حالته في طلباتي."), "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setLineJoinSubmitting(false); }
  };
  const selectLineOffer = (line: RiderLineOffer) => {
    const pickupPoint = tripOrigin && hasSelectedPoint(tripOrigin) ? tripOrigin : { lat: line.origin_lat, lng: line.origin_lng, label: line.origin_label, kind: "pickup" as const };
    const dropoffPoint = { lat: line.destination_lat, lng: line.destination_lng, label: line.destination_label, kind: "dropoff" as const };
    setLineJoinPickup(pickupPoint); setLineJoinPickupSearch(pickupPoint.label ?? line.origin_label);
    setLineJoinDropoff(dropoffPoint); setLineJoinDropoffSearch(dropoffPoint.label ?? line.destination_label);
    setLineJoinMapOpen(false); setSelectedOffer(line);
  };
  const chooseLineJoinMap = (mode: MapPickMode) => { setLineJoinMapMode(mode); setLineJoinMapOpen(true); };
  useEffect(() => { if (section === "requests") void loadLineJoinRequests(); }, [section, loadLineJoinRequests]);
  useEffect(() => subscribeToDeviceLocation((location) => {
    if (!location) {
      if (tripOriginSource.current !== "device") return;
      tripOriginSource.current = null;
      const home = savedPlaces.find((place) => place.place_type === "home") ?? savedPlaces[0];
      setTripOrigin(home ? { lat: home.lat, lng: home.lng, label: home.label, primaryLabel: home.label, kind: "pickup" } : null);
      if (home) tripOriginSource.current = "saved";
      return;
    }
    if (tripOriginSource.current === "manual") return;
    tripOriginSource.current = "device";
    const label = t("موقعي الحالي");
    setTripOrigin({ lat: location.lat, lng: location.lng, label, primaryLabel: label, kind: "pickup" });
  }), [savedPlaces]);
  useEffect(() => {
    if (tripOriginSource.current || !savedPlaces.length) return;
    const home = savedPlaces.find((place) => place.place_type === "home") ?? savedPlaces[0];
    if (!home) return;
    tripOriginSource.current = "saved";
    setTripOrigin({ lat: home.lat, lng: home.lng, label: home.label, primaryLabel: home.label, kind: "pickup" });
  }, [savedPlaces]);
  useEffect(() => {
    if (section !== "home" && section !== "trips") return;
    if (document.visibilityState === "hidden") return;
    if (tripOrigin?.lat == null || tripOrigin.lng == null) return;
    const showLoading = !tripOffersLoadedRef.current;
    if (!isInsideGreaterCairo(tripOrigin.lat, tripOrigin.lng)) {
      return;
    }
    let active = true;
    if (showLoading) { setTripOffersLoading(true); setTripOffersError(""); }
    const params = new URLSearchParams({ pickup_lat: String(tripOrigin.lat), pickup_lng: String(tripOrigin.lng) });
    const controller = new AbortController();
    void api<{ lines: RiderLineOffer[] }>(`/rider/lines/discover?${params.toString()}`, { token: session.token, signal: controller.signal, etag: true })
      .then((result) => { if (active && !sameData(tripOffersRef.current, result.lines ?? [])) { tripOffersRef.current = result.lines ?? []; setTripOffers(result.lines ?? []); } if (active) tripOffersLoadedRef.current = true; })
      .catch((error) => { if (active && showLoading) setTripOffersError(errorText(error)); })
      .finally(() => { if (active && showLoading) setTripOffersLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [section, tripOrigin?.lat, tripOrigin?.lng, tripSearchNonce, session.token]);
  const refreshDiscoveredLines = useCallback(async (signal: AbortSignal) => {
    if (tripOrigin?.lat == null || tripOrigin.lng == null) return false;
    const params = new URLSearchParams({ pickup_lat: String(tripOrigin.lat), pickup_lng: String(tripOrigin.lng) });
    try {
      const result = await api<{ lines: RiderLineOffer[] }>(`/rider/lines/discover?${params.toString()}`, { token: session.token, signal, etag: true });
      const next = result.lines ?? []; const changed = !sameData(tripOffersRef.current, next);
      if (changed) { tripOffersRef.current = next; setTripOffers(next); }
      tripOffersLoadedRef.current = true;
      return changed;
    } catch { return false; }
  }, [session.token, tripOrigin?.lat, tripOrigin?.lng]);
  useSilentRefresh(refreshDiscoveredLines, {
    enabled: (section === "home" || section === "trips") && hasSelectedPoint(tripOrigin) && isInsideGreaterCairo(tripOrigin!.lat!, tripOrigin!.lng!),
    intervalMs: 20_000,
  });
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setInitialLoadError("");
    const results = await Promise.allSettled([
      api<{ categories: Category[] }>("/pool/categories"),
      api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token, etag: true }),
      api<{ places: SavedPlace[] }>("/rider/saved-places", { token: session.token }),
      api<{ requests: typeof demandRequests }>("/rider/demand-requests", { token: session.token, etag: true }),
    ]);
    const errors: string[] = [];
    const [categoryResult, groupResult, savedPlaceResult, demandResult] = results;
    if (categoryResult?.status === "fulfilled") setCategories(categoryResult.value.categories ?? []);
    else if (categoryResult?.status === "rejected") errors.push(errorText(categoryResult.reason));
    if (groupResult?.status === "fulfilled") { groupsRef.current = groupResult.value.groups ?? []; setGroups(groupResult.value.groups ?? []); }
    else if (groupResult?.status === "rejected") errors.push(errorText(groupResult.reason));
    if (savedPlaceResult?.status === "fulfilled") setSavedPlaces(savedPlaceResult.value.places ?? []);
    else if (savedPlaceResult?.status === "rejected") errors.push(errorText(savedPlaceResult.reason));
    if (demandResult?.status === "fulfilled") { demandRequestsRef.current = demandResult.value.requests ?? []; setDemandRequests(demandResult.value.requests ?? []); }
    const message = errors[0] ?? "";
    setInitialLoadError(message);
    if (message) notify(message, "error");
    setLoading(false);
  }, [session.token, notify]);
  useEffect(() => { void loadInitialData(); }, [loadInitialData]);
  useEffect(() => { if (section === "home" && !loading) onInitialReady(); }, [section, loading, onInitialReady]);

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

  const refresh = useCallback(async (quiet = false, signal?: AbortSignal) => {
    try {
      const [groupsChanged, requestsChanged] = await Promise.all([refreshGroups(signal), refreshDemandRequests(signal)]);
      if (!quiet) await refreshNotifications();
      return groupsChanged || requestsChanged;
    } catch (error) { if (!quiet) notify(errorText(error), "error"); return false; }
  }, [refreshGroups, refreshDemandRequests, refreshNotifications, notify]);

  useEffect(() => { registerPoolRefresh(async () => { await refresh(); }); }, [registerPoolRefresh, refresh]);

  useSilentRefresh((signal) => refresh(true, signal), { intervalMs: 20_000 });

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
      setBookingMode("new"); setEditingGroupId(null); setSelectedGroup(null); setRiderTripsTab("myTrips"); setSection("trips", "replace"); setPickup(null); setDropoff(null);
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
      await refreshGroups(); setSelectedGroup(result.group.id); setRiderTripsTab("myTrips"); setSection("trips", "replace"); setPickup(null); setDropoff(null); setInviteCode("");
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
  const activeRequests = demandRequests.filter(({ status }) => status === "open" || status === "matched");
  const nearestOffer = tripOffers[0];
  const favoritePlace = savedPlaces.find((place) => place.place_type === "home") ?? savedPlaces[0];
  const suggestedRideNotification = notifications.find((item) => item.event_key.startsWith("demand-suggestion:") && Number.isSafeInteger(item.payload.line_id));
  const homePromoSlides = [
    ...(suggestedRideNotification ? [{ icon: "route" as const, eyebrow: t("اقتراح رحلة لطلبك"), title: t("رحلة منشورة تناسب طلبك"), body: t("نشر كابتن رحلة قد تناسب طلبك. راجع تفاصيلها واختر إن كنت تريد إرسال طلب انضمام."), action: t("عرض الرحلات"), onAction: () => setSection("trips") }] : []),
    { icon: "route" as const, eyebrow: t("ترشيح قريب منك"), title: nearestOffer ? `${nearestOffer.origin_label} ← ${nearestOffer.destination_label}` : t("رحلات تناسب نقطة انطلاقك"), body: nearestOffer ? `${t("مع")} ${nearestOffer.captain_name} · ${t("للمقعد")} ${money(Number(nearestOffer.price_per_seat))} ${t("ج.م")}` : tripOffersLoading ? t("جارٍ البحث عن رحلات قريبة من موقعك.") : t("حدد نقطة انطلاقك لتظهر لك الرحلات المنشورة القريبة."), action: t("اكتشف الرحلات"), onAction: () => setSection("trips") },
    { icon: "inbox" as const, eyebrow: t("تنبيه طلباتك"), title: activeRequests.length ? t("عندك طلبات قيد المتابعة") : t("تابع طلبات رحلاتك"), body: activeRequests.length ? `${activeRequests.length} ${t("طلبات نشطة، وسنخبرك عند العثور على رحلة مناسبة.")}` : t("احتفظ بطلبات رحلاتك وتابع تحديثاتها من مكان واحد."), action: activeRequests.length ? t("عرض طلباتي") : t("ابدأ طلب رحلة"), onAction: () => activeRequests.length ? setSection("requests") : openBooking("new") },
    { icon: "home" as const, eyebrow: t("اقتراح لك"), title: favoritePlace ? `${t("ابدأ من مكانك المعتاد")}: ${favoritePlace.label}` : t("احفظ أماكنك المعتادة"), body: favoritePlace ? t("اختار مكانك المحفوظ وابدأ البحث عن رحلة أسرع.") : t("إضافة المنزل أو العمل تسهّل عليك تحديد نقطة الانطلاق كل مرة."), action: favoritePlace ? t("ابحث من هذا المكان") : t("إضافة مكان محفوظ"), onAction: () => favoritePlace ? openBooking("new", undefined, favoritePlace) : setSection("account") },
  ];
  const selectedPromo = homePromoSlides[homeSlide % homePromoSlides.length]!;
  useEffect(() => {
    if (section !== "home") return;
    const timer = window.setInterval(() => setHomeSlide((current) => (current + 1) % homePromoSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, [section, homePromoSlides.length]);

  const openDemandCount = demandRequests.filter((request) => request.status === "open").length;
  const matchedDemandCount = demandRequests.filter((request) => request.status === "matched").length;
  const closedDemandCount = demandRequests.filter((request) => request.status === "cancelled" || request.status === "expired").length;
  const visibleDemandRequests = demandRequests.filter((request) => requestFilter === "all" || (requestFilter === "closed" ? request.status === "cancelled" || request.status === "expired" : request.status === requestFilter));
  const requestCards = <div className="rider-request-list">{visibleDemandRequests.map((request) => <article className="surface rider-request-card" key={request.id}><div className="rider-request-card-top"><span className={`status-chip status-${request.status}`}>{request.status === "matched" ? t("تم العثور على رحلة") : request.status === "open" ? t("بانتظار رحلة مناسبة") : request.status === "cancelled" ? t("ملغي") : t("منتهي")}</span><span>{vehicleTypeLabel(request.vehicle_type_id)}</span><time>{formatDate(request.trip_date)} · {request.arrival_time.slice(0, 5)}{request.return_arrival_time ? ` · ${t("عودة")} ${request.return_arrival_time.slice(0, 5)}` : ""}</time></div><div className="rider-request-route"><span className="rider-route-timeline" aria-hidden="true"><i /><b /><i /></span><div><strong>{request.pickup_label}</strong><strong>{request.dropoff_label}</strong></div></div><p className="rider-request-note">{request.status === "matched" ? t("تمت مطابقة طلبك. راجع تفاصيل الرحلة أدناه.") : request.status === "open" ? t("طلبك مسجل ونبحث عن رحلة منشورة أو طلبات مشابهة تناسبه.") : request.status === "cancelled" ? t("ألغيت هذا الطلب.") : t("انتهت مدة هذا الطلب.")}</p>{request.line && <div className="rider-match-summary"><strong>{t("الرحلة التي طابقت طلبك")}: {request.line.origin_label} ← {request.line.destination_label}</strong><span>{request.line.captain_name} · {t("· وصول")} {request.line.arrival_time.slice(0, 5)}{request.return_arrival_time && request.line.return_arrival_time ? ` · ${t("عودة")} ${request.line.return_arrival_time.slice(0, 5)}` : ""} · {money(Number(request.line.price_per_seat))} {t("للمقعد")}</span></div>}</article>)}</div>;

  if (section === "account") return <div className="rider-account-experience">{dataErrorBanner}<section className="rider-profile-heading"><div><span className="eyebrow">{t("حسابك في سِكّة")}</span><h2>{t("الملف الشخصي والإعدادات")}</h2><p>{t("إدارة بيانات حسابك وأماكنك المحفوظة.")}</p></div></section><AccountPanel session={session} notify={notify} /></div>;

  const lineJoinRequestSection = <section className="surface rider-request-card"><div className="section-title-row"><div><span className="eyebrow">{t("طلبات الانضمام للرحلات المنشورة")}</span><h2>{t("رحلات اخترتها")}</h2></div><button type="button" className="button button-outline button-small" onClick={() => void loadLineJoinRequests()} disabled={lineJoinRequestsLoading}>{t("تحديث")}</button></div>{lineJoinRequestsLoading && !lineJoinRequests.length ? <LoadingCard text="loading.riderRequests" /> : lineJoinRequests.length ? <div className="rider-request-list">{lineJoinRequests.map((request) => <article className="surface rider-request-card" key={request.id}><div className="rider-request-card-top"><span className={`status-chip status-${request.status}`}>{t(request.status === "pending" ? "بانتظار رد الكابتن" : request.status === "accepted" ? "تم قبول طلب الانضمام" : request.status === "rejected" ? "تم رفض طلب الانضمام" : "ملغي")}</span><time>{formatDate(request.trip_date)}</time></div><div className="rider-request-route"><span className="rider-route-timeline" aria-hidden="true"><i /><b /><i /></span><div><strong>{request.pickup_label}</strong><strong>{request.dropoff_label}</strong></div></div><p>{request.captain_lines?.captain_name ?? t("الكابتن")} · {t(request.direction === "return" ? "وقت العودة" : "وقت الانطلاق")} {request.captain_lines?.arrival_time?.slice(0, 5) ?? "—"} · {money(Number(request.captain_lines?.price_per_seat ?? 0))} {t("للمقعد")}</p></article>)}</div> : <p>{t("لم ترسل طلب انضمام لرحلة منشورة بعد.")}</p>}</section>;
  if (section === "requests") return <div className="rider-requests-page">{dataErrorBanner}{lineJoinRequestSection}{demandRequests.length ? <><section className="rider-request-overview" aria-label={t("ملخص طلباتك")}><div><span>{t("بانتظار المطابقة")}</span><strong>{openDemandCount}</strong></div><div><span>{t("تمت مطابقتها")}</span><strong>{matchedDemandCount}</strong></div><div><span>{t("منتهية أو ملغاة")}</span><strong>{closedDemandCount}</strong></div></section><div className="rider-request-filters" role="group" aria-label={t("تصفية الطلبات")}>{([["all", t("كل الطلبات"), demandRequests.length], ["open", t("قيد البحث"), openDemandCount], ["matched", t("تمت مطابقتها"), matchedDemandCount], ["closed", t("المنتهية"), closedDemandCount]] as const).map(([filter, label, count]) => <button type="button" key={filter} aria-pressed={requestFilter === filter} className={requestFilter === filter ? "is-active" : ""} onClick={() => setRequestFilter(filter)}>{label}<span>{count}</span></button>)}</div>{visibleDemandRequests.length ? requestCards : <EmptyState icon="inbox" title={t("لا توجد طلبات في هذا التصنيف")} text={t("اختر تصنيفًا آخر لمتابعة طلباتك.")} />}</> : initialLoadError ? null : <EmptyState icon="inbox" title={t("لم تسجل طلب رحلة بعد")} text={t("طلباتك تظهر هنا بعد البحث عن الرحلات المنشورة وعدم العثور على رحلة مناسبة ثم تسجيل طلبك.")} action="أنشئ طلب رحلة" onAction={() => openBooking("new")} />}</div>;

  if (section === "booking" && bookingMode !== "edit") return <><RiderDemandFlow session={session} notify={notify} onBack={() => setSection("home")} onOpenRequests={() => setSection("requests")} onRequestCreated={async () => { await refreshDemandRequests(); }} initialPickup={bookingPickup ?? pickup} initialDropoff={dropoff} initialTripDate={bookingTripDate} initialArrivalTime={bookingArrivalTime} initialReturnArrivalTime={bookingReturnArrivalTime} startWithCustomRequest={startDemandFlowWithRequest} savedPlaces={savedPlaces} />{dataErrorBanner}</>;
  if (loading && section === "home") return <div className="dashboard-grid rider-dashboard"><section className="dashboard-main">{welcomeBanner}<LoadingCard text="loading.riderRequests" /></section></div>;
  if (loading && section === "trips") return <div className="trips-page">{dataErrorBanner}<LoadingCard text="loading.riderRequests" /></div>;
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
  if (section === "trips" && riderTripsTab === "myTrips") return <div className="trips-page rider-trips-experience">
    {selected ? <><button type="button" className="button button-quiet button-small trips-back-to-groups" onClick={() => setSelectedGroup(null)}>{t("→ رجوع لمجموعاتي")}</button><GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onEdit={() => startEditingGroup(selected)} currentUserId={session.user.id} token={session.token} /></> : visibleGroups.length ? <section className="group-list trips-group-list" aria-label={t("مجموعات مشاويرك")}>{visibleGroups.map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => setSelectedGroup(view.group.id)} />)}</section> : <EmptyState icon="trips" title={t("لسه مفيش رحلات مجدولة")} text={t("بعد إرسال طلب رحلة أو الانضمام لمجموعة ستظهر رحلاتك هنا.")} />}
    {allTrips.length > 0 && <section className="all-trips-section"><div className="section-title-row"><div><h2>{t("مواعيد رحلاتك")}</h2><p>{t("كل مواعيد الذهاب والعودة لرحلاتك")}</p></div><span className="section-count">{allTrips.length}</span></div><TripList trips={allTrips} categories={categories} /></section>}
  </div>;
  if (section === "trips") return <div className="trips-page rider-trips-experience">
    {dataErrorBanner}

    {tripOffersLoading && <LoadingCard text="جارٍ البحث عن رحلات مناسبة…" />}
    {tripOffersError && <ErrorState title={t("تعذر تحميل الرحلات")} text={tripOffersError} action="إعادة المحاولة" onAction={() => { tripOffersLoadedRef.current = false; setTripSearchNonce((value) => value + 1); }} />}
    {!tripOffersLoading && !tripOffersError && (tripOffers.length ? <section className="rider-trip-offer-list" aria-label={t("الرحلات المناسبة")}>
      <div className="rider-section-heading"><div><span className="eyebrow">{t("رحلات الكباتن المطابقة لبحثك")}</span><h2>{t("الرحلات المناسبة لك")}</h2></div><span className="section-count">{tripOffers.length}</span></div>
      {tripOffers.map((line) => <article className="surface rider-trip-offer" key={`${line.id}:${line.direction}`}>
        <div className="rider-trip-offer-top"><span className="rider-trip-offer-captain"><AppIcon name="user" size={16} />{line.captain_name}{line.captain_verified && <b aria-label={t("كابتن موثق")}>✓</b>}</span><span>{vehicleTypeLabel(line.vehicle_type_id)}</span></div>
        <div className="rider-trip-offer-route"><span><i /><b />{line.origin_label}</span><span><i />{line.destination_label}</span></div>
        <div className="rider-trip-offer-meta"><span>{t(line.direction === "return" ? "وقت العودة" : "وقت الانطلاق")} · {line.arrival_time.slice(0, 5)}</span><span>{line.seats} {t("مقاعد")}</span><strong>{money(Number(line.price_per_seat))} {t("للمقعد")}</strong></div>
        <small className="rider-trip-distance">{t("نقطة انطلاقك تبعد")} {line.pickup_distance_km} {t("كم")}</small>
        <button type="button" className="button button-primary rider-trip-offer-action" onClick={() => selectLineOffer(line)}>{t("اشترك في الرحلة")} <span aria-hidden="true">←</span></button>
      </article>)}
    </section> : <EmptyState icon="route" title={tripOrigin ? t("لم نجد رحلة منشورة تناسب بحثك") : t("حدد نقطة انطلاق لعرض الرحلات")} text={tripOrigin ? t("لم نجد رحلة منشورة قريبة من موقعك. أنشئ طلب رحلة لتصلك اقتراحات لاحقًا.") : t("اسمح للتطبيق باستخدام موقعك لعرض الرحلات المنشورة القريبة.")} action={tripOrigin ? "أنشئ طلب رحلة" : undefined} onAction={tripOrigin ? createFallbackRequest : undefined} />)}
    {selectedOffer && <div className="brand-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOffer(null); }}><section className="brand-confirm-dialog rider-trip-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="rider-trip-detail-title"><button type="button" className="rider-trip-detail-close" onClick={() => setSelectedOffer(null)} aria-label={t("إغلاق")}>×</button><span className="eyebrow">{t("تفاصيل الرحلة المنشورة")}</span><h2 id="rider-trip-detail-title">{t("رحلة مع الكابتن")} {selectedOffer.captain_name}</h2><div className="rider-trip-detail-route"><strong>{selectedOffer.origin_label}</strong><span aria-hidden="true">←</span><strong>{selectedOffer.destination_label}</strong></div><dl><div><dt>{t("نوع المركبة")}</dt><dd>{vehicleTypeLabel(selectedOffer.vehicle_type_id)}</dd></div><div><dt>{t(selectedOffer.direction === "return" ? "وقت العودة" : "وقت الانطلاق")}</dt><dd>{selectedOffer.arrival_time.slice(0, 5)}</dd></div><div><dt>{t("التاريخ القادم")}</dt><dd>{formatDate(nextServiceDate(selectedOffer.service_days))}</dd></div><div><dt>{t("مقاعد متاحة")}</dt><dd>{selectedOffer.seats}</dd></div><div><dt>{t("سعر المقعد")}</dt><dd>{money(Number(selectedOffer.price_per_seat))}</dd></div><div><dt>{t("المسافة من نقطة انطلاقك")}</dt><dd>{selectedOffer.pickup_distance_km} {t("كم")}</dd></div></dl><div className="location-search-stack"><LocationSearchField kind="pickup" title={t("نقطة الركوب")} value={lineJoinPickupSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setLineJoinPickupSearch(value); setLineJoinPickup(null); }} onSelect={(point) => { setLineJoinPickup(point); setLineJoinPickupSearch(point.label ?? ""); }} onChooseMap={() => chooseLineJoinMap("pickup")} onFocus={() => undefined} pointSelected={hasSelectedPoint(lineJoinPickup)} /><LocationSearchField kind="dropoff" title={t("نقطة النزول")} value={lineJoinDropoffSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setLineJoinDropoffSearch(value); setLineJoinDropoff(null); }} onSelect={(point) => { setLineJoinDropoff(point); setLineJoinDropoffSearch(point.label ?? ""); }} onChooseMap={() => chooseLineJoinMap("dropoff")} onFocus={() => undefined} pointSelected={hasSelectedPoint(lineJoinDropoff)} /></div>{lineJoinMapOpen && <section className="booking-map-panel" aria-label={t("اختيار الموقع من الخريطة")}><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد")} {lineJoinMapMode === "pickup" ? t("نقطة الركوب") : t("نقطة النزول")} {t("على الخريطة")}</p><button type="button" className="map-close-button" onClick={() => setLineJoinMapOpen(false)} aria-label={t("إغلاق الخريطة")}>×</button></div><div className="booking-map"><MapPicker pickup={lineJoinPickup} dropoff={lineJoinDropoff} mode={lineJoinMapMode} direction={selectedOffer.direction} restrictToGreaterCairo routePlaces={[{ lat: selectedOffer.origin_lat, lng: selectedOffer.origin_lng, kind: "pickup" as const, sequence: 0 }, ...(selectedOffer.intermediate_stops ?? []).map((stop, index) => ({ ...stop, kind: "pickup" as const, sequence: index + 1 })), { lat: selectedOffer.destination_lat, lng: selectedOffer.destination_lng, kind: "dropoff" as const, sequence: (selectedOffer.intermediate_stops ?? []).length + 1 }]} onOutsidePick={() => notify(t("اختار نقطة داخل القاهرة الكبرى فقط."), "error")} onPick={(mode, point) => { if (mode === "pickup") { setLineJoinPickup(point); setLineJoinPickupSearch(point.label ?? ""); } else { setLineJoinDropoff(point); setLineJoinDropoffSearch(point.label ?? ""); } setLineJoinMapOpen(false); }} /></div></section>}<p>{t("سيُرسل طلب انضمام للكابتن على الرحلة والتاريخ المحددين، ويمكنك متابعة الرد في طلباتي.")}</p><footer><button type="button" className="button button-outline" onClick={() => setSelectedOffer(null)}>{t("رجوع للرحلات")}</button><button type="button" className="button button-primary" onClick={() => void requestSelectedLine()} disabled={lineJoinSubmitting || !hasSelectedPoint(lineJoinPickup) || !hasSelectedPoint(lineJoinDropoff)}>{lineJoinSubmitting ? t("جارٍ إرسال طلب الانضمام…") : t("طلب الانضمام للرحلة")} <span aria-hidden="true">←</span></button></footer></section></div>}
  </div>;
  return <div className="dashboard-grid rider-dashboard rider-home-experience">
    <section className="dashboard-main">{dataErrorBanner}
      {welcomeBanner}
      <section className="rider-overview-strip" aria-label={t("ملخص مشاويرك")}>
        <button type="button" onClick={() => { setRiderTripsTab("myTrips"); setSection("trips"); }}><span className="rider-overview-icon"><AppIcon name="trips" size={18} /></span><span><small>{t("رحلاتي المجدولة")}</small><strong>{visibleGroups.length}</strong></span></button>
        <button type="button" onClick={() => setSection("requests")}><span className="rider-overview-icon"><AppIcon name="inbox" size={18} /></span><span><small>{t("طلبات نشطة")}</small><strong>{demandRequests.filter(({ status }) => status === "open" || status === "matched").length}</strong></span></button>
        <button type="button" onClick={() => { setRiderTripsTab("myTrips"); setSection("trips"); }}><span className="rider-overview-icon"><AppIcon name="calendar" size={18} /></span><span><small>{t("مواعيد رحلاتي")}</small><strong>{allTrips.length}</strong></span></button>
      </section>
      <section className="rider-shortcuts"><div className="rider-section-heading"><div><span className="eyebrow">{t("أماكنك المعتادة")}</span><h2>{t("ابدأ من مكانك المفضل")}</h2></div><button type="button" className="text-action" onClick={() => setSection("account")}>{t("إدارة الأماكن")}</button></div>{savedPlaces.length ? <div className="rider-place-list">{savedPlaces.map((place) => <button type="button" className="rider-place-chip" key={`${place.place_type}-${place.label}`} onClick={() => openBooking("new", undefined, place)}><span className="rider-place-icon">{place.place_type === "home" ? "⌂" : place.place_type === "work" ? "▦" : "⌖"}</span><span><small>{place.place_type === "home" ? t("المنزل") : place.place_type === "work" ? t("العمل") : t("مكان محفوظ")}</small><strong>{place.label}</strong></span><b aria-hidden="true">←</b></button>)}</div> : <div className="rider-saved-empty"><span aria-hidden="true">⌖</span><p>{t("احفظ المنزل أو العمل لتبدأ البحث بسرعة في المرة القادمة.")}</p><button type="button" className="button button-outline button-small" onClick={() => setSection("account")}>{t("إضافة مكان محفوظ")}</button></div>}</section>
      <section className="rider-home-discovery-carousel" aria-label={t("عروض وتنبيهات واقتراحات") } aria-live="polite">
        <div className="rider-promo-mark"><AppIcon name={selectedPromo.icon} size={21} /><span>{selectedPromo.eyebrow}</span><i /></div>
        <div className="rider-promo-content" key={homeSlide}><h2>{selectedPromo.title}</h2><p>{selectedPromo.body}</p><button type="button" className="button button-primary" onClick={selectedPromo.onAction}>{selectedPromo.action}<span aria-hidden="true"> ←</span></button></div>
        <div className="rider-promo-pagination" role="group" aria-label={t("شرائح الاقتراحات")}>{homePromoSlides.map((slide, index) => <button type="button" key={slide.eyebrow} className={homeSlide === index ? "is-active" : ""} aria-label={`${t("اقتراح")} ${index + 1}`} aria-pressed={homeSlide === index} onClick={() => setHomeSlide(index)} />)}</div>
      </section>
    </section>
  </div>;
}

