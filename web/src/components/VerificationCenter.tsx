import { useCallback, useEffect, useMemo, useState } from "react";
import { api, uploadVerificationDocument, type VerificationDocument, type VerificationDocumentType } from "../api";
import { errorText } from "../lib/formatters";
import type { Session, Toast } from "../types";

type Snapshot = {
  role: "rider" | "captain";
  phone_verified: boolean;
  telegram_enabled: boolean;
  telegram_bot_username: string | null;
  documents: VerificationDocument[];
  captain_status: "active" | "suspended_grace_expired" | null;
  verification_status: "pending" | "approved" | "rejected" | null;
  grace_period_expires_at: string | null;
  requirements: { rider: VerificationDocumentType[]; captain_immediate: VerificationDocumentType[]; captain_deferred: VerificationDocumentType[]; labels: Record<string, string> };
};

export default function VerificationCenter({ session, notify }: { session: Session; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDocument, setBusyDocument] = useState<VerificationDocumentType | null>(null);
  const [telegramUrl, setTelegramUrl] = useState("");
  const [error, setError] = useState("");
  const [focusedTarget, setFocusedTarget] = useState<string | null>(null);
  const docs = useMemo(() => new Map((snapshot?.documents ?? []).map((doc) => [doc.document_type, doc])), [snapshot]);
  const verificationSignature = useMemo(() => snapshot ? [snapshot.phone_verified, ...snapshot.documents.map((doc) => `${doc.document_type}:${doc.status}:${doc.reviewed_at ?? ""}`)].join("|") : "", [snapshot]);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api<Snapshot>("/verification", { token: session.token });
      setSnapshot(data); setError("");
      return data;
    } catch (cause) { setError(errorText(cause)); return null; }
    finally { if (!quiet) setLoading(false); }
  }, [session.token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (verificationSignature) window.dispatchEvent(new Event("sekka:verification-refresh")); }, [verificationSignature]);
  useEffect(() => {
    if (!snapshot) return;
    const key = `sekka.verification.focus.${session.user.id}`;
    const target = localStorage.getItem(key);
    if (!target) return;
    localStorage.removeItem(key);
    setFocusedTarget(target);
    const frame = window.requestAnimationFrame(() => {
      const node = document.getElementById(target === "phone" ? "verification-phone" : `verification-upload-${target}`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target === "phone") node?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      else node?.focus({ preventScroll: true });
    });
    const timer = window.setTimeout(() => setFocusedTarget(null), 5_000);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [snapshot, session.user.id]);
  useEffect(() => {
    const onRefresh = () => { void refresh(true); };
    window.addEventListener("sekka:verification-refresh", onRefresh);
    return () => window.removeEventListener("sekka:verification-refresh", onRefresh);
  }, [refresh]);
  useEffect(() => {
    if (!telegramUrl || snapshot?.phone_verified) return;
    const timer = window.setInterval(() => { void refresh(true); }, 5_000);
    return () => window.clearInterval(timer);
  }, [telegramUrl, snapshot?.phone_verified, refresh]);

  const upload = async (type: VerificationDocumentType, file?: File) => {
    if (!file) return;
    setBusyDocument(type);
    try {
      await uploadVerificationDocument(session.token, type, file);
      notify("تم رفع المستند وإرساله للمراجعة.", "success");
      window.dispatchEvent(new Event("sekka:verification-refresh"));
      await refresh(true);
    } catch (cause) { notify(errorText(cause), "error"); }
    finally { setBusyDocument(null); }
  };

  const verifyPhone = async () => {
    try {
      const result = await api<{ verification_url?: string; already_verified?: boolean }>("/verification/phone/telegram", { method: "POST", token: session.token });
      if (result.already_verified) { await refresh(true); return; }
      if (!result.verification_url) throw new Error("لم يصل رابط التحقق من الخادم.");
      setTelegramUrl(result.verification_url);
      window.open(result.verification_url, "_blank", "noopener,noreferrer");
      notify("افتح تيليجرام وشارك رقم هاتفك المسجّل، ثم ارجع لهذه الصفحة.", "info");
    } catch (cause) { notify(errorText(cause), "error"); }
  };

  if (loading && !snapshot) return <section id="verification-center" className="surface verification-center"><p>جارٍ تحميل حالة التوثيق…</p></section>;
  if (!snapshot) return <section id="verification-center" className="surface verification-center"><h2>توثيق الحساب</h2><p role="alert">{error || "تعذر تحميل حالة المستندات."}</p><button className="button button-outline" onClick={() => void refresh()}>إعادة المحاولة</button></section>;

  const mandatory = snapshot.role === "rider" ? snapshot.requirements.rider : snapshot.requirements.captain_immediate;
  const deferred = snapshot.requirements.captain_deferred;
  const approvedCount = mandatory.filter((type) => docs.get(type)?.status === "approved").length + Number(snapshot.phone_verified);
  const progress = Math.round(approvedCount / (mandatory.length + 1) * 100);
  const graceDays = snapshot.grace_period_expires_at ? Math.max(0, Math.ceil((Date.parse(snapshot.grace_period_expires_at) - Date.now()) / 86_400_000)) : null;

  return <section id="verification-center" className="surface verification-center" aria-labelledby="verification-title">
    <header className="verification-heading"><div><span className="eyebrow">خطوة تفعيل الحساب</span><h2 id="verification-title">توثيق الحساب والمستندات</h2><p>ارفع المستندات المطلوبة. ستظهر حالة كل مستند هنا بعد المراجعة.</p></div><button className="button button-outline button-small" onClick={() => void refresh()} disabled={loading}>{loading ? "جارٍ التحديث…" : "تحديث الحالة ↻"}</button></header>
    <div className="verification-progress" aria-label={`اكتمل ${progress}% من التوثيق`}><div className="verification-progress-copy"><strong>{progress}% مكتمل</strong><span>{approvedCount} من {mandatory.length + 1} متطلبات أساسية</span></div><div className="verification-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
    <article id="verification-phone" className={`verification-phone-row ${focusedTarget === "phone" ? "is-focus-target" : ""}`}><div><strong>توثيق رقم الهاتف</strong><p>{snapshot.phone_verified ? "تم توثيق الرقم المسجّل في الحساب." : snapshot.telegram_enabled ? "تحقق مجاني عبر تيليجرام بمشاركة رقمك من حسابك نفسه." : "خدمة تيليجرام لم تُهيأ بعد. تواصل مع الدعم لإكمال التحقق."}</p></div><div className="verification-phone-actions">{snapshot.phone_verified ? <span className="verification-status is-approved">موثّق ✓</span> : <><button className="button button-primary button-small" onClick={() => void verifyPhone()} disabled={!snapshot.telegram_enabled}>وثّق رقمك الآن</button>{telegramUrl && <a className="button button-outline button-small" href={telegramUrl} target="_blank" rel="noreferrer">فتح تيليجرام</a>}</>}</div></article>
    <section className="verification-category"><div className="verification-category-heading"><h3>المستندات الأساسية</h3><p>{mandatory.length} مستندات مطلوبة لإكمال التوثيق</p></div><div className="verification-doc-grid">{mandatory.map((type) => <DocumentCard key={type} type={type} label={snapshot.requirements.labels[type] ?? type} document={docs.get(type)} busy={busyDocument === type} focused={focusedTarget === type} onFile={(file) => void upload(type, file)} />)}</div></section>
    {snapshot.role === "captain" && <section className="verification-deferred"><div className="verification-deferred-heading"><div><h3>مستندات خلال 30 يومًا</h3><p>يمكن رفعهما الآن أو قبل انتهاء المهلة.</p></div><strong className={graceDays === 0 ? "is-rejected" : ""}>{graceDays === null ? "تبدأ المهلة عند إنشاء ملف المركبة" : graceDays === 0 ? "انتهت المهلة" : `متبقي ${graceDays} يومًا`}</strong></div><div className="verification-doc-grid">{deferred.map((type) => <DocumentCard key={type} type={type} label={snapshot.requirements.labels[type] ?? type} document={docs.get(type)} busy={busyDocument === type} focused={focusedTarget === type} onFile={(file) => void upload(type, file)} />)}</div></section>}
    {snapshot.captain_status === "suspended_grace_expired" && <p className="verification-warning" role="alert">توقف استقبال الرحلات بعد انتهاء المهلة. ارفع المستندين وتواصل مع الدعم لإعادة التفعيل.</p>}
    <p className="verification-privacy">المستندات خاصة، ولا يطّلع عليها إلا صاحب الحساب وفريق التوثيق المخوّل.</p>
  </section>;
}

function DocumentCard({ type, label, document, busy, focused, onFile }: { type: VerificationDocumentType; label: string; document?: VerificationDocument; busy: boolean; focused: boolean; onFile: (file: File) => void }) {
  const status = document?.status ?? "empty";
  const statusLabel = status === "approved" ? "مقبول" : status === "pending" ? "قيد المراجعة" : status === "rejected" ? "مرفوض" : "لم يُرفع";
  const statusClass = status === "approved" ? "is-approved" : status === "pending" ? "is-pending" : status === "rejected" ? "is-rejected" : "is-empty";
  return <article className={`verification-doc-card ${focused ? "is-focus-target" : ""}`}>
    <div className="verification-doc-top"><div><h3>{label}</h3><span className={`verification-status ${statusClass}`}>{statusLabel}</span></div><span className="verification-doc-icon" role="img" aria-label={`مستند ${label}`}>▧</span></div>
    {document?.rejection_reason && <p className="verification-rejection">سبب الرفض: {document.rejection_reason}</p>}
    {document?.uploaded_at && <small className="verification-date">آخر رفع: {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.uploaded_at))}</small>}
    <label id={`verification-upload-${type}`} tabIndex={0} className={`verification-upload button ${focused || status === "rejected" || status === "empty" ? "button-primary" : "button-outline"} button-small`}>{busy ? "جارٍ الرفع…" : status === "rejected" ? "أعد الرفع بعد المراجعة" : document ? "استبدال المستند" : "ارفع هذا المستند"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label>
  </article>;
}

