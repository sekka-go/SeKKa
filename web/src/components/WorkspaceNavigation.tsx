import AppIcon, { type AppIconName } from "./AppIcon";
import type { NavKey } from "../types";
import type { Role } from "../api";
import type { InfoPageKey } from "./InfoPages";

export type WorkspaceNavItem = { key: NavKey; label: string; icon: AppIconName };

export default function WorkspaceNavigation({
  items, activeSection, notificationsOpen, unreadCount, role, fullName, open,
  onSelect, onClose, onAccount, onInvite, onSignOut, onOpenInfo,
}: {
  items: WorkspaceNavItem[];
  activeSection: NavKey;
  notificationsOpen: boolean;
  unreadCount: number;
  role: Role;
  fullName: string;
  open: boolean;
  onSelect: (item: WorkspaceNavItem) => void;
  onClose: () => void;
  onAccount: () => void;
  onInvite: () => void;
  onSignOut: () => void;
  onOpenInfo: (page: InfoPageKey) => void;
}) {
  const roleLabel = role === "rider" ? "راكب" : role === "captain" ? "كابتن" : "مدير النظام";
  const sectionLabel = role === "rider" ? "مساحة الراكب" : role === "captain" ? "مساحة الكابتن" : "إدارة سِكَّة";

  const renderItem = (item: WorkspaceNavItem, mobile = false) => {
    const active = item.key === "notifications" ? notificationsOpen : activeSection === item.key;
    return <button
      key={item.key}
      type="button"
      aria-current={item.key !== "notifications" && active ? "page" : undefined}
      aria-expanded={item.key === "notifications" ? notificationsOpen : undefined}
      className={`nav-item ${active ? "nav-active" : ""} ${mobile ? "mobile-tab" : ""}`}
      onClick={() => onSelect(item)}
    >
      <span className="nav-icon"><AppIcon name={item.icon} size={mobile ? 21 : 19} /></span>
      <span className="nav-label">{item.label}</span>
      {item.key === "notifications" && unreadCount > 0 && <b className="nav-count">{unreadCount}</b>}
    </button>;
  };

  return <>
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="القائمة الرئيسية">
      <div className="sidebar-brand">
        <div className="sidebar-label">{sectionLabel}</div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><AppIcon name="close" /></button>
      </div>
      <nav aria-label="التنقل الرئيسي">{items.map((item) => renderItem(item))}</nav>
      <div className="sidebar-utilities">
        <a className="nav-item" href="mailto:sekkago.app@gmail.com"><span className="nav-icon"><AppIcon name="support" size={19} /></span><span className="nav-label">خدمة العملاء والإدارة</span></a>
        <button type="button" className="nav-item" onClick={onInvite}><span className="nav-icon"><AppIcon name="users" size={19} /></span><span className="nav-label">دعوة الأصدقاء</span></button>
        <div className="sidebar-info-links" aria-label="معلومات ومساعدة">
          <button type="button" onClick={() => onOpenInfo("terms")}>الشروط والأحكام</button>
          <button type="button" onClick={() => onOpenInfo("privacy")}>سياسة الخصوصية</button>
          <button type="button" onClick={() => onOpenInfo("faq")}>الأسئلة الشائعة</button>
        </div>
      </div>
      <div className="sidebar-spacer" />
      <button type="button" className="sidebar-profile" onClick={onAccount}>
        <span className="avatar">{fullName.slice(0, 1)}</span>
        <span className="profile-copy"><strong>{fullName}</strong><small>{roleLabel}</small></span>
        <span className="profile-more" aria-hidden="true">···</span>
      </button>
      <button type="button" className="sidebar-signout" onClick={onSignOut}><AppIcon name="logout" size={18} />تسجيل الخروج</button>
    </aside>
    {open && <button type="button" className="sidebar-scrim" onClick={onClose} aria-label="إغلاق القائمة" />}
    <nav className="mobile-tabbar" aria-label="التنقل السريع">{items.map((item) => renderItem(item, true))}</nav>
  </>;
}
