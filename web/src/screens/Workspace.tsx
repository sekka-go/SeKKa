import { useCallback, useEffect, useRef, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { api, type Notification } from "../api";
import type { NavKey, Session, Toast } from "../types";
import RiderWorkspace from "./RiderWorkspace";
import CaptainWorkspace from "./CaptainWorkspace";
import AdminWorkspace from "./AdminWorkspace";
import { NotificationsPanel } from "../components/workspace-shared";
export default function Workspace({ session, onSignOut, notify }: { session: Session; onSignOut: () => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const initialSection: NavKey = session.user.role === "captain" ? "offers" : session.user.role === "admin" ? "admin" : "home";
  const [section, setSectionState] = useState<NavKey>(() => {
    const state = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey } | null;
    return state?.sekkaWorkspace && state.sekkaSection ? state.sekkaSection : initialSection;
  });
  const [historyDepth, setHistoryDepth] = useState(() => {
    const state = window.history.state as { sekkaWorkspace?: boolean; sekkaIndex?: number } | null;
    return state?.sekkaWorkspace ? state.sekkaIndex ?? 0 : 0;
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const riderPoolRefreshRef = useRef<() => Promise<void>>(async () => undefined);
  const [navOpen, setNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const setSection = useCallback((next: NavKey, historyMode: "push" | "replace" = "push") => {
    const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number } | null;
    if (current?.sekkaWorkspace && current.sekkaSection === next) {
      setSectionState(next);
      return;
    }
    const currentIndex = current?.sekkaWorkspace ? current.sekkaIndex ?? historyDepth : historyDepth;
    const nextIndex = historyMode === "replace"
      ? currentIndex
      : currentIndex + 1;
    const nextState = { ...(current ?? {}), sekkaWorkspace: true, sekkaSection: next, sekkaIndex: nextIndex };
    if (historyMode === "replace") window.history.replaceState(nextState, "", window.location.href);
    else window.history.pushState(nextState, "", window.location.href);
    setHistoryDepth(nextIndex);
    setSectionState(next);
  }, [historyDepth]);

  useEffect(() => {
    const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;
    if (!current?.sekkaWorkspace) {
      const base = { ...(current ?? {}), sekkaWorkspace: true, sekkaSection: section, sekkaIndex: 0 };
      window.history.replaceState(base, "", window.location.href);
      window.history.pushState({ ...base, sekkaGuard: true }, "", window.location.href);
    } else if ((current.sekkaIndex ?? 0) === 0 && !current.sekkaGuard) {
      window.history.pushState({ ...current, sekkaGuard: true }, "", window.location.href);
    }

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;
      if (state?.sekkaWorkspace) {
        const restored = state.sekkaSection ?? initialSection;
        const depth = state.sekkaIndex ?? 0;
        setSectionState(restored);
        setHistoryDepth(depth);
        setNavOpen(false);
        if (depth === 0 && !state.sekkaGuard) {
          window.setTimeout(() => {
            const latest = window.history.state as { sekkaWorkspace?: boolean; sekkaGuard?: boolean } | null;
            if (latest?.sekkaWorkspace && !latest.sekkaGuard) {
              window.history.pushState({ ...latest, sekkaGuard: true }, "", window.location.href);
            }
          }, 0);
        }
        return;
      }

      setSectionState(initialSection);
      setHistoryDepth(0);
      setNavOpen(false);
      window.history.pushState({ sekkaWorkspace: true, sekkaSection: initialSection, sekkaIndex: 0, sekkaGuard: true }, "", window.location.href);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialSection]);

  useEffect(() => {
    const navigate = (event: Event) => setSection((event as CustomEvent<NavKey>).detail);
    window.addEventListener("sekka:navigate", navigate);
    return () => window.removeEventListener("sekka:navigate", navigate);
  }, [setSection]);
  const refreshNotifications = useCallback(async () => {
    try { const result = await api<{ notifications: Notification[] }>("/pool/notifications", { token: session.token }); setNotifications(result.notifications); }
    catch { /* session banner handles expiry */ }
    finally { setNotificationsLoaded(true); }
  }, [session.token]);
  const registerPoolRefresh = useCallback((refresh: () => Promise<void>) => { riderPoolRefreshRef.current = refresh; }, []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  useEffect(() => {
    if (!notificationsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeNotifications(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notificationsOpen, closeNotifications]);
  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshNotifications(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);
  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);
  const inviteFriends = useCallback(async () => {
    const invite = { title: "أطلب سِكّة", text: "شارك الطريق مع ناس رايحة في نفس اتجاهك.", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(invite);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(invite.url); notify("تم نسخ رابط سِكّة للمشاركة.", "success"); }
      else notify("شارك رابط التطبيق مع أصدقائك.", "info");
    } catch { /* تجاهل إغلاق نافذة المشاركة من المستخدم */ }
    setNavOpen(false);
  }, [notify]);
  useEffect(() => {
    const invite = () => { void inviteFriends(); };
    window.addEventListener("sekka:invite-friends", invite);
    return () => window.removeEventListener("sekka:invite-friends", invite);
  }, [inviteFriends]);

  const nav: { key: NavKey; label: string; icon: string }[] = session.user.role === "rider"
    ? [{ key: "home", label: "الرئيسية", icon: "⌂" }, { key: "booking", label: "مشوار جديد", icon: "＋" }, { key: "trips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الرسائل", icon: "✉" }, { key: "account", label: "الإعدادات", icon: "⚙" }]
    : session.user.role === "captain"
      ? [{ key: "offers", label: "العروض", icon: "⌖" }, { key: "captainTrips", label: "رحلاتي", icon: "↗" }, { key: "notifications", label: "الرسائل", icon: "✉" }, { key: "account", label: "الإعدادات", icon: "⚙" }]
      : [{ key: "admin", label: "نظرة عامة", icon: "▦" }, { key: "broadcast", label: "بث الرسائل", icon: "◉" }, { key: "notifications", label: "الرسائل", icon: "✉" }, { key: "account", label: "الإعدادات", icon: "⚙" }];

  const titles: Record<NavKey, [string, string]> = {
    home: ["صباح الخير", "طريقك اليوم يبدأ من هنا"], booking: ["خطط لمشوارك", "اختار أيامك ونقاطك، وإحنا نرتّب الباقي"],
    trips: ["رحلاتي", "كل مشاويرك ومجموعاتك في مكان واحد"], notifications: ["الإشعارات", "آخر التحديثات الخاصة بمشاويرك"],
    account: ["حسابي", "بياناتك وإعدادات الأمان"], offers: ["المسارات المتاحة", "اختار المسار المناسب لسيارتك ومواعيدك"],
    captainTrips: ["رحلاتي", "المسارات المقبولة وخطوات تنفيذها"], admin: ["لوحة الإدارة", "متابعة المنصة وتوثيق الكباتن"],
    broadcast: ["رسالة عامة", "إرسال إعلان محفوظ إلى جميع مستخدمي سِكّة"],
  };
  const [title, subtitle] = titles[section];
  const unread = notifications.filter((item) => !item.read_at).length;

  return <div className="workspace">
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><div className="sidebar-label">{session.user.role === "rider" ? "مساحة الراكب" : session.user.role === "captain" ? "مساحة الكابتن" : "إدارة سِكّة"}</div><button className="sidebar-close" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة">×</button></div>
      <nav aria-label="التنقل الرئيسي">{nav.map((item) => <button key={item.key} aria-current={item.key !== "notifications" && section === item.key ? "page" : undefined} className={`nav-item ${item.key !== "notifications" && section === item.key ? "nav-active" : ""}`} onClick={() => { if (item.key === "booking") window.dispatchEvent(new CustomEvent("sekka:booking-mode", { detail: "new" })); if (item.key === "notifications") setNotificationsOpen(true); else setSection(item.key); setNavOpen(false); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.key === "notifications" && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}</nav>
      <div className="sidebar-utilities"><a className="nav-item" href="mailto:sekkago.app@gmail.com"><span className="nav-icon">؟</span>خدمة العملاء والإدارة</a><button className="nav-item" onClick={() => void inviteFriends()}><span className="nav-icon">↗</span>دعوة الأصدقاء</button></div>
      <div className="sidebar-spacer" />
      <button className="sidebar-profile" onClick={() => { setSection("account"); setNavOpen(false); }}><span className="avatar">{session.user.full_name.slice(0, 1)}</span><span className="profile-copy"><strong>{session.user.full_name}</strong><small>{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</small></span><span className="profile-more">···</span></button>
      <button className="sidebar-signout" onClick={onSignOut}>تسجيل الخروج</button>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة" />}
    <main className="main-area">
      <header className="topbar" onClick={() => { if (notificationsOpen) closeNotifications(); }}><div className="topbar-brand-group"><button className="mobile-menu" onClick={() => setNavOpen(true)} aria-label="فتح القائمة">☰</button><button type="button" className="topbar-brand-home" onClick={() => { setSection(initialSection); setNavOpen(false); }} aria-label="العودة للرئيسية"><BrandLogo className="topbar-brand" /></button></div><div className="topbar-actions"><span className={`connection-state ${isOnline ? "is-online" : "is-offline"}`} role="status"><i />{isOnline ? "متصل" : "غير متصل"}</span><button className={`icon-button notification-bell ${notificationsOpen ? "is-open" : ""}`} onClick={(event) => { event.stopPropagation(); setNotificationsOpen((open) => !open); }} aria-expanded={notificationsOpen} aria-controls="sekka-notifications-drawer" aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{unread > 0 && <i />}</button></div></header>
      <div className="page-content">{section !== "booking" && <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div></div>}
        {session.user.role === "rider" && <RiderWorkspace session={session} section={section} setSection={setSection} refreshNotifications={refreshNotifications} registerPoolRefresh={registerPoolRefresh} notify={notify} />}
        {session.user.role === "captain" && <CaptainWorkspace session={session} section={section} notify={notify} />}
        {session.user.role === "admin" && <AdminWorkspace session={session} section={section} refreshNotifications={refreshNotifications} notify={notify} />}
      </div>
      {notificationsOpen && <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={session.user.role === "rider" ? () => riderPoolRefreshRef.current() : undefined} allowWaitActions={session.user.role === "rider"} notify={notify} isLoading={!notificationsLoaded} onClose={closeNotifications} />}
    </main>
  </div>;
}
