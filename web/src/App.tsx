Warning: truncated output (original token count: 18404)
Total output lines: 595

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import MapPicker, { type MapPickMode, type MapPoint } from "./MapPicker";
import BrandLogo from "./components/BrandLogo";
import { categoryName, errorText, formatDate, money, statusLabel } from "./lib/formatters";
import { hasPushSubscription, subscribeToPush, unsubscribeFromPush } from "./lib/push";
import {
  api, ApiError, clearSession, getStoredSession, storeSession,
  type CaptainOffer, type CaptainProfile, type Category, type GroupView,
  type Notification, type PoolStop, type RouteGeometry, type User,
} from "./api";

type Session = { token: string; user: User };
type Toast = { tone: "success" | "error" | "info"; text: string };

function todayInCairo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}
function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function isServiceDay(value: string) {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day >= 0 && day <= 4;
}
function serviceWeek() {
  const today = todayInCairo();
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const sunday = shiftDate(today, day === 0 ? 7 : 7 - day);
  return Array.from({ length: 5 }, (_, index) => shiftDate(sunday, index));
}
function serviceMonth() {
  const today = todayInCairo();
  const parts = today.split("-").map(Number);
  for (let offset = 1; offset <= 4; offset++) {
    const monthStart = new Date(Date.UTC(parts[0]!, parts[1]! - 1 + offset, 1, 12));
    const month = monthStart.toISOString().slice(0, 7);
    const last = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12)).getUTCDate();
    const days: string[] = [];
    for (let day = 1; day <= last; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (isServiceDay(date)) days.push(date);
    }
    if (days.length >= 22) return days;
  }
  return [];
}
function defaultDates(type: "daily" | "weekly" | "monthly") {
  if (type === "weekly") return serviceWeek();
  if (type === "monthly") return serviceMonth().slice(0, 22);
  let date = shiftDate(todayInCairo(), 1);
  while (!isServiceDay(date)) date = shiftDate(date, 1);
  return [date];
}
function readDates(value: string) { try { return JSON.parse(value) as string[]; } catch { return []; } }
function pointLabel(point: MapPoint | null) {
  if (!point) return "لم يتم تحديد الموقع";
  if (point.label) return point.label;
  return typeof point.lat === "number" && typeof point.lng === "number" ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "لم يتم تحديد الموقع";
}
function memberPoint(lat: number | null, lng: number | null): MapPoint | null {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [health, setHealth] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    api<{ status: string; phase: number }>("/health").then(() => { setHealth(true); setHealthError(""); })
      .catch((error) => { setHealth(false); setHealthError(errorText(error)); });
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    api<{ user: User }>("/auth/me", { token: session.token }).then(({ user }) => {
      if (!active) return;
      const next = { ...session, user };
      setSession(next); storeSession(next.token, user);
    }).catch((error) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession(); setSession(null); notify("انتهت جلستك، سجّل الدخول مرة أخرى.", "info");
      }
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSignedIn = (next: Session) => { storeSession(next.token, next.user); setSession(next); };
  const signOut = async () => {
    if (session) await api("/auth/logout", { method: "POST", token: session.token }).catch(() => undefined);
    clearSession(); setSession(null); notify("تم تسجيل الخروج.", "success");
  };

  return <div className="app-shell" dir="rtl">
    {toast && <div className={`toast toast-${toast.tone}`} role="status">{toast.text}<button onClick={() => setToast(null)} aria-label="إغلاق">×</button></div>}
    {!health && <div className="connection-banner"><span className="connection-dot" />{healthError || "جاري الاتصال بالخادم…"}</div>}
    {session ? <Workspace session={session} onSignOut={signOut} notify={notify} /> : <AuthScreen onSignedIn={onSignedIn} notify={notify} />}
  </div>;
}

function AuthScreen({ onSignedIn, notify }: { onSignedIn: (session: Session) => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"rider" | "captain">("rider");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") {
        await api("/auth/register", { method: "POST", body: { full_name: fullName.trim(), phone_number: phone.trim(), password, role } });
      }
      const result = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { phone_number: phone.trim(), password } });
      onSignedIn({ token: result.token, user: result.user });
      notify(mode === "register" ? "أهلًا بك في سِكّة. حسابك جاهز." : "تم تسجيل الدخول.", "success");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <main className="auth-layout">
    <section className="auth-story">
      <BrandLogo variant="light" />
      <div className="auth-story-copy"><span className="eyebrow">معاك في السكة</span><h1>لو نفس السِكّة…<br /><em>سيبها على سِكّة.</em></h1><p>شارك الطريق مع ناس رايحة في نفس اتجاهك. خطط لأيامك، اختار مقعدك، وسيبها على سِكّة.</p>
        <div className="story-stats"><div><strong>4</strong><span>فئات تناسبك</span></div><i /><div><strong>5</strong><span>أيام خدمة أسبوعيًا</span></div></div>
      </div>
      <div className="story-route"><span className="route-point route-point-start" /><span className="route-dashes" /><span className="route-point route-point-end" /><span>القاهرة والجيزة</span></div>
      <div className="story-footer">© سِكّة للتنقل المشترك</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>تسجيل الدخول</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>حساب جديد</button></div>
        <div className="auth-heading"><span className="eyebrow">{mode === "login" ? "سعيدين برجوعك" : "ابدأ رحلتك"}</span><h2>{mode === "login" ? "أهلًا بيك تاني" : "انضم لسِكّة"}</h2><p>{mode === "login" ? "سجّل دخولك وكمّل من حيث توقفت." : "اختار نوع حسابك وأنشئ حسابك في دقيقة."}</p></div>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && <>
            <label>الاسم بالكامل<input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: ياسمين أحمد" required /></label>
            <fieldset className="role-picker"><legend>هتستخدم سِكّة بصفتك؟</legend><button type="button" className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><span>♙</span><strong>راكب</strong><small>أدور على مشوار مشترك</small></button><button type="button" className={role === "captain" ? "selected" : ""} onClick={() => setRole("captain")}><span>⌖</span><strong>كابتن</strong><small>أوصل الركاب لوجهتهم</small></button></fieldset>
          </>}
          <label>رقم الهاتف<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          <label>كلمة السر<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "8 أحرف على الأقل" : "••••••••"} minLength={mode === "register" ? 8 : 1} required /></label>
          {error && <div className="inline-error">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "لحظة واحدة…" : mode === "login" ? "دخول إلى حسابي" : "إنشاء الحساب"}<span>←</span></button>
        </form>
        <p className="auth-legal">بالمتابعة، أنت توافق على <a href="/terms.html">شروط الاستخدام</a> و<a href="/privacy.html">سياسة الخصوصية</a>.</p>
      </div>
      <span className="auth-panel-note">آمن · بسيط · على الطريق</span>
    </section>
  </main>;
}

type NavKey = "home" | "booking" | "trips" | "notifications" | "account" | "offers" | "captainTrips" | "admin";

function Workspace({ session, onSignOut, notify }: { session: Session; onSignOut: () => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [section, setSection] = useState<NavKey>(session.user.role === "captain" ? "offers" : session.user.role === "admin" ? "admin" : "home");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const navigate = (event: Event) => setSection((event as CustomEvent<NavKey>).detail);
    window.addEventListener("sekka:navigate", navigate);
    return () => window.removeEventListener("sekka:navigate", navigate);
  }, []);
  const refreshNotifications = useCallback(async () => {
    try { const result = await api<{ notifications: Notification[] }>("/pool/notifications", { token: session.token }); setNotifications(result.notifications); }
    catch { /* session banner handles expiry */ }
  }, [session.token]);
  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);

  const nav: { key: NavKey; label: string; icon: string }[] = session.user.role === "rider"
    ? [{ key: "home", label: "الرئيسية", icon: "⌂" }, { key: "booking", label: "مشوار جديد", icon: "＋" }, { key: "trips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }]
    : session.user.role === "captain"
      ? [{ key: "offers", label: "المسارات المتاحة", icon: "⌖" }, { key: "captainTrips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }]
      : [{ key: "admin", label: "نظرة عامة", icon: "▦" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }];

  const titles: Record<NavKey, [string, string]> = {
    home: ["صباح الخير", "طريقك اليوم يبدأ من هنا"], booking: ["خطط لمشوارك", "اختار أيامك ونقاطك، وإحنا نرتّب الباقي"],
    trips: ["رحلاتي", "كل مشاويرك ومجموعاتك في مكان واحد"], notifications: ["الإشعارات", "آخر التحديثات الخاصة بمشاويرك"],
    account: ["حسابي", "بياناتك وإعدادات الأمان"], offers: ["المسارات المتاحة", "اختار المسار المناسب لسيارتك ومواعيدك"],
    captainTrips: ["رحلاتي", "المسارات المقبولة وخطوات تنفيذها"], admin: ["لوحة الإدارة", "متابعة المنصة وتوثيق الكباتن"],
  };
  const [title, subtitle] = titles[section];
  const unread = notifications.filter((item) => !item.read_at).length;

  return <div className="workspace">
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo variant="dark" /><button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة">×</button></div>
      <div className="sidebar-label">القائمة الرئيسية</div>
      <nav>{nav.map((item) => <button key={item.key} className={`nav-item ${section === item.key ? "nav-active" : ""}`} onClick={() => { setSection(item.key); setNavOpen(false); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.key === "notifications" && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><span>✦</span><strong>محتاج مساعدة؟</strong><p>فريق سِكّة معاك في كل خطوة.</p><button onClick={() => notify("قنوات الدعم هتتوفر قريبًا.", "info")}>تواصل مع الدعم <span>←</span></button></div>
      <button className="sidebar-profile" onClick={() => setSection("account")}><span className="avatar">{session.user.full_name.slice(0, 1)}</span><span className="profile-copy"><strong>{session.user.full_name}</strong><small>{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</small></span><span className="profile-more">···</span></button>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setNavOpen(true)} aria-label="فتح القائمة">☰</button><div className="breadcrumbs"><span>سِكّة</span><b>/</b><strong>{title}</strong></div><div className="topbar-actions"><button className="icon-button notification-button" onClick={() => setSection("notifications")} aria-label="الإشعارات">♧{unread > 0 && <i />}</button><span className="topbar-divider" /><span className="topbar-user">{session.user.full_name}</span><span className="avatar avatar-small">{session.user.full_name.slice(0, 1)}</span><button className="text-action sign-out-action" onClick={onSignOut}>خروج</button></div></header>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h1>{title}، {session.user.full_name.split(" ")[0]}</h1><p>{subtitle}</p></div><div className="heading-mark">{section === "booking" ? "✦" : section === "offers" ? "⌖" : "س"}</div></div>
        {session.user.role === "rider" && <RiderWorkspace session={session} section={section} setSection={setSection} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
        {session.user.role === "captain" && <CaptainWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
        {session.user.role === "admin" && <AdminWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
      </div>
    </main>
  </div>;
}

function RiderWorkspace({ session, section, setSection, notifications, refreshNotifications, notify }: {
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

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!pickup || !dropoff || pickup.lat === null || pickup.lng === null || dropoff.lat === null || dropoff.lng === null) { notify("حدد نقطتي الركوب والنزول بالنقر على الخريطة أولًا.", "error"); return; }
    const expected = packageType === "daily" ? 1 : packageType === "weekly" ? 5 : 22;
    if (dates.length !== expected) { notify(`اختار ${expected} ${packageType === "daily" ? "يوم" : "يوم خدمة"} بالضبط.`, "error"); return; }
    setSubmitting(true);
    try {
      await api("/rider/pool/groups", { method: "POST", token: session.token, body: {
        category_id: categoryId, package_type: packageType, service_dates: dates,
        morning_departure: morning, return_departure: returnTime,
        pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      } });
      await refreshGroups(); await refreshNotifications();
      setBookingMode("new"); setSection("trips"); setPickup(null); setDropoff(null);
      notify("تم إنشاء المجموعة. شارك رقمها مع الركاب اللي رايحين نفس اتجاهك.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setSubmitting(false); }
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!pickup || !dropoff || pickup.lat === null || pickup.lng === null || dropoff.lat === null || dropoff.lng === null) { notify("حدد نقطتي الركوب والنزول بالنقر على الخريطة أولًا.", "error"); return; }
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
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;

  if (section === "booking") return <div className="booking-layout">
    <section className="surface booking-form-surface">
      <div className="surface-heading"><div><span className="eyebrow">الخطوة {bookingMode === "new" ? "١" : "١"} من ٢</span><h2>{bookingMode === "new" ? "ابدأ مجموعة جديدة" : "انضم لمجموعة موجودة"}</h2><p>مشوارك يتحدد على الخريطة، والباقي سهل.</p></div><span className="surface-icon">{bookingMode === "new" ? "↗" : "＋"}</span></div>
      <div className="segmented-control"><button className={bookingMode === "new" ? "selected" : ""} onClick={() => setBookingMode("new")}>إنشاء مجموعة</button><button className={bookingMode === "join" ? "selected" : ""} onClick={() => setBookingMode("join")}>الانضمام برقم</button></div>
      <form className="form-stack" onSubmit={bookingMode === "new" ? createGroup : joinGroup}>
        {bookingMode === "new" ? <>
          <label>فئة المشوار<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((category) => <option key={category.id} value={category.id}>{categoryName(category)} · {category.seats} مقاعد</option>)}</select></label>
          <div className="tier-helper">{selectedCategory ? <><strong>{selectedCategory.speed_tier === "faster" ? "Faster" : "Saver"}</strong><span>…6404 tokens truncated… السر. تم إنهاء ${result.revoked_other_sessions} جلسة أخرى.`, "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  return <div className="account-grid"><section className="surface account-card"><span className="account-avatar">{session.user.full_name.slice(0, 1)}</span><span className="eyebrow">بيانات الحساب</span><h2>{session.user.full_name}</h2><p>{session.user.phone_number}</p><span className="status-chip status-active">{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</span><div className="account-meta"><span>عضو منذ</span><strong>{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(session.user.created_at ?? Date.now()))}</strong></div></section>
    <section className="surface password-card"><div className="surface-heading"><div><span className="eyebrow">الأمان والخصوصية</span><h2>تغيير كلمة السر</h2><p>اختار كلمة سر قوية ومختلفة عن الحالية.</p></div><span className="surface-icon">⌑</span></div><form className="form-stack" onSubmit={submit}><label>كلمة السر الحالية<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></label><label>كلمة السر الجديدة<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري التحديث…" : "حفظ كلمة السر"}</button></form></section></div>;
}

function CaptainWorkspace({ session, section, notifications, refreshNotifications, notify }: {
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
      const result = await api<{ profile: CaptainProfile }>("/captain/profile", { token: session.token });
      setProfile(result.profile); setVehicle(result.profile.vehicle_type_id); setLicense(result.profile.license_number); setPlate(result.profile.vehicle_plate);
      setRadius(4);
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
  const selected = myTrips.find((item) => item.trip.id === selectedTrip) ?? null;

  if (!profileLoaded) return <LoadingCard text="بنجهز ملف الكابتن…" />;
  if (section === "account") return <div className="captain-account"><section className="surface onboarding-card"><div className="surface-heading"><div><span className="eyebrow">ملف الكابتن</span><h2>{profile ? "بيانات المركبة" : "ابدأ التوثيق"}</h2><p>أكمل بياناتك عشان تقدر تستقبل مسارات.</p></div><span className="surface-icon">⌖</span></div>
    {!profile ? <form className="form-stack" onSubmit={saveProfile}><label>نوع المركبة<select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="private_car">سيارة خاصة</option><option value="hiace">ميكروباص / Hiace</option></select></label><label>رقم الرخصة<input value={license} onChange={(e) => setLicense(e.target.value)} required /></label><label>رقم اللوحة<input value={plate} onChange={(e) => setPlate(e.target.value)} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري الحفظ…" : "حفظ البيانات"}</button></form>
      : <><div className="captain-status-box"><span className={`status-chip status-${profile.verification_status}`}>{statusLabel(profile.verification_status)}</span><p>{profile.verification_status === "approved" ? "حسابك موثّق. حدّث موقعك وتفضيلات سيارتك عشان توصلك المسارات." : profile.verification_status === "pending" ? "بياناتك وصلت للإدارة. تقدر تجهز تفضيلاتك، والمسارات هتظهر بعد الموافقة." : "تم رفض الملف. تواصل مع الدعم لتحديث بيانات المركبة."}</p></div><div className="profile-data-grid"><div><small>المركبة</small><strong>{profile.vehicle_type_id === "hiace" ? "Hiace" : "سيارة خاصة"}</strong></div><div><small>رقم اللوحة</small><strong>{profile.vehicle_plate}</strong></div><div><small>رقم الرخصة</small><strong>{profile.license_number}</strong></div></div></>}
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">تأكيد ملكية الحساب</span><h3>توثيق رقم الهاتف</h3></div><span className="verified-mark">{phoneVerified ? "✓" : "•"}</span></div>{phoneVerified ? <div className="success-note">تم توثيق رقم هاتفك.</div> : <div className="otp-row"><button className="button button-outline button-small" onClick={() => void requestOtp()}>إرسال كود تحقق</button><input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="الكود من ٦ أرقام" /><button className="button button-secondary button-small" onClick={() => void confirmOtp()} disabled={otp.length < 4}>تأكيد</button><small>كود التطوير يظهر في سجل الخادم، لا تُرسل SMS حقيقية.</small></div>}
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">استقبال المسارات</span><h3>موقعك وفئات الخدمة</h3></div></div><p className="muted-text">النطاق {radius} كم · الكابتن يحدد موقعه عند بداية الدوام.</p><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث موقعي الحالي</button><div className="capability-list"><label className="toggle-row"><input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} /><span>سيارتي مكيفة</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("faster")} onChange={() => setTiers((items) => items.includes("faster") ? items.filter((x) => x !== "faster") : [...items, "faster"])} /><span>أقبل Faster</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("saver")} onChange={() => setTiers((items) => items.includes("saver") ? items.filter((x) => x !== "saver") : [...items, "saver"])} /><span>أقبل Saver</span></label></div><label className="range-label">نطاق البحث <strong>{radius} كم</strong><input type="range" min={4} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><small>من ٤ إلى ١٠ كم، بدون تأثير على السعر.</small></label><button className="button button-primary button-small" onClick={() => void saveCapabilities()}>حفظ التفضيلات</button>
    </section><AccountPanel session={session} notify={notify} /></div>;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;

  if (section === "captainTrips") return <div className="trips-page"><div className="section-toolbar"><div><h2>المسارات المسندة إليك</h2><p>تابع نقاط التوقف بالترتيب وسجّل الوصول</p></div><button className="button button-outline button-small" onClick={() => void loadAssignedTrips()}>تحديث ↻</button></div>{selected ? <section className="surface captain-trip-detail"><div className="detail-hero-top"><span className="status-chip status-assigned">{statusLabel(selected.trip.status)}</span><strong>مجموعة #{selected.trip.group_id} · {formatDate(selected.trip.service_date)}</strong><span>{selected.trip.direction === "outbound" ? "ذهاب" : "عودة"}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={selected.route} routePlaces={selected.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence, label: `${stop.stop_type === "pickup" ? "ركوب" : "نزول"} · محطة ${stop.sequence}` }))} direction={selected.trip.direction === "return" ? "return" : "outbound"} readOnly onPick={() => undefined} /><div className="stop-list">{selected.stops.map((stop) => <div className="stop-row" key={stop.id}><span className={stop.stop_type === "pickup" ? "point-dot pickup-dot" : "point-dot dropoff-dot"} /><div><strong>{stop.stop_type === "pickup" ? "ركوب راكب" : "نزول راكب"} · محطة {stop.sequence}</strong><small>الموقع ظاهر على خريطة الرحلة بالأعلى</small></div>{stop.reached_at ? <span className="stop-done">✓ تم</span> : <button className="button button-outline button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/stops/${stop.id}/reached`, { method: "POST", token: session.token }); await loadAssignedTrips(); notify("تم تسجيل الوصول.", "success"); } catch (error) { notify(errorText(error), "error"); } }}>وصلت</button>}</div>)}</div><div className="trip-actions"><button className="button button-primary button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/complete`, { method: "POST", token: session.token }); notify("تم إغلاق الرحلة.", "success"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إنهاء الرحلة</button><button className="button button-quiet button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/report-absence`, { method: "POST", token: session.token }); notify("بدأ البحث عن كابتن بديل لهذا اليوم.", "info"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إبلاغ عن عدم التمكن</button></div></section>
        : myTrips.length ? <div className="offer-grid">{myTrips.map(({ trip }) => <button className="surface offer-card" key={trip.id} onClick={() => setSelectedTrip(trip.id)}><span className="status-chip status-assigned">{statusLabel(trip.status)}</span><h3>مجموعة #{trip.group_id}</h3><p>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? "ذهاب" : "عودة"} · {trip.departure_at.slice(11, 16)}</p><span className="text-action">عرض نقاط التوقف ←</span></button>)}</div> : <EmptyState icon="↗" title="لسه مفيش مسارات مسندة" text="اقبل مسارًا من قائمة المسارات المتاحة وسيظهر هنا." />}</div>;

  if (!profile || profile.verification_status !== "approved") return <div className="approval-state surface"><span className="approval-icon">⌖</span><span className="eyebrow">خطوة قبل استقبال المشاوير</span><h2>{profile ? "ملفك قيد التوثيق" : "أكمل ملف الكابتن"}</h2><p>{profile ? "بمجرد مراجعة بيانات السيارة من الإدارة، هتقدر تحدد موقعك وتستقبل المسارات القريبة." : "أضف بيانات مركبتك من صفحة حسابي ثم تابع حالة التوثيق."}</p><button className="button button-primary button-small" onClick={() => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); }}>فتح حسابي ←</button></div>;
  const loadOffers = async () => { setOfferError(""); try { const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token }); setOffers(result.offers); } catch (error) { setOfferError(errorText(error)); } };
  return <div className="captain-offers-page"><div className="offer-toolbar"><div><div className="online-pill"><i /> جاهز لاستقبال المسارات</div><p>موقعك الحالي يحدد المسارات القريبة منك.</p></div><div className="offer-actions"><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث الموقع</button><button className="button button-primary button-small" onClick={() => void loadOffers()}>تحديث المسارات ↻</button></div></div>{offerError && <div className="inline-error">{offerError}</div>}{offers.length ? <div className="offer-grid">{offers.map((offer) => <article className="surface offer-card" key={offer.trip.id}><div className="offer-card-top"><span className="status-chip status-needs_captain">مسار متاح</span><span>{formatDate(offer.trip.service_date)}</span></div><h3>{categoryName({ id: offer.category_id, speed_tier: offer.category_id.includes("saver") ? "saver" : "faster", has_ac: offer.category_id.includes("ac") ? 1 : 0, seats: offer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 })}</h3><div className="offer-meta"><span>↔ {offer.route_distance_km ?? "—"} كم</span><span>◷ {offer.trip.departure_at.slice(11, 16)}</span><span>سعر المقعد {money(offer.seat_day_fare)}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={offer.route_geometry} routePlaces={(offer.trip.stops ?? []).map((stop) => ({ lat: stop.lat, lng: stop.lng, kind: stop.stop_type, sequence: stop.sequence, label: `${stop.stop_type === "pickup" ? "ركوب" : "نزول"} · محطة ${stop.sequence}` }))} direction={offer.trip.direction} onPick={() => undefined} /><button className="button button-primary button-wide" disabled={busy} onClick={() => void acceptOffer(offer)}>{busy ? "جاري القبول…" : "قبول المسار"}<span>←</span></button></article>)}</div> : <EmptyState icon="⌖" title="مفيش مسارات قريبة دلوقتي" text="حدّث موقعك ونطاق البحث، وهنعرض المسارات المطابقة لسيارتك هنا." action="تحديث المسارات" onAction={() => void loadOffers()} />}</div>;
}

function AdminWorkspace({ session, section, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; notifications: Notification[]; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [captains, setCaptains] = useState<Record<string, unknown>[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    const [stats, pending] = await Promise.all([
      api<{ overview: Record<string, number> }>("/admin/analytics/overview", { token: session.token }),
      api<{ captains: Record<string, unknown>[] }>("/admin/captains?status=pending", { token: session.token }),
    ]);
    setOverview(stats.overview); setCaptains(pending.captains);
  }, [session.token]);
  useEffect(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, [refresh, notify]);
  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;
  const decide = async (captainId: number, status: "approved" | "rejected") => {
    setBusyId(captainId);
    try { await api(`/admin/captains/${captainId}/verification`, { method: "POST", token: session.token, body: { status } }); await refresh(); notify(status === "approved" ? "تم توثيق الكابتن." : "تم رفض طلب التوثيق.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusyId(null); }
  };
  return <div className="admin-dashboard"><div className="admin-stats-grid">{[
    ["إجمالي المستخدمين", overview?.total_users], ["الركاب", overview?.total_riders], ["الكباتن", overview?.total_captains], ["كباتن بانتظار التوثيق", overview?.captains_pending_verification],
  ].map(([label, value]) => <div className="surface admin-stat" key={String(label)}><small>{label}</small><strong>{value ?? "—"}</strong></div>)}</div><section className="surface admin-review"><div className="section-title-row"><div><span className="eyebrow">مراجعة الحسابات</span><h2>كباتن بانتظار التوثيق</h2><p>راجع بيانات المركبة قبل تفعيل استقبال المسارات.</p></div><button className="button button-outline button-small" onClick={() => void refresh()}>تحديث ↻</button></div>{captains.length ? captains.map((captain) => <div className="admin-captain-row" key={String(captain.user_id)}><span className="avatar">{String(captain.full_name).slice(0, 1)}</span><div className="admin-captain-info"><strong>{String(captain.full_name)}</strong><small>{String(captain.phone_number)} · {String(captain.vehicle_type_id)} · لوحة {String(captain.vehicle_plate)}</small><small>رخصة {String(captain.license_number)}</small></div><div className="admin-review-actions"><button className="button button-primary button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "approved")}>موافقة</button><button className="button button-quiet button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "rejected")}>رفض</button></div></div>) : <EmptyState icon="✓" title="مفيش طلبات معلقة" text="هتظهر هنا طلبات الكباتن الجديدة." />}</section><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">صحة المنصة</span><h2>نظرة عامة</h2></div><span className="online-pill"><i /> مباشر</span></div><div className="admin-summary-grid"><div><small>كباتن موثقون</small><strong>{overview?.captains_approved ?? "—"}</strong></div><div><small>رحلات جارية</small><strong>{overview?.total_trips_in_progress ?? "—"}</strong></div><div><small>رحلات مكتملة</small><strong>{overview?.total_trips_completed ?? "—"}</strong></div><div><small>اعتراضات مفتوحة</small><strong>{overview?.disputes_awaiting_admin ?? "—"}</strong></div></div><p className="muted-text">تسوية بوابة الدفع وعمولة الرحلات المشتركة مؤجلتان.</p></section></div>;
}

