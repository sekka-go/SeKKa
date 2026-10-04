import { useEffect, useState, type FormEvent } from "react";
import MapPicker from "./MapPickerLoader";
import RiderRoutePreferences from "./RiderRoutePreferences";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { getConfiguredPushPublicKey, hasPushSubscription, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import { api, type Category, type GroupView, type Notification } from "../api";
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

export function GroupDetail({ view, categories, busy, action, notify, onEdit, currentUserId, token }: {
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
      {group.status === "waiting" && category && seats < category.seats && activeMembers.length < category.seats && <button className="button button-secondary button-wide" disabled={busy} onClick={() => action(group.id, "complete-seats")}>احجز باقي المقاعد</button>}
      {firstFutureDate && ["active", "minimum_met", "needs_captain"].includes(group.status) && <button className="button button-quiet button-wide" disabled={busy} onClick={() => setConfirmCancellation({ title: "إلغاء يوم الخدمة؟", message: `سيتم إلغاء رحلة ${formatDate(firstFutureDate)} وفق سياسة الإلغاء.`, action: `days/${firstFutureDate}/cancel` })}>إلغاء يوم الخدمة</button>}
      <div className="group-management-actions">
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
export function LoadingCard({ text }: { text: string }) { return <div className="surface loading-card"><span className="spinner" /><strong>{text}</strong></div>; }

function NotificationGlyph({ eventKey }: { eventKey: string }) {
  const broadcast = eventKey.startsWith("broadcast:");
  const price = eventKey.includes("price");
  const captain = eventKey.includes("captain");
  return <span className="notification-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{broadcast ? <><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 6 8-6"/></> : price ? <><path d="M12 3v18"/><path d="M17 7.5c0-1.7-2.2-2.5-5-2.5S7 6 7 8s2.2 3 5 3 5 1.1 5 3-2.2 3-5 3-5-.8-5-2.5"/></> : captain ? <><circle cx="12" cy="8" r="3"/><path d="M5 20c.6-3.4 3-5 7-5s6.4 1.6 7 5"/><path d="M19 5v4m-2-2h4"/></> : <><path d="M4 17.5h3l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m12.5 6.5 3 3"/><path d="M4 21h16"/></>}</svg></span>;
}

export function NotificationRow({ item, showGlyph = true }: { item: Notification; showGlyph?: boolean }) {
  const isBroadcast = item.event_key.startsWith("broadcast:");
  const title = isBroadcast ? (typeof item.payload.title === "string" ? item.payload.title : "رسالة من إدارة سِكّة") : item.event_key.includes("price") ? "تحديث على سعر المجموعة" : item.event_key.includes("captain") ? "تحديث الكابتن" : item.event_key.includes("wait") ? "المجموعة ما زالت في الانتظار" : item.event_key.includes("invite") ? "دعوة لمجموعة مشوار" : "تحديث جديد على مشوارك";
  const message = typeof item.payload.message === "string" ? item.payload.message : item.event_key.includes("price") ? "راجع تفاصيل مجموعتك للاطلاع على السعر المحدّث." : item.event_key.includes("captain") ? "يوجد تحديث بخصوص الكابتن ورحلتك." : item.event_key.includes("wait") ? "تابع حالة المجموعة واختار الإجراء المناسب." : item.event_key.includes("invite") ? "يمكنك مراجعة تفاصيل الدعوة والرد عليها من رحلاتك." : "سنوافيك بأي تغيير جديد يخص رحلتك أو مجموعتك.";
  const date = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at));
  return <div className={`notification-row ${item.read_at ? "read" : "unread"} ${showGlyph ? "" : "notification-row-with-edit"}`}>{showGlyph && <NotificationGlyph eventKey={item.event_key} />}<div className="notification-content"><strong>{title}</strong><p className="notification-message">{message}</p></div><div className="notification-time"><small>{item.group_id ? `مجموعة #${item.group_id}` : ""}</small><small>{date}</small>{!item.read_at && <i aria-label="غير مقروء" />}</div></div>;
}

function NotificationHeader({ isLoading, refreshing, onRefresh, onToggleSettings, onClose, settingsLabel, settingsDisabled }: { isLoading: boolean; refreshing: boolean; onRefresh: () => void; onToggleSettings: () => void; onClose: () => void; settingsLabel: string; settingsDisabled: boolean }) {
  return <header className="notifications-header"><div><span className="eyebrow">مركز التحديثات</span><h2>الإشعارات</h2></div><div className="notification-header-actions"><button type="button" className="notification-icon-action" onClick={onRefresh} disabled={isLoading || refreshing} aria-label="تحديث الإشعارات" title="تحديث الإشعارات"><svg className={refreshing ? "is-spinning" : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M4.8 9a8 8 0 0 1 13.5-2L20 12M4 17v-5h5"/><path d="M19.2 15A8 8 0 0 1 5.7 17L4 12"/></svg></button><button type="button" className={`notification-icon-action ${settingsDisabled ? "is-unavailable" : ""}`} onClick={onToggleSettings} disabled={settingsDisabled} aria-label={settingsLabel} title={settingsLabel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.1.9-1.3 2.2-1.4-.5a7 7 0 0 1-1.5.9l-.3 1.5h-2.6l-.3-1.5a7 7 0 0 1-1.6-.9l-1.4.5-1.3-2.2 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.3-2.2 1.4.5a7 7 0 0 1 1.6-.9l.3-1.5H16l.3 1.5a7 7 0 0 1 1.5.9l1.4-.5 1.3 2.2-1.1.9a7 7 0 0 1 0 1.8Z"/></svg></button><button type="button" className="notification-icon-action notification-close" onClick={onClose} aria-label="إغلاق الإشعارات" title="إغلاق الإشعارات"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg></button></div></header>;
}

export function NotificationsPanel({ items, token, onRefresh, onPoolChanged, onEditGroup, allowWaitActions = false, notify, isLoading = false, onClose, topOffset = 0 }: { items: Notification[]; token: string; onRefresh: () => Promise<void>; onPoolChanged?: () => Promise<void>; onEditGroup?: (groupId: number) => void; allowWaitActions?: boolean; notify: (text: string, tone?: Toast["tone"]) => void; isLoading?: boolean; onClose: () => void; topOffset?: number }) {
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
  return <div className="notifications-overlay" style={{ top: topOffset, height: `calc(100dvh - ${topOffset}px)` }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside id="sekka-notifications-drawer" className="notifications-drawer" role="dialog" aria-modal="true" aria-label="الإشعارات" onMouseDown={(event) => event.stopPropagation()}><section className="notifications-page"><NotificationHeader isLoading={isLoading} refreshing={refreshing} onRefresh={() => void refresh()} onToggleSettings={() => void togglePush()} onClose={onClose} settingsLabel={pushBusy ? "جارٍ تحديث إعدادات الإشعارات" : pushReady ? pushEnabled ? "إيقاف إشعارات هذا الجهاز" : "تفعيل إشعارات هذا الجهاز" : "إشعارات الجهاز غير مهيأة حاليًا"} settingsDisabled={!pushReady || pushBusy} />{isLoading ? <div className="notifications-loading" role="status"><span className="spinner" /><span>بنحمّل إشعاراتك…</span></div> : items.length ? <div className="notification-list">{items.map((item) => {
    const options = Array.isArray(item.payload.options) ? item.payload.options : [];
    const isWaitNotice = allowWaitActions && item.event_key.includes("wait-72h") && Boolean(item.group_id);
    const canEditGroup = allowWaitActions && Boolean(item.group_id && onEditGroup);
    return <article className={`notification-item ${item.read_at ? "is-read" : "is-unread"}`} key={item.id}><div className={`notification-main-action ${canEditGroup ? "has-edit-action" : ""}`}>{canEditGroup && <button type="button" className="notification-edit-action" onClick={() => onEditGroup?.(item.group_id!)} aria-label={`تعديل مشوار المجموعة رقم ${item.group_id}`}>تعديل</button>}<button type="button" className="notification-read-action" onClick={() => void markRead(item)} aria-label={`${item.read_at ? "" : "تعليم كمقروء: "}${item.event_key.startsWith("broadcast:") && typeof item.payload.title === "string" ? item.payload.title : "إشعار عن مشوارك"}`}><NotificationRow item={item} showGlyph={!canEditGroup} /></button></div>{isWaitNotice && options.length > 0 && <div className="notification-choice-actions"><span>اختار ما يناسبك:</span>{options.includes("wait") && <button className="button button-outline button-small" onClick={() => void markRead(item)}>الانتظار</button>}{options.includes("book_remaining_seats") && <button className="button button-secondary button-small" onClick={() => void waitAction(item, "complete-seats")}>حجز باقي المقاعد</button>}{options.includes("cancel_free") && <button className="button button-quiet button-small" onClick={() => void waitAction(item, "cancel")}>إلغاء مجاني</button>}</div>}</article>;
  })}</div> : <div className="notifications-empty"><span className="notifications-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span><h3>لا توجد إشعارات حالياً</h3><p>سنقوم بتبليغك بأي تحديثات جديدة تخص رحلاتك ومجموعاتك فور توفرها.</p></div>}</section></aside></div>;
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
    {session.user.role === "rider" && <RiderRoutePreferences token={session.token} notify={notify} />}
    <section className="surface password-card"><div className="surface-heading"><div><span className="eyebrow">الأمان والخصوصية</span><h2>تغيير كلمة السر</h2><p>اختار كلمة سر قوية ومختلفة عن الحالية.</p></div><span className="surface-icon">⌑</span></div><form className="form-stack" onSubmit={submit}><label>كلمة السر الحالية<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required /></label><label>كلمة السر الجديدة<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></label><button className="button button-primary button-small" disabled={busy}>{busy ? "جاري التحديث…" : "حفظ كلمة السر"}</button></form></section></div>;
}
