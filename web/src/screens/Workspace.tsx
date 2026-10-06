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
function cairoHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}
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
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const riderPoolRefreshRef = useRef<() => Promise<void>>(async () => undefined);
  const [navOpen, setNavOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<InfoPageKey | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [localHour, setLocalHour] = useState(cairoHour);

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
    const nextState = { ...current, sekkaWorkspace: true, sekkaSection: next, sekkaIndex: nextIndex };
    if (historyMode === "replace") window.history.replaceState(nextState, "", window.location.href);
    else window.history.pushState(nextState, "", window.location.href);
    setHistoryDepth(nextIndex);
    setSectionState(next);
  }, [historyDepth]);

  useEffect(() => {
    const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;
    if (!current?.sekkaWorkspace) {
      const base = { ...current, sekkaWorkspace: true, sekkaSection: section, sekkaIndex: 0 };
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
    setNotificationsError("");
    try { const result = await api<{ notifications: Notification[] }>("/pool/notifications", { token: session.token }); setNotifications(result.notifications); }
    catch (error) { setNotificationsError(error instanceof Error ? error.message : "تعذر تحميل الإشعارات. حاول مرة أخرى."); }
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

  const nav: WorkspaceNavItem[] = session.user.role === "rider"
    ? [{ key: "home", label: "الرئيسية", icon: "home" }, { key: "booking", label: "مشوار جديد", icon: "plus" }, { key: "trips", label: "رحلاتي", icon: "trips" }, { key: "notifications", label: "الإشعارات", icon: "bell" }, { key: "account", label: "حسابي", icon: "user" }]
    : session.user.role === "captain"
      ? [{ key: "offers", label: "المسارات", icon: "route" }, { key: "captainTrips", label: "رحلاتي", icon: "trips" }, { key: "notifications", label: "الإشعارات", icon: "bell" }, { key: "account", label: "حسابي", icon: "user" }]
      : [{ key: "admin", label: "نظرة عامة", icon: "chart" }, { key: "broadcast", label: "رسالة عامة", icon: "send" }, { key: "notifications", label: "الإشعارات", icon: "bell" }, { key: "account", label: "حسابي", icon: "settings" }];

  const activateNav = (item: { key: NavKey }) => {
    setInfoPage(null);
    if (item.key === "booking") window.dispatchEvent(new CustomEvent("sekka:booking-mode", { detail: "new" }));
    if (item.key === "notifications") setNotificationsOpen((open) => !open);
    else { setNotificationsOpen(false); setSection(item.key); }
    setNavOpen(false);
  };
  const titles: Record<NavKey, [string, string]> = {
    home: [localHour >= 17 ? "مساء الخير" : "صباح الخير", "مشوارك اليوم يبدأ من هنا"], booking: ["خطط لمشوارك", "اختار أيامك ونقاطك، وإحنا نرتّب الباقي"],
    trips: ["رحلاتي", "كل مشاويرك ومجموعاتك في مكان واحد"], notifications: ["الإشعارات", "آخر التحديثات الخاصة بمشاويرك"],
    account: ["حسابي", ""], offers: ["المسارات المتاحة", "اختار المسار المناسب لسيارتك ومواعيدك"],
    captainTrips: ["رحلاتي", "المسارات المقبولة وخطوات تنفيذها"], admin: ["لوحة الإدارة", "متابعة المنصة وتوثيق الكباتن"],
    broadcast: ["رسالة عامة", "إرسال إعلان محفوظ إلى جميع مستخدمي سِكّة"],
  };
  const [title, subtitle] = titles[section];
  const unread = notifications.filter((item) => !item.read_at).length;
  const openMissingVerification = useCallback((target: "phone" | VerificationDocumentType) => {
    localStorage.setItem(`sekka.verification.focus.${session.user.id}`, target);
    setSection("account");
  }, [session.user.id, setSection]);

  return <div className={`workspace ${notificationsOpen ? "notifications-open" : ""}`}>
    <WorkspaceNavigation items={nav} activeSection={section} notificationsOpen={notificationsOpen} unreadCount={unread} role={session.user.role} fullName={session.user.full_name} userId={session.user.id} token={session.token} open={navOpen} onSelect={activateNav} onClose={() => setNavOpen(false)} onAccount={() => { setInfoPage(null); setSection("account"); setNavOpen(false); }} onInvite={() => void inviteFriends()} onSignOut={onSignOut} onOpenInfo={(page) => { setInfoPage(page); setNotificationsOpen(false); setNavOpen(false); }} />
    <main className="main-area">
      <header className="topbar" onClick={() => { if (notificationsOpen) closeNotifications(); }}><div className="topbar-brand-group"><button type="button" className="mobile-menu" onClick={() => setNavOpen(true)} aria-label="فتح القائمة"><AppIcon name="menu" /></button><button type="button" className="topbar-brand-home" onClick={() => { setSection(initialSection); setNavOpen(false); }} aria-label="العودة للرئيسية"><BrandLogo className="topbar-brand" /></button></div><div className="topbar-actions"><span className={`connection-state ${isOnline ? "is-online" : "is-offline"}`} role="status"><i />{isOnline ? "متصل" : "غير متصل"}</span><button type="button" className={`icon-button notification-bell ${notificationsOpen ? "is-open" : ""}`} onClick={(event) => { event.stopPropagation(); setNotificationsOpen((open) => !open); }} aria-expanded={notificationsOpen} aria-controls="sekka-notifications-drawer" aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"}><AppIcon name="bell" size={21} />{unread > 0 && <i />}</button></div></header>
      <div className="page-content">{infoPage ? <InfoPages page={infoPage} onBack={() => setInfoPage(null)} /> : <>{section !== "booking" && <div className={`page-heading ${section === "account" ? "page-heading-account" : ""}`}><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>}
        {session.user.role !== "admin" && <VerificationReminder session={session} onOpen={openMissingVerification} visible={section !== "account" && !(session.user.role === "captain" && section === "offers")} />}
        {session.user.role === "rider" && <RiderWorkspace session={session} section={section} setSection={setSection} refreshNotifications={refreshNotifications} registerPoolRefresh={registerPoolRefresh} notify={notify} />}
        {session.user.role === "captain" && <CaptainWorkspace session={session} section={section} notify={notify} />}
        {session.user.role === "admin" && <AdminWorkspace session={session} section={section} refreshNotifications={refreshNotifications} notify={notify} />}</>}
      </div>
      {notificationsOpen && <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} onPoolChanged={session.user.role === "rider" ? () => riderPoolRefreshRef.current() : undefined} onEditGroup={session.user.role === "rider" ? editNotificationGroup : undefined} allowWaitActions={session.user.role === "rider"} notify={notify} isLoading={!notificationsLoaded} error={notificationsError} onClose={closeNotifications} />}
    </main>
  </div>;
}

