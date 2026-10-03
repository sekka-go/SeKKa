import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "../MapPicker";
import LocationSearchField from "../components/LocationSearchField";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { isInsideGreaterCairo } from "../lib/greater-cairo";
import { api, type Category, type GroupView, type Notification, type SavedPlace } from "../api";
import { defaultDates, isServiceDay, serviceDatesFromStart, todayInCairo } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import {
  AccountPanel, EmptyState, GroupDetail, GroupSummary, LoadingCard,
  NotificationsPanel, TripList,
} from "../components/workspace-shared";
export default function RiderWorkspace({ session, section, setSection, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; setSection: (section: NavKey) => void; notifications: Notification[];
  refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"new" | "join">("new");
  const [categoryId, setCategoryId] = useState("");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [savedPlaceTarget, setSavedPlaceTarget] = useState<"pickup" | "dropoff">("pickup");
  const [savedPlaceMenuOpen, setSavedPlaceMenuOpen] = useState(false);
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
  const selectedPointForSavedPlace = savedPlaceTarget === "pickup" ? pickup : dropoff;
  const selected = groups.find((view) => view.group.id === selectedGroup) ?? null;

  const openBooking = (mode: "new" | "join") => {
    setBookingMode(mode);
    setSection("booking");
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
      setCategories(categoryResult.categories); setCategoryId(categoryResult.categories[0]?.id ?? ""); setGroups(groupResult.groups ?? []); setSavedPlaces(savedPlaceResult.places ?? []);
      setSelectedGroup(groupResult.groups?.[0]?.group.id ?? null);
    }).catch((error) => notify(errorText(error), "error")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.token, notify]);

  useEffect(() => {
    const handleBookingMode = (event: Event) => {
      const mode = (event as CustomEvent<"new" | "join">).detail;
      if (mode === "new" || mode === "join") setBookingMode(mode);
    };
    window.addEventListener("sekka:booking-mode", handleBookingMode);
    return () => window.removeEventListener("sekka:booking-mode", handleBookingMode);
  }, []);

  useEffect(() => {
    if (bookingMode !== "new" || !pickup || !dropoff) {
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
    if (!pickup || !dropoff) { notify("اختار نقطة الركوب والنزول بالدبوس أو البحث أو الخريطة.", "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    if (!categoryId || dates.length !== (packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22)) { notify("اختار تاريخ بداية صحيح وفئة للمشوار.", "error"); return; }
    setSubmitting(true);
    try {
      await api("/rider/pool/groups", { method: "POST", token: session.token, body: {
        category_id: categoryId, package_type: packageType, service_dates: dates,
        morning_departure: morning, return_departure: returnTime,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      } });
      await refreshGroups(); await refreshNotifications();
      setBookingMode("new"); setSection("trips"); setPickup(null); setDropoff(null);
      notify("تم إنشاء المجموعة. شارك رقمها مع الركاب اللي رايحين نفس اتجاهك.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!pickup || !dropoff) { notify("اختار نقطتي الركوب والنزول بالدبوس أو البحث أو الخريطة.", "error"); return; }
    if (!isInsideGreaterCairo(pickup.lat!, pickup.lng!) || !isInsideGreaterCairo(dropoff.lat!, dropoff.lng!)) { notify("المشاوير متاحة داخل القاهرة الكبرى فقط.", "error"); return; }
    setSubmitting(true);
    try {
      const result = await api<{ group: { id: number } }>(`/rider/pool/groups/${Number(inviteCode)}/join`, { method: "POST", token: session.token,
        body: { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng } });
      await refreshGroups(); setSelectedGroup(result.group.id); setSection("trips"); setPickup(null); setDropoff(null); setInviteCode("");
      notify("انضممت للمجموعة بنجاح.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const savePlace = async (placeType: SavedPlace["place_type"], point: MapPoint) => {
    if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
    try {
      const result = await api<{ place: SavedPlace }>(`/rider/saved-places/${placeType}`, {
        method: "PUT", token: session.token, body: { label: point.label ?? `موقع ${placeType === "home" ? "المنزل" : "العمل"}`, lat: point.lat, lng: point.lng },
      });
      setSavedPlaces((current) => [...current.filter((place) => place.place_type !== placeType), result.place]);
      notify(`تم حفظ مكان ${placeType === "home" ? "المنزل" : "العمل"}.`, "success");
    } catch (error) { notify(errorText(error), "error"); }
  };
  const removeSavedPlace = async (placeType: SavedPlace["place_type"]) => {
    try {
      await api(`/rider/saved-places/${placeType}`, { method: "DELETE", token: session.token });
      setSavedPlaces((current) => current.filter((place) => place.place_type !== placeType));
      notify(`تم حذف مكان ${placeType === "home" ? "المنزل" : "العمل"}.`, "success");
    } catch (error) { notify(errorText(error), "error"); }
  };

  const selectSavedPlace = (place: SavedPlace) => {
    const point = { lat: place.lat, lng: place.lng, kind: savedPlaceTarget, label: place.label };
    if (savedPlaceTarget === "pickup") { setPickup(point); setPickupSearch(place.label); }
    else { setDropoff(point); setDropoffSearch(place.label); }
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
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={refresh} allowWaitActions notify={notify} />;

  if (section === "booking") return <div className="booking-layout">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">{bookingMode === "new" ? "إنشاء مشوار" : "الانضمام لمجموعة"}</span><h2>{bookingMode === "new" ? "ابدأ مجموعة جديدة" : "انضم لمجموعة موجودة"}</h2><p>مشوارك يتحدد على الخريطة، والباقي سهل.</p></div><span className="surface-icon">{bookingMode === "new" ? "↗" : "＋"}</span></div>
      
      <form className="form-stack" onSubmit={bookingMode === "new" ? createGroup : joinGroup}>
        {bookingMode === "join" && <><label>رقم المجموعة<input type="number" min="1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="مثال: 124" required /></label><div className="info-note">لازم نقط الركوب والنزول تكون في حدود ٣ كم من مسار المجموعة.</div></>}
        <section className="saved-place-tools" aria-label="الأماكن المحفوظة">
          <div className="saved-place-tools-heading">
            <strong>الأماكن المحفوظة</strong>
            <div className="saved-place-target" aria-label="المكان الذي سيُستخدم">
              <button type="button" className={savedPlaceTarget === "pickup" ? "active" : ""} aria-pressed={savedPlaceTarget === "pickup"} onClick={() => { setSavedPlaceTarget("pickup"); setSavedPlaceMenuOpen(false); }}>للركوب</button>
              <button type="button" className={savedPlaceTarget === "dropoff" ? "active" : ""} aria-pressed={savedPlaceTarget === "dropoff"} onClick={() => { setSavedPlaceTarget("dropoff"); setSavedPlaceMenuOpen(false); }}>للنزول</button>
            </div>
          </div>
          {savedPlaces.length > 0 ? <div className="saved-place-chips">
            {savedPlaces.map((place) => <div className="saved-place-chip" key={place.place_type}>
              <button type="button" onClick={() => selectSavedPlace(place)} aria-label={`استخدم ${place.place_type === "home" ? "المنزل" : "العمل"} لنقطة ${savedPlaceTarget === "pickup" ? "الركوب" : "النزول"}`}>
                <strong>{place.place_type === "home" ? "⌂ المنزل" : "▣ العمل"}</strong><span>{place.label}</span>
              </button>
              <button type="button" className="saved-place-remove" onClick={() => void removeSavedPlace(place.place_type)} aria-label={`حذف ${place.place_type === "home" ? "المنزل" : "العمل"} المحفوظ`}>×</button>
            </div>)}
          </div> : <p className="saved-place-empty">احفظ نقطة الركوب أو النزول لاستخدامها بسرعة في المرات القادمة.</p>}
          {selectedPointForSavedPlace && typeof selectedPointForSavedPlace.lat === "number" && typeof selectedPointForSavedPlace.lng === "number" && <div className="saved-place-save">
            <button type="button" className="saved-place-save-trigger" aria-expanded={savedPlaceMenuOpen} onClick={() => setSavedPlaceMenuOpen((open) => !open)}>
              {savedPlaceMenuOpen ? "إغلاق خيارات الحفظ" : `حفظ نقطة ${savedPlaceTarget === "pickup" ? "الركوب" : "النزول"}`} <span aria-hidden="true">{savedPlaceMenuOpen ? "⌃" : "⌄"}</span>
            </button>
            {savedPlaceMenuOpen && <div className="saved-place-save-options">
              {(["home", "work"] as const).map((placeType) => {
                const exists = savedPlaces.some((place) => place.place_type === placeType);
                return <button type="button" key={placeType} onClick={() => { void savePlace(placeType, selectedPointForSavedPlace); setSavedPlaceMenuOpen(false); }}>
                  <span>{placeType === "home" ? "⌂ المنزل" : "▣ العمل"}</span><small>{exists ? "تحديث المكان" : "حفظ لأول مرة"}</small>
                </button>;
              })}
            </div>}
          </div>}
        </section>
        <div className="location-search-stack">
          <LocationSearchField kind="pickup" title="نقطة الركوب" value={pickupSearch} token={session.token} onChange={(value) => { setPickupSearch(value); setPickup(null); }} onSelect={(point) => { setPickup(point); setPickupSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("pickup")} onFocus={() => setSavedPlaceTarget("pickup")} />
          <LocationSearchField kind="dropoff" title="نقطة النزول" value={dropoffSearch} token={session.token} onChange={(value) => { setDropoffSearch(value); setDropoff(null); }} onSelect={(point) => { setDropoff(point); setDropoffSearch(point.label ?? ""); }} onChooseMap={() => chooseMap("dropoff")} onFocus={() => setSavedPlaceTarget("dropoff")} />
        </div>
        {mapOpen && <section className="booking-map-panel" aria-label="اختيار الموقع من الخريطة">
          <div className="booking-map-toolbar">
            <p className="map-instruction">انقر أو اسحب الدبوس لتحديد {pickMode === "pickup" ? "نقطة الركوب" : "نقطة النزول"} · القاهرة الكبرى فقط</p>
            <button type="button" className="map-close-button" onClick={() => setMapOpen(false)} aria-label="إغلاق الخريطة">×</button>
          </div>
          <div className="booking-map"><MapPicker pickup={pickup} dropoff={dropoff} mode={pickMode} restrictToGreaterCairo onOutsidePick={() => notify("اختار نقطة داخل القاهرة الكبرى فقط.", "error")} onPick={setMapPoint} /></div>
        </section>}
        {bookingMode === "new" && <>
          <label>نوع الباقة<div className="package-options">
            {(["daily", "weekly", "monthly"] as const).map((type) => <button type="button" key={type} className={packageType === type ? "package-option selected" : "package-option"} onClick={() => { setPackageType(type); setDates(serviceDatesFromStart(dates[0] && isServiceDay(dates[0]) ? dates[0] : defaultDates(type)[0]!, type)); }}><strong>{type === "daily" ? "يومي" : type === "weekly" ? "أسبوعي" : "شهري"}</strong><small>{type === "daily" ? "يوم واحد" : type === "weekly" ? "٥ أيام خدمة · خصم ٥٪" : "٢٢ يوم خدمة · خصم ١٠٪"}</small><b>{priceQuotes?.[categoryId] ? money(priceQuotes[categoryId]![type]) : priceLoading ? "جارٍ حساب السعر…" : "السعر بعد تحديد النقط"}</b></button>)}
          </div></label>
          <label>تاريخ بداية الرحلة<input type="date" min={todayInCairo()} value={dates[0] ?? ""} onChange={(e) => {
            const start = e.target.value;
            if (start && !isServiceDay(start)) { setDates([]); notify("اختار يومًا من الأحد للخميس؛ الجمعة والسبت إجازة.", "error"); return; }
            setDates(start ? serviceDatesFromStart(start, packageType) : []);
          }} required /></label>
          {dates.length > 1 && <small className="muted-text">أيام الخدمة: {formatDate(dates[0]!)} إلى {formatDate(dates[dates.length - 1]!)} · متتابعة مع استثناء الجمعة والسبت ({dates.length} يومًا)</small>}
          <div className="time-row"><label>وقت الذهاب<input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} required /></label><label>وقت العودة<input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required /></label></div>
          <section className="category-picker"><div className="field-heading"><strong>الفئة والسعر</strong>{priceLoading && <span>جارٍ تحديث الأسعار…</span>}</div>
            {priceError && <p className="price-error">{priceError}</p>}
            <div className="category-select-label" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCategoryMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setCategoryMenuOpen(false); }}>
              <span>اختار الفئة</span>
              <button type="button" className="category-select-trigger" aria-haspopup="listbox" aria-expanded={categoryMenuOpen} aria-controls="category-options" disabled={categories.length === 0} onClick={() => setCategoryMenuOpen((open) => !open)}>
                <span>{selectedCategory ? `${categoryName(selectedCategory)} · ${selectedCategory.seats} مقاعد` : "جاري تحميل الفئات"}</span>
                <strong>{selectedCategory && priceQuotes?.[selectedCategory.id] ? money(priceQuotes[selectedCategory.id]![packageType]) : priceLoading ? "جارٍ حساب السعر…" : "السعر بعد تحديد النقط"}</strong>
                <span className="category-select-chevron" aria-hidden="true">{categoryMenuOpen ? "⌃" : "⌄"}</span>
              </button>
              {categoryMenuOpen && <div className="category-select-options" id="category-options" role="listbox" aria-label="الفئات المتاحة">
                {categories.map((category) => {
                  const quote = priceQuotes?.[category.id];
                  const fare = quote ? money(quote[packageType]) : priceLoading ? "جارٍ حساب السعر…" : "السعر بعد تحديد النقط";
                  const chosen = category.id === categoryId;
                  return <button type="button" key={category.id} role="option" aria-selected={chosen} className={chosen ? "category-select-option selected" : "category-select-option"} onClick={() => { setCategoryId(category.id); setCategoryMenuOpen(false); }}>
                    <span><strong>{categoryName(category)}</strong><small>{category.seats} مقاعد · {category.speed_tier === "faster" ? "Faster" : "Saver"}</small></span>
                    <b>{fare}</b>
                  </button>;
                })}
              </div>}
            </div>
            <div className="tier-helper">{selectedCategory ? <><strong>{categoryName(selectedCategory)}</strong><span>{selectedCategory.speed_tier === "faster" ? "Faster" : "Saver"} · الفئة تكتمل عند {selectedCategory.seats} ركاب · السعر للفرد</span></> : "جاري تحميل الفئات"}</div>
          </section>
        </>}
        <button className="button button-primary button-wide" disabled={submitting || (bookingMode === "new" && Boolean(pickup && dropoff) && (!priceQuotes || priceLoading))}>{submitting ? "جاري الحفظ…" : bookingMode === "new" ? "تأكيد المشوار" : "الانضمام للمجموعة"}<span>←</span></button>
        {bookingMode === "new" && <p className="form-footnote">الأسعار تقديرية للفرد، والباقات الأسبوعية والشهرية تبدأ من التاريخ المحدد وتستثني الجمعة والسبت. مفيش دفع دلوقتي.</p>}
      </form>
    </section>
    
  </div>;

  const allTrips = groups.flatMap((view) => view.trips.map((trip) => ({ ...trip, groupId: view.group.id, categoryId: view.group.category_id, fare: view.group.seat_day_fare })));
  if (section === "trips") return <div className="trips-page">
    <div className="section-toolbar"><div className="segmented-control compact"><button className={selectedGroup ? "selected" : ""} onClick={() => setSelectedGroup(groups[0]?.group.id ?? null)}>المجموعات <span>{groups.length}</span></button><button className={!selectedGroup ? "selected" : ""} onClick={() => setSelectedGroup(null)}>مواعيد الرحلات <span>{allTrips.length}</span></button></div><button className="button button-primary button-small" onClick={() => openBooking("new")}>＋ مشوار جديد</button></div>
    {selectedGroup && selected ? <GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onNew={() => openBooking("new")} />
      : allTrips.length ? <TripList trips={allTrips} categories={categories} /> : <EmptyState icon="↗" title="لسه مفيش رحلات" text="لما تنشئ أو تنضم لمجموعة، هتلاقي مشاويرك هنا." action="ابدأ مشوارك" onAction={() => openBooking("new")} />}
    {groups.length > 1 && selectedGroup && <div className="group-switcher">{groups.map((view) => <button key={view.group.id} className={view.group.id === selectedGroup ? "group-chip active" : "group-chip"} onClick={() => setSelectedGroup(view.group.id)}>مجموعة #{view.group.id} · {statusLabel(view.group.status)}</button>)}</div>}
  </div>;

  return <div className="dashboard-grid rider-dashboard">
    <section className="dashboard-main">
      <div className="welcome-banner"><div className="welcome-copy"><span className="eyebrow">سِكّة أقرب لك</span><h2>طريقك أسهل<br /><em>مع سِكّة.</em></h2><button className="button button-dark" onClick={() => openBooking("new")}>إنشاء مشوار جديد <span>←</span></button></div><div className="welcome-illustration"><div className="sun-orbit" /><div className="route-art"><span /><i /><i /><i /><b /></div><div className="mini-car">▰</div></div></div>
      <div className="section-title-row rider-trips-heading"><h2>مشاويرك الحالية</h2><button className="text-action" onClick={() => setSection("trips")}>عرض الكل <span>←</span></button></div>
      {groups.length ? <div className="group-list">{groups.slice(0, 1).map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => { setSelectedGroup(view.group.id); setSection("trips"); }} />)}</div> : <EmptyState icon="⌖" title="معاك رقم مجموعة؟" text="اكتب رقمها وانضم لمشوار موجود." action="انضم لمجموعة" onAction={() => openBooking("join")} />}
    </section>
  </div>;
}
