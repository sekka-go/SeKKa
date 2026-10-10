import { t } from "../i18n/runtime";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { errorText, money } from "../lib/formatters";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, EmptyState, ErrorState, LoadingCard } from "../components/workspace-shared";
import AdminControlPanel from "../components/AdminControlPanel";
export default function AdminWorkspace({ session, section, refreshNotifications, notify }: {
  session: Session; section: NavKey; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [poolOverview, setPoolOverview] = useState<Record<string, number | boolean | string> | null>(null);
  const [captains, setCaptains] = useState<Record<string, unknown>[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastRequestId, setBroadcastRequestId] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const refresh = useCallback(async () => {
    setDashboardError("");
    try {
      const [stats, pending, pool] = await Promise.all([
        api<{ overview: Record<string, number> }>("/admin/analytics/overview", { token: session.token }),
        api<{ captains: Record<string, unknown>[] }>("/admin/captains?status=pending", { token: session.token }),
        api<{ overview: Record<string, number | boolean | string> }>("/admin/pool/overview", { token: session.token }),
      ]);
      setOverview(stats.overview); setCaptains(pending.captains); setPoolOverview(pool.overview);
    } catch (error) {
      setDashboardError(errorText(error));
      throw error;
    } finally { setDashboardLoading(false); }
  }, [session.token]);
  useEffect(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, [refresh, notify]);
  useEffect(() => {
    if (section !== "admin") return;
    const timer = window.setInterval(() => { void refresh().catch((error) => notify(errorText(error), "error")); }, 30_000);
    return () => window.clearInterval(timer);
  }, [section, refresh, notify]);
  if (section === "account") return <AccountPanel session={session} notify={notify} />;
  if (section === "broadcast") {
    const submitBroadcast = async (event: FormEvent) => {
      event.preventDefault();
      const title = broadcastTitle.trim(), message = broadcastMessage.trim();
      if (!title || !message) { notify(t("اكتب عنوان الرسالة ومحتواها أولًا."), "error"); return; }
      setBroadcastBusy(true);
      const requestId = broadcastRequestId || crypto.randomUUID();
      setBroadcastRequestId(requestId);
      try {
        const result = await api<{ notified_users: number }>("/admin/notifications/broadcast", { method: "POST", token: session.token, body: { title, message, request_id: requestId } });
        setBroadcastTitle(""); setBroadcastMessage(""); setBroadcastRequestId("");
        await refreshNotifications();
        notify(`${t("تم إرسال الرسالة إلى")} ${result.notified_users} ${t(result.notified_users === 1 ? "مستخدم." : "مستخدمين.")}`, "success");
      } catch (error) { notify(errorText(error), "error"); }
      finally { setBroadcastBusy(false); }
    };
    return <section className="surface admin-broadcast"><div className="section-title-row"><div><span className="eyebrow">{t("إدارة سِكّة")}</span><h2>{t("إرسال رسالة عامة")}</h2><p>{t("ستظهر الرسالة في صندوق الإشعارات لدى جميع المستخدمين.")}</p></div></div><form className="admin-broadcast-form" onSubmit={(event) => void submitBroadcast(event)}><label>{t("عنوان الرسالة")}<input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} maxLength={100} required placeholder={t("مثال: تحديث مهم")} /></label><label>{t("نص الرسالة")}<textarea value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} maxLength={1000} rows={5} required placeholder={t("اكتب الرسالة التي ستصل للجميع")} /></label><div className="admin-broadcast-footer"><small>{broadcastMessage.length}{t("/1000 حرف")}</small><button className="button button-primary" type="submit" disabled={broadcastBusy || !broadcastTitle.trim() || !broadcastMessage.trim()}>{broadcastBusy ? t("جاري الإرسال…") : t("إرسال للجميع")}</button></div></form></section>;
  }
  const decide = async (captainId: number, status: "approved" | "rejected") => {
    const reason = window.prompt(t("اكتب سبب قرار توثيق الكابتن"));
    if (!reason?.trim()) return;
    setBusyId(captainId);
    try { await api(`/admin/captains/${captainId}/verification`, { method: "POST", token: session.token, body: { status, reason: reason.trim() } }); await refresh(); notify(t(status === "approved" ? "تم توثيق الكابتن." : "تم رفض طلب التوثيق."), "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusyId(null); }
  };
  if (dashboardLoading && !overview) return <LoadingCard text="loading.adminSummary" />;
  if (dashboardError && !overview) return <ErrorState text={dashboardError} onAction={() => void refresh().catch((error) => notify(errorText(error), "error"))} />;
  return <>{dashboardError && <ErrorState title={t("تعذر تحديث بعض بيانات الإدارة")} text={dashboardError} onAction={() => void refresh().catch((error) => notify(errorText(error), "error"))} />}<AdminControlPanel session={session} notify={notify} /><div className="admin-dashboard"><div className="admin-stats-grid"><div className="surface admin-stat"><small>{t("إجمالي المستخدمين")}</small><strong>{overview?.total_users ?? "—"}</strong></div><details className="surface admin-user-breakdown"><summary>{t("تفاصيل المستخدمين")}</summary><div className="admin-summary-grid"><div><small>{t("الركاب")}</small><strong>{overview?.total_riders ?? "—"}</strong></div><div><small>{t("الكباتن")}</small><strong>{overview?.total_captains ?? "—"}</strong></div></div></details></div><section className="surface admin-review"><div className="section-title-row"><div><span className="eyebrow">{t("مراجعة الحسابات")}</span><h2>{t("كباتن بانتظار التوثيق")}</h2><p>{t("راجع بيانات المركبة قبل تفعيل استقبال المسارات.")}</p></div><button className="button button-outline button-small" onClick={() => void refresh().catch((error) => notify(errorText(error), "error"))}>{t("تحديث ↻")}</button></div>{captains.length ? captains.map((captain) => <div className="admin-captain-row" key={String(captain.user_id)}><span className="avatar">{String(captain.full_name).slice(0, 1)}</span><div className="admin-captain-info"><strong>{String(captain.full_name)}</strong><small>{String(captain.phone_number)} · {String(captain.vehicle_type_id)}  {t("· لوحة")} {String(captain.vehicle_plate)}</small><small>{t("رخصة")} {String(captain.license_number)}</small></div><div className="admin-review-actions"><button className="button button-primary button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "approved")}>{t("موافقة")}</button><button className="button button-quiet button-small" disabled={busyId === Number(captain.user_id)} onClick={() => void decide(Number(captain.user_id), "rejected")}>{t("رفض")}</button></div></div>) : <EmptyState icon="✓" title={t("مفيش طلبات معلقة")} text="هتظهر هنا طلبات الكباتن الجديدة." />}</section><details className="admin-secondary-details"><summary>{t("تفاصيل التشغيل والمستحقات")}</summary><div className="admin-secondary-content"><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">{t("مجموعات سِكّة")}</span><h2>{t("تشغيل الرحلات والدفتر المؤجل")}</h2></div><button className="button button-outline button-small" onClick={() => void refresh().catch((error) => notify(errorText(error), "error"))}>{t("تحديث ↻")}</button></div><div className="admin-summary-grid"><div><small>{t("مجموعات الانتظار")}</small><strong>{poolOverview?.waiting_groups ?? "—"}</strong></div><div><small>{t("بانتظار موافقة السعر")}</small><strong>{poolOverview?.price_review_groups ?? "—"}</strong></div><div><small>{t("بانتظار كابتن")}</small><strong>{poolOverview?.needs_captain_groups ?? "—"}</strong></div><div><small>{t("مجموعات نشطة")}</small><strong>{poolOverview?.active_groups ?? "—"}</strong></div><div><small>{t("مستحقات الشركة الدفترية")}</small><strong>{money(Number(poolOverview?.company_due ?? 0))}</strong></div><div><small>{t("مستحقات الكباتن الدفترية")}</small><strong>{money(Number(poolOverview?.captains_due ?? 0))}</strong></div></div><p className="muted-text">{t("هذه قيود حسابية معلقة فقط؛ لا يتم تحصيل أو تحويل أي أموال.")}</p></section><section className="surface admin-summary"><div className="section-title-row"><div><span className="eyebrow">{t("صحة المنصة")}</span><h2>{t("نظرة عامة")}</h2></div><span className="online-pill"><i />  {t("مباشر")}</span></div><div className="admin-summary-grid"><div><small>{t("كباتن موثقون")}</small><strong>{overview?.captains_approved ?? "—"}</strong></div><div><small>{t("رحلات جارية")}</small><strong>{overview?.total_trips_in_progress ?? "—"}</strong></div><div><small>{t("رحلات مكتملة")}</small><strong>{overview?.total_trips_completed ?? "—"}</strong></div><div><small>{t("اعتراضات مفتوحة")}</small><strong>{overview?.disputes_awaiting_admin ?? "—"}</strong></div></div><p className="muted-text">{t("تسوية بوابة الدفع وعمولة الرحلات المشتركة مؤجلتان.")}</p></section></div></details></div></>;
}
