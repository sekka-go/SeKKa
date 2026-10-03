import { useCallback, useEffect, useState } from "react";
import { api, type Notification } from "../api";
import { errorText, money } from "../lib/formatters";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, EmptyState, NotificationsPanel } from "../components/workspace-shared";
export default function AdminWorkspace({ session, section, notifications, refreshNotifications, notify }: {
  session: Session; section: NavKey; notifications: Notification[]; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [poolOverview, setPoolOverview] = useState<Record<string, number | boolean | string> | null>(null);
  const [captains, setCaptains] = useState<Record<string, unknown>[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    const [stats, pending, pool] = await Promise.all([
      api<{ overview: Record<string, number> }>("/admin/analytics/overview", { token: session.token }),
      api<{ captains: Record<string, unknown>[] }>("/admin/captains?status=pending", { token: session.token }),
      api<{ overview: Record<string, number | boolean | string> }>("/admin/pool/overview", { token: session.token }),
    ]);
    setOverview(stats.overview); setCaptains(pending.captains); setPoolOverview(pool.overview);
  }, [session.token]);
  useEffect(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, [refresh, notify]);
  useEffect(() => {
    if (section !== "admin") return;
    const timer = window.setInterval(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, 30_000);
    return () => window.clearInterval(timer);
  }, [section, refresh, notify]);
  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "notifications") return <NotificationsPanel items={notifications} token={session.token} onRefresh={refreshNotifications} notify={notify} />;
  const decide = async (captainId: number, status: "approved" | "rejected") => {
    setBusyId(captainId);
    try { await api(`/admin/captains/${captainId}/verification`, { method: "POST", token: session.token, body: { status } }); await refresh(); notify(status === "approved" ? "تم توثيق الكابتن." : "تم رفض طلب التوثيق.", "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusyId(null); }
  };
  return <div className="admin-dashboard"><div className="admin-stats-grid"><div className="surface admin-stat"><small>إجمالي المستخدمين</small><strong>{overview?.total_users ?? "—"}</strong></div><details className="surface admin-user-breakdown"><summary>تفاصيل المستخدمين</summary><div className="admin-summary-grid"><div><small>الركاب</small><strong>{overview?.total_riders ?? "—"}</strong></div><div><small>الكباتن</small><strong>{overview?.total_captains ?? "—"}</strong></div></div></details></div><section className="surface admin-review"><div className="section-title-row"><div><span className="eyebrow">مراجعة الحسابات</span><h2>كباتن بانتظار التوثيق</h2><p>راجع بيانات المركبة قبل تفعيل استقبال المسارات.</p></div><button className="button button-outline button-small" onClick={() => void refresh()}>تحديث ↻</button></div>{captains.length ? captains.map((captain) => <div className="admin-captain-row" key={String(captain.user_id)}><span className="avatar">{String(captain.full_name).slice(0, 1)}</span><div className="admin-captain-info"><strong>{String(captain.full_name)}</strong><small>{String(captain.phone_number)} · {String(captain.vehicle_type_id)} · لوحة {String(captain.vehicle_plate)}</small><small>رخصة {String(captain.license_number)}</small></div><div className="admin-review-actions"><button className="button button-primary button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "approved")}>موافقة</button><button className="button button-quiet button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "rejected")}>رفض</button></div></div>) : <EmptyState icon="✓" title="مفيش طلبات معلقة" text="هتظهر هنا طلبات الكباتن الجديدة." />}</section><details className="admin-secondary-details"><summary>تفاصيل التشغيل والمستحقات</summary><div className="admin-secondary-content"><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">مجموعات سِكّة</span><h2>تشغيل الرحلات والدفتر المؤجل</h2></div><button className="button button-outline button-small" onClick={() => void refresh()}>تحديث ↻</button></div><div className="admin-summary-grid"><div><small>مجموعات الانتظار</small><strong>{poolOverview?.waiting_groups ?? "—"}</strong></div><div><small>بانتظار موافقة السعر</small><strong>{poolOverview?.price_review_groups ?? "—"}</strong></div><div><small>بانتظار كابتن</small><strong>{poolOverview?.needs_captain_groups ?? "—"}</strong></div><div><small>مجموعات نشطة</small><strong>{poolOverview?.active_groups ?? "—"}</strong></div><div><small>مستحقات الشركة الدفترية</small><strong>{money(Number(poolOverview?.company_due ?? 0))}</strong></div><div><small>مستحقات الكباتن الدفترية</small><strong>{money(Number(poolOverview?.captains_due ?? 0))}</strong></div></div><p className="muted-text">هذه قيود حسابية معلقة فقط؛ لا يتم تحصيل أو تحويل أي أموال.</p></section><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">صحة المنصة</span><h2>نظرة عامة</h2></div><span className="online-pill"><i /> مباشر</span></div><div className="admin-summary-grid"><div><small>كباتن موثقون</small><strong>{overview?.captains_approved ?? "—"}</strong></div><div><small>رحلات جارية</small><strong>{overview?.total_trips_in_progress ?? "—"}</strong></div><div><small>رحلات مكتملة</small><strong>{overview?.total_trips_completed ?? "—"}</strong></div><div><small>اعتراضات مفتوحة</small><strong>{overview?.disputes_awaiting_admin ?? "—"}</strong></div></div><p className="muted-text">تسوية بوابة الدفع وعمولة الرحلات المشتركة مؤجلتان.</p></section></div></details></div>;
}
