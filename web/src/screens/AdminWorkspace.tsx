import { t } from "../i18n/runtime";
import Button from "../components/Button";
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { errorText } from "../lib/formatters";
import type { NavKey, Session, Toast } from "../types";
import { AccountPanel, ErrorState, LoadingCard } from "../components/workspace-shared";

const AdminControlPanel = lazy(() => import("../components/AdminControlPanel"));
type Overview = Record<string, number>;
type PoolOverview = Record<string, number>;
const adminSections = new Set<NavKey>(["adminUsers", "adminDocuments", "adminTrips", "adminComplaints", "adminFinance", "adminFinanceAdjustment", "adminPricing", "adminAudit"]);

export default function AdminWorkspace({ session, section, refreshNotifications, notify }: {
  session: Session; section: NavKey; refreshNotifications: () => Promise<void>; notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [poolOverview, setPoolOverview] = useState<PoolOverview | null>(null);
  const [disputesCapped, setDisputesCapped] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastRequestId, setBroadcastRequestId] = useState("");

  const refresh = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const [stats, pool, disputes] = await Promise.all([
        api<{ overview: Overview }>("/admin/analytics/overview", { token: session.token }),
        api<{ overview: PoolOverview }>("/admin/pool/overview", { token: session.token }),
        api<{ total_count: number; capped: boolean }>("/admin/disputes?summary=true", { token: session.token }),
      ]);
      setOverview({ ...stats.overview, disputes_awaiting_admin: disputes.total_count });
      setDisputesCapped(disputes.capped);
      setPoolOverview(pool.overview);
      setLastUpdated(Date.now());
    } catch (error) {
      setDashboardError(errorText(error));
    } finally {
      setDashboardLoading(false);
    }
  }, [session.token]);
  useEffect(() => { if (section === "admin") void refresh(); }, [section, refresh]);
  useEffect(() => {
    if (section !== "admin") return;
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [section, refresh]);

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
    return <section className="surface admin-broadcast"><div className="section-title-row"><div><span className="eyebrow">{t("إدارة سِكّة")}</span><h2>{t("إرسال رسالة عامة")}</h2><p>{t("ستظهر الرسالة في صندوق الإشعارات لدى جميع المستخدمين.")}</p></div></div><form className="admin-broadcast-form" onSubmit={(event) => void submitBroadcast(event)}><label>{t("عنوان الرسالة")}<input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} maxLength={100} required placeholder={t("مثال: تحديث مهم")} /></label><label>{t("نص الرسالة")}<textarea value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} maxLength={1000} rows={5} required placeholder={t("اكتب الرسالة التي ستصل للجميع")} /></label><div className="admin-broadcast-footer"><small>{broadcastMessage.length}{t("/1000 حرف")}</small><Button variant="primary" type="submit" loading={broadcastBusy} disabled={!broadcastTitle.trim() || !broadcastMessage.trim()}>{t("إرسال للجميع")}</Button></div></form></section>;
  }
  if (adminSections.has(section)) return <Suspense fallback={<LoadingCard text="loading.adminSection" />}><AdminControlPanel session={session} notify={notify} section={section} /></Suspense>;

  const cards: Array<{ label: string; value: number | string | undefined; section: NavKey }> = [
    { label: "كباتن بانتظار التوثيق", value: overview?.captains_pending_verification, section: "adminDocuments" },
    { label: "اعتراضات مفتوحة", value: overview?.disputes_awaiting_admin === undefined ? undefined : disputesCapped ? `${overview.disputes_awaiting_admin}+` : overview.disputes_awaiting_admin, section: "adminComplaints" },
    { label: "رحلات جارية", value: overview?.total_trips_in_progress, section: "adminTrips" },
    { label: "مجموعات بانتظار موافقة السعر", value: poolOverview?.price_review_groups, section: "adminTrips" },
  ];
  const navigate = (target: NavKey) => window.dispatchEvent(new CustomEvent<NavKey>("sekka:navigate", { detail: target }));
  if (!overview && section === "admin" && !dashboardError) return <LoadingCard text="loading.adminSummary" />;
  if (dashboardError && !overview) return <ErrorState text={dashboardError} onAction={() => void refresh()} />;

  return <div className="admin-dashboard">
    {dashboardError && <ErrorState title={t("تعذر تحديث بعض بيانات الإدارة")} text={dashboardError} onAction={() => void refresh()} />}
    <div className="admin-overview-toolbar"><p>{t("آخر تحديث")} · {lastUpdated === null ? t("جارٍ التحديث…") : new Date(lastUpdated).toLocaleTimeString()}</p><Button type="button" variant="secondary" size="sm" disabled={dashboardLoading} onClick={() => void refresh()} aria-label={t("تحديث بيانات الإدارة")}>{dashboardLoading ? t("جارٍ التحديث…") : t("تحديث ↻")}</Button></div>
    <section className="admin-overview-kpis" aria-label={t("ملخص الإدارة")}>
      {cards.map((card) => <button className="surface admin-overview-kpi" key={card.label} onClick={() => navigate(card.section)}><span>{t(card.label)}</span><strong aria-live="polite">{dashboardLoading && !overview ? <i className="spinner" aria-label={t("loading.general")} /> : card.value ?? 0}</strong></button>)}
    </section>
    <section className="surface admin-overview-users"><div><span className="eyebrow">{t("المستخدمون")}</span><strong>{overview?.total_users ?? 0}</strong><small>{t("راكب")} {overview?.total_riders ?? 0} · {t("كابتن")} {overview?.total_captains ?? 0}</small></div><Button variant="secondary" size="sm" onClick={() => navigate("adminUsers")}>{t("إدارة المستخدمين")}</Button></section>
    {(overview?.captains_pending_verification ?? 0) > 0 && <section className="surface admin-overview-review"><div><h2>{t("طلبات توثيق تحتاج مراجعة")}</h2><p>{t("افتح قائمة المستندات لمراجعة الطلبات واتخاذ القرار.")}</p></div><Button variant="primary" size="sm" onClick={() => navigate("adminDocuments")}>{t("مراجعة المستندات")}</Button></section>}
    <p className="admin-overview-note">{t("المبالغ المعروضة في الدفتر قيود حسابية فقط؛ لا يتم تحصيل أو تحويل أموال.")}</p>
  </div>;
}
