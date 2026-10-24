import { getDirection, t } from "../i18n/runtime";
import AppIcon from "../components/AppIcon";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import MapPicker from "../components/MapPickerLoader";

import type { MapPickMode, MapPoint } from "../MapPicker";
import LocationSearchField from "../components/LocationSearchField";
import TimePicker12h, { formatTime12h } from "../components/TimePicker12h";
import RiderDemandFlow from "./RiderDemandFlow";
import { categoryName, errorText, formatDate, money } from "../lib/formatters";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { reverseGeocode } from "../lib/location-address";
import { subscribeToDeviceLocation } from "../lib/device-location";
import { api, type Category, type GroupView, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { defaultDates, isServiceDay, serviceDatesFromStart, shiftDate, todayInCairo } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import {
  AccountPanel, EmptyState, ErrorState, GroupDetail, GroupSummary, LoadingCard, TripList,
} from "../components/workspace-shared";

const hasSelectedPoint = (point: MapPoint | null) =>
  typeof point?.lat === "number" && Number.isFinite(point.lat) &&
  typeof point?.lng === "number" && Number.isFinite(point.lng);
type RiderLineOffer = {
  id: number; vehicle_type_id: "private_car" | "hiace"; origin_label: string; origin_lat: number; origin_lng: number;
  destination_label: string; destination_lat: number; destination_lng: number; arrival_time: string; service_days: number[];
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
export default function RiderWorkspace({ session, section, setSection, refreshNotifications, registerPoolRefresh, notify, onInitialReady }: {
  session: Session; section: NavKey; setSection: (section: NavKey, historyMode?: "push" | "replace") => void;
  refreshNotifications: () => Promise<void>; registerPoolRefresh: (refresh: () => Promise<void>) => void; notify: (text: string, tone?: Toast["tone"]) => void;
  onInitialReady: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [tripOrigin, setTripOrigin] = useState<MapPoint | null>(null);
  const [tripDestination, setTripDestination] = useState<MapPoint | null>(null);
  const [tripOriginSearch, setTripOriginSearch] = useState("");
  const [tripDestinationSearch, setTripDestinationSearch] = useState("");
  const [tripOffers, setTripOffers] = useState<RiderLineOffer[]>([]);
  const [tripOffersLoading, setTripOffersLoading] = useState(false);
  const [tripOffersError, setTripOffersError] = useState("");
  const [tripSearchNonce, setTripSearchNonce] = useState(0);
  const [tripMapOpen, setTripMapOpen] = useState(false);
  const [tripMapTarget, setTripMapTarget] = useState<MapPickMode>("pickup");
  const [homeSlide, setHomeSlide] = useState(0);
  const tripOriginSource = useRef<"device" | "saved" | "manual" | null>(null);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [demandRequests, setDemandRequests] = useState<{ id: number; pickup_label: string; dropoff_label: string; trip_date: string; arrival_time: string; return_arrival_time?: string | null; vehicle_type_id: string; status: string; demand_groups?: { status: string; captain_line_id: number | null } | null; line?: { origin_label: string; destination_label: string; arrival_time: string; return_arrival_time?: string | null; price_per_seat: number; captain_name: string } | null }[]>([]);
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
    setEditingGroupId(null);
    if (mode === "new") { setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily")); setBookingTripDate(defaultDates("daily")[0] ?? ""); setBookingArrivalTime("08:00"); setBookingReturnArrivalTime(""); setBookingPickup(savedPickup ? { lat: savedPickup.lat, lng: savedPickup.lng, label: savedPickup.label, primaryLabel: savedPickup.label, kind: "pickup" } : null); }
    if (mode === "join") {
      setInviteCode(prefill ? String(prefill.groupId) : "");
      setPickup(prefill?.pickup ?? null); setDropoff(prefill?.dropoff ?? null);
      setPickupSearch(prefill?.pickup.label ?? ""); setDropoffSearch(prefill?.dropoff.label ?? "");
    }
    setBookingStep("route");
    setPriceInfoOpen(false);
    setSection("booking");
  };
  const openCaptainOffer = (line: RiderLineOffer) => {
    const origin = { lat: line.origin_lat, lng: line.origin_lng, label: line.origin_label, primaryLabel: line.origin_label, kind: "pickup" as const };
    const destination = { lat: line.destination_lat, lng: line.destination_lng, label: line.destination_label, primaryLabel: line.destination_label, kind: "dropoff" as const };
    setBookingMode("new"); setEditingGroupId(null); setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily"));
    setBookingTripDate(nextServiceDate(line.service_days)); setBookingArrivalTime(line.arrival_time.slice(0, 5)); setBookingReturnArrivalTime("");
    setBookingPickup(origin); setPickup(origin); setDropoff(destination); setPickupSearch(line.origin_label); setDropoffSearch(line.destination_label);
    setSection("booking"); window.scrollTo({ top: 0, behavior: "smooth" });
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
  useEffect(() => subscribeToDeviceLocation((location) => {
    if (!location) {
      if (tripOriginSource.current !== "device") return;
      tripOriginSource.current = null;
      const home = savedPlaces.find((place) => place.place_type === "home") ?? savedPlaces[0];
      setTripOrigin(home ? { lat: home.lat, lng: home.lng, label: home.label, primaryLabel: home.label, kind: "pickup" } : null);
      setTripOriginSearch(home?.label ?? "");
      if (home) tripOriginSource.current = "saved";
      return;
    }
    if (tripOriginSource.current === "manual") return;
    tripOriginSource.current = "device";
    const label = t("موقعي الحالي");
    setTripOrigin({ lat: location.lat, lng: location.lng, label, primaryLabel: label, kind: "pickup" });
    setTripOriginSearch(label);
  }), [savedPlaces]);
  useEffect(() => {
    if (tripOriginSource.current || !savedPlaces.length) return;
    const home = savedPlaces.find((place) => place.place_type === "home") ?? savedPlaces[0];
    if (!home) return;
    tripOriginSource.current = "saved";
    setTripOrigin({ lat: home.lat, lng: home.lng, label: home.label, primaryLabel: home.label, kind: "pickup" });
    setTripOriginSearch(home.label);
  }, [savedPlaces]);
  useEffect(() => {
    if (section !== "home" && section !== "trips") return;
    if (tripOrigin?.lat == null || tripOrigin.lng == null) { setTripOffers([]); setTripOffersError(""); setTripOffersLoading(false); return; }
    if (!isInsideGreaterCairo(tripOrigin.lat, tripOrigin.lng) || (tripDestination?.lat != null && tripDestination.lng != null && !isInsideGreaterCairo(tripDestination.lat, tripDestination.lng))) {
      setTripOffers([]); setTripOffersError(t("المشاوير متاحة داخل القاهرة الكبرى فقط.")); setTripOffersLoading(false); return;
    }
    let active = true;
    setTripOffersLoading(true);
    setTripOffersError("");
    const params = new URLSearchParams({ pickup_lat: String(tripOrigin.lat), pickup_lng: String(tripOrigin.lng) });
    if (tripDestination?.lat != null && tripDestination.lng != null) {
      params.set("dropoff_lat", String(tripDestination.lat)); params.set("dropoff_lng", String(tripDestination.lng));
    }
    void api<{ lines: RiderLineOffer[] }>(`/rider/lines/discover?${params.toString()}`, { token: session.token })
      .then((result) => { if (active) setTripOffers(result.lines ?? []); })
      .catch((error) => { if (active) setTripOffersError(errorText(error)); })
      .finally(() => { if (active) setTripOffersLoading(false); });
    return () => { active = false; };
  }, [section, tripOrigin?.lat, tripOrigin?.lng, tripDestination?.lat, tripDestination?.lng, tripSearchNonce, session.token]);
  useEffect(() => {
    if (section !== "home") return;
    const timer = window.setInterval(() => setHomeSlide((current) => (current + 1) % 3), 6500);
    return () => window.clearInterval(timer);
  }, [section]);
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
  const homePromoSlides = [
    { icon: "route" as const, eyebrow: t("ترشيح قريب منك"), title: nearestOffer ? `${nearestOffer.origin_label} ← ${nearestOffer.destination_label}` : t("رحلات تناسب نقطة انطلاقك"), body: nearestOffer ? `${t("مع")} ${nearestOffer.captain_name} · ${t("للمقعد")} ${money(Number(nearestOffer.price_per_seat))} ${t("ج.م")}` : tripOffersLoading ? t("جارٍ البحث عن رحلات قريبة من موقعك.") : t("حدد نقطة انطلاقك لتظهر لك الرحلات المنشورة القريبة."), action: t("اكتشف الرحلات"), onAction: () => setSection("trips") },
    { icon: "inbox" as const, eyebrow: t("تنبيه طلباتك"), title: activeRequests.length ? t("عندك طلبات قيد المتابعة") : t("تابع طلبات رحلاتك"), body: activeRequests.length ? `${activeRequests.length} ${t("طلبات نشطة، وسنخبرك عند العثور على رحلة مناسبة.")}` : t("احتفظ بطلبات رحلاتك وتابع تحديثاتها من مكان واحد."), action: activeRequests.length ? t("عرض طلباتي") : t("ابدأ طلب رحلة"), onAction: () => activeRequests.length ? setSection("requests") : openBooking("new") },
    { icon: "home" as const, eyebrow: t("اقتراح لك"), title: favoritePlace ? `${t("ابدأ من مكانك المعتاد")}: ${favoritePlace.label}` : t("احفظ أماكنك المعتادة"), body: favoritePlace ? t("اختار مكانك المحفوظ وابدأ البحث عن رحلة أسرع.") : t("إضافة المنزل أو العمل تسهّل عليك تحديد نقطة الانطلاق كل مرة."), action: favoritePlace ? t("ابحث من هذا المكان") : t("إضافة مكان محفوظ"), onAction: () => favoritePlace ? openBooking("new", undefined, favoritePlace) : setSection("account") },
  ];
  const selectedPromo = homePromoSlides[homeSlide % homePromoSlides.length]!;

  const openDemandCount = demandRequests.filter((request) => request.status === "open").length;
  const matchedDemandCount = demandRequests.filter((request) => request.status === "matched").length;
  const closedDemandCount = demandRequests.filter((request) => request.status === "cancelled" || request.status === "expired").length;
  const visibleDemandRequests = demandRequests.filter((request) => requestFilter === "all" || (requestFilter === "closed" ? request.status === "cancelled" || request.status === "expired" : request.status === requestFilter));
  const requestCards = <div className="rider-request-list">{visibleDemandRequests.map((request) => <article className="surface rider-request-card" key={request.id}><div className="rider-request-card-top"><span className={`status-chip status-${request.status}`}>{request.status === "matched" ? t("تم العثور على رحلة") : request.status === "open" ? t("بانتظار رحلة مناسبة") : request.status === "cancelled" ? t("ملغي") : t("منتهي")}</span><span>{request.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</span><time>{formatDate(request.trip_date)} · {request.arrival_time.slice(0, 5)}{request.return_arrival_time ? ` · ${t("عودة")} ${request.return_arrival_time.slice(0, 5)}` : ""}</time></div><div className="rider-request-route"><span className="rider-route-timeline" aria-hidden="true"><i /><b /><i /></span><div><strong>{request.pickup_label}</strong><strong>{request.dropoff_label}</strong></div></div><p className="rider-request-note">{request.status === "matched" ? t("تمت مطابقة طلبك. راجع تفاصيل الرحلة أدناه.") : request.status === "open" ? t("طلبك مسجل ونبحث عن رحلة منشورة أو طلبات مشابهة تناسبه.") : request.status === "cancelled" ? t("ألغيت هذا الطلب.") : t("انتهت مدة هذا الطلب.")}</p>{request.line && <div className="rider-match-summary"><strong>{t("الرحلة التي طابقت طلبك")}: {request.line.origin_label} ← {request.line.destination_label}</strong><span>{request.line.captain_name} · {t("· وصول")} {request.line.arrival_time.slice(0, 5)}{request.return_arrival_time && request.line.return_arrival_time ? ` · ${t("عودة")} ${request.line.return_arrival_time.slice(0, 5)}` : ""} · {money(Number(request.line.price_per_seat))} {t("للمقعد")}</span></div>}</article>)}</div>;

  if (section === "account") return <div className="rider-account-experience">{dataErrorBanner}<section className="rider-profile-heading"><div><span className="eyebrow">{t("حسابك في سِكّة")}</span><h2>{t("الملف الشخصي والإعدادات")}</h2><p>{t("إدارة بيانات حسابك وأماكنك المحفوظة.")}</p></div></section><AccountPanel session={session} notify={notify} /></div>;

  if (section === "requests") return <div className="rider-requests-page">{dataErrorBanner}<section className="rider-section-intro"><span className="eyebrow">{t("طلبات أنشأتها بعد البحث")}</span><h2>{t("طلباتي")}</h2><p>{t("هنا تتابع الطلبات التي سجلتها عندما لم تجد رحلة منشورة مناسبة. إذا تطابقت مع رحلة أو طلبات مشابهة ستظهر لك آخر التحديثات هنا.")}</p><button type="button" className="button button-outline button-small" onClick={() => setSection("trips")}>{t("تصفح الرحلات المنشورة")}</button></section>{demandRequests.length ? <><section className="rider-request-overview" aria-label={t("ملخص طلباتك")}><div><span>{t("بانتظار المطابقة")}</span><strong>{openDemandCount}</strong></div><div><span>{t("تمت مطابقتها")}</span><strong>{matchedDemandCount}</strong></div><div><span>{t("منتهية أو ملغاة")}</span><strong>{closedDemandCount}</strong></div></section><div className="rider-request-filters" role="group" aria-label={t("تصفية الطلبات")}>{([["all", t("كل الطلبات"), demandRequests.length], ["open", t("قيد البحث"), openDemandCount], ["matched", t("تمت مطابقتها"), matchedDemandCount], ["closed", t("المنتهية"), closedDemandCount]] as const).map(([filter, label, count]) => <button type="button" key={filter} aria-pressed={requestFilter === filter} className={requestFilter === filter ? "is-active" : ""} onClick={() => setRequestFilter(filter)}>{label}<span>{count}</span></button>)}</div>{visibleDemandRequests.length ? requestCards : <EmptyState icon="inbox" title={t("لا توجد طلبات في هذا التصنيف")} text={t("اختر تصنيفًا آخر لمتابعة طلباتك.")} />}</> : initialLoadError ? null : <EmptyState icon="inbox" title={t("لم تسجل طلب رحلة بعد")} text={t("طلباتك تظهر هنا بعد البحث عن الرحلات المنشورة وعدم العثور على رحلة مناسبة ثم تسجيل طلبك.")} action="اكتشف الرحلات المتاحة" onAction={() => setSection("trips")} />}</div>;

  if (section === "booking" && bookingMode !== "edit") return <><RiderDemandFlow session={session} notify={notify} onBack={() => setSection("home")} onOpenRequests={() => setSection("requests")} onRequestCreated={refreshDemandRequests} initialPickup={bookingPickup ?? pickup} initialDropoff={dropoff} initialTripDate={bookingTripDate} initialArrivalTime={bookingArrivalTime} initialReturnArrivalTime={bookingReturnArrivalTime} savedPlaces={savedPlaces} />{dataErrorBanner}</>;
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
  const riderTripTabs = <div className="rider-trip-tabs" role="group" aria-label={t("نوع الرحلات")}>
    <button type="button" aria-pressed={riderTripsTab === "discover"} className={riderTripsTab === "discover" ? "is-active" : ""} onClick={() => { setSelectedGroup(null); setRiderTripsTab("discover"); }}><span>{t("الرحلات المتاحة")}<small>{t("منشورة من الكباتن")}</small></span><b>{tripOffersLoading ? "…" : tripOffers.length}</b></button>
    <button type="button" aria-pressed={riderTripsTab === "myTrips"} className={riderTripsTab === "myTrips" ? "is-active" : ""} onClick={() => setRiderTripsTab("myTrips")}><span>{t("رحلاتي المجدولة")}<small>{t("الرحلات التي انضممت إليها")}</small></span><b>{visibleGroups.length}</b></button>
  </div>;
  if (section === "trips" && riderTripsTab === "myTrips") return <div className="trips-page rider-trips-experience">
    {riderTripTabs}
    {selected ? <><button type="button" className="button button-quiet button-small trips-back-to-groups" onClick={() => setSelectedGroup(null)}>{t("→ رجوع لمجموعاتي")}</button><GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onEdit={() => startEditingGroup(selected)} currentUserId={session.user.id} token={session.token} /></> : visibleGroups.length ? <section className="group-list trips-group-list" aria-label={t("مجموعات مشاويرك")}>{visibleGroups.map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => setSelectedGroup(view.group.id)} />)}</section> : <EmptyState icon="trips" title={t("لسه مفيش رحلات مجدولة")} text={t("بعد إرسال طلب رحلة أو الانضمام لمجموعة ستظهر رحلاتك هنا.")} action="اكتشف رحلات الكباتن" onAction={() => setRiderTripsTab("discover")} />}
    {allTrips.length > 0 && <section className="all-trips-section"><div className="section-title-row"><div><h2>{t("مواعيد رحلاتك")}</h2><p>{t("كل مواعيد الذهاب والعودة لرحلاتك")}</p></div><span className="section-count">{allTrips.length}</span></div><TripList trips={allTrips} categories={categories} /></section>}
  </div>;
  if (section === "trips") return <div className="trips-page rider-trips-experience">
    {dataErrorBanner}
    {riderTripTabs}
    <section className="rider-section-intro"><span className="eyebrow">{t("رحلات منشورة من الكباتن")}</span><h2>{t("الرحلات المتاحة")}</h2><p>{t("ابحث عن رحلة منشورة تناسب نقطة انطلاقك ووصولك. إذا لم تجد رحلة مناسبة، يمكنك تسجيل طلبك ليظهر في طلباتي.")}</p></section>
    <section className="rider-trip-discovery surface">
      <div className="rider-trip-discovery-fields">
        <LocationSearchField kind="pickup" title={t("نقطة الانطلاق")} value={tripOriginSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { tripOriginSource.current = value ? "manual" : null; setTripOriginSearch(value); setTripOrigin(null); }} onSelect={(point) => { tripOriginSource.current = "manual"; setTripOrigin(point); setTripOriginSearch(point.label ?? ""); }} onChooseMap={() => { setTripMapTarget("pickup"); setTripMapOpen(true); }} onFocus={() => undefined} pointSelected={hasSelectedPoint(tripOrigin)} />
        <LocationSearchField kind="dropoff" title={t("نقطة الوصول (اختياري)")} value={tripDestinationSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setTripDestinationSearch(value); setTripDestination(null); }} onSelect={(point) => { setTripDestination(point); setTripDestinationSearch(point.label ?? ""); }} onChooseMap={() => { setTripMapTarget("dropoff"); setTripMapOpen(true); }} onFocus={() => undefined} pointSelected={hasSelectedPoint(tripDestination)} />
      </div>
      <div className="rider-trip-discovery-actions"><span>{tripOriginSource.current === "device" ? t("نعرض الرحلات القريبة من موقعك الحالي.") : t("حدد نقطة الانطلاق أو اختر مكانًا محفوظًا.")}</span><button type="button" className="button button-primary" disabled={!hasSelectedPoint(tripOrigin) || tripOffersLoading} onClick={() => setTripSearchNonce((value) => value + 1)}>{tripOffersLoading ? t("جارٍ البحث عن رحلات مناسبة…") : t("＋ ابحث عن رحلة")}</button></div>
      {tripMapOpen && <div className="booking-map"><div className="booking-map-toolbar"><p className="map-instruction">{t("حدد نقطة الانطلاق أو الوصول على الخريطة")}</p><button type="button" className="map-close-button" onClick={() => setTripMapOpen(false)} aria-label={t("إغلاق الخريطة")}>×</button></div><MapPicker pickup={tripOrigin} dropoff={tripDestination} mode={tripMapTarget} restrictToGreaterCairo onOutsidePick={() => notify(t("اختار نقطة داخل القاهرة الكبرى فقط."), "error")} onPick={(mode, point) => { if (mode === "pickup") { tripOriginSource.current = "manual"; setTripOrigin(point); setTripOriginSearch(point.label ?? ""); } else { setTripDestination(point); setTripDestinationSearch(point.label ?? ""); } setTripMapOpen(false); }} /></div>}
    </section>
    {tripOffersLoading && <LoadingCard text="جارٍ البحث عن رحلات مناسبة…" />}
    {tripOffersError && <ErrorState title={t("تعذر تحميل الرحلات")} text={tripOffersError} action="إعادة المحاولة" onAction={() => setTripSearchNonce((value) => value + 1)} />}
    {!tripOffersLoading && !tripOffersError && (tripOffers.length ? <section className="rider-trip-offer-list" aria-label={t("الرحلات المناسبة")}>
      <div className="rider-section-heading"><div><span className="eyebrow">{t("رحلات الكباتن المطابقة لبحثك")}</span><h2>{t("الرحلات المناسبة لك")}</h2></div><span className="section-count">{tripOffers.length}</span></div>
      {tripOffers.map((line) => <article className="surface rider-trip-offer" key={line.id}>
        <div className="rider-trip-offer-top"><span className="rider-trip-offer-captain"><AppIcon name="user" size={16} />{line.captain_name}{line.captain_verified && <b aria-label={t("كابتن موثق")}>✓</b>}</span><span>{line.vehicle_type_id === "hiace" ? t("هاي إس") : t("ملاكي")}</span></div>
        <div className="rider-trip-offer-route"><span><i /><b />{line.origin_label}</span><span><i />{line.destination_label}</span></div>
        <div className="rider-trip-offer-meta"><span>{t("وقت الانطلاق")} · {line.arrival_time.slice(0, 5)}</span><span>{line.seats} {t("مقاعد")}</span><strong>{money(Number(line.price_per_seat))} {t("للمقعد")}</strong></div>
        <small className="rider-trip-distance">{t("نقطة انطلاقك تبعد")} {line.pickup_distance_km} {t("كم")}{tripDestination && ` · ${t("نقطة وصولك تبعد")} ${line.dropoff_distance_km} ${t("كم")}`}</small>
        <button type="button" className="button button-primary rider-trip-offer-action" onClick={() => openCaptainOffer(line)}>{t("ابحث عن رحلة على هذا المسار")} <span aria-hidden="true">←</span></button>
      </article>)}
    </section> : <EmptyState icon="route" title={tripOrigin ? t("لم نجد رحلة منشورة تناسب بحثك") : t("حدد نقطة انطلاق لعرض الرحلات")} text={tripOrigin ? t("غيّر نقطة الانطلاق أو الوصول وحاول البحث مرة أخرى. وإذا لم تجد رحلة مناسبة، سجّل طلبًا ليظهر في صفحة طلباتي.") : t("لو وافقت على استخدام موقعك هنقترح الرحلات القريبة، أو اختار مكان الانطلاق يدويًا.")} action={tripOrigin ? "سجّل طلب رحلة" : undefined} onAction={tripOrigin ? () => { openBooking("new"); setPickup(tripOrigin); setPickupSearch(tripOrigin.label ?? ""); setDropoff(tripDestination); setDropoffSearch(tripDestination?.label ?? ""); } : undefined} />)}
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

