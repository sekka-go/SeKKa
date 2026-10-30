import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./rider-trips-screen.css";

type Line = {
  id: string;
  origin_name: string;
  destination_name: string;
  operating_days: number[];
  departure_time: string;
  return_time: string | null;
  seat_count: number | null;
  monthly_price: number | null;
  currency: string;
  vehicle_details: Record<string, unknown> | null;
  published_at: string | null;
  vehicle: { id: string; name_ar: string; capacity_max: number } | null;
};

type MemberRide = { id: string; status: string; joined_at: string; group: { status: string; starts_on: string | null; ends_on: string | null; line: Line | null } | null };
type Props = { supabase: SupabaseClient | null; mode: "available" | "mine"; onHome: () => void };
type Order = "recent" | "price";
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function Icon({ name }: { name: "back" | "pin" | "calendar" | "clock" | "people" | "car" | "search" | "home" | "bag" | "chat" | "user" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 15c3 0 5 1.8 5 5"/></>,
    car: <><path d="m5 11 2-5h10l2 5 2 2v6h-2v-2H5v2H3v-6l2-2Z"/><path d="M5 11h14"/></>,
    search: <><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16 16 5 5"/></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/></>,
    bag: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></>,
    chat: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 11h.1M12 11h.1M16 11h.1"/></>,
    user: <><circle cx="12" cy="7" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

function formatPrice(value: number | null, currency: string) {
  if (value === null) return "السعر يحدده الخط";
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value)} ${currency.trim() === "EGP" ? "ج.م" : currency.trim()}`;
}

export default function RiderTripsScreen({ supabase, mode, onHome }: Props) {
  const mine = mode === "mine";
  const [lines, setLines] = useState<Line[]>([]);
  const [memberships, setMemberships] = useState<MemberRide[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState<Order>("recent");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selected, setSelected] = useState<Line | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [queryKey, setQueryKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      if (!supabase) { setError("إعدادات الاتصال بقاعدة البيانات غير مكتملة."); setLoading(false); return; }
      setLoading(true);
      try {
        if (mine) {
          const { data: auth, error: authError } = await supabase.auth.getUser();
          if (authError) throw authError;
          if (!auth.user) throw new Error("يجب تسجيل الدخول لعرض رحلاتك.");
          const { data, error: queryError } = await supabase.from("ride_group_members")
            .select("id,status,joined_at,group:ride_groups(status,starts_on,ends_on,line:captain_lines(id,origin_name,destination_name,operating_days,departure_time,return_time,seat_count,monthly_price,currency,vehicle_details,published_at,vehicle:vehicle_types(id,name_ar,capacity_max)))")
            .eq("rider_id", auth.user.id).eq("status", "active").order("joined_at", { ascending: false });
          if (queryError) throw queryError;
          if (active) setMemberships((data ?? []) as unknown as MemberRide[]);
        } else {
          const { data, error: queryError } = await supabase.from("captain_lines")
            .select("id,origin_name,destination_name,operating_days,departure_time,return_time,seat_count,monthly_price,currency,vehicle_details,published_at,vehicle:vehicle_types(id,name_ar,capacity_max)")
            .eq("status", "published").order("published_at", { ascending: false });
          if (queryError) throw queryError;
          if (active) setLines((data ?? []) as unknown as Line[]);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error && cause.message.includes("تسجيل الدخول") ? cause.message : "تعذر تحميل البيانات. تحقق من الاتصال أو صلاحيات الحساب ثم أعد المحاولة.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [supabase, mine, queryKey]);

  const results = useMemo(() => {
    const normalizedFrom = from.trim().toLocaleLowerCase("ar");
    const normalizedTo = to.trim().toLocaleLowerCase("ar");
    const chosenDate = date ? new Date(`${date}T12:00:00`) : null;
    const weekday = chosenDate?.getDay();
    const today = new Date();
    const found = lines.filter((line) => {
      if (normalizedFrom && !line.origin_name.toLocaleLowerCase("ar").includes(normalizedFrom)) return false;
      if (normalizedTo && !line.destination_name.toLocaleLowerCase("ar").includes(normalizedTo)) return false;
      if (weekday !== undefined && !line.operating_days.includes(weekday)) return false;
      if (vehicleFilter !== "all" && line.vehicle?.id !== vehicleFilter) return false;
      const declaredCapacity = line.seat_count ?? line.vehicle?.capacity_max ?? null;
      if (declaredCapacity !== null && declaredCapacity < passengers) return false;
      if (chosenDate && chosenDate.toDateString() === today.toDateString() && line.departure_time <= `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`) return false;
      return true;
    });
    return found.sort((a, b) => order === "price" ? (a.monthly_price ?? Number.MAX_SAFE_INTEGER) - (b.monthly_price ?? Number.MAX_SAFE_INTEGER) : (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  }, [lines, from, to, date, passengers, order, vehicleFilter]);

  const myRides = memberships.filter((item) => item.group?.line);
  const categories = [{ id: "prime", label: "Prime" }, { id: "daily", label: "Daily" }, { id: "space", label: "Space" }, { id: "max", label: "Max" }];
  const selectedCategory = categories.find((category) => category.id === vehicleFilter);
  const retry = () => { setLoading(true); setQueryKey((key) => key + 1); };
  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setSearched(true); };
  const card = (line: Line, key: string) => {
    const capacity = line.seat_count ?? line.vehicle?.capacity_max;
    return <article className="rider-trip-card" key={key}>
      <div className="trip-card-price"><span className="trip-seat-badge"><Icon name="people"/> السعة {capacity ?? "—"}</span><strong>{formatPrice(line.monthly_price, line.currency)}</strong><small>{line.monthly_price !== null ? "للمقعد شهريًا" : "السعر غير معلن"}</small><button className="rider-trip-detail-button" onClick={() => setSelected(line)}>تفاصيل الرحلة <Icon name="back"/></button></div>
      <div className="trip-card-route"><div className="trip-route-place"><i className="trip-route-dot"/><span>{line.origin_name}</span></div><div className="trip-route-connector"/><div className="trip-route-place"><i className="trip-route-dot"/><span>{line.destination_name}</span></div><div className="trip-route-datetime"><span><Icon name="calendar"/>{date ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`)) : line.operating_days.map((day) => days[day]).filter(Boolean).join("، ") || "المواعيد غير محددة"}</span><span><Icon name="clock"/>{line.departure_time.slice(0, 5)}</span></div></div>
      <div className="trip-card-captain"><span className="trip-captain-avatar"><Icon name="people"/></span><strong>رحلة منشورة</strong><span>{line.vehicle?.name_ar ?? "نوع المركبة غير محدد"}</span><span><Icon name="car"/> {capacity ? `${capacity} مقاعد إجمالية` : "السعة غير محددة"}</span></div>
    </article>;
  };

  return <main className="rider-trips-screen" dir="rtl" lang="ar">
    <header className="rider-trips-header"><img src="/brand/sekka-mark.png" alt="سِكّة"/><div><span>{mine ? "رحلات مرتبطة بحسابك" : "اكتشف الخطوط التي تناسبك"}</span><h1>{mine ? "رحلاتي" : "البحث عن رحلة"}</h1></div><button onClick={onHome} aria-label="العودة للرئيسية"><Icon name="back"/></button></header>
    {!mine && <form className="rider-trip-search" onSubmit={submitSearch}>
      <div className="rider-trip-search-grid">
        <label><span>تاريخ الرحلة <Icon name="calendar"/></span><input type="date" value={date} min={new Date().toLocaleDateString("en-CA")} onChange={(event) => setDate(event.target.value)}/></label>
        <label><span>إلى أين؟ <Icon name="pin"/></span><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="الوجهة" autoComplete="off"/></label>
        <label><span>من أين؟ <Icon name="pin"/></span><input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="نقطة الانطلاق" autoComplete="off"/></label>
      </div><div className="rider-trip-search-bottom"><label className="rider-passengers-label"><span>عدد الركاب</span><span className="rider-passenger-control"><button type="button" onClick={() => setPassengers((count) => Math.max(1, count - 1))} disabled={passengers <= 1} aria-label="تقليل الركاب">−</button><b>{passengers} راكب</b><button type="button" onClick={() => setPassengers((count) => Math.min(13, count + 1))} disabled={passengers >= 13} aria-label="زيادة الركاب">+</button></span></label><button className="rider-trip-submit" type="submit"><Icon name="search"/> ابحث عن الرحلات</button></div>
    </form>}
    <section className="rider-trips-list-section">
      <div className="rider-trips-results-heading"><div><span>{mine ? "الرحلات والاشتراكات المرتبطة بك" : "رحلات منشورة من الكباتن"}</span><h2>{mine ? "رحلاتي" : searched ? "الرحلات المناسبة لك" : "الرحلات المتاحة"}</h2></div>{!mine && !loading && !error && <span className="rider-results-count">{results.length} رحلة</span>}</div>
      {!mine && <div className="rider-trip-filters"><div className="rider-trip-filter-row" aria-label="ترتيب وتصفية الرحلات"><button className={order === "recent" && vehicleFilter === "all" ? "selected" : ""} onClick={() => { setOrder("recent"); setVehicleFilter("all"); }}>كل الرحلات <span>☷</span></button><button className={order === "price" ? "selected" : ""} onClick={() => setOrder("price")}>الأقل سعرًا <span>◉</span></button><button aria-expanded={categoryOpen} aria-controls="trip-category-options" className={vehicleFilter !== "all" ? "selected" : ""} onClick={() => setCategoryOpen((open) => !open)}>{selectedCategory ? `الفئة: ${selectedCategory.label}` : "تصفية بالفئة"} <span>⚙</span></button></div>{categoryOpen && <div id="trip-category-options" className="rider-trip-category-options" role="group" aria-label="فئة المركبة"><button className={vehicleFilter === "all" ? "selected" : ""} onClick={() => { setVehicleFilter("all"); setCategoryOpen(false); }}>كل الفئات</button>{categories.map((category) => <button key={category.id} className={vehicleFilter === category.id ? "selected" : ""} onClick={() => { setVehicleFilter(category.id); setCategoryOpen(false); }}>{category.label}</button>)}</div>}</div>}
      {!mine && <p className="rider-search-limit-note">تعرض النتائج الخطوط المنشورة المطابقة. حالة المقاعد الفعلية وتقييمات الكباتن غير متاحة للقراءة العامة حاليًا.</p>}
      {loading ? <div className="rider-trips-state" role="status"><strong>جارٍ تحميل الرحلات</strong><p>نحمّل البيانات من حسابك.</p></div> : error ? <div className="rider-trips-state rider-trips-error" role="alert"><strong>تعذر تحميل الرحلات</strong><p>{error}</p><button onClick={retry}>إعادة المحاولة</button></div> : mine ? myRides.length ? <div className="rider-trips-results">{myRides.map((item) => <div key={item.id}>{card(item.group!.line!, item.id)}<p className="rider-member-status">حالة الارتباط: {item.status === "active" ? "نشطة" : item.status === "pending" ? "قيد الانتظار" : item.status}</p></div>)}</div> : <div className="rider-trips-state"><strong>لا توجد رحلات مرتبطة بحسابك بعد</strong><p>بعد قبول طلب انضمامك ستظهر رحلتك هنا.</p><button onClick={() => { window.location.assign("/trips"); }}>استكشف الرحلات</button></div> : results.length ? <div className="rider-trips-results">{results.map((line) => card(line, line.id))}</div> : <div className="rider-trips-state"><strong>{searched ? "لم نعثر على خطوط تطابق بحثك" : "لا توجد خطوط منشورة للعرض حاليًا"}</strong><p>{searched ? "جرّب تعديل نقطة الانطلاق أو الوصول أو التاريخ وعدد الركاب." : "ستظهر هنا الخطوط التي نشرها الكباتن عند توفرها."}</p></div>}
    </section>
    <nav className="rider-trips-bottom-nav" aria-label="التنقل الرئيسي"><a href="/home"><Icon name="home"/><span>الرئيسية</span></a><a className={!mine ? "active" : ""} aria-current={!mine ? "page" : undefined} href="/trips"><Icon name="search"/><span>البحث</span></a><a className={mine ? "active" : ""} aria-current={mine ? "page" : undefined} href="/my-trips"><Icon name="bag"/><span>طلباتي</span></a><a href="/journey/conversations"><Icon name="chat"/><span>المحادثات</span></a><a href="/journey/profile"><Icon name="user"/><span>المزيد</span></a></nav>
    {selected && <div className="rider-trip-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="rider-trip-modal" role="dialog" aria-modal="true" aria-labelledby="trip-detail-title"><button className="rider-trip-modal-close" onClick={() => setSelected(null)} aria-label="إغلاق">×</button><span className="rider-trip-published">خط منشور</span><h2 id="trip-detail-title">{selected.origin_name} ← {selected.destination_name}</h2><p><Icon name="calendar"/> أيام التشغيل: {selected.operating_days.map((day) => days[day]).filter(Boolean).join("، ") || "غير محددة"}</p><p><Icon name="clock"/> موعد الانطلاق: {selected.departure_time.slice(0, 5)}{selected.return_time ? ` · العودة ${selected.return_time.slice(0, 5)}` : ""}</p><p><Icon name="car"/> المركبة: {selected.vehicle?.name_ar ?? "غير محددة"}</p><p><Icon name="people"/> السعة الإجمالية المعلنة: {selected.seat_count ?? selected.vehicle?.capacity_max ?? "غير محددة"}</p><p>السعر: {formatPrice(selected.monthly_price, selected.currency)}{selected.monthly_price !== null ? " لكل راكب شهريًا" : ""}</p><p className="rider-trip-modal-note">تفاصيل المقاعد المتبقية وبيانات الكابتن غير معروضة لأن صلاحيات القراءة العامة الحالية لا توفرها. تقديم طلب الانضمام غير متاح بعد من الواجهة.</p></section></div>}
  </main>;
}
