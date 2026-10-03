import { useEffect, useState, type FormEvent } from "react";
import MapPicker from "../MapPicker";
import RiderRoutePreferences from "./RiderRoutePreferences";
import { categoryName, errorText, formatDate, money, statusLabel } from "../lib/formatters";
import { getConfiguredPushPublicKey, hasPushSubscription, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import { api, type Category, type GroupView, type Notification } from "../api";
import { readDates, todayInCairo } from "../lib/booking-dates";
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

export function GroupDetail({ view, categories, busy, action, notify, onEdit, currentUserId }: {
  view: GroupView; categories: Category[]; busy: boolean;
  action: (groupId: number, action: string, body?: unknown) => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
  onEdit: () => void; currentUserId: number;
}) {
  const { group, members, trips } = view;
  const category = categories.find((item) => item.id === group.category_id);
  const activeMembers = members.filter((m) => m.status === "active");
  const seats = activeMembers.reduce((sum, m) => sum + m.seats_reserved, 0);
  const dates = readDates(group.service_dates);
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
      <div className="detail-route-map"><div className="section-title-row"><div><h3>خط السير</h3><p>ذهاب وعودة · الخريطة تعرض الطريق الفعلي</p></div>{!(group.route_geometry?.outbound_segments?.length || group.route_geometry?.return_segments?.length) && <span className="map-distance">{group.route_duration_min ?? "—"} د</span>}</div><MapPicker pickup={members[0] ? { lat: members[0].pickup_lat, lng: members[0].pickup_lng } : null} dropoff={members[0] ? { lat: members[0].dropoff_lat, lng: members[0].dropoff_lng } : null} mode="pickup" route={group.route_geometry} onPick={() => undefined} /></div>
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

export function NotificationRow({ item }: { item: Notification }) {
  const isBroadcast = item.event_key.startsWith("broadcast:");
  const title = isBroadcast ? (typeof item.payload.title === "string" ? item.payload.title : "رسالة من إدارة سِكّة") : item.event_key.includes("price") ? "تحديث على سعر المجموعة" : item.event_key.includes("captain") ? "تحديث الكابتن" : item.event_key.includes("wait") ? "المجموعة ما زالت في الانتظار" : item.event_key.includes("invite") ? "دعوة لمجموعة مشوار" : "تحديث جديد على مشوارك";
  const message = isBroadcast && typeof item.payload.message === "string" ? item.payload.message : "";
  const date = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at));
  return <div className={`notification-row ${item.read_at ? "read" : ""}`}><span className="notification-mark">{isBroadcast ? "✉" : item.event_key.includes("price") ? "٪" : item.event_key.includes("captain") ? "⌖" : "↗"}</span><div><strong>{title}</strong>{message && <p className="notification-message">{message}</p>}<small>{item.group_id ? `مجموعة #${item.group_id} · ` : ""}{date}</small></div>{!item.read_at && <i />}</div>;
}

export function NotificationsPanel({ items, token, onRefresh, onPoolChanged, allowWaitActions = false, notify }: { items: Notification[]; token: string; onRefresh: () => Promise<void>; onPoolChanged?: () => Promise<void>; allowWaitActions?: boolean; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
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
  return <section className="surface notifications-panel"><div className="section-title-row"><div><h2>كل الإشعارات</h2><p>الإشعارات محفوظة داخل حسابك</p></div><div className="notification-controls">{pushReady ? <button className="button button-outline button-small" onClick={() => void togglePush()} disabled={pushBusy}>{pushBusy ? "جاري التحديث…" : pushEnabled ? "إيقاف إشعارات الجهاز" : "تفعيل إشعارات الجهاز"}</button> : import.meta.env.PROD ? <small className="push-unavailable-note">إشعارات الجهاز غير مهيأة حاليًا</small> : <button className="button button-outline button-small" disabled>تفعيل الإشعارات بعد النشر</button>}<button className="text-action" onClick={() => void onRefresh()}>تحديث ↻</button></div></div>{items.length ? items.map((item) => {
    const options = Array.isArray(item.payload.options) ? item.payload.options : [];
    const isWaitNotice = allowWaitActions && item.event_key.includes("wait-72h") && Boolean(item.group_id);
    return <article className="notification-button-row" key={item.id}><button className="notification-main-action" onClick={() => void markRead(item)}><NotificationRow item={item} /><span className="notification-open">{item.read_at ? "" : "تعليم كمقروء"}</span></button>{isWaitNotice && options.length > 0 && <div className="notification-choice-actions"><span>اختار ما يناسبك:</span>{options.includes("wait") && <button className="button button-outline button-small" onClick={() => void markRead(item)}>الانتظار</button>}{options.includes("book_remaining_seats") && <button className="button button-secondary button-small" onClick={() => void waitAction(item, "complete-seats")}>حجز باقي المقاعد</button>}{options.includes("cancel_free") && <button className="button button-quiet button-small" onClick={() => void waitAction(item, "cancel")}>إلغاء مجاني</button>}</div>}</article>;
  }) : <EmptyState icon="◌" title="مفيش إشعارات لسه" text="هنبلغك بأي تحديث على رحلاتك ومجموعاتك." />}</section>;
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
