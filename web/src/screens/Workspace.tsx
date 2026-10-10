import { t } from "../i18n/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import AppIcon from "../components/AppIcon";
import WorkspaceNavigation, { type WorkspaceNavItem } from "../components/WorkspaceNavigation";
import { api, type Notification, type VerificationDocumentType } from "../api";
import type { NavKey, Session, Toast } from "../types";
import RiderWorkspace from "./RiderWorkspace";
import CaptainWorkspace from "./CaptainWorkspace";
import AdminWorkspace from "./AdminWorkspace";
import { NotificationsPanel } from "../components/workspace-shared";
import VerificationReminder from "../components/VerificationReminder";
import InfoPages, { type InfoPageKey } from "../components/InfoPages";
import MessagesWorkspace from "./MessagesWorkspace";
import ThemePreferenceCard, { type ThemePreference } from "../components/ThemePreferenceCard";
import LanguageSelector from "../components/LanguageSelector";
function cairoHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

function sectionAllowedForRole(section: NavKey, role: Session["user"]["role"]) {
  if (section === "account") return true;
  if (["admin", "adminUsers", "adminDocuments", "adminTrips", "adminComplaints", "adminFinance", "adminFinanceAdjustment", "adminPricing", "adminAudit", "broadcast"].includes(section)) return role === "admin";
  if (["offers", "publish", "captainTrips"].includes(section)) return role === "captain";
  if (section === "messages") return role === "rider" || role === "captain";
  return role === "rider";
}

function sectionForPath(path: string, role: Session["user"]["role"]): NavKey | null {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const routeSections: Record<string, NavKey> = {
    "/account": "account", "/admin": "admin", "/admin/users": "adminUsers", "/admin/documents": "adminDocuments", "/admin/trips": "adminTrips", "/admin/complaints": "adminComplaints", "/admin/finance": "adminFinance", "/admin/finance/adjustment": "adminFinanceAdjustment", "/admin/pricing": "adminPricing", "/admin/audit": "adminAudit", "/broadcast": "broadcast",
    "/captain": "offers", "/captain/trips": "captainTrips", "/publish": "publish",
    "/search": "booking", "/trips": "trips", "/messages": "messages", "/notifications": "notifications",
  };
  const section = routeSections[normalizedPath];
  return section && sectionAllowedForRole(section, role) ? section : null;
}

function pathForSection(section: NavKey) {
  const sectionPaths: Record<NavKey, string> = {
    home: "/", account: "/account", booking: "/search", trips: "/trips",
    notifications: "/notifications", messages: "/messages", offers: "/captain",
    publish: "/publish", captainTrips: "/captain/trips", admin: "/admin", adminUsers: "/admin/users", adminDocuments: "/admin/documents", adminTrips: "/admin/trips", adminComplaints: "/admin/complaints", adminFinance: "/admin/finance", adminFinanceAdjustment: "/admin/finance/adjustment", adminPricing: "/admin/pricing", adminAudit: "/admin/audit", broadcast: "/broadcast",
  };
  return sectionPaths[section];
}

export default function Workspace({ session, onSignOut, notify, themePreference, resolvedTheme, onThemePreferenceChange }: {
  session: Session; onSignOut: () => void; notify: (text: string, tone?: Toast["tone"]) => void;
  resolvedTheme: "light" | "dark";
  themePreference: ThemePreference; onThemePreferenceChange: (value: ThemePreference) => void;
}) {
  const initialSection: NavKey = session.user.role === "captain" ? "offers" : session.user.role === "admin" ? "admin" : "home";
  const [section, setSectionState] = useState<NavKey>(() => {
    const state = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey } | null;
    const routeSection = sectionForPath(window.location.pathname, session.user.role);
    if (routeSection) return routeSection;
    if (state?.sekkaWorkspace && state.sekkaSection && sectionAllowedForRole(state.sekkaSection, session.user.role)) return state.sekkaSection;
    return initialSection;
  });
  const [historyDepth, setHistoryDepth] = useState(() => {
    const state = window.history.state as { sekkaWorkspace?: boolean; sekkaIndex?: number; sekkaSection?: NavKey } | null;
    return state?.sekkaWorkspace && state.sekkaSection && sectionAllowedForRole(state.sekkaSection, session.user.role) && state.sekkaSection === sectionForPath(window.location.pathname, session.user.role) ? state.sekkaIndex ?? 0 : 0;
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const riderPoolRefreshRef = useRef<() => Promise<void>>(async () => undefined);
  const [navOpen, setNavOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPageKey | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [localHour, setLocalHour] = useState(cairoHour);

  const setSection = useCallback((next: NavKey, historyMode: "push" | "replace" = "push") => {
    const safeNext = sectionAllowedForRole(next, session.user.role) ? next : initialSection;
    const nextPath = pathForSection(safeNext);
    const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number } | null;
    if (current?.sekkaWorkspace && current.sekkaSection === safeNext) {
      if (window.location.pathname !== nextPath) window.history.replaceState(current, "", nextPath);
      setSectionState(safeNext);
      return;
    }
    const currentIndex = current?.sekkaWorkspace ? current.sekkaIndex ?? historyDepth : historyDepth;
    const nextIndex = historyMode === "replace"
      ? currentIndex
      : currentIndex + 1;
    const nextState = { ...current, sekkaWorkspace: true, sekkaSection: safeNext, sekkaIndex: nextIndex };
    if (historyMode === "replace") window.history.replaceState(nextState, "", nextPath);
    else window.history.pushState(nextState, "", nextPath);
    setHistoryDepth(nextIndex);
    setSectionState(safeNext);
  }, [historyDepth, initialSection, session.user.role]);

  useEffect(() => {
    const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;
    if (!current?.sekkaWorkspace) {
      const base = { ...current, sekkaWorkspace: true, sekkaSection: section, sekkaIndex: 0 };
      const path = pathForSection(section);
      window.history.replaceState(base, "", path);
      window.history.pushState({ ...base, sekkaGuard: true }, "", path);
    } else {
      const safeSection = sectionAllowedForRole(section, session.user.role) ? section : initialSection;
      const path = pathForSection(safeSection);
      const routeChanged = current.sekkaSection !== safeSection || window.location.pathname !== path;
      const normalized = { ...current, sekkaWorkspace: true, sekkaSection: safeSection, sekkaIndex: routeChanged ? 0 : current.sekkaIndex ?? 0 };
      if (routeChanged || current.sekkaIndex == null) window.history.replaceState(normalized, "", path);
      if ((normalized.sekkaIndex ?? 0) === 0 && !current.sekkaGuard) {
        window.history.pushState({ ...normalized, sekkaGuard: true }, "", path);
      }
    }

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;
      if (state?.sekkaWorkspace) {
        const requested = state.sekkaSection ?? initialSection;
        const restored = sectionAllowedForRole(requested, session.user.role) ? requested : initialSection;
        const depth = state.sekkaIndex ?? 0;
        setSectionState(restored);
        setHistoryDepth(depth);
        setNavOpen(false);
        const restoredPath = pathForSection(restored);
        if (restored !== requested || window.location.pathname !== restoredPath) window.history.replaceState({ sekkaWorkspace: true, sekkaSection: restored, sekkaIndex: depth, sekkaGuard: state.sekkaGuard }, "", restoredPath);
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
      const path = pathForSection(initialSection);
      window.history.replaceState({ sekkaWorkspace: true, sekkaSection: initialSection, sekkaIndex: 0 }, "", path);
      window.history.pushState({ sekkaWorkspace: true, sekkaSection: initialSection, sekkaIndex: 0, sekkaGuard: true }, "", path);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialSection, section, session.user.role]);

  useEffect(() => {
    const navigate = (event: Event) => setSection((event as CustomEvent<NavKey>).detail);
    window.addEventListener("sekka:navigate", navigate);
    return () => window.removeEventListener("sekka:navigate", navigate);
  }, [setSection]);
  const refreshNotifications = useCallback(async () => {
    setNotificationsError("");
    try { const result = await api<{ notifications: Notification[] }>("/pool/notifications", { token: session.token }); setNotifications(result.notifications); }
    catch (error) { setNotificationsError(t(error instanceof Error ? error.message : "تعذر تحميل الإشعارات. حاول مرة أخرى.")); }
    finally { setNotificationsLoaded(true); }
  }, [session.token]);
  const registerPoolRefresh = useCallback((refresh: () => Promise<void>) => { riderPoolRefreshRef.current = refresh; }, []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const editNotificationGroup = useCallback((groupId: number) => {
    closeNotifications();
    window.dispatchEvent(new CustomEvent<number>("sekka:edit-group", { detail: groupId }));
  }, [closeNotifications]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeNotifications(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [notificationsOpen, closeNotifications]);
  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);
  useEffect(() => {
    const timer = window.setInterval(() => setLocalHour(cairoHour()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshNotifications(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);
  const refreshUnreadMessages = useCallback(async () => {
    if (session.user.role === "admin") return;
    try {
      const result = await api<{ unread_total: number }>("/messages/conversations", { token: session.token });
      setUnreadMessageCount(result.unread_total);
    } catch { /* يظل شريط التنقل متاحًا حتى لو تعذر تحديث العدد */ }
  }, [session.token, session.user.role]);
  useEffect(() => { void refreshUnreadMessages(); const timer = window.setInterval(() => { void refreshUnreadMessages(); }, 30_000); return () => window.clearInterval(timer); }, [refreshUnreadMessages]);
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
    const invite = { title: t("أطلب سِكّة"), text: t("شارك الطريق مع ناس رايحة في نفس اتجاهك."), url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(invite);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(invite.url); notify(t("تم نسخ رابط سِكّة للمشاركة."), "success"); }
      else notify(t("شارك رابط التطبيق مع أصدقائك."), "info");
    } catch { /* تجاهل إغلاق نافذة المشاركة من المستخدم */ }
    setNavOpen(false);
  }, [notify]);
  useEffect(() => {
    const invite = () => { void inviteFriends(); };
    window.addEventListener("sekka:invite-friends", invite);
    return () => window.removeEventListener("sekka:invite-friends", invite);
  }, [inviteFriends]);

  const nav: WorkspaceNavItem[] = session.user.role === "rider"
    ? [{ key: "home", label: "الرئيسية", icon: "home" }, { key: "trips", label: "رحلاتي", icon: "trips" }, { key: "messages", label: "الرسائل", icon: "messages" }, { key: "account", label: "حسابي", icon: "user" }]
    : session.user.role === "captain"
      ? [{ key: "offers", label: "الرئيسية", icon: "home" }, { key: "publish", label: "مساراتي", icon: "route" }, { key: "captainTrips", label: "رحلاتي", icon: "trips" }, { key: "messages", label: "الرسائل", icon: "messages" }, { key: "account", label: "حسابي", icon: "user" }]
      : [{ key: "account", label: "حسابي", icon: "settings" }, { key: "admin", label: "نظرة عامة", icon: "chart" }, { key: "broadcast", label: "رسالة عامة", icon: "send" }];

  const activateNav = (item: { key: NavKey }) => {
    setInfoPage(null);
    if (item.key === "booking") window.dispatchEvent(new CustomEvent("sekka:booking-mode", { detail: "new" }));
    if (item.key === "notifications") setNotificationsOpen((open) => !open);
    else { setNotificationsOpen(false); setSection(item.key); }
    setNavOpen(false);
  };
  const titles: Record<NavKey, [string, string]> = {
    home: [localHour >= 17 ? "مساء الخير" : "صباح الخير", "مشوارك اليوم يبدأ من هنا"], booking: ["خطط لمشوارك", "اختار أيامك ونقاطك، وإحنا نرتّب الباقي"],
    trips: ["رحلاتي", "كل مشاويرك ومجموعاتك في مكان واحد"], notifications: ["الإشعارات", "آخر التحديثات الخاصة بمشاويرك"], messages: ["الرسائل", "تواصل مع المشاركين في مشاويرك ومجموعاتك"],
    account: ["حسابي", ""], offers: ["المسارات المتاحة", "اختار المسار المناسب لسيارتك ومواعيدك"],
    captainTrips: ["رحلاتي", "المسارات المقبولة وخطوات تنفيذها"], admin: ["لوحة الإدارة", "متابعة المنصة وتوثيق الكباتن"],
    publish: ["نشر مسار", "أضف خط سيرك ومواعيد تشغيله"],
    adminUsers: ["المستخدمون", "بحث وإدارة حسابات الركاب والكباتن"], adminDocuments: ["مراجعة المستندات", "طلبات توثيق الكباتن"],
    adminTrips: ["الرحلات والمجموعات", "متابعة حالات التشغيل الحالية"], adminComplaints: ["الاعتراضات", "مراجعة الاعتراضات على الدفعات"],
    adminFinance: ["المالية والدفتر", "قيود حسابية ومتابعة المستحقات"], adminFinanceAdjustment: ["إضافة تسوية دفترية", "أدخل بيانات التسوية وراجعها قبل الحفظ"], adminPricing: ["التسعير والعمولة", "إعداد رسوم المسارات وفئات المجموعات"],
    adminAudit: ["سجل التدقيق", "مراجعة تغييرات الإدارة"],
    broadcast: ["رسالة عامة", "إرسال إعلان محفوظ إلى جميع مستخدمي سِكّة"],
  };
  const [title, subtitle] = titles[section];
  const unread = notifications.filter((item) => !item.read_at).length;
  const openMissingVerification = useCallback((target: "phone" | VerificationDocumentType) => {
    localStorage.setItem(`sekka.verification.focus.${session.user.id}`, target);
    setSection("account");
  }, [session.user.id, setSection]);

  return <div className={`workspace ${notificationsOpen ? "notifications-open" : ""}`}>
    <WorkspaceNavigation items={nav} activeSection={section} notificationsOpen={notificationsOpen} unreadCount={unread} unreadMessageCount={unreadMessageCount} role={session.user.role} fullName={session.user.full_name} userId={session.user.id} token={session.token} open={navOpen} onSelect={activateNav} onClose={() => setNavOpen(false)} onAccount={() => { setInfoPage(null); setSection("account"); setNavOpen(false); }} onInvite={() => void inviteFriends()} onSignOut={onSignOut} onOpenInfo={(page) => { setInfoPage(page); setNotificationsOpen(false); setNavOpen(false); }} />
    <main className="main-area">
      <header className="topbar" onClick={() => { if (notificationsOpen) closeNotifications(); }}><div className="topbar-brand-group"><button type="button" className="mobile-menu" onClick={() => setNavOpen(true)} aria-label={t("فتح القائمة")}><AppIcon name="menu" /></button><button type="button" className="topbar-brand-home" onClick={() => { setSection(initialSection); setNavOpen(false); }} aria-label={t("العودة للرئيسية")}><BrandLogo className="topbar-brand" /></button></div><div className="topbar-actions"><span className={`connection-state ${isOnline ? "is-online" : "is-offline"}`} role="status"><i />{isOnline ? t("متصل") : t("غير متصل")}</span><button type="button" className={`icon-button notification-bell ${notificationsOpen ? "is-open" : ""}`} onClick={(event) => { event.stopPropagation(); setNotificationsOpen((open) => !open); }} aria-expanded={notificationsOpen} aria-controls="sekka-notifications-drawer" aria-label={unread > 0 ? `${t("الإشعارات")} · ${unread} ${t("غير مقروءة")}` : t("الإشعارات")}><AppIcon name="bell" size={21} />{unread > 0 && <i />}</button></div></header>
      <div className="page-content">{infoPage ? <InfoPages page={infoPage} onBack={() => setInfoPage(null)} /> : <>{section !== "booking" && <div className={`page-heading ${section === "account" ? "page-heading-account" : ""}`}><div><h1>{t(title)}</h1>{subtitle && <p>{t(subtitle)}</p>}</div>{session.user.role === "admin" && section.startsWith("admin") && section !== "admin" && <button type="button" className="button button-outline button-small" onClick={() => setSection("admin")}>{t("العودة للملخص")}</button>}</div>}
        {section === "account" && <div className="account-settings-stack"><ThemePreferenceCard value={themePreference} resolvedTheme={resolvedTheme} onChange={onThemePreferenceChange} /><LanguageSelector /></div>}
        {session.user.role !== "admin" && <VerificationReminder session={session} onOpen={openMissingVerification} visible={section !== "account" && !(session.user.role === "captain" && section === "offers")} />}
        {section === "messages" && <MessagesWorkspace session={session} notify={notify} />}
        {session.user.role === "rider" && section !== "messages" && <RiderWorkspace session={session} section={section} setSection={setSection} refreshNotifications={refreshNotifications} registerPoolRefresh={registerPoolRefresh} notify={notify} />}
        {session.user.role === "captain" && section !== "messages" && <CaptainWorkspace session={session} section={section} setSection={setSection} notify={notify} />}
        {session.user.role === "admin" && <AdminWorkspace session={session} section={section} refreshNotifications={refreshNotifications} notify={notify} />}</>}
      </div>
      {notificationsOpen && <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={session.user.role === "rider" ? () => riderPoolRefreshRef.current() : undefined} onEditGroup={session.user.role === "rider" ? editNotificationGroup : undefined} allowWaitActions={session.user.role === "rider"} notify={notify} isLoading={!notificationsLoaded} error={notificationsError} onClose={closeNotifications} />}
    </main>
  </div>;
}

