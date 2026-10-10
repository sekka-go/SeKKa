import { getLanguage, t } from "../i18n/runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { errorText, maskLastFour, roleLabel, statusLabel, vehicleTypeLabel } from "../lib/formatters";
import type { NavKey, Session, Toast } from "../types";

type Tab = "users" | "verification" | "trips" | "disputes" | "finance" | "adjustment" | "settings" | "audit";
type Row = {
  id?: number | string;
  status?: string;
  user_id?: number;
  full_name?: string;
  phone_number?: string;
  role?: string;
  account_status?: string;
  captain?: { vehicle_type_id: string; vehicle_plate: string; license_number: string; verification_status: string } | null;
  kind?: string;
  departure_at?: string | null;
  started_at?: string | null;
  service_date?: string | null;
  captain_user_id?: number | null;
  payment_id?: number;
  payment?: { amount?: number; trip_id?: number; reported_by_user_id?: number };
  commission_rate?: number;
  pricing?: Row[];
  pool_categories?: Row[];
  base_fee?: number;
  rate_per_km?: number;
  rate_per_min?: number;
  vehicle_type_id?: string;
  label?: string;
  speed_tier?: string;
  has_ac?: boolean | number;
  vehicle?: { name?: string };
  trip_kind?: string;
  trip_id?: number;
  reason?: string;
  amount?: number;
  created_at?: string;
  actor_user_id?: number;
  action?: string;
  resource_type?: string;
  resource_id?: number | string;
  document_label?: string;
  uploaded_at?: string;
  rejection_reason?: string | null;
  user?: { full_name?: string; phone_number?: string; role?: string };
  [field: string]: unknown;
};
const field = "admin-field w-full rounded-xl border px-3 py-2 outline-none";
const sectionTabs: Array<[NavKey, Tab, string]> = [
  ["adminUsers", "users", "المستخدمون"], ["adminDocuments", "verification", "المستندات"],
  ["adminTrips", "trips", "الرحلات والمجموعات"], ["adminComplaints", "disputes", "الاعتراضات"],
  ["adminFinance", "finance", "المالية"], ["adminFinanceAdjustment", "adjustment", "إضافة تسوية دفترية"], ["adminPricing", "settings", "التسعير"], ["adminAudit", "audit", "سجل التدقيق"],
];

export default function AdminControlPanel({ session, notify, section }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void; section: NavKey }) {
  const tab = sectionTabs.find(([key]) => key === section)?.[1] ?? "users";
  const [users, setUsers] = useState<Row[]>([]), [trips, setTrips] = useState<{ daily_trips: Row[]; pool_trips: Row[]; pool_groups: Row[] }>({ daily_trips: [], pool_trips: [], pool_groups: [] });
  const [disputes, setDisputes] = useState<Row[]>([]), [settings, setSettings] = useState<Row | null>(null), [audit, setAudit] = useState<Row[]>([]);
  const [ledgerRows, setLedgerRows] = useState<Row[]>([]);
  const [financeSummary, setFinanceSummary] = useState<Row | null>(null);
  const [verificationDocuments, setVerificationDocuments] = useState<Row[]>([]);
  const [verificationUserId, setVerificationUserId] = useState<number | null>(null);
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"), [statusFilter, setStatusFilter] = useState("all");
  const [userPage, setUserPage] = useState(0), [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<Row | null>(null);
  const [deleteTargetUserId, setDeleteTargetUserId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonError, setDeleteReasonError] = useState("");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const auth = { token: session.token };
  async function load(target: Tab = tab, targetUserId = verificationUserId) {
    setLoading(true); setLoadError("");
    try {
      if (target === "users") {
        const params = new URLSearchParams({ q: query, role: roleFilter, status: statusFilter, limit: "25", offset: String(userPage * 25) });
        const result = await api<{ users: Row[]; has_more: boolean }>("/admin/users?" + params.toString(), auth);
        setUsers((current) => userPage === 0 ? result.users : [...current, ...result.users]);
        setHasMoreUsers(result.has_more);
      }
      if (target === "trips") setTrips(await api<{ daily_trips: Row[]; pool_trips: Row[]; pool_groups: Row[] }>("/admin/trips", auth));
      if (target === "disputes") setDisputes((await api<{disputes:Row[]}>("/admin/disputes", auth)).disputes);
      if (target === "verification") setVerificationDocuments((await api<{documents:Row[]}>(`/admin/verifications?status=all${targetUserId === null ? "" : `&user_id=${targetUserId}`}`, auth)).documents);
      if (target === "settings") setSettings(await api<Row>("/admin/settings", auth));
      if (target === "finance") {
        const [ledger, summary] = await Promise.all([
          api<{ adjustments: Row[] }>("/admin/ledger/adjustments?limit=100", auth),
          api<Row>("/admin/finance/summary", auth),
        ]);
        setLedgerRows(ledger.adjustments);
        setFinanceSummary(summary);
      }
      if (target === "audit") setAudit((await api<{audit_logs:Row[]}>("/admin/audit?limit=100", auth)).audit_logs);
    } catch (error) {
      setLoadError(errorText(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (tab === "users") return; void load().catch((e) => notify(errorText(e), "error")); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== "users") return; const timer = window.setTimeout(() => void load("users").catch((e) => notify(errorText(e), "error")), 300); return () => window.clearTimeout(timer); }, [query, roleFilter, statusFilter, userPage, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  async function perform(path: string, method: string, body: unknown, success: string, refresh = tab): Promise<boolean> {
    setBusy(true); try { await api(path, { ...auth, method, body }); notify(t(success), "success"); await load(refresh); return true; }
    catch (e) { notify(errorText(e), "error"); return false; } finally { setBusy(false); }
  }
  const openUserVerifications = (userId: number) => {
    setVerificationUserId(userId);
    if (tab === "verification") void load("verification", userId).catch((e) => notify(errorText(e), "error"));
    else window.dispatchEvent(new CustomEvent<NavKey>("sekka:navigate", { detail: "adminDocuments" }));
  };
  const clearUserVerificationFilter = () => {
    setVerificationUserId(null);
    void load("verification", null).catch((e) => notify(errorText(e), "error"));
  };
  const showUserDetails = async (userId: number) => {
    try {
      const result = await api<{ user: Row }>(`/admin/users/${userId}`, auth);
      setSelectedUserDetails(result.user);
    } catch (error) { notify(errorText(error), "error"); }
  };
  const changeUserStatus = (user: Row, status: "active" | "suspended" | "banned") => {
    const reason = window.prompt(t("سبب تغيير حالة الحساب"));
    if (!reason?.trim()) return;
    const targetStatus = statusLabel(status);
    if (!window.confirm(`${t("تأكيد تغيير حالة الحساب إلى")} ${targetStatus}؟ ${t("سيؤثر هذا على قدرة المستخدم على استخدام حسابه.")}`)) return;
    void perform("/admin/users/" + user.id + "/status", "PATCH", { status, reason: reason.trim() }, "تم تحديث حالة الحساب.", "users");
  };
  const deleteUser = (user: Row) => {
    const reason = deleteReason.trim();
    if (!reason) {
      setDeleteReasonError(t("اكتب سبب حذف الحساب للمتابعة."));
      return;
    }
    if (reason.length > 1000) {
      setDeleteReasonError(t("سبب الحذف طويل جدًا (الحد الأقصى 1000 حرف)."));
      return;
    }
    setDeleteReasonError("");
    void perform(`/admin/users/${user.id}`, "DELETE", { reason }, "تم حذف الحساب والاحتفاظ بالسجلات المطلوبة بصورة مجهولة.", "users").then((deleted) => {
      if (deleted) {
        setDeleteTargetUserId(null);
        setDeleteReason("");
      }
    });
  };
  const visibleUsers = useMemo(() => users.filter((user) => (roleFilter === "all" || user.role === roleFilter) && (statusFilter === "all" || user.account_status === statusFilter)), [users, roleFilter, statusFilter]);
  const allTrips = useMemo<Array<Row & { kind: string }>>(() => [...trips.daily_trips.map((x) => ({...x, kind:"daily"})), ...trips.pool_trips.map((x) => ({...x, kind:"pool"}))], [trips]);
  return <section className="admin-control-panel w-full space-y-5 py-5 text-start admin-text-primary" aria-busy={loading}>
    <header className="admin-panel-heading"><div><p className="text-sm font-bold admin-text-accent">{t("SeKKa · تحكم آمن")}</p><h2 className="mt-1 text-2xl font-extrabold">{t(sectionTabs.find(([key]) => key === section)?.[2] ?? "مركز إدارة المنصة")}</h2><p className="mt-1 text-sm admin-text-secondary">{t("كل تغيير حساس يُسجل مع سببه في سجل التدقيق.")}</p></div><button type="button" className="button button-outline button-small" disabled={loading} onClick={() => void load().catch((e) => notify(errorText(e), "error"))} aria-label={t("تحديث القسم")}>{loading ? t("جارٍ التحديث…") : t("تحديث ↻")}</button></header>
    <aside className="admin-permissions-note"><span aria-hidden="true">▣</span><div><strong>{t("صلاحيات إدارة محمية")}</strong><p>{t("تظهر هذه الأدوات لحسابات الإدارة المخوّلة فقط، وتُراجع تغييراتها من سجل التدقيق.")}</p></div></aside>
    <nav aria-label={t("أقسام الإدارة")} className="admin-nav-groups"><a href="/admin" aria-current={section === "admin" ? "page" : undefined} onClick={(event) => { event.preventDefault(); window.dispatchEvent(new CustomEvent<NavKey>("sekka:navigate", { detail: "admin" })); }}>{t("نظرة عامة")}</a>{sectionTabs.map(([key, _id, label]) => <a key={key} href={`/${key === "adminUsers" ? "admin/users" : key === "adminDocuments" ? "admin/documents" : key === "adminTrips" ? "admin/trips" : key === "adminComplaints" ? "admin/complaints" : key === "adminFinance" ? "admin/finance" : key === "adminFinanceAdjustment" ? "admin/finance/adjustment" : key === "adminPricing" ? "admin/pricing" : "admin/audit"}`} aria-current={key === section ? "page" : undefined} onClick={(event) => { event.preventDefault(); window.dispatchEvent(new CustomEvent<NavKey>("sekka:navigate", { detail: key })); }}>{t(label)}</a>)}</nav>
    {loadError && <div className="admin-load-feedback" role="alert"><span>{loadError}</span><button type="button" onClick={() => void load().catch((error) => notify(errorText(error), "error"))}>{t("إعادة المحاولة")}</button></div>}
    {loading && <p className="admin-load-status" role="status"><span className="spinner" />  {t("loading.adminSection")}</p>}
    {tab === "users" && <div className="space-y-3"><input className={field} placeholder={t("ابحث بالاسم أو الهاتف")} value={query} onChange={(e) => { setQuery(e.target.value); setUserPage(0); }} /><div className="admin-user-filters"><label>{t("الدور")}<select className={field} value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setUserPage(0); }}><option value="all">{t("كل الأدوار")}</option><option value="rider">{t("راكب")}</option><option value="captain">{t("كابتن")}</option><option value="admin">{t("مدير النظام")}</option></select></label><label>{t("الحالة") }<select className={field} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setUserPage(0); }}><option value="all">{t("كل الحالات")}</option>{["active","suspended","banned"].map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label></div>{visibleUsers.map((u) => <article key={u.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border admin-border admin-surface p-4"><div><strong className="text-lg">{u.full_name}</strong><p className="text-sm admin-text-secondary">{maskLastFour(u.phone_number)} · {roleLabel(String(u.role ?? ""))} · <AdminStatus status={String(u.account_status)} /></p>{u.captain && <p className="text-xs admin-text-muted">{t("مركبة")} {vehicleTypeLabel(String(u.captain.vehicle_type_id))}  {t("· لوحة")} {u.captain.vehicle_plate}  {t("· رخصة")} {maskLastFour(String(u.captain.license_number))}  {t("· التوثيق")} {statusLabel(u.captain.verification_status)}</p>}</div><details className="user-actions-menu"><summary aria-label={t("إجراءات المستخدم")} title={t("إجراءات المستخدم")}>⋯</summary><div className="user-actions-menu-list"><button type="button" className="rounded-lg border admin-border-accent px-3 py-2 text-xs admin-text-accent" onClick={() => void showUserDetails(Number(u.id))}>{t("عرض التفاصيل")}</button><button type="button" className="rounded-lg border admin-border-accent px-3 py-2 text-xs admin-text-accent" onClick={() => openUserVerifications(Number(u.id))}>{t("مستندات التوثيق")}</button><button disabled={busy} className="rounded-lg border admin-border px-3 py-2 text-xs hover:admin-border-accent" onClick={() => { const full_name=window.prompt(t("اسم المستخدم"),u.full_name); const phone_number=full_name && window.prompt(t("رقم الهاتف")); const reason=phone_number && window.prompt(t("سبب تعديل الحساب")); if(full_name?.trim()&&phone_number?.trim()&&reason?.trim()) void perform("/admin/users/"+u.id,"PATCH",{full_name:full_name.trim(),phone_number:phone_number.trim(),reason:reason.trim()},"تم تحديث الحساب.","users"); }}>{t("تعديل الحساب")}</button>{u.captain && <button disabled={busy} className="rounded-lg border admin-border px-3 py-2 text-xs hover:admin-border-accent" onClick={() => { const vehicle_type_id=window.prompt(t("نوع المركبة"),u.captain?.vehicle_type_id ?? ""); const license_number=vehicle_type_id && window.prompt(t("رقم الرخصة")); const vehicle_plate=license_number && window.prompt(t("رقم اللوحة"),u.captain?.vehicle_plate ?? ""); const reason=vehicle_plate && window.prompt(t("سبب تعديل بيانات المركبة")); if(vehicle_type_id?.trim()&&license_number?.trim()&&vehicle_plate?.trim()&&reason?.trim()) void perform("/admin/captains/"+u.id,"PATCH",{vehicle_type_id:vehicle_type_id.trim(),license_number:license_number.trim(),vehicle_plate:vehicle_plate.trim(),reason:reason.trim()},"تم تحديث بيانات الكابتن.","users"); }}>{t("تعديل المركبة")}</button>}{(["active","suspended","banned"] as const).filter((s) => s !== u.account_status).map((status) => <button key={status} data-status={status} disabled={busy} className="user-status-action rounded-lg border admin-border px-3 py-2 text-xs hover:admin-border-accent" onClick={() => changeUserStatus(u, status)}>{status === "active" ? t("إعادة التفعيل") : status === "suspended" ? t("إيقاف مؤقت") : t("حظر")}</button>)}{Number(u.id) !== session.user.id && <button type="button" disabled={busy} className="admin-user-delete-trigger rounded-lg border admin-border-error px-3 py-2 text-xs admin-text-error disabled:opacity-50" onClick={() => { setDeleteTargetUserId(Number(u.id)); setDeleteReason(""); setDeleteReasonError(""); }}>{t("حذف الحساب")}</button>}{deleteTargetUserId === Number(u.id) && <form className="admin-user-delete-confirm" onSubmit={(event) => { event.preventDefault(); deleteUser(u); }}><strong>{t("تأكيد حذف الحساب")}</strong><p>{t("سيتم حذف بيانات الحساب الشخصية ومستندات التوثيق وإلغاء جلساته. السجلات المالية والتشغيلية ستبقى مجهولة الهوية.")}</p><label htmlFor={"admin-delete-reason-" + u.id}>{t("سبب حذف الحساب")}</label><textarea id={"admin-delete-reason-" + u.id} value={deleteReason} maxLength={1000} rows={3} aria-required="true" aria-invalid={Boolean(deleteReasonError)} aria-describedby={deleteReasonError ? "admin-delete-reason-error-" + u.id : undefined} onChange={(event) => { setDeleteReason(event.target.value); if (deleteReasonError) setDeleteReasonError(""); }} placeholder={t("اكتب سبب حذف الحساب (حتى 1000 حرف).")}/>{deleteReasonError && <span id={"admin-delete-reason-error-" + u.id} className="admin-user-delete-error" role="alert">{deleteReasonError}</span>}<div className="admin-user-delete-actions"><button type="button" disabled={busy} onClick={() => { setDeleteTargetUserId(null); setDeleteReason(""); setDeleteReasonError(""); }}>{t("إلغاء")}</button><button type="submit" disabled={busy} className="admin-user-delete-submit">{busy ? t("جارٍ الحذف…") : t("تأكيد الحذف")}</button></div></form>}</div></details></article>) }{!visibleUsers.length && !loading && !loadError && <Empty text={t("لا يوجد مستخدمون بهذه التصفية.")} />}{hasMoreUsers && <button type="button" className="button button-outline button-small" disabled={loading} onClick={() => setUserPage((page) => page + 1)}>{t(loading ? "جارٍ التحديث…" : "تحميل المزيد")}</button>}</div>}
    {tab === "verification" && <VerificationQueue documents={verificationDocuments} loading={loading} loadError={loadError} session={session} notify={notify} refresh={() => load("verification")} userId={verificationUserId} onClearUserFilter={clearUserVerificationFilter} />}
    {tab === "trips" && <div className="space-y-4"><section className="space-y-3"><h3 className="text-lg font-bold">{t("المجموعات بانتظار التشغيل")}</h3>{trips.pool_groups.map((group)=><article key={String(group.id)} className="flex flex-wrap items-center justify-between gap-3 border-b admin-border py-3"><div><strong>{t("مجموعة رقم")} #{group.id}</strong><p className="text-sm admin-text-secondary">{t(String(group.package_type ?? ""))} · {t("الموعد الصباحي")} {String(group.morning_departure ?? "").slice(0,5)} · {t("موعد العودة")} {String(group.return_departure ?? "").slice(0,5)}</p><small className="admin-text-muted">{t("أيام الخدمة")}: {Array.isArray(group.service_dates) ? group.service_dates.join("، ") : ""} · {String(group.route_distance_km ?? 0)} {t("كم")}</small></div><AdminStatus status={String(group.status ?? "waiting")} /></article>)}{!trips.pool_groups.length && !loading && !loadError && <Empty text={t("لا توجد مجموعات بانتظار التشغيل.")} />}</section><section className="space-y-3"><h3 className="text-lg font-bold">{t("الرحلات النشطة")}</h3>{allTrips.map((trip) => <article key={trip.kind + trip.id} className="space-y-3 rounded-2xl border admin-border admin-surface p-4"><div className="flex justify-between"><strong>{t("رحلة")} {trip.kind === "pool" ? t("مجموعة") : t("يومية")} #{trip.id}</strong><AdminStatus status={String(trip.status)} /></div><p className="text-sm admin-text-secondary">{trip.departure_at || trip.started_at || trip.service_date}  {t("· الكابتن")} {trip.captain_user_id || t("غير معين")}</p><div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg border admin-border-error px-3 py-2 text-sm admin-text-error disabled:opacity-50" onClick={() => { const reason=window.prompt(t("سبب الإلغاء")); const reason_tag=reason && window.prompt(t("تصنيف السبب (other / route_issue / safety / captain_unavailable)"),"other"); if(reason?.trim() && reason_tag?.trim()) void perform("/admin/trips/"+trip.kind+"/"+trip.id+"/cancel","POST",{reason,reason_tag},t("تم إلغاء الرحلة."),"trips"); }}>{t("إلغاء الرحلة")}</button><button disabled={busy} className="rounded-lg border admin-border px-3 py-2 text-sm hover:admin-border-accent disabled:opacity-50" onClick={() => { const captain_user_id=Number(window.prompt(t("رقم حساب الكابتن الموثق"))); const reason=window.prompt(t("سبب إعادة التعيين")); if(Number.isInteger(captain_user_id)&&captain_user_id>0&&reason?.trim()) void perform("/admin/trips/"+trip.kind+"/"+trip.id+"/captain","POST",{captain_user_id,reason},t("تم تعيين الكابتن."),"trips"); }}>{t("إعادة تعيين الكابتن")}</button></div></article>)}{!allTrips.length && !loading && !loadError && <Empty text={t("لا توجد رحلات قابلة للإجراء حاليًا.")}/>}</section></div>}
    {tab === "disputes" && <div className="space-y-3">{disputes.map((d) => <Dispute key={d.payment_id} row={d} session={session} notify={notify} refresh={() => load("disputes")}/>)}{!disputes.length && !loading && !loadError && <Empty text="لا توجد اعتراضات مفتوحة."/>}</div>}
    {tab === "finance" && <div className="space-y-4"><p className="text-sm admin-text-secondary">{t("القيود دفترية فقط؛ لا يتم تحصيل أو تحويل أي أموال.")}</p><div className="admin-finance-kpis"><div className="surface"><small>{t("مستحقات الشركة الدفترية")}</small><strong>{loading || !financeSummary ? <span className="admin-number-skeleton" role="status" aria-label={t("loading.general")} /> : (Number(financeSummary.company_due ?? 0)).toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")} {t("ج.م")}</strong></div><div className="surface"><small>{t("مستحقات الكباتن الدفترية")}</small><strong>{loading || !financeSummary ? <span className="admin-number-skeleton" role="status" aria-label={t("loading.general")} /> : (Number(financeSummary.captains_due ?? 0)).toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")} {t("ج.م")}</strong></div></div><div className="grid gap-4"><section className="rounded-2xl border admin-border admin-surface p-4"><div className="section-title-row"><h3 className="text-lg font-bold">{t("تسويات دفترية حديثة")}</h3><button type="button" className="button button-outline button-small" onClick={() => window.dispatchEvent(new CustomEvent<NavKey>("sekka:navigate", { detail: "adminFinanceAdjustment" }))}>{t("إضافة تسوية دفترية")}</button></div>{ledgerRows.map((x)=><div key={x.id} className="flex flex-wrap justify-between gap-2 border-t admin-border py-2 text-sm"><span>{t("رحلة")} {t(String(x.trip_kind ?? ""))} #{x.trip_id} · {x.reason}</span><strong className={Number(x.amount)<0?"admin-text-error":"admin-text-accent"}>{Number(x.amount).toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")}  {t("ج.م")}</strong></div>)}{!ledgerRows.length&&<p className="text-sm admin-text-muted">{t("لا توجد تسويات يدوية.")}</p>}</section></div></div>}
    {tab === "adjustment" && <div className="max-w-2xl"><Ledger session={session} notify={notify} reload={() => load("finance")}/></div>}
    {tab === "settings" && settings && <div className="grid gap-4"><Commission token={session.token} initial={Number(settings.commission_rate)} notify={notify} reload={() => load("settings")}/><section className="rounded-2xl border admin-border admin-surface p-4"><h3 className="text-lg font-bold">{t("تسعير الرحلات اليومية")}</h3>{settings.pricing?.map((x)=><Pricing key={x.vehicle_type_id} row={x} token={session.token} notify={notify} reload={()=>load("settings")}/>)}</section><section className="rounded-2xl border admin-border admin-surface p-4"><h3 className="text-lg font-bold">{t("تسعير فئات المجموعات")}</h3>{settings.pool_categories?.map((x)=><Pricing key={x.id} row={{...x,id:x.id,vehicle_type_id:String(x.id), label:`${t(x.speed_tier === "faster" ? "أسرع" : "أوفر")} · ${t(x.has_ac ? "مكيّف" : "بدون تكييف")}`}} pool token={session.token} notify={notify} reload={()=>load("settings")}/>)}</section></div>}
    {tab === "audit" && <div className="overflow-x-auto rounded-2xl border admin-border"><table className="w-full min-w-[680px] text-sm"><thead className="admin-surface-raised"><tr>{["الوقت","المسؤول","الإجراء","العنصر","السبب"].map(x=><th key={x} className="p-3 text-start">{t(x)}</th>)}</tr></thead><tbody>{audit.map((x)=><tr key={x.id} className="border-t admin-border"><td className="p-3 admin-text-secondary">{new Date(x.created_at ?? 0).toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")}</td><td className="p-3">#{x.actor_user_id}</td><td className="p-3 admin-text-accent">{t(String(x.action))}</td><td className="p-3">{t(String(x.resource_type))} · {x.resource_id}</td><td className="max-w-xs truncate p-3 admin-text-secondary">{x.reason || "—"}</td></tr>)}</tbody></table>{!audit.length && !loading && !loadError && <Empty text={t("سجل التدقيق فارغ.")}/>}</div>}
    {selectedUserDetails && <div className="admin-user-details-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUserDetails(null); }}><section className="admin-user-details-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-user-details-title"><div className="admin-user-details-heading"><h3 id="admin-user-details-title">{t("بيانات المستخدم")}</h3><button type="button" aria-label={t("إغلاق")} onClick={() => setSelectedUserDetails(null)}>×</button></div><dl><div><dt>{t("اسم المستخدم")}</dt><dd>{String(selectedUserDetails.full_name ?? "")}</dd></div><div><dt>{t("رقم الهاتف")}</dt><dd dir="ltr">{String(selectedUserDetails.phone_number ?? "")}</dd></div><div><dt>{t("الدور")}</dt><dd>{roleLabel(String(selectedUserDetails.role ?? ""))}</dd></div><div><dt>{t("الحالة")}</dt><dd>{statusLabel(String(selectedUserDetails.account_status ?? "active"))}</dd></div>{selectedUserDetails.captain && <><div><dt>{t("نوع المركبة")}</dt><dd>{vehicleTypeLabel(String((selectedUserDetails.captain as Row).vehicle_type_id ?? ""))}</dd></div><div><dt>{t("رقم اللوحة")}</dt><dd>{String((selectedUserDetails.captain as Row).vehicle_plate ?? "")}</dd></div><div><dt>{t("رقم الرخصة")}</dt><dd>{String((selectedUserDetails.captain as Row).license_number ?? "")}</dd></div><div><dt>{t("حالة التوثيق")}</dt><dd>{statusLabel(String((selectedUserDetails.captain as Row).verification_status ?? ""))}</dd></div></>}</dl><p>{t("تم تسجيل فتح البيانات في سجل التدقيق.")}</p></section></div>}
  </section>;
}
function Dispute({row,session,notify,refresh}:{row:Row;session:Session;notify:(text:string,tone?:"success"|"error"|"info")=>void;refresh:()=>Promise<void>}) {
 const [reason,setReason]=useState(""); const [busy,setBusy]=useState(false);
 return <article className="space-y-3 rounded-2xl border admin-border admin-surface p-4"><div className="flex justify-between"><strong>{t("اعتراض الدفعة #")}{row.payment_id}</strong><span className="admin-text-accent">{row.payment?.amount}  {t("ج.م")}</span></div><p className="text-sm admin-text-secondary">{t("رحلة #")}{row.payment?.trip_id}  {t("· مقدم الاعتراض #")}{row.payment?.reported_by_user_id}</p><textarea className={field} rows={2} placeholder={t("سبب القرار الإداري")} value={reason} onChange={(e)=>setReason(e.target.value)}/><div className="flex flex-wrap gap-2">{(["resolve","adjust","void"] as const).map((action)=><button key={action} disabled={busy||reason.trim().length<3} className="rounded-lg border admin-border px-3 py-2 text-sm hover:admin-border-accent disabled:opacity-40" onClick={async()=>{const adjusted_amount=action==="adjust"?Number(window.prompt(t("المبلغ المعدل بالجنيه"))):undefined;if(action==="adjust"&&!Number.isFinite(adjusted_amount))return;setBusy(true);try{await api("/admin/payments/"+row.payment_id+"/"+action,{token:session.token,method:"POST",body:{reason,...(adjusted_amount===undefined?{}:{adjusted_amount})}});notify(t("تم حفظ قرار الاعتراض."),"success");await refresh()}catch(e){notify(errorText(e),"error")}finally{setBusy(false)}}}>{action==="resolve"?t("حسم الاعتراض"):action==="adjust"?t("تعديل المبلغ"):t("إلغاء الدفعة")}</button>)}</div></article>;
}
function Commission({token,initial,notify,reload}:{token:string;initial:number;notify:(text:string,tone?:"success"|"error"|"info")=>void;reload:()=>Promise<void>}) {
 const [rate,setRate]=useState(String(initial * 100));
 useEffect(()=>setRate(String(initial * 100)),[initial]);
 return <article className="space-y-3 rounded-2xl border admin-border admin-surface p-4"><h3 className="text-lg font-bold">{t("عمولة المنصة")}</h3><label className="admin-percentage-field"><input className={field} type="number" min="0" max="100" step="1" value={rate} onChange={e=>setRate(e.target.value)}/><span>%</span></label><button className="admin-primary rounded-lg admin-primary-bg px-4 py-2 font-bold admin-primary-text" onClick={async()=>{const numericRate=Number(rate);if(!Number.isFinite(numericRate)||numericRate<0||numericRate>100){notify(t("أدخل نسبة بين 0 و100%"),"error");return}const reason=window.prompt(t("سبب تغيير العمولة"));if(!reason?.trim())return;if(!window.confirm(t("هل تريد حفظ إعدادات التسعير الجديدة؟")))return;try{await api("/admin/settings/commission",{token,method:"PATCH",body:{rate:numericRate/100,reason:reason.trim()}});notify(t("تم تحديث العمولة."),"success");await reload()}catch(e){notify(errorText(e),"error")}}}>{t("حفظ العمولة")}</button><p className="text-xs admin-text-muted">{t("تؤثر على قيود الرحلات المشتركة الجديدة فقط.")}</p></article>;
}
function Ledger({session,notify,reload}:{session:Session;notify:(text:string,tone?:"success"|"error"|"info")=>void;reload:()=>Promise<void>}) {
 const [kind,setKind]=useState("pool"),[trip,setTrip]=useState(""),[member,setMember]=useState(""),[amount,setAmount]=useState(""),[reason,setReason]=useState("");
 const submit=async()=>{const tripId=Number(trip),memberId=member?Number(member):null,numericAmount=Number(amount);if(!Number.isSafeInteger(tripId)||tripId<1||(memberId!==null&&(!Number.isSafeInteger(memberId)||memberId<1))||!Number.isFinite(numericAmount)||numericAmount===0||!reason.trim()){notify(t("راجع رقم الرحلة والمبلغ والسبب قبل الحفظ."),"error");return}if(!window.confirm(t("هل تريد تسجيل التسوية الدفترية بهذا المبلغ والسبب؟")))return;try{await api("/admin/ledger/adjustments",{token:session.token,method:"POST",body:{trip_kind:kind,trip_id:tripId,member_id:memberId,amount:numericAmount,reason:reason.trim()}});notify(t("تم تسجيل التسوية."),"success");setReason("");setAmount("");await reload()}catch(e){notify(errorText(e),"error")}};
 return <article className="space-y-3 rounded-2xl border admin-border admin-surface p-4"><h3 className="text-lg font-bold">{t("تسوية دفترية يدوية")}</h3><select className={field} value={kind} onChange={e=>setKind(e.target.value)}><option value="pool">{t("رحلة مجموعة")}</option><option value="daily">{t("رحلة يومية")}</option></select><input className={field} inputMode="numeric" placeholder={t("رقم الرحلة")} value={trip} onChange={e=>setTrip(e.target.value)}/><input className={field} inputMode="numeric" placeholder={t("رقم العضو (اختياري)")} value={member} onChange={e=>setMember(e.target.value)}/><input className={field} type="number" step="0.01" placeholder={t("المبلغ موجب أو سالب")} value={amount} onChange={e=>setAmount(e.target.value)}/><textarea className={field} placeholder={t("السبب")} value={reason} onChange={e=>setReason(e.target.value)}/><button className="rounded-lg border admin-border-accent px-4 py-2 font-bold admin-text-accent" onClick={()=>void submit()}>{t("تسجيل التسوية")}</button></article>;
}
function Pricing({row,token,pool=false,notify,reload}:{row:Row;token:string;pool?:boolean;notify:(text:string,tone?:"success"|"error"|"info")=>void;reload:()=>Promise<void>}) {
 const [values,setValues]=useState({base_fee:String(row.base_fee),rate_per_km:String(row.rate_per_km),rate_per_min:String(row.rate_per_min)});
 return <form className="grid gap-2 border-t admin-border pt-3 sm:grid-cols-5" onSubmit={async(e)=>{e.preventDefault();const reason=window.prompt(t("سبب تعديل التسعير"));if(!reason?.trim())return;if(!window.confirm(t("هل تريد حفظ إعدادات التسعير الجديدة؟")))return;const path=pool?"/admin/settings/pool-categories/"+row.vehicle_type_id:"/admin/pricing/"+row.vehicle_type_id;try{await api(path,{token,method:"PATCH",body:{...Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number(v)])),reason:reason.trim()}});notify(t("تم تحديث التسعير."),"success");await reload()}catch(error){notify(errorText(error),"error")}}}><strong className="self-center">{row.label||row.vehicle?.name||row.vehicle_type_id}</strong>{(["base_fee","rate_per_km","rate_per_min"] as const).map((k)=><label key={k} className="text-xs admin-text-secondary">{k==="base_fee"?t("الأساس (جنيه)"):k==="rate_per_km"?t("لكل كم (جنيه)"):t("لكل دقيقة (جنيه)")}<input className={field+" mt-1"} type="number" min="0" step="0.01" value={values[k]} onChange={e=>setValues({...values,[k]:e.target.value})}/></label>)}<button className="rounded-lg border admin-border-accent px-3 py-2 admin-text-accent">{t("حفظ")}</button></form>;
}
function AdminStatus({ status }: { status: string }) {
 const normalized = status.toLowerCase();
 const tone = ["active","approved","completed"].includes(normalized) ? "success" : ["rejected","cancelled","banned","suspended"].includes(normalized) ? "danger" : ["in_progress","assigned"].includes(normalized) ? "info" : "warning";
 return <span className={`admin-status-pill is-${tone}`}>{statusLabel(normalized)}</span>;
}
function Empty({text}:{text:string}) { return <p className="rounded-xl border border-dashed admin-border p-8 text-center admin-text-secondary">{t(text)}</p>; }
function VerificationQueue({documents,loading,loadError,session,notify,refresh,userId,onClearUserFilter}:{documents:Row[];loading:boolean;loadError:string;session:Session;notify:(text:string,tone?:Toast["tone"])=>void;refresh:()=>Promise<void>;userId:number|null;onClearUserFilter:()=>void}) {
 const [status,setStatus]=useState("pending");
 useEffect(()=>setStatus(userId===null?"pending":"all"),[userId]);
 const [webhookBusy,setWebhookBusy]=useState(false);
 const visible=documents.filter((doc)=>status==="all"||doc.status===status);
 const registerTelegramWebhook=async()=>{setWebhookBusy(true);try{await api("/admin/verification/telegram-webhook",{method:"POST",token:session.token});notify(t("تم ربط بوت تيليجرام لاستقبال عمليات التحقق."),"success")}catch(error){notify(errorText(error),"error")}finally{setWebhookBusy(false)}};
 return <div className="space-y-3">{userId!==null&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border admin-soft-border-accent admin-soft-accent p-3"><strong>{t("مستندات المستخدم رقم")} {userId}</strong><button type="button" className="rounded-lg border admin-border px-3 py-2 text-sm" onClick={onClearUserFilter}>{t("العودة لكل المستخدمين")}</button></div>}<div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm admin-text-secondary">{t("تصفية المستندات")}<select className={field+" mr-2"} value={status} onChange={(event)=>setStatus(event.target.value)}><option value="pending">{t("بانتظار المراجعة")}</option><option value="approved">{t("مقبولة")}</option><option value="rejected">{t("مرفوضة")}</option><option value="all">{t("كل المستندات")}</option></select></label><div className="flex flex-wrap items-center gap-3"><span className="text-sm admin-text-muted">{visible.length}  {t("مستند")}</span><button type="button" disabled={webhookBusy} className="rounded-lg border admin-border-accent px-3 py-2 text-sm admin-text-accent disabled:opacity-50" onClick={()=>void registerTelegramWebhook()}>{webhookBusy?t("جارٍ ربط تيليجرام…"):t("إعداد تحقق تيليجرام")}</button></div></div>{visible.map((doc)=> <VerificationReviewCard key={doc.id} row={doc} session={session} notify={notify} refresh={refresh}/>)}{!visible.length && !loading && !loadError && <Empty text={status==="pending"?"لا توجد مستندات بانتظار المراجعة.":"لا توجد مستندات في هذه القائمة."}/>}</div>;
}
function VerificationReviewCard({row,session,notify,refresh}:{row:Row;session:Session;notify:(text:string,tone?:Toast["tone"])=>void;refresh:()=>Promise<void>}) {
 const [reason,setReason]=useState("");const [busy,setBusy]=useState(false);
 const review=async(status:"approved"|"rejected")=>{if(status==="rejected"&&reason.trim().length<3)return;setBusy(true);try{await api(`/admin/verifications/${row.id}/review`,{method:"POST",token:session.token,body:{status,...(status==="rejected"?{reason:reason.trim()}: {})}});notify(t(status==="approved"?"تم قبول المستند وتسجيل القرار.":"تم رفض المستند وإبلاغ المستخدم."),"success");await refresh()}catch(error){notify(errorText(error),"error")}finally{setBusy(false)}};
 const openDocument=async()=>{const newTab=window.open("about:blank","_blank");if(!newTab){notify(t("اسمح بفتح نافذة جديدة لمعاينة المستند."),"info");return}newTab.opener=null;try{const {signed_url}=await api<{signed_url:string}>(`/admin/verifications/${row.id}/file`,{token:session.token});newTab.location.replace(signed_url)}catch(error){newTab.close();notify(errorText(error),"error")}};
 return <article className="space-y-3 rounded-2xl border admin-border admin-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-lg">{t(String(row.document_label ?? ""))}</strong><AdminStatus status={String(row.status)} /></div><p className="text-sm admin-text-secondary">{row.user?.full_name} · {maskLastFour(row.user?.phone_number)} · {row.user?.role===`captain`?t("كابتن"):t("راكب")} #{row.user_id}</p><p className="text-xs admin-text-muted">{t("رفع في")} {new Date(row.uploaded_at ?? Date.now()).toLocaleString(getLanguage() === "ar" ? "ar-EG" : "en-EG")}</p></div><button disabled={busy} className="rounded-lg border admin-border px-3 py-2 text-sm hover:admin-border-accent" onClick={()=>void openDocument()}>{t("معاينة المستند ↗")}</button></div>{row.rejection_reason&&<p className="text-sm admin-text-error">{t("سبب الرفض:")} {row.rejection_reason}</p>}{row.status==="pending"?<><textarea className={field} rows={2} value={reason} onChange={(event)=>setReason(event.target.value)} placeholder={t("سبب الرفض — مطلوب عند رفض المستند")}/><div className="flex flex-wrap gap-2"><button disabled={busy} className="admin-primary rounded-lg admin-primary-bg px-4 py-2 font-bold admin-primary-text disabled:opacity-50" onClick={()=>void review("approved")}>{t("اعتماد المستند")}</button><button disabled={busy||reason.trim().length<3} className="rounded-lg border admin-border-error px-4 py-2 admin-text-error disabled:opacity-40" onClick={()=>void review("rejected")}>{t("رفض مع السبب")}</button></div></>:<p className="text-sm admin-text-secondary">{row.status==="approved"?t("تم اعتماد المستند، ويمكنك معاينته عند الحاجة."):t("تمت مراجعة المستند؛ يمكنك معاينته وسجل سبب الرفض عند وجوده.")}</p>}</article>;
}





