import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "../MapPicker";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { api, type Category, type GroupView, type Notification } from "../api";
import { defaultDates, pointLabel, serviceMonth, serviceWeek, todayInCairo } from "../lib/booking-dates";
import type { NavKey, Session, Toast } from "../types";
import {
  AccountPanel, EmptyState, GroupDetail, GroupSummary, LoadingCard, Metric,
  NotificationRow, NotificationsPanel, TripList,
} from "../components/workspace-shared";
export default function RiderWorkspace({ session, section, setSection, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; setSection: (section: NavKey) => void; notifications: Notification[];
  refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingMode, setBookingMode] = useState<"new" | "join">("new");
  const [categoryId, setCategoryId] = useState("");
  const [packageType, setPackageType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [dates, setDates] = useState<string[]>(() => defaultDates("daily"));
  const [morning, setMorning] = useState("07:30");
  const [returnTime, setReturnTime] = useState("17:00");
  const [pickup, setPickup] = useState<MapPoint | null>(null);
  const [dropoff, setDropoff] = useState<MapPoint | null>(null);
  const [pickMode, setPickMode] = useState<MapPickMode>("pickup");
  const [inviteCode, setInviteCode] = useState("");
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const selected = groups.find((view) => view.group.id === selectedGroup) ?? null;

  const refreshGroups = useCallback(async () => {
    const result = await api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token });
    setGroups(result.groups ?? []);
  }, [session.token]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ categories: Category[] }>("/pool/categories"),
      api<{ groups: GroupView[] }>("/rider/pool/groups", { token: session.token }),
    ]).then(([categoryResult, groupResult]) => {
      if (!active) return;
      setCategories(categoryResult.categories); setCategoryId(categoryResult.categories[0]?.id ?? ""); setGroups(groupResult.groups ?? []);
      setSelectedGroup(groupResult.groups?.[0]?.group.id ?? null);
    }).catch((error) => notify(errorText(error), "error")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.token, notify]);

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
    if (!pickup || !dropoff) { notify("حدد نقطة الركوب ونقطة النزول على الخريطة.", "error"); return; }
    const expected = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;
    if (dates.length !== expected) { notify(`اختار ${expected} ${packageType === "daily" ? "يوم" : "يوم خدمة"} بالضبط.`, "error"); return; }
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
    if (!pickup || !dropoff) { notify("حدد نقطتي الركوب والنزول على الخريطة.", "error"); return; }
    setSubmitting(true);
    try {
      const result = await api<{ group: { id: number } }>(`/rider/pool/groups/${Number(inviteCode)}/join`, { method: "POST", token: session.token,
        body: { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng } });
      await refreshGroups(); setSelectedGroup(result.group.id); setSection("trips"); setPickup(null); setDropoff(null); setInviteCode("");
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

  const dateOptions = useMemo(() => packageType === "weekly" ? serviceWeek() : packageType === "monthly" ? serviceMonth() : dates, [packageType, dates]);
  const expectedDays = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;

  if (loading) return <LoadingCard text="بنجهّز مساحة مشاويرك…" />;

  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={refresh} allowWaitActions notify={notify} />;

  if (section === "booking") return <div className="booking-layout">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">الخطوة {bookingMode === "new" ? "١" : "١"} من ٢</span><h2>{bookingMode === "new" ? "ابدأ مجموعة جديدة" : "انضم لمجموعة موجودة"}</h2><p>مشوارك يتحدد على الخريطة، والباقي سهل.</p></div><span className="surface-icon">{bookingMode === "new" ? "↗" : "＋"}</span></div>
      <div className="segmented-control"><button className={bookingMode === "new" ? "selected" : ""} onClick={() => setBookingMode("new")}>إنشاء مجموعة</button><button className={bookingMode === "join" ? "selected" : ""} onClick={() => setBookingMode("join")}>الانضمام برقم</button></div>
      <form className="form-stack" onSubmit={bookingMode === "new" ? createGroup : joinGroup}>
        {bookingMode === "new" ? <>
          <label>فئة المشوار<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((category) => <option key={category.id} value={category.id}>{categoryName(category)} · {category.seats} مقاعد</option>)}</select></label>
          <div className="tier-helper">{selectedCategory ? <><strong>{selectedCategory.speed_tier === "faster" ? "Faster" : "Saver"}</strong><span>الحد الأدنى {selectedCategory.speed_tier === "faster" ? "راكبان" : "٣ ركاب"} · {selectedCategory.seats} مقاعد</span></> : "جاري تحميل الفئات"}</div>
          <label>نوع الباقة<div className="package-options">
            {(["daily", "weekly", "monthly"] as const).map((type) => <button type="button" key={type} className={packageType === type ? "package-option selected" : "package-option"} onClick={() => { setPackageType(type); setDates(defaultDates(type)); }}><strong>{type === "daily" ? "يومي" : type === "weekly" ? "أسبوعي" : "شهري"}</strong><small>{type === "daily" ? "يوم واحد" : type === "weekly" ? "٥ أيام · خصم ٥٪" : "٢٢ يومًا · خصم ١٠٪"}</small></button>)}
          </div></label>
          {packageType === "daily" ? <label>تاريخ المشوار<input type="date" min={todayInCairo()} value={dates[0] ?? ""} onChange={(e) => setDates(e.target.value ? [e.target.value] : [])} required /></label>
            : <div className="date-picker-block"><div className="field-heading"><strong>{packageType === "weekly" ? "اختار ٥ أيام في أسبوع الخدمة" : "اختار ٢٢ يوم خدمة في الشهر"}</strong><span>{dates.length} / {expectedDays}</span></div><div className="date-chips">{dateOptions.map((date) => <button type="button" key={date} className={dates.includes(date) ? "date-chip active" : "date-chip"} onClick={() => setDates((current) => current.includes(date) ? current.filter((d) => d !== date) : [...current, date].sort())}>{formatDate(date)}</button>)}</div><small className="muted-text">أيام الخدمة من الأحد إلى الخميس، والمواعيد يحددها الراكب.</small></div>}
          <div className="time-row"><label>وقت الذهاب<input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} required /></label><label>وقت العودة<input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required /></label></div>
        </> : <><label>رقم المجموعة<input type="number" min="1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="مثال: 124" required /></label><div className="info-note">لازم نقط الركوب والنزول تكون في حدود ٣ كم من مسار المجموعة.</div></>}
        <div className="map-points-readout"><div><i className="point-dot pickup-dot" /><span><strong>نقطة الركوب</strong><small>{pointLabel(pickup)}</small></span><button type="button" className={pickMode === "pickup" ? "text-action active" : "text-action"} onClick={() => setPickMode("pickup")}>حدد</button></div><div><i className="point-dot dropoff-dot" /><span><strong>نقطة النزول</strong><small>{pointLabel(dropoff)}</small></span><button type="button" className={pickMode === "dropoff" ? "text-action active" : "text-action"} onClick={() => setPickMode("dropoff")}>حدد</button></div></div>
        <p className="map-instruction">اضغط على الخريطة لتحديد <b>{pickMode === "pickup" ? "نقطة الركوب" : "نقطة النزول"}</b></p>
        <MapPicker pickup={pickup} dropoff={dropoff} mode={pickMode} onPick={(type, point) => type === "pickup" ? setPickup(point) : setDropoff(point)} />
        <button className="button button-primary button-wide" disabled={submitting}>{submitting ? "جاري الحفظ…" : bookingMode === "new" ? "تأكيد المشوار" : "الانضمام للمجموعة"}<span>←</span></button>
        {bookingMode === "new" && <p className="form-footnote">مفيش دفع دلوقتي؛ المبلغ هيظهر بعد اكتمال الحد الأدنى وتأكيد المسار.</p>}
      </form>
    </section>
    <aside className="booking-aside"><div className="surface soft-surface"><span className="aside-icon">✦</span><h3>مشوار مشترك، بسعر أعدل</h3><p>Faster يبدأ براكبين، وSaver بثلاثة. سعر الفرد يتحسب على عدد مقاعد الفئة بالكامل.</p><ul><li>ذهاب وعودة كل يوم خدمة</li><li>إلغاء اليوم مجانًا قبل ١٢ ساعة</li><li>خصم حتى ١٠٪ على الباقات</li></ul></div><div className="surface compact-note"><span>ⓘ</span><p>الموقع اللي بتختاره بيُستخدم لحساب الطريق ومشاركة تفاصيل المشوار مع مجموعتك.</p></div></aside>
  </div>;

  const allTrips = groups.flatMap((view) => view.trips.map((trip) => ({ ...trip, groupId: view.group.id, categoryId: view.group.category_id, fare: view.group.seat_day_fare })));
  if (section === "trips") return <div className="trips-page">
    <div className="section-toolbar"><div className="segmented-control compact"><button className={selectedGroup ? "selected" : ""} onClick={() => setSelectedGroup(groups[0]?.group.id ?? null)}>المجموعات <span>{groups.length}</span></button><button className={!selectedGroup ? "selected" : ""} onClick={() => setSelectedGroup(null)}>مواعيد الرحلات <span>{allTrips.length}</span></button></div><button className="button button-primary button-small" onClick={() => setSection("booking")}>＋ مشوار جديد</button></div>
    {selectedGroup && selected ? <GroupDetail view={selected} categories={categories} busy={submitting} action={groupAction} notify={notify} onNew={() => setSection("booking")} />
      : allTrips.length ? <TripList trips={allTrips} categories={categories} /> : <EmptyState icon="↗" title="لسه مفيش رحلات" text="لما تنشئ أو تنضم لمجموعة، هتلاقي مشاويرك هنا." action="ابدأ مشوارك" onAction={() => setSection("booking")} />}
    {groups.length > 1 && selectedGroup && <div className="group-switcher">{groups.map((view) => <button key={view.group.id} className={view.group.id === selectedGroup ? "group-chip active" : "group-chip"} onClick={() => setSelectedGroup(view.group.id)}>مجموعة #{view.group.id} · {statusLabel(view.group.status)}</button>)}</div>}
  </div>;

  return <div className="dashboard-grid">
    <section className="dashboard-main">
      <div className="welcome-banner"><div className="welcome-copy"><span className="eyebrow">سِكّة أقرب لك</span><h2>خلّي الطريق<br /><em>على مزاجك.</em></h2><p>مشاويرك اليومية، بتكلفة أقل وناس شبه طريقك.</p><button className="button button-dark" onClick={() => setSection("booking")}>خطط لمشوار <span>←</span></button></div><div className="welcome-illustration"><div className="sun-orbit" /><div className="route-art"><span /><i /><i /><i /><b /></div><div className="mini-car">▰</div></div></div>
      <div className="metric-grid"><Metric icon="↗" label="مجموعاتي" value={String(groups.length)} hint="باقات ومشاوير" /><Metric icon="◷" label="الأيام المجدولة" value={String(allTrips.filter((trip) => ["scheduled", "assigned", "needs_captain"].includes(trip.status)).length)} hint="ذهاب وعودة" /><Metric icon="♙" label="سعر المقعد" value={money(groups.find((g) => g.group.seat_day_fare)?.group.seat_day_fare)} hint="حسب المسار والفئة" /></div>
      <div className="section-title-row"><div><h2>مشاويرك الحالية</h2><p>تابع حالة المجموعة والمواعيد القادمة</p></div><button className="text-action" onClick={() => setSection("trips")}>عرض الكل <span>←</span></button></div>
      {groups.length ? <div className="group-list">{groups.slice(0, 2).map((view) => <GroupSummary key={view.group.id} view={view} categories={categories} onClick={() => { setSelectedGroup(view.group.id); setSection("trips"); }} />)}</div> : <EmptyState icon="⌖" title="مشوارك الأول مستنيك" text="حدد طريقك، اختار أيامك، وابدأ مجموعة جديدة." action="خطط لمشوار" onAction={() => setSection("booking")} />}
    </section>
    <aside className="dashboard-side"><div className="surface side-date-card"><div className="side-date-top"><span>سِكّة اليوم</span><span className="weather-mark">☀</span></div><strong>{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" }).format(new Date())}</strong><small>{new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(new Date())}</small><div className="week-strip">{[0, 1, 2, 3, 4].map((n) => <span key={n} className={n === new Date().getDay() ? "today" : ""}>{["ح", "ن", "ث", "ر", "خ"][n]}<b>{n + 1}</b></span>)}</div></div>
      <div className="surface activity-card"><div className="section-title-row"><div><h3>آخر التحديثات</h3><p>إشعارات مجموعاتك</p></div><button className="text-action" onClick={() => setSection("notifications")}>الكل</button></div>{notifications.slice(0, 3).length ? notifications.slice(0, 3).map((item) => <NotificationRow key={item.id} item={item} />) : <p className="muted-text">مفيش تحديثات جديدة.</p>}</div>
      <div className="surface callout-card"><span>✦</span><h3>وفّر مع كل باقة</h3><p>احجز ٥ أيام أسبوعيًا ووفر ٥٪، أو اختار ٢٢ يومًا شهريًا ووفر ١٠٪.</p><button className="text-action" onClick={() => setSection("booking")}>اكتشف الباقات ←</button></div>
    </aside>
  </div>;
}
