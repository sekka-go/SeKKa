import { getLanguage, t } from "../i18n/runtime";
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
  const [wizardStarted, setWizardStarted] = useState(false);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const docs = useMemo(() => new Map((snapshot?.documents ?? []).map((doc) => [doc.document_type, doc])), [snapshot]);
  const mandatory = useMemo(() => !snapshot ? [] : snapshot.role === "rider" ? snapshot.requirements.rider : snapshot.requirements.captain_immediate, [snapshot]);
  const steps = useMemo(() => [
    { id: "phone", kind: "phone" as const, label: "توثيق رقم الهاتف" },
    ...mandatory.map((type) => ({ id: type, kind: "document" as const, type, label: snapshot?.requirements.labels[type] ?? type })),
  ], [mandatory, snapshot]);
  const isStepComplete = useCallback((step: (typeof steps)[number]) => step.kind === "phone"
    ? Boolean(snapshot?.phone_verified)
    : ["pending", "approved"].includes(docs.get(step.type)?.status ?? ""), [docs, snapshot?.phone_verified]);
  const allCoreComplete = steps.length > 0 && steps.every(isStepComplete);
  const completedSteps = steps.filter(isStepComplete).length;
  const allRequiredDocumentsApproved = mandatory.every((type) => docs.get(type)?.status === "approved");
  const accountActivated = Boolean(snapshot?.phone_verified && allRequiredDocumentsApproved && (
    snapshot.role === "rider" || (snapshot.captain_status === "active" && snapshot.verification_status === "approved")
  ));
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
    setWizardStarted(true);
    const targetIndex = steps.findIndex((step) => step.id === target);
    if (targetIndex >= 0) setActiveStep(targetIndex);
  }, [snapshot, session.user.id, steps]);
  useEffect(() => {
    if (!wizardStarted || !focusedTarget) return;
    const target = focusedTarget;
    const frame = window.requestAnimationFrame(() => {
      const node = document.getElementById(target === "phone" ? "verification-phone" : `verification-upload-${target}`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target === "phone") node?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      else node?.focus({ preventScroll: true });
    });
    const timer = window.setTimeout(() => setFocusedTarget(null), 5_000);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [wizardStarted, activeStep, focusedTarget]);
  useEffect(() => {
    if (!wizardStarted || !wizardComplete || allCoreComplete) return;
    const firstIncomplete = steps.findIndex((step) => !isStepComplete(step));
    setActiveStep(Math.max(firstIncomplete, 0));
    setWizardComplete(false);
  }, [allCoreComplete, isStepComplete, steps, wizardComplete, wizardStarted]);
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
  useEffect(() => {
    if (!allCoreComplete || accountActivated) return;
    const timer = window.setInterval(() => { void refresh(true); }, 20_000);
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void refresh(true); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [accountActivated, allCoreComplete, refresh]);

  const upload = async (type: VerificationDocumentType, file?: File) => {
    if (!file) return;
    setBusyDocument(type);
    try {
      await uploadVerificationDocument(session.token, type, file);
      notify(t("تم رفع المستند وإرساله للمراجعة."), "success");
      window.dispatchEvent(new Event("sekka:verification-refresh"));
      await refresh(true);
    } catch (cause) { notify(errorText(cause), "error"); }
    finally { setBusyDocument(null); }
  };

  const verifyPhone = async () => {
    try {
      const result = await api<{ verification_url?: string; already_verified?: boolean }>("/verification/phone/telegram", { method: "POST", token: session.token });
      if (result.already_verified) { await refresh(true); return; }
      if (!result.verification_url) throw new Error(t("لم يصل رابط التحقق من الخادم."));
      setTelegramUrl(result.verification_url);
      window.open(result.verification_url, "_blank", "noopener,noreferrer");
      notify(t("افتح تيليجرام وشارك رقم هاتفك المسجّل، ثم ارجع لهذه الصفحة."), "info");
    } catch (cause) { notify(errorText(cause), "error"); }
  };

  if (loading && !snapshot) return <section id="verification-center" className="surface verification-center"><p>{t("جارٍ تحميل حالة التوثيق…")}</p></section>;
  if (!snapshot) return <section id="verification-center" className="surface verification-center"><h2>{t("توثيق الحساب")}</h2><p role="alert">{error || t("تعذر تحميل حالة المستندات.")}</p><button className="button button-outline" onClick={() => void refresh()}>{t("إعادة المحاولة")}</button></section>;

  const deferred = snapshot.requirements.captain_deferred;
  const progress = Math.round(completedSteps / Math.max(steps.length, 1) * 100);
  const graceDays = snapshot.grace_period_expires_at ? Math.max(0, Math.ceil((Date.parse(snapshot.grace_period_expires_at) - Date.now()) / 86_400_000)) : null;
  const currentStep = steps[Math.min(activeStep, Math.max(steps.length - 1, 0))];
  const beginWizard = () => {
    setActiveStep(Math.max(0, steps.findIndex((step) => !isStepComplete(step))));
    setWizardComplete(false);
    setWizardStarted(true);
  };
  const nextStep = () => {
    if (activeStep >= steps.length - 1) setWizardComplete(true);
    else setActiveStep((step) => step + 1);
  };

  return <section id="verification-center" className="surface verification-center" aria-labelledby="verification-title">
    <header className="verification-heading"><div><span className="eyebrow">{t("خطوة تفعيل الحساب")}</span><h2 id="verification-title">{t("تفعيل الحساب")}</h2></div></header>
    <div className="verification-progress" aria-label={`${t("اكتمل رفع")} ${progress}% ${t("من المتطلبات الأساسية")}`}><div className="verification-progress-copy"><strong>{progress}{t("% مكتمل")}</strong><span>{completedSteps}  {t("من")} {steps.length}  {t("متطلبات أساسية تم استلامها")}</span></div><div className="verification-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
    {!wizardStarted && !allCoreComplete && <section className="verification-intro"><span className="verification-intro-icon" aria-hidden="true">✓</span><button className="button button-primary verification-start-button" onClick={beginWizard}>{t("فعّل حسابك الآن")}</button><p>{t("ارفع المستندات المطلوبة لتبدأ")}</p></section>}
    {wizardStarted && (!allCoreComplete || !wizardComplete) && currentStep && <section className="verification-wizard" aria-live="polite">
      <div className="verification-wizard-heading"><div><span className="eyebrow">{t("الخطوة")} {activeStep + 1}  {t("من")} {steps.length}</span><h3>{currentStep.kind === "phone" ? t(currentStep.label) : t("ارفع المستند المطلوب")}</h3></div><strong>{completedSteps}  {t("من")} {steps.length}  {t("مكتمل")}</strong></div>
      <div className="verification-progress-track" aria-label={`${t("اكتمل")} ${Math.round(completedSteps / steps.length * 100)}% ${t("من الخطوات")}`}><span style={{ width: `${Math.round(completedSteps / steps.length * 100)}%` }} /></div>
      {currentStep.kind === "phone" ? <article id="verification-phone" className={`verification-phone-row ${focusedTarget === "phone" ? "is-focus-target" : ""}`}><div><strong>{t("توثيق رقم الهاتف")}</strong><p>{snapshot.phone_verified ? t("تم توثيق الرقم المسجّل في الحساب.") : snapshot.telegram_enabled ? t("تحقق مجاني عبر تيليجرام بمشاركة رقمك من حسابك نفسه.") : t("خدمة تيليجرام غير مهيأة حاليًا. تواصل مع الدعم لإكمال التحقق.")}</p></div><div className="verification-phone-actions">{snapshot.phone_verified ? <span className="verification-status is-approved">{t("موثّق ✓")}</span> : <><button className="button button-primary button-small" onClick={() => void verifyPhone()} disabled={!snapshot.telegram_enabled}>{t("وثّق رقمك الآن")}</button>{telegramUrl && <a className="button button-outline button-small" href={telegramUrl} target="_blank" rel="noreferrer">{t("فتح تيليجرام")}</a>}</>}</div></article>
        : <DocumentCard type={currentStep.type} label={currentStep.label} document={docs.get(currentStep.type)} busy={busyDocument === currentStep.type} focused={focusedTarget === currentStep.id} onFile={(file) => void upload(currentStep.type, file)} />}
      <div className="verification-wizard-actions"><button className="button button-outline" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>{t("السابق")}</button><button className="button button-primary" onClick={nextStep} disabled={!isStepComplete(currentStep) || busyDocument !== null}>{activeStep === steps.length - 1 ? t("إنهاء") : t("التالي")}</button></div>
    </section>}
    {allCoreComplete && (!wizardStarted || wizardComplete) && <section className={`verification-finish ${accountActivated ? "is-activated" : "is-review"}`} role="status"><span className="verification-finish-icon" aria-hidden="true">{accountActivated ? "✓" : "…"}</span><div><h3>{accountActivated ? t("مبروك، تم تفعيل حسابك في سِكّة") : t("اكتمل رفع المستندات")}</h3><p>{accountActivated ? t("تم اعتماد متطلبات حسابك. تقدر تبدأ استخدام سِكّة الآن.") : t("وصلت مستنداتك الأساسية لفريق التوثيق، وحسابك الآن قيد المراجعة. سنحدّث الحالة تلقائيًا ونخبرك فور التفعيل.")}</p></div><div className="verification-finish-actions"><button className="button button-outline button-small" onClick={() => { setActiveStep(0); setWizardComplete(false); setWizardStarted(true); }}>{t("إدارة المستندات")}</button></div></section>}
    {snapshot.role === "captain" && <section className="verification-deferred"><div className="verification-deferred-heading"><div><h3>{t("مستندات خلال 30 يومًا")}</h3><p>{t("يمكن رفعهما الآن أو قبل انتهاء المهلة.")}</p></div><strong className={graceDays === 0 ? "is-rejected" : ""}>{graceDays === null ? t("تبدأ المهلة عند إنشاء ملف المركبة") : graceDays === 0 ? t("انتهت المهلة") : `${t("متبقي")} ${graceDays} ${t("يومًا")}`}</strong></div><div className="verification-doc-grid">{deferred.map((type) => <DocumentCard key={type} type={type} label={t(snapshot.requirements.labels[type] ?? type)} document={docs.get(type)} busy={busyDocument === type} focused={focusedTarget === type} onFile={(file) => void upload(type, file)} />)}</div></section>}
    {snapshot.captain_status === "suspended_grace_expired" && <p className="verification-warning" role="alert">{t("توقف استقبال الرحلات بعد انتهاء المهلة. ارفع المستندين وتواصل مع الدعم لإعادة التفعيل.")}</p>}
    <p className="verification-privacy">{t("مستنداتك خاصة، ونستخدمها لإتمام التوثيق.")}</p>
  </section>;
}

function DocumentCard({ type, label, document, busy, focused, onFile }: { type: VerificationDocumentType; label: string; document?: VerificationDocument; busy: boolean; focused: boolean; onFile: (file: File) => void }) {
  const status = document?.status ?? "empty";
  const statusLabel = t(status === "approved" ? "مقبول" : status === "pending" ? "قيد المراجعة" : status === "rejected" ? "مرفوض" : "لم يُرفع");
  const statusClass = status === "approved" ? "is-approved" : status === "pending" ? "is-pending" : status === "rejected" ? "is-rejected" : "is-empty";
  return <article className={`verification-doc-card ${focused ? "is-focus-target" : ""}`}>
    <div className="verification-doc-top"><div><h3>{t(label)}</h3><span className={`verification-status ${statusClass}`}>{statusLabel}</span></div><span className="verification-doc-icon" role="img" aria-label={`${t("مستند")} ${t(label)}`}>▧</span></div>
    {document?.rejection_reason && <p className="verification-rejection">{t("سبب الرفض:")} {t(document.rejection_reason)}</p>}
    {document?.uploaded_at && <small className="verification-date">{t("آخر رفع:")} {new Intl.DateTimeFormat(getLanguage() === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.uploaded_at))}</small>}
    <label id={`verification-upload-${type}`} tabIndex={0} className={`verification-upload button ${focused || status === "rejected" || status === "empty" ? "button-primary" : "button-outline"} button-small`}>{busy ? t("جارٍ الرفع…") : status === "rejected" ? t("أعد الرفع بعد المراجعة") : document ? t("استبدال المستند") : t("ارفع هذا المستند")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label>
  </article>;
}


