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
function pointLabel(point: MapPoint | null) { return point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "اضغط على الخريطة لتحديد الموقع"; }

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
      <div className="auth-story-copy"><span className="eyebrow">تنقّل يومي أذكى</span><h1>لو نفس السِكَّة..<br /><em>سيبها على سِكّة.</em></h1><p>شارك الطريق مع ناس رايحة في نفس اتجاهك. خطط لأيامك، اختار مقعدك، وسيب الباقي على سِكّة.</p>
        <div className="story-stats"><div><strong>4</strong><span>فئات تناسبك</span></div><i /><div><strong>5</strong><span>أيام خدمة أسبوعيًا</span></div></div>
      </div>
      <div className="story-route"><span className="route-point route-point-start" /><span className="route-dashes" /><span className="route-point route-point-end" /><span>القاهرة · طريقك اليومي</span></div>
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
        <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
      </div>
      <span className="auth-panel-note">آمن · بسيط · على الطريق</span>
    </section>
  </main>;
}

type NavKey = "home" | "booking" | "trips" | "notifications" | "account" | "offers" | "captainTrips" | "admin" | "help";

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
    ? [{ key: "home", label: "الرئيسية", icon: "⌂" }, { key: "booking", label: "مشوار جديد", icon: "＋" }, { key: "trips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }, { key: "help", label: "المساعدة", icon: "؟" }]
    : session.user.role === "captain"
      ? [{ key: "offers", label: "المسارات المتاحة", icon: "⌖" }, { key: "captainTrips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }, { key: "help", label: "المساعدة", icon: "؟" }]
      : [{ key: "admin", label: "نظرة عامة", icon: "▦" }, { key: "notifications", label: "الإشعارات", icon: "◌" }, { key: "account", label: "حسابي", icon: "♙" }, { key: "help", label: "المساعدة", icon: "؟" }];

  const titles: Record<NavKey, [string, string]> = {
    home: ["صباح الخير", "طريقك اليوم يبدأ من هنا"], booking: ["خطط لمشوارك", "اختار أيامك ونقاطك، وإحنا نرتّب الباقي"],
    trips: ["رحلاتي", "كل مشاويرك ومجموعاتك في مكان واحد"], notifications: ["الإشعارات", "آخر التحديثات الخاصة بمشاويرك"],
    account: ["حسابي", "بياناتك وإعدادات الأمان"], offers: ["المسارات المتاحة", "اختار المسار المناسب لسيارتك ومواعيدك"],
    captainTrips: ["رحلاتي", "المسارات المقبولة وخطوات تنفيذها"], admin: ["لوحة الإدارة", "متابعة المنصة وتوثيق الكباتن"], help: ["مركز المساعدة", "إجابات واضحة عن الحجز والرحلات والباقات"],
  };
  const [title, subtitle] = titles[section];
  const unread = notifications.filter((item) => !item.read_at).length;

  return <div className="workspace">
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><BrandLogo variant="dark" /><button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة">×</button></div>
      <div className="sidebar-label">القائمة الرئيسية</div>
      <nav>{nav.map((item) => <button key={item.key} className={`nav-item ${section === item.key ? "nav-active" : ""}`} onClick={() => { setSection(item.key); setNavOpen(false); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.key === "notifications" && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="help-card"><span>✦</span><strong>محتاج مساعدة؟</strong><p>إجابات سريعة عن استخدام سِكّة.</p><button onClick={() => { setSection("help"); setNavOpen(false); }}>افتح مركز المساعدة <span>←</span></button></div>
      <button className="sidebar-profile" onClick={() => setSection("account")}><span className="avatar">{session.user.full_name.slice(0, 1)}</span><span className="profile-copy"><strong>{session.user.full_name}</strong><small>{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</small></span><span className="profile-more">···</span></button>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setNavOpen(true)} aria-label="فتح القائمة">☰</button><div className="breadcrumbs"><span>سِكّة</span><b>/</b><strong>{title}</strong></div><div className="topbar-actions"><button className="icon-button notification-button" onClick={() => setSection("notifications")} aria-label="الإشعارات">♧{unread > 0 && <i />}</button><span className="topbar-divider" /><span className="topbar-user">{session.user.full_name}</span><span className="avatar avatar-small">{session.user.full_name.slice(0, 1)}</span><button className="text-action sign-out-action" onClick={onSignOut}>خروج</button></div></header>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h1>{title}، {session.user.full_name.split(" ")[0]}</h1><p>{subtitle}</p></div><div className="heading-mark">{section === "booking" ? "✦" : section === "offers" ? "⌖" : "س"}</div></div>
        {section === "help" ? <HelpPanel /> : <>
          {session.user.role === "rider" && <RiderWorkspace session={session} section={section} setSection={setSection} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
          {session.user.role === "captain" && <CaptainWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
          {session.user.role === "admin" && <AdminWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
        </>}
      </div>
    </main>
  </div>;
}

function HelpPanel() {
  const topics = [
    { title: "كيف أطلب رحلة؟", text: "من «مشوار جديد» حدّد نقطة الركوب والنزول، اختَر Faster أو Saver، ثم الأيام والمواعيد وأرسل الطلب. تحتاج الرحلة إلى راكبين على الأقل في Faster أو 3 ركاب في Saver." },
    { title: "متى يبدأ السعر؟", text: "السعر يُقسّم على سعة الفئة كاملة: 3 مقاعد في Faster و4 في Saver. تظهر أي زيادة تتجاوز 15% للموافقة؛ يمكنك الرفض دون غرامة." },
    { title: "ما قواعد الإلغاء؟", text: "الإلغاء قبل موعد الرحلة بـ12 ساعة أو أكثر مجاني. إذا بقي أقل من 12 ساعة تُخصم أجرة يوم. إلغاء الباقة الأسبوعية أو الشهرية يخصم 10% رسومًا إدارية من قيمة الأيام المتبقية." },
    { title: "ماذا يحدث بعد 72 ساعة؟", text: "إذا لم يكتمل الحد الأدنى، يمكنك الانتظار أو حجز المقاعد الباقية أو الإلغاء مجانًا. إذا لم تختر، يستمر الانتظار." },
    { title: "هل يتم الدفع داخل التطبيق؟", text: "بوابة الدفع والتحصيل والاسترداد الفعلي مؤجلة. التطبيق يعرض الاستحقاقات المسجلة ولا يطلب بيانات بطاقة." },
    { title: "كيف أفعّل توثيق هاتف الكابتن؟", text: "ميزة OTP متوقفة افتراضيًا. يضيف المدير أسرار Twilio إلى Supabase ثم يفعّلها من لوحة الإدارة؛ لن تُرسل رسالة قبل ذلك." },
    { title: "لماذا لا أستطيع إنشاء مجموعة؟", text: "إنشاء المجموعات يحتاج اتصالًا بالإنترنت وخدمة توجيه طرق خاصة متاحة للخادم. إذا ظهرت رسالة خطأ، جرّب لاحقًا أو أعد المحاولة." },
  ];
  return (
    <div className="help-center">
      <section className="surface help-center-intro">
        <span className="eyebrow">دليل سِكّة</span>
        <h2>إجابات سريعة قبل ما تبدأ</h2>
        <p>اختر السؤال لمعرفة طريقة الاستخدام وقواعد الرحلات. للحجز ومتابعة الحالة يلزم اتصال بالإنترنت.</p>
      </section>
      <section className="surface help-center-list" aria-label="الأسئلة الشائعة">
        {topics.map((topic) => (
          <details className="help-topic" key={topic.title}>
            <summary>{topic.title}</summary>
            <p>{topic.text}</p>
          </details>
        ))}
      </section>
    </div>
  );
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
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;

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

function Metric({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return <div className="surface metric-card"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></div>;
}

function GroupSummary({ view, categories, onClick }: { view: GroupView; categories: Category[]; onClick: () => void }) {
  const group = view.group;
  const category = categories.find((item) => item.id === group.category_id);
  const seats = view.members.filter((m) => m.status === "active").reduce((sum, m) => sum + m.seats_reserved, 0);
  return <button className="surface group-summary" onClick={onClick}><div className="group-summary-top"><span className={`status-chip status-${group.status}`}>{statusLabel(group.status)}</span><span className="group-number">مجموعة #{group.id}</span></div><div className="group-summary-main"><span className="route-badge">↗</span><div><strong>{categoryName(category)}</strong><small>{group.package_type === "weekly" ? "باقة أسبوعية" : group.package_type === "monthly" ? "باقة شهرية" : "مشوار يومي"} · {view.members.length} ركاب</small></div><span className="group-price">{money(group.seat_day_fare)}</span></div><div className="seat-progress"><span>{seats} مقاعد محجوزة</span><div><i style={{ width: `${category ? Math.min(100, seats / category.seats * 100) : 0}%` }} /></div><small>{category?.seats ?? "—"} إجمالي المقاعد</small></div><div className="group-summary-foot"><span>⌖ {group.route_distance_km ?? "—"} كم</span><span>◷ {group.morning_departure} ذهاب · {group.return_departure} عودة</span><span>التفاصيل ←</span></div></button>;
}

function GroupDetail({ view, categories, busy, action, notify, onNew }: {
  view: GroupView; categories: Category[]; busy: boolean;
  action: (groupId: number, action: string, body?: unknown) => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
  onNew: () => void;
}) {
  const { group, members, trips } = view;
  const category = categories.find((item) => item.id === group.category_id);
  const activeMembers = members.filter((m) => m.status === "active");
  const seats = activeMembers.reduce((sum, m) => sum + m.seats_reserved, 0);
  const dates = readDates(group.service_dates);
  const [canceling, setCanceling] = useState(false);
  const cancel = async () => {
    if (!window.confirm("متأكد إنك عايز تلغي الباقة؟ هتشوف قيمة الاسترداد قبل أي تحصيل مستقبلي.")) return;
    setCanceling(true); await action(group.id, "cancel"); setCanceling(false);
  };
  const firstFutureDate = trips.find((trip) => trip.service_date >= todayInCairo() && trip.status !== "completed")?.service_date;

  return <div className="group-detail-layout"><div className="group-detail-main">
    <section className="surface detail-hero"><div className="detail-hero-top"><span className={`status-chip status-${group.status}`}>{statusLabel(group.status)}</span><span className="group-number">رقم المجموعة #{group.id}</span><button className="icon-button" title="نسخ رقم المجموعة" onClick={() => { void navigator.clipboard?.writeText(String(group.id)); notify("اتنسخ رقم المجموعة.", "success"); }}>⧉</button></div><h2>{categoryName(category)}</h2><p>{group.package_type === "monthly" ? "باقة شهرية" : group.package_type === "weekly" ? "باقة أسبوعية" : "مشوار يومي"} · {dates.length} أيام خدمة · ذهاب وعودة</p><div className="detail-stats"><div><small>سعر المقعد لليوم</small><strong>{money(group.seat_day_fare)}</strong></div><div><small>الطريق</small><strong>{group.route_distance_km ?? "—"} كم</strong></div><div><small>الركاب</small><strong>{activeMembers.length} / {category?.seats ?? "—"}</strong></div></div>
      {group.status === "price_review" && <div className="warning-panel"><span>!</span><div><strong>في تعديل على السعر</strong><p>راجع السعر الجديد واختار تكمل أو تخرج من المجموعة بدون غرامة.</p></div><div className="warning-actions"><button className="button button-primary button-small" disabled={busy} onClick={() => action(group.id, "price-decision", { action: "accept" })}>موافق</button><button className="button button-quiet button-small" disabled={busy} onClick={() => action(group.id, "price-decision", { action: "decline" })}>رفض</button></div></div>}
      {group.status === "waiting" && <div className="info-note"><strong>المجموعة لسه بتكتمل.</strong> Faster يحتاج راكبين وSaver يحتاج ٣ ركاب. بعد ٧٢ ساعة هيوصلك إشعار بالاختيارات المتاحة.</div>}
      {group.status === "needs_captain" && <div className="info-note"><strong>اكتمل عدد الركاب.</strong> بندور على كابتن قريب للمسار، وهيوصلك تحديث أول ما يتحدد.</div>}
      <div className="detail-route-map"><div className="section-title-row"><div><h3>خط السير</h3><p>ذهاب وعودة · الخريطة تعرض الطريق الفعلي</p></div><span className="map-distance">{group.route_duration_min ?? "—"} د</span></div><MapPicker pickup={members[0] ? { lat: members[0].pickup_lat, lng: members[0].pickup_lng } : null} dropoff={members[0] ? { lat: members[0].dropoff_lat, lng: members[0].dropoff_lng } : null} mode="pickup" route={group.route_geometry} onPick={() => undefined} /></div>
    </section>
    <section className="surface detail-section"><div className="section-title-row"><div><h3>الركاب والمقاعد</h3><p>{seats} مقاعد من {category?.seats ?? "—"} محجوزة</p></div><span className="section-count">{activeMembers.length}</span></div><div className="rider-list">{members.map((member, index) => <div key={member.id} className={`rider-row ${member.status !== "active" ? "rider-muted" : ""}`}><span className="rider-sequence">{String(index + 1).padStart(2, "0")}</span><div><strong>{index === 0 ? "أنت" : `راكب ${index + 1}`}</strong><small>{member.seats_reserved} مقعد · {member.status === "active" ? "مؤكد" : member.status === "awaiting_confirmation" ? "بانتظار التأكيد" : "غادر المجموعة"}</small></div><span className="rider-state">{member.price_decision === "pending" && group.status === "price_review" ? "مطلوب ردك" : "●"}</span></div>)}</div></section>
    <section className="surface detail-section"><div className="section-title-row"><div><h3>أيام الخدمة</h3><p>الوقت المحلي للقاهرة</p></div><span className="section-count">{dates.length}</span></div><div className="service-date-list">{dates.map((date) => <div key={date} className="service-date-row"><span className="calendar-badge">{new Date(`${date}T12:00:00Z`).getUTCDate()}</span><div><strong>{formatDate(date)}</strong><small>{group.morning_departure} ذهاب · {group.return_departure} عودة</small></div><span className="date-price">{money(group.seat_day_fare)}</span></div>)}</div></section>
  </div><aside className="group-detail-side"><section className="surface action-card"><h3>إدارة المشوار</h3><p>شارك المجموعة مع أصحابك أو حدّث حجزك.</p><button className="button button-outline button-wide" onClick={() => { void navigator.clipboard?.writeText(String(group.id)); notify("اتنسخ رقم المجموعة.", "success"); }}>⧉ نسخ رقم المجموعة</button>
      {group.status === "waiting" && category && seats < category.seats && activeMembers.length < category.seats && <button className="button button-secondary button-wide" disabled={busy} onClick={() => action(group.id, "complete-seats")}>احجز باقي المقاعد</button>}
      {firstFutureDate && ["active", "minimum_met", "needs_captain"].includes(group.status) && <button className="button button-quiet button-wide" disabled={busy} onClick={() => { if (window.confirm(`إلغاء يوم ${formatDate(firstFutureDate)}؟`)) action(group.id, `days/${firstFutureDate}/cancel`); }}>إلغاء يوم الخدمة</button>}
      {!(["cancelled", "completed"].includes(group.status)) && <button className="text-danger" disabled={busy || canceling} onClick={() => void cancel()}>{canceling ? "جاري الإلغاء…" : "إلغاء الباقة"}</button>}
      <div className="payment-note"><span>◌</span><p>الدفع الإلكتروني مؤجل. هذه الأسعار تقديرية مسجلة وليست عملية تحصيل.</p></div></section>
      <section className="surface upcoming-card"><div className="section-title-row"><div><h3>الرحلات القادمة</h3><p>جدول الذهاب والعودة</p></div></div>{trips.slice(0, 6).map((trip) => <div className="upcoming-row" key={trip.id}><span className={`trip-arrow ${trip.direction}`}>{trip.direction === "outbound" ? "↗" : "↙"}</span><div><strong>{formatDate(trip.service_date)}</strong><small>{trip.direction === "outbound" ? "ذهاب" : "عودة"} · {trip.departure_at.slice(11, 16)}</small></div><span className={`tiny-status status-${trip.status}`}>{statusLabel(trip.status)}</span></div>)}</section>
      <button className="button button-primary button-wide" onClick={onNew}>＋ ابدأ مجموعة جديدة</button>
    </aside></div>;
}

function TripList({ trips, categories }: { trips: RiderWorkspaceTrip[]; categories: Category[] }) {
  if (!trips.length) return <EmptyState icon="↗" title="مواعيدك هتظهر هنا" text="بعد ما تنضم لمجموعة، هتلاقي الذهاب والعودة في الجدول." />;
  return <div className="surface trip-table"><div className="trip-table-head"><span>المشوار</span><span>التاريخ والوقت</span><span>الفئة</span><span>الحالة</span></div>{trips.map((trip) => <div className="trip-table-row" key={`${trip.groupId}-${trip.id}`}><div><span className={`trip-arrow ${trip.direction}`}>{trip.direction === "outbound" ? "↗" : "↙"}</span><strong>مجموعة #{trip.groupId}</strong></div><div><strong>{formatDate(trip.service_date)}</strong><small>{trip.departure_at.slice(11, 16)}</small></div><span>{categoryName(categories.find((item) => item.id === trip.categoryId))}</span><span className={`status-chip status-${trip.status}`}>{statusLabel(trip.status)}</span></div>)}</div>;
}
type RiderWorkspaceTrip = { id: number; groupId: number; categoryId: string; service_date: string; direction: "outbound" | "return"; departure_at: string; status: string; fare: number | null };

function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="surface empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{action && onAction && <button className="button button-primary button-small" onClick={onAction}>{action} <span>←</span></button>}</div>;
}
function LoadingCard({ text }: { text: string }) { return <div className="surface loading-card"><span className="spinner" /><strong>{text}</strong></div>; }

function NotificationRow({ item }: { item: Notification }) {
  const title = item.event_key.includes("price") ? "تحديث على سعر المجموعة" : item.event_key.includes("captain") ? "تحديث الكابتن" : item.event_key.includes("wait") ? "المجموعة ما زالت في الانتظار" : item.event_key.includes("invite") ? "دعوة لمجموعة مشوار" : "تحديث جديد على مشوارك";
  const date = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at));
  return <div className={`notification-row ${item.read_at ? "read" : ""}`}><span className="notification-mark">{item.event_key.includes("price") ? "٪" : item.event_key.includes("captain") ? "⌖" : "↗"}</span><div><strong>{title}</strong><small>{item.group_id ? `مجموعة #${item.group_id} · ` : ""}{date}</small></div>{!item.read_at && <i />}</div>;
}

function NotificationsPanel({ items, token, onRefresh, notify }: { items: Notification[]; token: string; onRefresh: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void hasPushSubscription().then((enabled) => { if (active) setPushEnabled(enabled); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(token);
        setPushEnabled(false);
        notify("تم إيقاف إشعارات سِكّة على هذا الجهاز.", "success");
      } else {
        await subscribeToPush(token);
        setPushEnabled(true);
        notify("تم تفعيل إشعارات سِكّة على هذا الجهاز.", "success");
      }
    } catch (error) { notify(errorText(error), "error"); }
    finally { setPushBusy(false); }
  };

  const markRead = async (item: Notification) => {
    if (item.read_at) return;
    try { await api(`/pool/notifications/${item.id}/read`, { method: "POST", token }); await onRefresh(); }
    catch (error) { notify(errorText(error), "error"); }
  };
  return <section className="surface notifications-panel"><div className="section-title-row"><div><h2>كل الإشعارات</h2><p>الإشعارات محفوظة داخل حسابك</p></div><div className="notification-controls"><button className="button button-outline button-small" onClick={() => void togglePush()} disabled={pushBusy || !import.meta.env.PROD}>{pushBusy ? "جاري التحديث…" : pushEnabled ? "إيقاف إشعارات الجهاز" : import.meta.env.PROD ? "تفعيل إشعارات الجهاز" : "تفعيل الإشعارات بعد النشر"}</button><button className="text-action" onClick={() => void onRefresh()}>تحديث ↻</button></div></div>{items.length ? items.map((item) => <button className="notification-button-row" key={item.id} onClick={() => void markRead(item)}><NotificationRow item={item} /><span className="notification-open">{item.read_at ? "" : "تعليم كمقروء"}</span></button>) : <EmptyState icon="◌" title="مفيش إشعارات لسه" text="هنبلغك بأي تحديث على رحلاتك ومجموعاتك." />}</section>;
}

function AccountPanel({ session, notify }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ revoked_other_sessions: number }>("/auth/change-password", { method: "POST", token: session.token, body: { current_password: current, new_password: next } }); setCurrent(""); setNext(""); notify(`تم تحديث كلمة السر. تم إنهاء ${result.revoked_other_sessions} جلسة أخرى.`, "success"); }
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
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpProviderReady, setOtpProviderReady] = useState(false);
  const [otpStatusLoaded, setOtpStatusLoaded] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
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
  useEffect(() => {
    void api<{ enabled: boolean; provider_ready: boolean }>("/captain/verify/status", { token: session.token })
      .then((status) => { setOtpEnabled(status.enabled); setOtpProviderReady(status.provider_ready); })
      .catch((error) => notify(errorText(error), "error"))
      .finally(() => setOtpStatusLoaded(true));
  }, [session.token, notify]);

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
    setOtpSending(true);
    try {
      await api("/captain/verify/request", { method: "POST", token: session.token });
      setOtpSent(true);
      notify("أرسلنا كود التحقق إلى رقم هاتفك. صلاحيته ١٠ دقائق.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setOtpSending(false); }
  };
  const confirmOtp = async () => {
    try { await api("/captain/verify/confirm", { method: "POST", token: session.token, body: { otp } }); setPhoneVerified(true); setOtp(""); setOtpSent(false); notify("تم توثيق رقم الهاتف.", "success"); }
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
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">تأكيد ملكية الحساب</span><h3>توثيق رقم الهاتف</h3></div><span className="verified-mark">{phoneVerified ? "✓" : "•"}</span></div>{phoneVerified ? <div className="success-note">تم توثيق رقم هاتفك.</div> : !otpStatusLoaded ? <div className="muted-text">جارٍ التحقق من إعداد توثيق الهاتف…</div> : !otpEnabled ? <div className="success-note">توثيق الهاتف متوقف مؤقتًا. يمكن للإدارة تشغيله عند تجهيز خدمة الرسائل.</div> : !otpProviderReady ? <div className="inline-error">الإدارة فعّلت التوثيق، لكن خدمة SMS تحتاج إلى إعداد.</div> : <div className="otp-row"><button className="button button-outline button-small" onClick={() => void requestOtp()} disabled={otpSending}>{otpSending ? "جاري الإرسال…" : otpSent ? "إعادة إرسال الكود" : "إرسال كود تحقق"}</button>{otpSent && <><input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ""))} placeholder="أدخل كود SMS" /><button className="button button-secondary button-small" onClick={() => void confirmOtp()} disabled={otp.length < 4}>تأكيد</button></>}<small>الكود صالح لمدة ١٠ دقائق، ولا نعرضه أو نخزنه في التطبيق.</small></div>}
    <div className="onboarding-divider" /><div className="surface-heading"><div><span className="eyebrow">استقبال المسارات</span><h3>موقعك وفئات الخدمة</h3></div></div><p className="muted-text">النطاق {radius} كم · الكابتن يحدد موقعه عند بداية الدوام.</p><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث موقعي الحالي</button><div className="capability-list"><label className="toggle-row"><input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} /><span>سيارتي مكيفة</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("faster")} onChange={() => setTiers((items) => items.includes("faster") ? items.filter((x) => x !== "faster") : [...items, "faster"])} /><span>أقبل Faster</span></label><label className="toggle-row"><input type="checkbox" checked={tiers.includes("saver")} onChange={() => setTiers((items) => items.includes("saver") ? items.filter((x) => x !== "saver") : [...items, "saver"])} /><span>أقبل Saver</span></label></div><label className="range-label">نطاق البحث <strong>{radius} كم</strong><input type="range" min={4} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /><small>من ٤ إلى ١٠ كم، بدون تأثير على السعر.</small></label><button className="button button-primary button-small" onClick={() => void saveCapabilities()}>حفظ التفضيلات</button>
    </section><AccountPanel session={session} notify={notify} /></div>;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;

  if (section === "captainTrips") return <div className="trips-page"><div className="section-toolbar"><div><h2>المسارات المسندة إليك</h2><p>تابع نقاط التوقف بالترتيب وسجّل الوصول</p></div><button className="button button-outline button-small" onClick={() => void loadAssignedTrips()}>تحديث ↻</button></div>{selected ? <section className="surface captain-trip-detail"><div className="detail-hero-top"><span className="status-chip status-assigned">{statusLabel(selected.trip.status)}</span><strong>مجموعة #{selected.trip.group_id} · {formatDate(selected.trip.service_date)}</strong><span>{selected.trip.direction === "outbound" ? "ذهاب" : "عودة"}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={selected.route} onPick={() => undefined} /><div className="stop-list">{selected.stops.map((stop) => <div className="stop-row" key={stop.id}><span className={stop.stop_type === "pickup" ? "point-dot pickup-dot" : "point-dot dropoff-dot"} /><div><strong>{stop.stop_type === "pickup" ? "ركوب راكب" : "نزول راكب"} · محطة {stop.sequence}</strong><small>{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</small></div>{stop.reached_at ? <span className="stop-done">✓ تم</span> : <button className="button button-outline button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/stops/${stop.id}/reached`, { method: "POST", token: session.token }); await loadAssignedTrips(); notify("تم تسجيل الوصول.", "success"); } catch (error) { notify(errorText(error), "error"); } }}>وصلت</button>}</div>)}</div><div className="trip-actions"><button className="button button-primary button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/complete`, { method: "POST", token: session.token }); notify("تم إغلاق الرحلة.", "success"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إنهاء الرحلة</button><button className="button button-quiet button-small" onClick={async () => { try { await api(`/captain/pool/trips/${selected.trip.id}/report-absence`, { method: "POST", token: session.token }); notify("بدأ البحث عن كابتن بديل لهذا اليوم.", "info"); setSelectedTrip(null); await loadAssignedTrips(); } catch (error) { notify(errorText(error), "error"); } }}>إبلاغ عن عدم التمكن</button></div></section>
        : myTrips.length ? <div className="offer-grid">{myTrips.map(({ trip }) => <button className="surface offer-card" key={trip.id} onClick={() => setSelectedTrip(trip.id)}><span className="status-chip status-assigned">{statusLabel(trip.status)}</span><h3>مجموعة #{trip.group_id}</h3><p>{formatDate(trip.service_date)} · {trip.direction === "outbound" ? "ذهاب" : "عودة"} · {trip.departure_at.slice(11, 16)}</p><span className="text-action">عرض نقاط التوقف ←</span></button>)}</div> : <EmptyState icon="↗" title="لسه مفيش مسارات مسندة" text="اقبل مسارًا من قائمة المسارات المتاحة وسيظهر هنا." />}</div>;

  if (!profile || profile.verification_status !== "approved") return <div className="approval-state surface"><span className="approval-icon">⌖</span><span className="eyebrow">خطوة قبل استقبال المشاوير</span><h2>{profile ? "ملفك قيد التوثيق" : "أكمل ملف الكابتن"}</h2><p>{profile ? "بمجرد مراجعة بيانات السيارة من الإدارة، هتقدر تحدد موقعك وتستقبل المسارات القريبة." : "أضف بيانات مركبتك من صفحة حسابي ثم تابع حالة التوثيق."}</p><button className="button button-primary button-small" onClick={() => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); }}>فتح حسابي ←</button></div>;
  const loadOffers = async () => { setOfferError(""); try { const result = await api<{ offers: CaptainOffer[] }>("/captain/pool/offers", { token: session.token }); setOffers(result.offers); } catch (error) { setOfferError(errorText(error)); } };
  return <div className="captain-offers-page"><div className="offer-toolbar"><div><div className="online-pill"><i /> جاهز لاستقبال المسارات</div><p>موقعك الحالي يحدد المسارات القريبة منك.</p></div><div className="offer-actions"><button className="button button-outline button-small" onClick={() => void updateLocation()}>⌖ تحديث الموقع</button><button className="button button-primary button-small" onClick={() => void loadOffers()}>تحديث المسارات ↻</button></div></div>{offerError && <div className="inline-error">{offerError}</div>}{offers.length ? <div className="offer-grid">{offers.map((offer) => <article className="surface offer-card" key={offer.trip.id}><div className="offer-card-top"><span className="status-chip status-needs_captain">مسار متاح</span><span>{formatDate(offer.trip.service_date)}</span></div><h3>{categoryName({ id: offer.category_id, speed_tier: offer.category_id.includes("saver") ? "saver" : "faster", has_ac: offer.category_id.includes("ac") ? 1 : 0, seats: offer.category_id.includes("saver") ? 4 : 3, base_fee: 0, rate_per_km: 0, rate_per_min: 0 })}</h3><div className="offer-meta"><span>↔ {offer.route_distance_km ?? "—"} كم</span><span>◷ {offer.trip.departure_at.slice(11, 16)}</span><span>سعر المقعد {money(offer.seat_day_fare)}</span></div><MapPicker pickup={null} dropoff={null} mode="pickup" route={offer.route_geometry} onPick={() => undefined} /><button className="button button-primary button-wide" disabled={busy} onClick={() => void acceptOffer(offer)}>{busy ? "جاري القبول…" : "قبول المسار"}<span>←</span></button></article>)}</div> : <EmptyState icon="⌖" title="مفيش مسارات قريبة دلوقتي" text="حدّث موقعك ونطاق البحث، وهنعرض المسارات المطابقة لسيارتك هنا." action="تحديث المسارات" onAction={() => void loadOffers()} />}</div>;
}

function AdminWorkspace({ session, section, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; notifications: Notification[]; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [captains, setCaptains] = useState<Record<string, unknown>[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [otpSettings, setOtpSettings] = useState<{ enabled: boolean; provider: string; provider_ready: boolean } | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [stats, pending, otp] = await Promise.all([
      api<{ overview: Record<string, number> }>("/admin/analytics/overview", { token: session.token }),
      api<{ captains: Record<string, unknown>[] }>("/admin/captains?status=pending", { token: session.token }),
      api<{ otp: { enabled: boolean; provider: string; provider_ready: boolean } }>("/admin/settings/otp", { token: session.token }),
    ]);
    setOverview(stats.overview); setCaptains(pending.captains); setOtpSettings(otp.otp);
  }, [session.token]);
  useEffect(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, [refresh, notify]);
  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;
  const updateOtpSetting = async (enabled: boolean) => {
    setOtpBusy(true);
    try {
      const result = await api<{ otp: { enabled: boolean; provider: string; provider_ready: boolean } }>("/admin/settings/otp", { method: "PATCH", token: session.token, body: { enabled } });
      setOtpSettings(result.otp);
      notify(enabled ? "تم تشغيل توثيق الهاتف عبر SMS." : "تم إيقاف توثيق الهاتف مؤقتًا.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setOtpBusy(false); }
  };
  const decide = async (captainId: number, status: "approved" | "rejected") => {
    setBusyId(captainId);
    try { await api(`/admin/captains/${captainId}/verification`, { method: "POST", token: session.token, body: { status } }); await refresh(); notify(status === "approved" ? "تم توثيق الكابتن." : "تم رفض طلب التوثيق.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusyId(null); }
  };
  return <div className="admin-dashboard"><div className="admin-stats-grid">{[
    ["إجمالي المستخدمين", overview?.total_users], ["الركاب", overview?.total_riders], ["الكباتن", overview?.total_captains], ["كباتن بانتظار التوثيق", overview?.captains_pending_verification],
  ].map(([label, value]) => <div className="surface admin-stat" key={String(label)}><small>{label}</small><strong>{value ?? "—"}</strong></div>)}</div><section className="surface admin-review"><div className="section-title-row"><div><span className="eyebrow">إعدادات الحساب</span><h2>توثيق رقم الهاتف</h2><p>التشغيل متوقف افتراضيًا. يلزم إعداد بيانات مزوّد SMS في أسرار Supabase قبل تفعيله.</p></div><span className={otpSettings?.enabled ? "status-chip status-active" : "status-chip"}>{otpSettings?.enabled ? "مُفعّل" : "متوقف"}</span></div><label className="toggle-row"><input type="checkbox" checked={otpSettings?.enabled ?? false} disabled={otpBusy || !otpSettings || (!otpSettings.provider_ready && !otpSettings.enabled)} onChange={(event) => void updateOtpSetting(event.target.checked)} /><span>{otpBusy ? "جاري حفظ الإعداد…" : "تشغيل OTP للكباتن"}</span></label><p className="muted-text">{otpSettings?.provider_ready ? "مزود Twilio Verify جاهز." : "مزوّد SMS غير مهيأ؛ يمكنك إيقاف الميزة، ولن يسمح الخادم بتشغيلها قبل إعداد الأسرار."}</p></section><section className="surface admin-review"><div className="section-title-row"><div><span className="eyebrow">مراجعة الحسابات</span><h2>كباتن بانتظار التوثيق</h2><p>راجع بيانات المركبة قبل تفعيل استقبال المسارات.</p></div><button className="button button-outline button-small" onClick={() => void refresh()}>تحديث ↻</button></div>{captains.length ? captains.map((captain) => <div className="admin-captain-row" key={String(captain.user_id)}><span className="avatar">{String(captain.full_name).slice(0, 1)}</span><div className="admin-captain-info"><strong>{String(captain.full_name)}</strong><small>{String(captain.phone_number)} · {String(captain.vehicle_type_id)} · لوحة {String(captain.vehicle_plate)}</small><small>رخصة {String(captain.license_number)}</small></div><div className="admin-review-actions"><button className="button button-primary button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "approved")}>موافقة</button><button className="button button-quiet button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "rejected")}>رفض</button></div></div>) : <EmptyState icon="✓" title="مفيش طلبات معلقة" text="هتظهر هنا طلبات الكباتن الجديدة." />}</section><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">صحة المنصة</span><h2>نظرة عامة</h2></div><span className="online-pill"><i /> مباشر</span></div><div className="admin-summary-grid"><div><small>كباتن موثقون</small><strong>{overview?.captains_approved ?? "—"}</strong></div><div><small>رحلات جارية</small><strong>{overview?.total_trips_in_progress ?? "—"}</strong></div><div><small>رحلات مكتملة</small><strong>{overview?.total_trips_completed ?? "—"}</strong></div><div><small>اعتراضات مفتوحة</small><strong>{overview?.disputes_awaiting_admin ?? "—"}</strong></div></div><p className="muted-text">تسوية بوابة الدفع وعمولة الرحلات المشتركة مؤجلتان.</p></section></div>;
}
