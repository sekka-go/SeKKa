import { useEffect, useState, type FormEvent } from "react";
import MapPicker from "./MapPickerLoader";
import RiderRoutePreferences from "./RiderRoutePreferences";
import VerificationCenter from "./VerificationCenter";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { getConfiguredPushPublicKey, hasPushSubscription, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import { api, type Category, type GroupView, type Notification } from "../api";
import BrandLogo from "../components/BrandLogo";
import { readDates, todayInCairo } from "../lib/booking-dates";
import { useResolvedLocationPoints } from "../lib/use-location-addresses";
import type { RiderWorkspaceTrip, Session, Toast } from "../types";
export function Metric({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return <div className="surface metric-card"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></div>;
}

export function GroupSummary({ view, categories, onClick }: { view: GroupView; categories: Category[]; onClick: () => void }) {
  const group = view.group;
  const category = categories.find((item) => item.id === group.category_id);
  const seats = view.members.filter((m) => m.status === "active").reduce((sum, m) => sum + m.seats_reserved, 0);
  return <button className="surface group-summary" onClick={onClick}><div className="group-summary-top"><span className={`status-chip status-${group.status}`}>{statusLabel(group.status)}</span><span className="group-number">مجموعة #{group.id}</span></div><div className="group-summary-main"><span className="route-badge">↗</span><div><strong>{categoryName(category)}</strong><small>{group.package_type === "weekly" ? "باقة أسبوعية" : group.package_type === "monthly" ? "باقة شهرية" : "مشوار يومي"} · {view.members.length} ركاب</small></div><span className="group-price">{money(group.seat_day_fare)}</span></div><div className="seat-progress"><span>{seats} مقاعد محجوزة</span><div><i style={{ width: `${category ? Math.min(100, seats / category.seats * 100) : 0}%` }} /></div><small>{category?.seats ?? "—"} إجمالي المقاعد</small></div><div className="group-summary-foot"><span>⌖ {group.route_distance_km ?? "—"} كم</span><span>◷ {group.morning_departure} ذهاب · {group.return_departure} عودة</span><span>التفاصيل ←</span></div></button>;
}

export function GroupDetail({ view, categories, busy, action, notify: _notify, onEdit, currentUserId, token }: {
  view: GroupView; categories: Category[]; busy: boolean;
  action: (groupId: number, action: string, body?: unknown) => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
  onEdit: () => void; currentUserId: number; token: string;
}) {
  const { group, members, trips } = view;
  const category = categories.find((item) => item.id === group.category_id);
  const activeMembers = members.filter((m) => m.status === "active");
  const seats = activeMembers.reduce((sum, m) => sum + m.seats_reserved, 0);
  const dates = readDates(group.service_dates);
  const firstMember = members[0];
  const routeStops = useResolvedLocationPoints(token, firstMember ? [
    { lat: firstMember.pickup_lat, lng: firstMember.pickup_lng, kind: "pickup", sequence: 1 },
    { lat: firstMember.dropoff_lat, lng: firstMember.dropoff_lng, kind: "dropoff", sequence: 2 },
  ] : []);
  const [canceling, setCanceling] = useState(false);
  const [confirmCancellation, setConfirmCancellation] = useState<{ title: string; message: string; action: string } | null>(null);
  const cancel = async () => {
    setCanceling(true); await action(group.id, confirmCancellation?.action ?? "cancel"); setCanceling(false); setConfirmCancellation(null);
  };
  const canEdit = group.status === "waiting" && group.created_by_user_id === currentUserId && activeMembers.length === 1 && activeMembers[0]?.rider_user_id === currentUserId && trips.length === 0;
  const firstFutureDate = trips.find((trip) => trip.service_date >= todayInCairo() && trip.status !== "completed")?.service_date;

  return <div className="group-detail-layout"><div className="group-detail-main">
    <section className="surface detail-hero"><div className="detail-hero-top"><span className={`status-chip status-${group.status}`} aria-label="حالة الرحلة">{group.status === "needs_captain" ? "جاري البحث عن كابتن" : statusLabel(group.status)}</span><span className="group-number">مجموعة #{group.id}</span></div><h2>{categoryName(category)}</h2>
      {group.status === "price_review" && <div className="warning-panel"><span>!</span><div><strong>في تعديل على السعر</strong><p>راجع السعر الجديد واختار تكمل أو تخرج من المجموعة بدون غرامة.</p></div><div className="warning-actions"><button className="button button-primary button-small" disabled={busy} onClick={() => action(group.id, "price-decision", { action: "accept" })}>موافق</button><button className="button button-quiet button-small" disabled={busy} onClick={() => action(group.id, "price-decision", { action: "decline" })}>رفض</button></div></div>}

    </section>
    <details className="trip-extra-details"><summary>تفاصيل المشوار · المسار والركاب والمواعيد</summary>
      <div className="detail-route-map"><div className="section-title-row"><div><h3>خط السير</h3><p>ذهاب وعودة · الخريطة تعرض الطريق الفعلي</p></div>{!(group.route_geometry?.outbound_segments?.length || group.route_geometry?.return_segments?.length) && <span className="map-distance">{group.route_duration_min ?? "—"} د</span>}</div><MapPicker pickup={routeStops[0] ?? null} dropoff={routeStops[1] ?? null} mode="pickup" route={group.route_geometry} onPick={() => undefined} /></div>
    <section className="surface detail-section"><div className="section-title-row"><div><h3>الركاب والمقاعد</h3><p>{seats} مقاعد من {category?.seats ?? "—"} محجوزة</p></div></div><div className="rider-list">{members.map((member, index) => <div key={member.id} className={`rider-row ${member.status !== "active" ? "rider-muted" : ""}`}><div><strong>{index === 0 ? "أنت" : `راكب ${index + 1}`}</strong><small>{member.seats_reserved} مقعد · {member.status === "active" ? "مؤكد" : member.status === "awaiting_confirmation" ? "بانتظار التأكيد" : "غادر المجموعة"}</small></div>{member.price_decision === "pending" && group.status === "price_review" && <span className="rider-state">مطلوب ردك</span>}</div>)}</div></section>
    <section className="surface detail-section"><div className="section-title-row"><div><h3>أيام الخدمة</h3><p>الوقت المحلي للقاهرة</p></div></div><div className="service-date-list">{dates.map((date) => <div key={date} className="service-date-row"><span className="calendar-badge">{new Date(`${date}T12:00:00Z`).getUTCDate()}</span><div><strong>{formatDate(date)}</strong><small>{group.morning_departure} ذهاب · {group.return_departure} عودة</small></div><span className="date-price">{money(group.seat_day_fare)}</span></div>)}</div></section>
    </details>
  </div><aside className="group-detail-side"><section className="surface action-card"><h3>إدارة المشوار</h3>
      <div className="group-management-actions">
        {group.status === "waiting" && category && seats < category.seats && activeMembers.length < category.seats && <button className="button button-secondary" disabled={busy} onClick={() => action(group.id, "complete-seats")}>احجز باقي المقاعد</button>}
        {firstFutureDate && ["active", "minimum_met", "needs_captain"].includes(group.status) && <button className="button button-quiet" disabled={busy} onClick={() => setConfirmCancellation({ title: "إلغاء يوم الخدمة؟", message: `سيتم إلغاء رحلة ${formatDate(firstFutureDate)} وفق سياسة الإلغاء.`, action: `days/${firstFutureDate}/cancel` })}>إلغاء يوم الخدمة</button>}
        {canEdit && <button className="button button-edit-trip" disabled={busy} onClick={onEdit}>تعديل المشوار</button>}
        {!(["cancelled", "completed"].includes(group.status)) && <button className="button button-cancel-trip" disabled={busy || canceling} onClick={() => setConfirmCancellation({ title: group.package_type === "daily" ? "إلغاء المشوار؟" : "إلغاء الباقة؟", message: group.package_type === "daily" ? "هل تريد إلغاء هذا المشوار؟ راجع سياسة الإلغاء قبل التأكيد." : "سيتم إلغاء الباقة مع احتساب الاسترداد المستحق وفق سياسة الإلغاء.", action: "cancel" })}>{canceling ? "جارٍ الإلغاء…" : group.package_type === "daily" ? "إلغاء المشوار" : "إلغاء الباقة"}</button>}
      </div>
</section>
      {confirmCancellation && <div className="brand-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmCancellation(null); }}>
        <section className="brand-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-dialog-title" aria-describedby="cancel-dialog-message">
          <span className="brand-confirm-icon" aria-hidden="true">!</span><h2 id="cancel-dialog-title">{confirmCancellation.title}</h2><p id="cancel-dialog-message">{confirmCancellation.message}</p>
          <div className="brand-modal-actions"><button className="button button-quiet" disabled={busy || canceling} onClick={() => setConfirmCancellation(null)}>رجوع</button><button className="button button-cancel-trip" disabled={busy || canceling} onClick={() => void cancel()}>{canceling ? "جارٍ الإلغاء…" : "تأكيد الإلغاء"}</button></div>
        </section>
      </div>}
      
    </aside></div>;
}

export function TripList({ trips, categories }: { trips: RiderWorkspaceTrip[]; categories: Category[] }) {
  if (!trips.length) return <EmptyState icon="↗" title="مواعيدك هتظهر هنا" text="بعد ما تنضم لمجموعة، هتلاقي الذهاب والعودة في الجدول." />;
  return <div className="surface trip-table"><div className="trip-table-head"><span>المشوار</span><span>التاريخ والوقت</span><span>الفئة</span><span>الحالة</span></div>{trips.map((trip) => <div className="trip-table-row" key={`${trip.groupId}-${trip.id}`}><div><span className={`trip-arrow ${trip.direction}`}>{trip.direction === "outbound" ? "↗" : "↙"}</span><strong>مجموعة #{trip.groupId}</strong></div><div><strong>{formatDate(trip.service_date)}</strong><small>{trip.departure_at.slice(11, 16)}</small></div><span>{categoryName(categories.find((item) => item.id === trip.categoryId))}</span><span className={`status-chip status-${trip.status}`}>{statusLabel(trip.status)}</span></div>)}</div>;
}
export function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="surface empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{action && onAction && <button className="button button-primary button-small" onClick={onAction}>{action} <span>←</span></button>}</div>;
}
export function ErrorState({ title = "حصلت مشكلة في تحميل البيانات", text, action = "إعادة المحاولة", onAction }: { title?: string; text: string; action?: string; onAction: () => void }) {
  return <section className="surface error-state" role="alert"><span className="error-state-mark" aria-hidden="true">!</span><div><h3>{title}</h3><p>{text}</p></div><button className="button button-outline button-small" type="button" onClick={onAction}>{action}</button></section>;
}
export function LoadingCard({ text }: { text: string }) { return <div className="surface loading-card"><span className="spinner" /><strong>{text}</strong></div>; }

type NotificationCategory = "ride" | "chat" | "rating" | "alert" | "system";
function categoryFor(item: Notification): NotificationCategory {
  if (item.type) return item.type;
  const key = item.event_key;
  if (key.includes("chat")) return "chat";
  if (key.includes("rating") || key.includes("feedback")) return "rating";
  if (key.startsWith("broadcast:") || key.includes("verification") || key.startsWith("admin-")) return "system";
  if (["cancel", "delay", "route", "no-captain", "expired", "replacement", "price"].some((part) => key.includes(part))) return "alert";
  return "ride";
}
function notificationCopy(item: Notification) {
  const key = item.event_key;
  const title = key.startsWith("broadcast:") ? "رسالة من إدارة سِكّة" : key.includes("price") ? "تحديث على سعر المشوار" : key.includes("captain") ? "تحديث الكابتن" : key.includes("wait") ? "المشوار ما زال في الانتظار" : key.includes("invite") ? "دعوة لمشوار" : key.includes("cancel") ? "إلغاء المشوار" : key.includes("delay") ? "تأخير في المشوار" : key.includes("chat") ? "رسالة جديدة" : key.includes("rating") ? "تقييم جديد" : "تحديث جديد على مشوارك";
  const message = typeof item.payload.message === "string" ? item.payload.message : key.includes("price") ? "راجع تفاصيل المشوار للاطلاع على السعر المحدّث." : key.includes("captain") ? "فيه تحديث بخصوص الكابتن ورحلتك." : key.includes("wait") ? "تابع حالة المشوار واختار الإجراء المناسب." : key.includes("invite") ? "راجع تفاصيل الدعوة ورد عليها من رحلاتك." : key.includes("chat") ? "بعتلك رسالة في محادثة المشوار." : key.includes("rating") ? "وصلك تقييم جديد على رحلتك." : "هنبلغك بأي تغيير جديد يخص مشوارك.";
  return { title: typeof item.payload.title === "string" ? item.payload.title : title, message };
}
function relativeNotificationTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "دلوقتي";
  if (seconds < 3600) return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.floor(seconds / 60)) + " د";
  if (seconds < 86400) return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.floor(seconds / 3600)) + " س";
  if (seconds < 604800) return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.floor(seconds / 86400)) + " ي";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(value));
}
function notificationDayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
function NotificationRow({ item }: { item: Notification }) {
  const category = categoryFor(item);
  const { title, message } = notificationCopy(item);
  const hasActorName = typeof item.payload.actor_name === "string";
  const isSystemActor = item.actor_id == null && !hasActorName;
  const actor = hasActorName ? item.payload.actor_name as string : isSystemActor || category === "system" ? "سِكّة" : "عضو في سِكّة";
  const avatar = typeof item.payload.actor_avatar_url === "string" ? item.payload.actor_avatar_url : "";
  const route = [item.payload.origin, item.payload.destination].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ← ");
  const context = route || (typeof item.payload.trip_name === "string" ? item.payload.trip_name : item.group_id ? `مشوار #${item.group_id}` : "");
  const quote = typeof item.payload.quote === "string" ? item.payload.quote : typeof item.payload.preview === "string" ? item.payload.preview : "";
  const badge = category === "ride" ? "✓" : category === "chat" ? "●" : category === "rating" ? "★" : category === "alert" ? "!" : "•";
  return <div className={`notification-row category-${category}`}>
    <span className={`notification-avatar ${isSystemActor && !avatar ? "is-brand" : ""}`} aria-hidden="true">{avatar ? <img src={avatar} alt="" /> : isSystemActor ? <BrandLogo compact /> : actor.slice(0, 1)}</span>
    <span className="notification-category-badge" aria-label={category === "ride" ? "مشوار" : category === "chat" ? "محادثة" : category === "rating" ? "تقييم" : category === "alert" ? "تنبيه" : "من سِكّة"}>{badge}</span>
    <span className="notification-content"><span className="notification-main-copy"><strong>{actor}</strong> {message}</span><strong className="notification-title">{title}</strong>{context && <span className="notification-context">{context}</span>}{quote && <span className="notification-quote">“{quote}”</span>}</span>
    <time className="notification-time" dateTime={item.created_at} title={new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}>{relativeNotificationTime(item.created_at)}</time>
  </div>;
}

function NotificationHeader({ isLoading, refreshing, onRefresh, onToggleSettings, onClose, settingsLabel, settingsDisabled }: { isLoading: boolean; refreshing: boolean; onRefresh: () => void; onToggleSettings: () => void; onClose: () => void; settingsLabel: string; settingsDisabled: boolean }) {
  return <header className="notifications-header"><div><span className="eyebrow">مركز التحديثات</span><h2>الإشعارات</h2></div><div className="notification-header-actions"><button type="button" className="notification-icon-action" onClick={onRefresh} disabled={isLoading || refreshing} aria-label="تحديث الإشعارات" title="تحديث الإشعارات"><svg className={refreshing ? "is-spinning" : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M4.8 9a8 8 0 0 1 13.5-2L20 12M4 17v-5h5"/><path d="M19.2 15A8 8 0 0 1 5.7 17L4 12"/></svg></button><button type="button" className={`notification-icon-action ${settingsDisabled ? "is-unavailable" : ""}`} onClick={onToggleSettings} disabled={settingsDisabled} aria-label={settingsLabel} title={settingsLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.1.9-1.3 2.2-1.4-.5a7 7 0 0 1-1.5.9l-.3 1.5h-2.6l-.3-1.5a7 7 0 0 1-1.6-.9l-1.4.5-1.3-2.2 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.3-2.2 1.4.5a7 7 0 0 1 1.6-.9l.3-1.5H16l.3 1.5a7 7 0 0 1 1.5.9l1.4-.5 1.3 2.2-1.1.9a7 7 0 0 1 0 1.8Z"/></svg></button><button type="button" className="notification-icon-action notification-close" onClick={onClose} aria-label="إغلاق الإشعارات" title="إغلاق الإشعارات"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button></div></header>;
}

export function NotificationsPanel({ items, token, onRefresh, onPoolChanged, onEditGroup, allowWaitActions = false, notify, isLoading = false, error = "", onClose }: { items: Notification[]; token: string; onRefresh: () => Promise<void>; onPoolChanged?: () => Promise<void>; onEditGroup?: (groupId: number) => void; allowWaitActions?: boolean; notify: (text: string, tone?: Toast["tone"]) => void; isLoading?: boolean; error?: string; onClose: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([getConfiguredPushPublicKey(), hasPushSubscription()]).then(([publicKey, enabled]) => {
      if (active) { setPushReady(Boolean(publicKey)); setPushEnabled(Boolean(publicKey) && enabled); }
    }).catch(() => { if (active) setPushReady(false); });
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

  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); }
    finally { setRefreshing(false); }
  };

  const markRead = async (item: Notification) => {
    if (item.read_at) return;
    try { await api(`/pool/notifications/${item.id}/read`, { method: "POST", token }); await onRefresh(); }
    catch (error) { notify(errorText(error), "error"); }
  };
  const waitAction = async (item: Notification, action: "complete-seats" | "cancel") => {
    if (!item.group_id || !onPoolChanged) return;
    if (action === "cancel" && !window.confirm("إلغاء المجموعة الآن؟ لن يتم تحصيل أي مبلغ، وسيُسجل الاسترداد المستحق.")) return;
    try {
      await api(`/rider/pool/groups/${item.group_id}/${action}`, { method: "POST", token, body: {} });
      await onPoolChanged();
      notify(action === "cancel" ? "تم إلغاء المجموعة مجانًا." : "تم حجز المقاعد المتبقية للمجموعة.", "success");
    } catch (error) { notify(errorText(error), "error"); }
  };
  const deleteNotification = async (item: Notification) => {
    try { await api(`/pool/notifications/${item.id}/delete`, { method: "POST", token }); await onRefresh(); notify("تم حذف الإشعار.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
  };
  const muteTrip = async (item: Notification) => {
    try { await api(`/pool/notifications/${item.id}/mute`, { method: "POST", token }); await onRefresh(); notify("تم كتم إشعارات المشوار ده.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
  };
  const today = notificationDayKey(new Date().toISOString());
  const groupedItems = [
    { key: "new", label: "الجديد", items: items.filter((item) => !item.read_at) },
    { key: "today", label: "اليوم", items: items.filter((item) => Boolean(item.read_at) && notificationDayKey(item.created_at) === today) },
    { key: "earlier", label: "سابقاً", items: items.filter((item) => Boolean(item.read_at) && notificationDayKey(item.created_at) !== today) },
  ].filter((group) => group.items.length > 0);
  const renderItem = (item: Notification) => {
    const options = Array.isArray(item.payload.options) ? item.payload.options : [];
    const isWaitNotice = allowWaitActions && item.event_key.includes("wait-72h") && Boolean(item.group_id);
    const canEditGroup = allowWaitActions && Boolean(item.group_id && onEditGroup);
    return <article className={`notification-item ${item.read_at ? "is-read" : "is-unread"}`} key={item.id}>
      <div className="notification-main-action">
        <button type="button" className="notification-read-action" onClick={() => void markRead(item)} aria-label={`${item.read_at ? "" : "تعليم كمقروء: "}${notificationCopy(item).title}`}><NotificationRow item={item} /></button>
        <div className="notification-item-actions">
          {canEditGroup && <button type="button" className="notification-edit-action" onClick={() => onEditGroup?.(item.group_id!)} aria-label={`تعديل مشوار المجموعة رقم ${item.group_id}`}>تعديل</button>}
          <details className="notification-action-menu"><summary aria-label="إجراءات الإشعار" title="إجراءات الإشعار">⋯</summary><div className="notification-action-options">
            {!item.read_at && <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void markRead(item); }}>تعليم كمقروء</button>}
            {item.group_id !== null && <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void muteTrip(item); }}>كتم إشعارات المشوار</button>}
            <button type="button" className="is-danger" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void deleteNotification(item); }}>حذف الإشعار</button>
          </div></details>
        </div>
      </div>
      {isWaitNotice && options.length > 0 && <div className="notification-choice-actions"><span>اختار ما يناسبك:</span>{options.includes("wait") && <button className="button button-outline button-small" onClick={() => void markRead(item)}>الانتظار</button>}{options.includes("book_remaining_seats") && <button className="button button-secondary button-small" onClick={() => void waitAction(item, "complete-seats")}>حجز باقي المقاعد</button>}{options.includes("cancel_free") && <button className="button button-quiet button-small" onClick={() => void waitAction(item, "cancel")}>إلغاء مجاني</button>}</div>}
    </article>;
  };
  return <div className="notifications-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside id="sekka-notifications-drawer" className="notifications-drawer" role="dialog" aria-modal="true" aria-label="الإشعارات" onMouseDown={(event) => event.stopPropagation()}><section className="notifications-page"><NotificationHeader isLoading={isLoading} refreshing={refreshing} onRefresh={() => void refresh()} onToggleSettings={() => void togglePush()} onClose={onClose} settingsLabel={pushBusy ? "جارٍ تحديث إعدادات الإشعارات" : pushReady ? pushEnabled ? "إيقاف إشعارات هذا الجهاز" : "تفعيل إشعارات هذا الجهاز" : "إشعارات الجهاز غير مهيأة حاليًا"} settingsDisabled={!pushReady || pushBusy} />{isLoading ? <div className="notifications-loading" role="status"><span className="spinner" /><span>بنحمّل إشعاراتك…</span></div> : error ? <div className="notifications-error" role="alert"><span className="error-state-mark" aria-hidden="true">!</span><strong>تعذر تحميل الإشعارات</strong><p>{error}</p><button type="button" className="button button-outline button-small" onClick={() => void refresh()}>إعادة المحاولة</button></div> : items.length ? <div className="notification-list">{groupedItems.map((group) => <section className="notification-feed-group" key={group.key}><h3>{group.label}</h3>{group.items.map(renderItem)}</section>)}</div> : <div className="notifications-empty"><span className="notifications-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><h3>لا توجد إشعارات حالياً</h3><p>سنقوم بتبليغك بأي تحديثات جديدة تخص رحلاتك ومجموعاتك فور توفرها.</p></div>}</section></aside></div>;
}

export function AccountPanel({ session, notify }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ revoked_other_sessions: number }>("/auth/change-password", { method: "POST", token: session.token, body: { current_password: current, new_password: next } }); setCurrent(""); setNext(""); notify(`تم تحديث كلمة السر. تم إنهاء ${result.revoked_other_sessions} جلسة أخرى.`, "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };
  return <div className="account-grid"><section className="surface account-card"><span className="account-avatar">{session.user.full_name.slice(0, 1)}</span><span className="eyebrow">بيانات الحساب</span><h2>{session.user.full_name}</h2><p>{session.user.phone_number}</p><span className="status-chip status-active">{session.user.role === "rider" ? "راكب" : session.user.role === "captain" ? "كابتن" : "مدير النظام"}</span><div className="account-meta"><span>عضو منذ</span><strong>{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(session.user.created_at ?? Date.now()))}</strong></div></section>
    {session.user.role !== "admin" && <VerificationCenter session={session} notify={notify} />}
    {session.user.role === "rider" && <RiderRoutePreferences token={session.token} notify={notify} />}
    <details className="surface password-card settings-disclosure"><summary><span><span className="eyebrow">الأمان والخصوصية</span><strong>تغيير كلمة السر</strong><small>تقدر تفتح القسم عند الحاجة.</small></span><span className="settings-disclosure-chevron" aria-hidden="true">⌄</span></summary><form className="form-stack" onSubmit={submit}><label>كلمة السر الحالية<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></label><label>كلمة السر الجديدة<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري التحديث…" : "حفظ كلمة السر"}</button></form></details></div>;
}


