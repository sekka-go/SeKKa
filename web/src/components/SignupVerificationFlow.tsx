import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, uploadVerificationDocument, type VerificationDocument, type VerificationDocumentType } from "../api";
import { errorText } from "../lib/formatters";
import { t } from "../i18n/runtime";
import BrandLogo from "./BrandLogo";
import type { Session, Toast } from "../types";

type Snapshot = {
  role: "rider" | "captain";
  phone_verified: boolean;
  telegram_enabled: boolean;
  documents: VerificationDocument[];
  captain_status: "active" | "suspended_grace_expired" | null;
  verification_status: "pending" | "approved" | "rejected" | null;
  grace_period_expires_at: string | null;
  requirements: {
    rider: VerificationDocumentType[];
    captain_immediate: VerificationDocumentType[];
    captain_deferred: VerificationDocumentType[];
    labels: Record<string, string>;
  };
};

type Step =
  | { id: "vehicle"; kind: "vehicle"; optional: false }
  | { id: "phone"; kind: "phone"; optional: true }
  | { id: VerificationDocumentType; kind: "document"; type: VerificationDocumentType; optional: boolean; grace: boolean };

export default function SignupVerificationFlow({ session, notify, onExplore }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
  onExplore: (session: Session) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyDocument, setBusyDocument] = useState<VerificationDocumentType | null>(null);
  const [telegramUrl, setTelegramUrl] = useState("");
  const [vehicle, setVehicle] = useState("private_car");
  const [license, setLicense] = useState("");
  const [plate, setPlate] = useState("");
  const docs = useMemo(() => new Map((snapshot?.documents ?? []).map((doc) => [doc.document_type, doc])), [snapshot]);

  const refresh = useCallback(async () => {
    try {
      const result = await api<Snapshot>("/verification", { token: session.token });
      setSnapshot(result);
      setError("");
      return result;
    } catch (cause) {
      setError(errorText(cause));
      return null;
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!telegramUrl || snapshot?.phone_verified) return;
    const timer = window.setInterval(() => { void refresh(); }, 5_000);
    return () => window.clearInterval(timer);
  }, [telegramUrl, snapshot?.phone_verified, refresh]);

  const steps = useMemo<Step[]>(() => {
    if (!snapshot) return [];
    const result: Step[] = [];
    if (snapshot.role === "captain" && !snapshot.captain_status) result.push({ id: "vehicle", kind: "vehicle", optional: false });
    result.push({ id: "phone", kind: "phone", optional: true });
    const immediate = snapshot.role === "captain" ? snapshot.requirements.captain_immediate : snapshot.requirements.rider;
    for (const type of immediate) result.push({
      id: type,
      kind: "document",
      type,
      optional: snapshot.role === "rider",
      grace: false,
    });
    if (snapshot.role === "captain") {
      for (const type of snapshot.requirements.captain_deferred) result.push({ id: type, kind: "document", type, optional: true, grace: true });
    }
    return result;
  }, [snapshot]);

  const currentStep = steps[Math.min(activeStep, Math.max(steps.length - 1, 0))];
  const currentUploaded = currentStep?.kind === "document" && ["pending", "approved"].includes(docs.get(currentStep.type)?.status ?? "");
  const canContinue = Boolean(currentStep && (currentStep.kind !== "document" || currentUploaded));
  const next = () => {
    if (activeStep >= steps.length - 1) setComplete(true);
    else setActiveStep((step) => step + 1);
  };

  const saveVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/captain/profile", {
        method: "POST",
        token: session.token,
        body: { vehicle_type_id: vehicle, license_number: license.trim(), vehicle_plate: plate.trim() },
      });
      const result = await refresh();
      if (result?.captain_status) setActiveStep(0);
      else setError(t("تعذر تجهيز ملف المركبة. راجع البيانات وحاول مرة أخرى."));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (type: VerificationDocumentType, file?: File) => {
    if (!file) return;
    setBusyDocument(type);
    try {
      await uploadVerificationDocument(session.token, type, file);
      notify(t("تم رفع المستند وإرساله للمراجعة."), "success");
      await refresh();
    } catch (cause) {
      notify(errorText(cause), "error");
    } finally {
      setBusyDocument(null);
    }
  };

  const verifyPhone = async () => {
    try {
      const result = await api<{ verification_url?: string; already_verified?: boolean }>("/verification/phone/telegram", { method: "POST", token: session.token });
      if (result.already_verified) { await refresh(); return; }
      if (!result.verification_url) throw new Error(t("لم يصل رابط التحقق من الخادم."));
      setTelegramUrl(result.verification_url);
      window.open(result.verification_url, "_blank", "noopener,noreferrer");
      notify(t("افتح تيليجرام وشارك رقم هاتفك المسجّل، ثم ارجع لهذه الصفحة."), "info");
    } catch (cause) {
      notify(errorText(cause), "error");
    }
  };

  if (loading && !snapshot) return <main className="auth-page"><section className="auth-page-content"><section className="surface verification-center"><p>{t("loading.verification")}</p></section></section></main>;
  if (!snapshot) return <main className="auth-page"><header className="auth-page-header" /><section className="auth-page-content"><section className="surface verification-center"><h1>{t("تجهيز توثيق الحساب")}</h1><p role="alert">{error || t("تعذر تحميل حالة المستندات.")}</p><button className="button button-outline" onClick={() => { setLoading(true); void refresh(); }}>{t("إعادة المحاولة")}</button><button className="button button-primary" onClick={() => onExplore(session)}>{t("استكشف سكة الآن")}</button></section></section></main>;

  const graceDays = snapshot.grace_period_expires_at
    ? Math.max(0, Math.ceil((Date.parse(snapshot.grace_period_expires_at) - Date.now()) / 86_400_000))
    : null;

  return <main className="auth-page signup-onboarding-page">
    <header className="auth-page-header"><a href="/"><BrandLogo /></a><h1>{t("أهلًا بك في SeKKa")}</h1></header>
    <section className="auth-page-content">
      <section className="surface verification-center signup-verification-flow" aria-labelledby="signup-verification-title">
        <header className="verification-heading"><div><span className="eyebrow">{t("خطوة بخطوة")}</span><h2 id="signup-verification-title">{complete ? t("حسابك جاهز للاستكشاف") : t("تجهيز حسابك")}</h2></div></header>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {!complete && currentStep && <>
          <div className="verification-progress-copy"><strong>{t("الخطوة")} {activeStep + 1} {t("من")} {steps.length}</strong><span>{Math.round((activeStep + 1) / steps.length * 100)}{t("% مكتمل")}</span></div>
          <div className="verification-progress-track"><span style={{ width: `${Math.round((activeStep + 1) / steps.length * 100)}%` }} /></div>
          <section className="verification-wizard" aria-live="polite">
            <div className="verification-wizard-heading"><h3>{currentStep.kind === "vehicle" ? t("بيانات المركبة") : currentStep.kind === "phone" ? t("توثيق رقم الهاتف") : t(snapshot.requirements.labels[currentStep.type] ?? currentStep.type)}</h3></div>
            {currentStep.kind === "vehicle" && <form className="form-stack signup-vehicle-form" onSubmit={(event) => void saveVehicle(event)}>
              <p>{t("سجّل بيانات المركبة لبدء مراجعة طلب الكابتن. تبدأ مهلة المستندات المؤجلة بعد إنشاء ملف المركبة.")}</p>
              <label>{t("نوع المركبة")}<select value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="private_car">{t("سيارة خاصة")}</option><option value="hiace">{t("هاي إس")}</option></select></label>
              <label>{t("رقم الرخصة")}<input value={license} onChange={(event) => setLicense(event.target.value)} autoComplete="off" required /></label>
              <label>{t("رقم اللوحة")}<input value={plate} onChange={(event) => setPlate(event.target.value)} autoComplete="off" required /></label>
              <button className="button button-primary" disabled={busy}>{busy ? t("لحظة واحدة…") : t("حفظ ومتابعة")}</button>
            </form>}
            {currentStep.kind === "phone" && <article className="verification-phone-row"><div><strong>{t("توثيق رقم الهاتف")}</strong><p>{snapshot.phone_verified ? t("تم توثيق الرقم المسجّل في الحساب.") : snapshot.telegram_enabled ? t("تحقق مجاني عبر تيليجرام بمشاركة رقمك من حسابك نفسه.") : t("خدمة تيليجرام غير مهيأة حاليًا. يمكنك استكمال تجهيز الحساب والتحقق لاحقًا.")}</p></div><div className="verification-phone-actions">{snapshot.phone_verified ? <span className="verification-status is-approved">{t("موثّق ✓")}</span> : <button className="button button-primary button-small" onClick={() => void verifyPhone()} disabled={!snapshot.telegram_enabled}>{t("وثّق رقمك الآن")}</button>}</div></article>}
            {currentStep.kind === "document" && <>
              <DocumentCard label={snapshot.requirements.labels[currentStep.type] ?? currentStep.type} document={docs.get(currentStep.type)} busy={busyDocument === currentStep.type} onFile={(file) => void upload(currentStep.type, file)} />
              {currentStep.grace && <p className="verification-privacy">{graceDays === null ? t("تبدأ مهلة 30 يومًا عند إنشاء ملف المركبة.") : `${t("متبقي")} ${graceDays} ${t("يومًا")} ${t("لاستكمال المستندات المؤجلة.")}`}</p>}
              {snapshot.role === "rider" && <p className="verification-privacy">{t("رفع البطاقة اختياري الآن، ويمكنك استكشاف التطبيق بدونها.")}</p>}
            </>}
            {currentStep.kind !== "vehicle" && <div className="verification-wizard-actions">
              <button className="button button-outline" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>{t("السابق")}</button>
              <button className="button button-primary" onClick={next} disabled={!canContinue || busyDocument !== null}>{activeStep === steps.length - 1 ? t("إنهاء") : t("التالي")}</button>
              {currentStep.kind === "document" && currentStep.grace && !currentUploaded && <button className="button button-outline signup-grace-skip" onClick={next}>{t("تخطي — مهلة 30 يومًا")}</button>}
              {currentStep.kind === "document" && currentStep.optional && snapshot.role === "rider" && !currentUploaded && <button className="button button-outline signup-grace-skip" onClick={next}>{t("تخطي الآن، سأضيف البطاقة لاحقًا")}</button>}
            </div>}
          </section>
        </>}
        {complete && <section className="verification-finish is-review" role="status"><span className="verification-finish-icon" aria-hidden="true">✓</span><div><h3>{snapshot.role === "captain" ? t("استلمنا طلب توثيق الكابتن") : t("حسابك جاهز للاستكشاف")}</h3><p>{snapshot.role === "captain" ? t("ستراجع الإدارة المستندات الأساسية. يمكنك استخدام التطبيق الآن، ولن تظهر لك المسارات قبل اكتمال الموافقة.") : t("يمكنك استخدام التطبيق الآن وإضافة بطاقة الهوية لاحقًا من صفحة التوثيق.")}</p></div><button className="button button-primary signup-explore-button" onClick={() => onExplore(session)}>{t("استكشف سكة الآن")}</button></section>}
        <p className="verification-privacy">{t("مستنداتك خاصة، ولا يطّلع عليها إلا فريق التوثيق المخوّل.")}</p>
      </section>
    </section>
  </main>;
}

function DocumentCard({ label, document, busy, onFile }: {
  label: string;
  document?: VerificationDocument;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const status = document?.status ?? "empty";
  const statusLabel = t(status === "approved" ? "مقبول" : status === "pending" ? "قيد المراجعة" : status === "rejected" ? "مرفوض" : "لم يُرفع");
  const statusClass = status === "approved" ? "is-approved" : status === "pending" ? "is-pending" : status === "rejected" ? "is-rejected" : "is-empty";
  return <article className="verification-doc-card"><div className="verification-doc-top"><div><h3>{t(label)}</h3><span className={`verification-status ${statusClass}`}>{statusLabel}</span></div><span className="verification-doc-icon" aria-hidden="true">▧</span></div><label className="verification-upload button button-primary button-small">{busy ? t("جارٍ الرفع…") : document ? t("استبدال المستند") : t("ارفع هذا المستند")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label></article>;
}
