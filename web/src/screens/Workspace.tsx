import { useCallback, useEffect, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import { api, type Notification } from "../api";
import type { NavKey, Session, Toast } from "../types";
import RiderWorkspace from "./RiderWorkspace";
import CaptainWorkspace from "./CaptainWorkspace";
import AdminWorkspace from "./AdminWorkspace";
export default function Workspace({ session, onSignOut, notify }: { session: Session; onSignOut: () => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
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
  useEffect(() => {
    const timer = window.setInterval(() => { void refreshNotifications(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

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
      <div className="sidebar-label">{session.user.role === "rider" ? "مساحة الراكب" : session.user.role === "captain" ? "مساحة الكابتن" : "إدارة سِكّة"}</div>
      <nav aria-label="التنقل الرئيسي">{nav.map((item) => <button key={item.key} aria-current={section === item.key ? "page" : undefined} className={`nav-item ${section === item.key ? "nav-active" : ""}`} onClick={() => { setSection(item.key); setNavOpen(false); }}><span className="nav-icon">{item.icon}</span>{item.label}{item.key === "notifications" && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <button className="sidebar-profile" onClick={() => { setSection("account"); setNavOpen(false); }}><span className="avatar">{session.user.full_name.slice(0, 1)}</span><span className="profile-copy"><strong>{session.user.full_name}</strong><small>{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</small></span><span className="profile-more">···</span></button>
    </aside>
    {navOpen && <button className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setNavOpen(true)} aria-label="فتح القائمة">☰</button><div className="breadcrumbs"><span>سِكّة</span></div><div className="topbar-actions"><button className="icon-button notification-button" onClick={() => setSection("notifications")} aria-label="الإشعارات">♧{unread > 0 && <i />}</button><span className="topbar-divider" /><span className="topbar-user">{session.user.full_name}</span><span className="avatar avatar-small">{session.user.full_name.slice(0, 1)}</span><button className="text-action sign-out-action" onClick={onSignOut}>خروج</button></div></header>
      <div className="page-content"><div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div></div>
        {session.user.role === "rider" && <RiderWorkspace session={session} section={section} setSection={setSection} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
        {session.user.role === "captain" && <CaptainWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
        {session.user.role === "admin" && <AdminWorkspace session={session} section={section} notifications={notifications} refreshNotifications={refreshNotifications} notify={notify} />}
      </div>
    </main>
  </div>;
}
