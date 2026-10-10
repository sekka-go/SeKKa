import { t } from "../i18n/runtime";
import AppIcon, { type AppIconName } from "./AppIcon";
import type { NavKey } from "../types";
import type { Role } from "../api";
import type { InfoPageKey } from "./InfoPages";
import ProfileAvatar from "./ProfileAvatar";
import LanguageSelector from "./LanguageSelector";

export type WorkspaceNavItem = { key: NavKey; label: string; icon: AppIconName };

export default function WorkspaceNavigation({
  items, activeSection, notificationsOpen, unreadCount, unreadMessageCount, role, fullName, userId, token, open,
  onSelect, onClose, onAccount, onInvite, onSignOut, onOpenInfo,
}: {
  items: WorkspaceNavItem[];
  activeSection: NavKey;
  notificationsOpen: boolean;
  unreadCount: number;
  unreadMessageCount: number;
  role: Role;
  fullName: string;
  userId: number;
  token: string;
  open: boolean;
  onSelect: (item: WorkspaceNavItem) => void;
  onClose: () => void;
  onAccount: () => void;
  onInvite: () => void;
  onSignOut: () => void;
  onOpenInfo: (page: InfoPageKey) => void;
}) {
  const roleLabel = t(role === "rider" ? "راكب" : role === "captain" ? "كابتن" : "مدير النظام");
  const sectionLabel = t(role === "rider" ? "مساحة الراكب" : role === "captain" ? "مساحة الكابتن" : "إدارة سِكَّة");

  const renderItem = (item: WorkspaceNavItem, placement: "sidebar" | "mobile" = "sidebar") => {
    const active = notificationsOpen ? item.key === "notifications" : activeSection === item.key;
    return <button
      key={item.key}
      type="button"
      aria-current={item.key !== "notifications" && active ? "page" : undefined}
      aria-expanded={item.key === "notifications" ? notificationsOpen : undefined}
      className={`nav-item ${placement === "mobile" ? "mobile-tab-item" : ""} ${active ? "nav-active" : ""}`}
      onClick={() => onSelect(item)}
    >
      <span className="nav-icon"><AppIcon name={item.icon} size={19} /></span>
      <span className="nav-label">{t(item.label)}</span>
      {item.key === "notifications" && unreadCount > 0 && <b className="nav-count">{unreadCount}</b>}
      {item.key === "messages" && unreadMessageCount > 0 && <b className="nav-count">{unreadMessageCount}</b>}
    </button>;
  };

  return <>
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label={t("القائمة الرئيسية")}>
      <div className="sidebar-brand">
        <div className="sidebar-label">{sectionLabel}</div>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label={t("إغلاق القائمة")}><AppIcon name="close" /></button>
      </div>
      <div className="sidebar-section-heading">{t("التنقل")}</div>
      <nav className="sidebar-primary-nav" aria-label={t("التنقل الرئيسي")}>{items.map((item) => renderItem(item))}</nav>
      <div className="sidebar-utilities">
        <div className="sidebar-section-heading">{t("تواصل ومساعدة")}</div>
        <a className="nav-item" href="mailto:sekkago.app@gmail.com"><span className="nav-icon"><AppIcon name="support" size={19} /></span><span className="nav-label">{t("خدمة العملاء")}</span></a>
        <button type="button" className="nav-item" onClick={onInvite}><span className="nav-icon"><AppIcon name="users" size={19} /></span><span className="nav-label">{t("دعوة الأصدقاء")}</span></button>
        <div className="sidebar-info-links" aria-label={t("معلومات ومساعدة")}>
          <button type="button" onClick={() => onOpenInfo("terms")}>{t("الشروط والأحكام")}</button>
          <button type="button" onClick={() => onOpenInfo("privacy")}>{t("سياسة الخصوصية")}</button>
          <button type="button" onClick={() => onOpenInfo("faq")}>{t("الأسئلة الشائعة")}</button>
        </div>
        <LanguageSelector compact />
      </div>
      <div className="sidebar-spacer" />
      <button type="button" className="sidebar-profile" onClick={onAccount}>
        <ProfileAvatar userId={userId} token={token} name={fullName} />
        <span className="profile-copy"><strong>{fullName}</strong><small>{roleLabel}</small></span>
        <span className="profile-more" aria-hidden="true">···</span>
      </button>
      <button type="button" className="sidebar-signout" onClick={onSignOut}><AppIcon name="logout" size={18} />{t("تسجيل الخروج")}</button>
    </aside>
    <nav className="mobile-tabbar" aria-label={t("التنقل الرئيسي")}>{items.map((item) => renderItem(item, "mobile"))}</nav>
    {open && <button type="button" className="sidebar-scrim" onClick={onClose} aria-label={t("إغلاق القائمة")} />}
  </>;
}
