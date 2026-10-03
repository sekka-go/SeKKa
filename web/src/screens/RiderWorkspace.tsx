import { useCallback, useEffect, useState, type FormEvent } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "../MapPicker";
import RiderCommuterBoard from "../components/RiderCommuterBoard";
import LocationSearchField from "../components/LocationSearchField";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { api, type Category, type GroupView, type Notification, type RiderCommuterPreferences, type SavedPlace } from "../api";
import { defaultDates, isServiceDay, serviceDatesFromStart } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import {
  AccountPanel, EmptyState, GroupDetail, GroupSummary, LoadingCard,
  NotificationsPanel, TripList,
} from "../components/workspace-shared";

const hasSelectedPoint = (point: MapPoint | null) =>
  typeof point?.lat === "number" && Number.isFinite(point.lat) &&
  typeof point?.lng === "number" && Number.isFinite(point.lng);
export default function RiderWorkspace({ session, section, setSection, notifications, notificationsLoading, refreshNotifications, notify }: {
  session: Session; section: NavKey; setSection: (section: NavKey, historyMode?: "push" | "replace") => void; notifications: Notification[];
  notificationsLoading: boolean;
  refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"new" | "join" | "edit">("new");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [bookingStep, setBookingStep] = useState<"route" | "schedule" | "review">("route");
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
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const selected = groups.find((view) => view.group.id === selectedGroup) ?? null;
  const priceLabel = (type: "daily" | "weekly" | "monthly", selectedCategoryId = categoryId) => {
    const selectedQuote = selectedCategoryId ? priceQuotes?.[selectedCategoryId] : null;
    if (selectedQuote) return money(selectedQuote[type]);
    return priceLoading ? "جارٍ حساب الأسعار…" : priceError ? "تعذر حساب السعر" : "السعر بعد تحديد الفئة";
  };

  const openBooking = (mode: "new" | "join", prefill?: { groupId: number; pickup: MapPoint; dropoff: MapPoint }) => {
    setBookingMode(mode);
    setEditingGroupId(null);
    if (mode === "new") { setCategoryId(""); setPackageType("daily"); setDates(defaultDates("daily")); }
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
      notify("يمكن تعديل مشوارك قبل انضمام ركاب آخرين وبدء تفعيله فقط.", "error");
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
    const nextPickup = { lat: member.pickup_lat, lng: member.pickup_lng, kind: "pickup" as const, label: String(member.pickup_lat) + ", " + String(member.pickup_lng) };
    const nextDropoff = { lat: member.dropoff_lat, lng: member.dropoff_lng, kind: "dropoff" as const, label: String(member.dropoff_lat) + ", " + String(member.dropoff_lng) };
    setPickup(nextPickup); setDropoff(nextDropoff);
    setPickupSearch(nextPickup.label); setDropoffSearch(nextDropoff.label);
    setSection("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueToSchedule = () => {
    const missing = [
      !hasSelectedPoint(pickup) ? "pickup" : null,
      !hasSelectedPoint(dropoff) ? "dropoff" : null,
    ].filter((kind): kind is "pickup" | "dropoff" => kind !== null);
    if (missing.length > 0) {
      const firstMissing = missing[0]!;
      const field = document.querySelector<HTMLElement>(`.location-search-${firstMissing}`);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      notify(`اختار نقطة ${firstMissing === "pickup" ? "الركوب" : "النزول"} من نتائج البحث أو حددها بالدبوس قبل المتابعة.`, "error");
      return;
    }
    if (!isInsideGreaterCairo(pickup!.lat!, pickup!.lng!) || !isInsideGreaterCairo(dropoff!.lat!, dropoff!.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    setBookingStep("schedule");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueToReview = () => {
    if (bookingMode === "join") {
      const groupId = Number(inviteCode);
      if (!Number.isInteger(groupId) || groupId < 1) { notify("اكتب رقم مجموعة صحيحًا قبل المتابعة.", "error"); return; }
      if (!hasSelectedPoint(pickup) || !hasSelectedPoint(dropoff)) { notify("اختار نقطة الركوب والوصول من نتائج البحث أو الخريطة.", "error"); return; }
      if (!isInsideGreaterCairo(pickup!.lat!, pickup!.lng!) || !isInsideGreaterCairo(dropoff!.lat!, dropoff!.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    } else {
      if (!categoryId) { notify("اختار الفئة قبل مراجعة المشوار.", "error"); return; }
      const expectedDates = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;
      if (dates.length !== expectedDates) { notify("راجع أيام الخدمة للباقة قبل المتابعة.", "error"); return; }
      if (!morning || !returnTime) { notify("حدد وقت الذهاب والعودة قبل المتابعة.", "error"); return; }
      if (!priceQuotes?.[categoryId] || priceLoading) { notify("انتظر اكتمال حساب السعر قبل مراجعة المشوار.", "info"); return; }
    }
    setBookingStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnToSchedule = () => {
    setBookingStep("schedule");
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
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ categories: Category[] }>("/pool/categories"),
      api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token }),
      api<{ places: SavedPlace[] }>("/rider/saved-places", { token: session.token }),
    ]).then(([categoryResult, groupResult, savedPlaceResult]) => {
      if (!active) return;
      setCategories(categoryResult.categories); setGroups(groupResult.groups ?? []); setSavedPlaces(savedPlaceResult.places ?? []);
    }).catch((error) => notify(errorText(error), "error")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.token, notify]);

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

  const refresh = async () => {
    try { await refreshGroups(); await refreshNotifications(); }
    catch (error) { notify(errorText(error), "error"); }
  };

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (bookingStep !== "review") {
      notify("راجع تفاصيل المشوار قبل تأكيد الإنشاء.", "error");
      return;
    }
    if (!pickup || !dropoff) { notify("اختار نقطة الركوب والنزول بالدبوس أو البحث أو الخريطة.", "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    if (!categoryId || dates.length !== (packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22)) { notify("اختار الفئة وتأكد من إعدادات الباقة قبل المتابعة.", "error"); return; }
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
    if (bookingStep !== "review") { notify("راجع رقم المجموعة ونقطتي الركوب والوصول قبل الانضمام.", "error"); return; }
    if (!pickup || !dropoff) { notify("اختار نقطتي الركوب والنزول بالدبوس أو البحث أو الخريطة.", "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    setSubmitting(true);
    try {
      const result = await api<{ group: { id: number } }>(`/rider/pool/groups/${Number(inviteCode)}/join`, { method: "POST", token: session.token,
        body: { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng } });
      await refreshGroups(); setSelectedGroup(result.group.id); setSection("trips", "replace"); setPickup(null); setDropoff(null); setInviteCode("");
      notify("انضممت للمجموعة بنجاح.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const groupAction = async (groupId: number, action: string, body?: unknown) => {
    setSubmitting(true);
    try {
      await api(`/rider/pool/groups/${groupId}/${action}`, { method: "POST", token: session.token, body });
      await refresh(); notify("تم تحديث المشوار.", "success");
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
    const label = `${point.lat?.toFixed(5)}, ${point.lng?.toFixed(5)}`;
    const selected = { ...point, label };
    if (mode === "pickup") { setPickup(selected); setPickupSearch(label); }
    else { setDropoff(selected); setDropoffSearch(label); }
  };

  if (loading) return <LoadingCard text="بنجهّز مساحة مشاويرك…" />;

  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={refresh} allowWaitActions notify={notify} isLoading={notificationsLoading} />;

  if (section === "booking") return <div className="booking-layout">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">{bookingMode === "join" ? "الانضمام لمجموعة" : `الخطوة ${bookingStep === "route" ? "الأولى · تحديد المسار" : bookingStep === "schedule" ? "الثانية · الموعد والفئة" : "الثالثة · المراجعة"}`}</span><h2>{bookingMode === "join" ? (bookingStep === "review" ? "راجع طلب الانضمام" : "انضم لمجموعة موجودة") : bookingStep === "route" ? "حدد نقطتي مشوارك" : bookingStep === "schedule" ? "اختار موعدك وفئتك" : "راجع تفاصيل مشوارك"}</h2><p>{bookingMode === "join" ? (bookingStep === "review" ? "تأكد من رقم المجموعة ونقطتي الركوب والوصول قبل إرسال الطلب." : "أدخل رقم المجموعة وحدد نقطتي الركوب والوصول.") : bookingStep === "route" ? "ابحث عن نقطة الركوب والوصول أو حددهما بالدبوس." : bookingStep === "schedule" ? "حدد التاريخ والوقت والباقات والفئة." : "راجع التفاصيل مرة واحدة، ويمكنك الرجوع لتعديل أي اختيار قبل الإنشاء."}</p></div><span className="surface-icon">{bookingMode !== "join" ? "⌖" : "＋"}</span></div>
      <div className="booking-stepper" aria-label={bookingMode === "join" ? "خطوات الانضمام للمجموعة" : "خطوات إنشاء المشوار"}>
        {bookingMode === "join" ? <>
          <button type="button" className={bookingStep === "route" ? "booking-step active" : "booking-step complete"} aria-current={bookingStep === "route" ? "step" : undefined} onClick={returnToRoute}><span>١</span><strong>البيانات</strong></button>
          <i className={bookingStep === "review" ? "complete" : ""} />
          <div className={bookingStep === "review" ? "booking-step active" : "booking-step"} aria-current={bookingStep === "review" ? "step" : undefined}><span>٢</span><strong>المراجعة</strong></div>
        </> : <>
          <button type="button" className={bookingStep === "route" ? "booking-step active" : "booking-step complete"} aria-current={bookingStep === "route" ? "step" : undefined} onClick={returnToRoute}><span>١</span><strong>النقط</strong></button>
          <i className={bookingStep === "schedule" || bookingStep === "review" ? "complete" : ""} />
          <button type="button" className={bookingStep === "schedule" ? "booking-step active" : bookingStep === "review" ? "booking-step complete" : "booking-step"} aria-current={bookingStep === "schedule" ? "step" : undefined} disabled={bookingStep === "route"} onClick={returnToSchedule}><span>٢</span><strong>الموعد والفئة</strong></button>
          <i className={bookingStep === "review" ? "complete" : ""} />
          <div className={bookingStep === "review" ? "booking-step active" : "booking-step"} aria-current={bookingStep === "review" ? "step" : undefined}><span>٣</span><strong>المراجعة</strong></div>
        </>}
      </div>
      <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        if (bookingStep !== "review") { notify("راجع البيانات أولًا قبل تأكيد العملية.", "info"); return; }
        if (bookingMode === "join") void joinGroup(event);
        else void createGroup(event);
      }}>
        {bookingStep === "route" && <>
        {bookingMode === "join" && <><label>رقم المجموعة<input type="number" min="1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="مثال: 124" required /></label><div className="info-note">لازم نقط الركوب والنزول تكون في حدود ٣ كم من مسار المجموعة.</div></>}
        <div className="location-search-stack">
          <LocationSearchField kind="pickup" title="نقطة الركوب" value={pickupSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setPickupSearch(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("pickup")} onFocus={() => undefined} pointSelected={hasSelectedPoint(pickup)} />
          <LocationSearchField kind="dropoff" title="نقطة النزول" value={dropoffSearch} token={session.token} savedPlaces={savedPlaces} onChange={(value) => { setDropoffSearch(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("dropoff")} onFocus={() => undefined} pointSelected={hasSelectedPoint(dropoff)} />
        </div>
        <small className="location-search-attribution">نتائج الأماكن من OpenStreetMap</small>
        {mapOpen && <section className="booking-map-panel" aria-label="اختيار الموقع من الخريطة">
          <div className="booking-map-toolbar">
            <p className="map-instruction">انقر أو اسحب الدبوس لتحديد {pickMode === "pickup" ? "نقطة الركوب" : "نقطة النزول"} · القاهرة الكبرى فقط</p>
            <button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label="إغلاق الخريطة">×</button>
          </div>
          <div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={pickMode} restrictToGreaterCairo onOutsidePick={() => notify("اختار نقطة داخل القاهرة الكبرى فقط.", "error")} onPick={setMapPoint} /></div>
        </section>}
        </>}
        {bookingMode !== "join" && bookingStep === "schedule" && <>
          <label>نوع الباقة<div className="package-options">
            {(["daily", "weekly", "monthly"] as const).map((type) => <button type="button" key={type} className={packageType === type ? "package-option selected" : "package-option"} onClick={() => { setPackageType(type); setDates(serviceDatesFromStart(dates[0] && isServiceDay(dates[0]) ? dates[0] : defaultDates(type)[0]!, type)); }}><strong>{type === "daily" ? "يومي" : type === "weekly" ? "أسبوعي" : "شهري"}</strong><small>{type === "daily" ? "يوم واحد" : type === "weekly" ? "٥ أيام خدمة · خصم ٥٪" : "٢٢ يوم خدمة · خصم ١٠٪"}</small><b>{priceLabel(type)}</b></button>)}
          </div></label>
          <div className="time-row"><label>وقت الذهاب<input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} required /></label><label>وقت العودة<input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required /></label></div>
          <section className="category-picker"><div className="field-heading"><strong>الفئة والسعر</strong><div className="category-heading-actions">{priceLoading && <span>جارٍ تحديث الأسعار…</span>}<button type="button" className="price-info-trigger" aria-label="معلومات عن الأسعار والباقات" aria-expanded={priceInfoOpen} onClick={() => setPriceInfoOpen((open) => !open)}>ⓘ</button></div></div>
            {priceInfoOpen && <div className="price-info-popover" role="note">الأسعار تقديرية للفرد. يبدأ الجدول تلقائيًا من يوم الخدمة القادم، مع استثناء الجمعة والسبت في الباقات الأسبوعية والشهرية.</div>}
            {priceError && <p className="price-error">{priceError}</p>}
            <div className="category-select-label" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCategoryMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setCategoryMenuOpen(false); }}>
              <span>اختار الفئة</span>
              <button type="button" className="category-select-trigger" aria-haspopup="listbox" aria-expanded={categoryMenuOpen} aria-controls="category-options" disabled={categories.length === 0} onClick={() => setCategoryMenuOpen((open) => !open)}>
                <span>{selectedCategory ? `${categoryName(selectedCategory)} · ${selectedCategory.seats} مقاعد` : categories.length > 0 ? "اختر الفئة للمتابعة" : "لا توجد فئات متاحة"}</span>
                <strong>{priceLabel(packageType, selectedCategory?.id ?? "")}</strong>
                <span className="category-select-chevron" aria-hidden="true">{categoryMenuOpen ? "⌃" : "⌄"}</span>
              </button>
              {categoryMenuOpen && <div className="category-select-options" id="category-options" role="listbox" aria-label="الفئات المتاحة">
                {categories.map((category) => {
                  const quote = priceQuotes?.[category.id];
                  const fare = quote ? money(quote[packageType]) : priceLoading ? "جارٍ حساب السعر…" : priceError ? "تعذر حساب السعر" : "السعر غير متاح";
                  const chosen = category.id === categoryId;
                  return <button type="button" key={category.id} role="option" aria-selected={chosen} className={chosen ? "category-select-option selected" : "category-select-option"} onClick={() => { setCategoryId(category.id); setCategoryMenuOpen(false); }}>
                    <span><strong>{categoryName(category)}</strong><small>{category.seats} مقاعد · {category.speed_tier === "faster" ? "Faster" : "Saver"}</small></span>
                    <b>{fare}</b>
                  </button>;
                })}
              </div>}
            </div>
            
          </section>
        </>}
        {bookingStep === "review" && <section className="booking-review" aria-labelledby="booking-review-title">
          <div className="booking-review-heading"><div><span className="eyebrow">ملخص قبل التأكيد</span><h3 id="booking-review-title">تأكد من بيانات المشوار</h3></div><span className="status-chip status-waiting">مراجعة</span></div>
          {bookingMode === "join" ? <>
            <div className="booking-review-row"><span>رقم المجموعة</span><strong>#{inviteCode}</strong></div>
            <div className="booking-review-row"><span>نقطة الركوب</span><strong>{pickup?.label || "لم يتم تحديدها"}</strong><button type="button" className="text-action" onClick={returnToRoute}>تعديل</button></div>
            <div className="booking-review-row"><span>نقطة الوصول</span><strong>{dropoff?.label || "لم يتم تحديدها"}</strong><button type="button" className="text-action" onClick={returnToRoute}>تعديل</button></div>
            <p className="booking-review-note">سيُرسل طلب الانضمام للمجموعة بعد تأكيدك.</p>
          </> : <>
            <div className="booking-review-section"><div className="booking-review-section-title"><strong>المسار</strong><button type="button" className="text-action" onClick={returnToRoute}>تعديل</button></div>
              <div className="booking-review-row"><span>نقطة الركوب</span><strong>{pickup?.label || "لم يتم تحديدها"}</strong></div>
              <div className="booking-review-row"><span>نقطة الوصول</span><strong>{dropoff?.label || "لم يتم تحديدها"}</strong></div>
            </div>
            <div className="booking-review-section"><div className="booking-review-section-title"><strong>الموعد والفئة</strong><button type="button" className="text-action" onClick={returnToSchedule}>تعديل</button></div>
              <div className="booking-review-row"><span>الباقة</span><strong>{packageType === "daily" ? "يومية" : packageType === "weekly" ? "أسبوعية" : "شهرية"} · {dates.length} {dates.length === 1 ? "يوم خدمة" : "أيام خدمة"}</strong></div>
              <div className="booking-review-row"><span>أول موعد خدمة</span><strong>{dates[0] ? formatDate(dates[0]) : "—"}</strong></div>
              <div className="booking-review-row"><span>وقت الذهاب والعودة</span><strong>{morning} · {returnTime}</strong></div>
              <div className="booking-review-row"><span>الفئة</span><strong>{selectedCategory ? `${categoryName(selectedCategory)} · ${selectedCategory.seats} مقاعد` : "لم يتم تحديدها"}</strong></div>
              <div className="booking-review-total"><span>السعر التقديري للفرد / يوم</span><strong>{priceLabel(packageType)}</strong></div>
            </div>
            <p className="booking-review-note">لن يتم إنشاء المجموعة إلا بعد الضغط على زر التأكيد أدناه.</p>
          </>}
        </section>}
        {bookingStep === "route" && bookingMode !== "join" && <button type="button" className="button button-primary button-wide" onClick={continueToSchedule}>التالي · الموعد والفئة <span>←</span></button>}
        {bookingStep === "route" && bookingMode === "join" && <button type="button" className="button button-primary button-wide" onClick={continueToReview}>مراجعة طلب الانضمام <span>←</span></button>}
        {bookingStep === "schedule" && <button type="button" className="button button-primary button-wide" disabled={submitting} onClick={continueToReview}>مراجعة المشوار <span>←</span></button>}
        {bookingStep === "review" && <div className="booking-review-actions"><button type="button" className="button button-outline" onClick={bookingMode === "join" ? returnToRoute : returnToSchedule} disabled={submitting}>رجوع للتعديل</button><button type="submit" className="button button-primary" disabled={submitting}>{submitting ? bookingMode === "join" ? "جارٍ إرسال الطلب…" : "جارٍ إنشاء المجموعة…" : bookingMode === "join" ? "تأكيد الانضمام للمجموعة" : bookingMode === "edit" ? "حفظ التعديلات" : "تأكيد إنشاء المجموعة"} <span>←</span></button></div>}
      </form>
    </section>
    
  </div>;

  const allTrips = groups.flatMap((view) => view.trips.map((trip) => ({ ...trip, groupId: view.group.id, categoryId: view.group.category_id, fare: view.group.seat_day_fare })));
  if (section === "trips") return <div className="trips-page">
    <div className="section-toolbar"><button className="button button-primary button-small" onClick={() => openBooking("new")}>＋ مشوار جديد</button></div>
    {selectedGroup && selected ? <><button className="button button-quiet button-small trips-back-to-groups" onClick={() => setSelectedGroup(null)}>→ رجوع لمجموعاتي</button><GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onEdit={() => startEditingGroup(selected)} currentUserId={session.user.id} /></> : groups.length ? <section className="group-list trips-group-list" aria-label="مجموعات مشاويرك">{groups.map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => setSelectedGroup(view.group.id)} />)}</section> : null}
    {allTrips.length ? <section className="all-trips-section"><div className="section-title-row"><div><h2>مواعيد رحلاتك</h2><p>كل مواعيد الذهاب والعودة لمجموعاتك</p></div><span className="section-count">{allTrips.length}</span></div><TripList trips={allTrips} categories={categories} /></section> : <EmptyState icon="↗" title="لسه مفيش رحلات مجدولة" text={groups.length ? "مجموعة مشوارك ظاهرة فوق؛ ستظهر مواعيده هنا بعد اكتمالها وتأكيد الكابتن." : "لما تنشئ أو تنضم لمجموعة، هتلاقي مشاويرك هنا."} />}
    {groups.length > 1 && selectedGroup && <div className="group-switcher">{groups.map((view) => <button key={view.group.id} className={view.group.id === selectedGroup ? "group-chip active" : "group-chip"} onClick={() => setSelectedGroup(view.group.id)}>مجموعة #{view.group.id} · {statusLabel(view.group.status)}</button>)}</div>}
  </div>;

  return <div className="dashboard-grid rider-dashboard">
    <section className="dashboard-main">
      <div className="welcome-banner"><div className="welcome-copy"><span className="eyebrow">سِكّة أقرب لك</span><h2>طريقك أسهل<br /><em>مع سِكّة.</em></h2><div className="welcome-actions"><button className="button button-dark" onClick={() => openBooking("new")}>إنشاء مشوار جديد <span>←</span></button>{groups.length > 0 && <button className="button button-secondary" onClick={() => openBooking("join")}>انضم لمجموعة <span>←</span></button>}</div></div><div className="welcome-illustration"><div className="sun-orbit" /><div className="route-art"><span /><i /><i /><i /><b /></div><div className="mini-car">▰</div></div></div>
      <div className="section-title-row rider-trips-heading"><h2>مشاويرك الحالية</h2><button className="text-action" onClick={() => setSection("trips")}>عرض الكل <span>←</span></button></div>
      {groups.length > 0 && <div className="group-list">{groups.slice(0, 1).map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => { setSelectedGroup(view.group.id); setSection("trips"); }} />)}</div>}
      <RiderCommuterBoard token={session.token} places={savedPlaces} groups={groups} categories={categories}
        onCreateTrip={(type) => { openBooking("new"); if (type) { setPackageType(type); setDates(defaultDates(type)); } }}
        onOpenTrips={() => setSection("trips")}
        onJoin={(match, routePickup, routeDropoff) => openBooking("join", { groupId: match.group.id, pickup: routePickup, dropoff: routeDropoff })}
        onManagePreferences={() => setSection("account")}
        onInviteFriends={() => window.dispatchEvent(new CustomEvent("sekka:invite-friends"))} />
    </section>
  </div>;
}

