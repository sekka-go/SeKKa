import { useState, type FormEvent } from "react";
import { Button, InlineAlert, TextField } from "../../design-system/components";
import "./legal-pages.css";

type Stage = "phone" | "email" | "email-sent" | "code" | "password" | "complete";

type Props = {
  onBack: () => void;
  onSendPhoneCode: (phone: string) => Promise<void>;
  onVerifyPhoneCode: (phone: string, code: string) => Promise<void>;
  onSendEmailReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
};

export default function ForgotPasswordScreen({ onBack, onSendPhoneCode, onVerifyPhoneCode, onSendEmailReset, onUpdatePassword }: Props) {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (stage === "phone") {
      const normalized = phone.replace(/[\s()-]/g, "");
      if (!/^01[0125]\d{8}$/.test(normalized)) { setError("أدخل رقم هاتف مصريًا صحيحًا مكوّنًا من 11 رقمًا."); return; }
      await run(async () => { await onSendPhoneCode(normalized); setPhone(normalized); setStage("code"); });
    } else if (stage === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("أدخل بريدًا إلكترونيًا صحيحًا."); return; }
      await run(async () => { await onSendEmailReset(email.trim()); setStage("email-sent"); });
    } else if (stage === "code") {
      if (!/^\d{6}$/.test(code.trim())) { setError("أدخل رمز التحقق المكوّن من 6 أرقام."); return; }
      await run(async () => { await onVerifyPhoneCode(phone, code.trim()); setStage("password"); });
    } else if (stage === "password") {
      if (password.length < 8) { setError("كلمة المرور يجب ألا تقل عن 8 أحرف."); return; }
      if (password !== confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
      await run(async () => { await onUpdatePassword(password); setStage("complete"); });
    }
  }

  async function run(action: () => Promise<void>) {
    setLoading(true);
    try { await action(); }
    catch (cause) { setError(recoveryErrorMessage(cause)); }
    finally { setLoading(false); }
  }

  const titles: Record<Stage, string> = {
    phone: "استعادة الحساب", email: "استعادة عبر البريد", "email-sent": "تحقق من بريدك",
    code: "رمز التحقق", password: "كلمة مرور جديدة", complete: "تم تحديث الحساب",
  };

  return (
    <main className="sekka-legal-page" dir="rtl" lang="ar">
      <header className="legal-header"><button className="legal-back" type="button" onClick={onBack} aria-label="العودة لتسجيل الدخول">←</button><a className="legal-brand" href="/"><img src="/brand/sekka-mark.png" alt=""/><strong>سِكّة</strong></a></header>
      <section className="recovery-content" aria-labelledby="recovery-title">
        <div className="recovery-icon" aria-hidden="true"><RecoveryIcon/></div>
        <h1 id="recovery-title">{titles[stage]}</h1>
        <p className="recovery-description">
          {stage === "phone" && <>أدخل رقم الهاتف المسجل وسنرسل رمز تحقق لاستعادة الوصول إلى حسابك.</>}
          {stage === "email" && <>إذا كان بريدك الإلكتروني مرتبطًا بحسابك، سنرسل إليه رابطًا آمنًا لإعادة تعيين كلمة المرور.</>}
          {stage === "email-sent" && <>إذا كان البريد مرتبطًا بحساب، ستصلك رسالة. افتح الرابط من هذا الجهاز لإكمال إعادة التعيين.</>}
          {stage === "code" && <>أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى <bdi dir="ltr">{phone}</bdi>.</>}
          {stage === "password" && <>تحققنا من رقم هاتفك. اختر كلمة مرور جديدة لحسابك.</>}
          {stage === "complete" && <>تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول بها.</>}
        </p>

        {(stage === "phone" || stage === "email" || stage === "code" || stage === "password") && <form className="recovery-form" onSubmit={submit} noValidate>
          {stage === "phone" && <TextField label="رقم الهاتف" type="tel" inputMode="tel" dir="ltr" autoComplete="tel-national" placeholder="01xxxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} required />}
          {stage === "email" && <TextField label="البريد الإلكتروني" type="email" inputMode="email" dir="ltr" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />}
          {stage === "code" && <TextField label="رمز التحقق" type="text" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} placeholder="••••••" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />}
          {stage === "password" && <>
            <TextField label="كلمة المرور الجديدة" type="password" autoComplete="new-password" minLength={8} placeholder="8 أحرف على الأقل" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <TextField label="تأكيد كلمة المرور" type="password" autoComplete="new-password" minLength={8} placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </>}
          {error && <InlineAlert>{error}</InlineAlert>}
          <Button type="submit" loading={loading} loadingLabel="جارٍ الإرسال…">{stage === "phone" ? "إرسال رمز التحقق" : stage === "email" ? "إرسال رابط الاستعادة" : stage === "code" ? "التحقق من الرمز" : "حفظ كلمة المرور"}<span aria-hidden="true">←</span></Button>
        </form>}

        {stage === "phone" && <>
          <div className="recovery-divider"><span/>أو<span/></div>
          <button className="legal-outline-button" type="button" onClick={() => { setError(""); setStage("email"); }}><MailIcon/> استعادة الحساب عبر البريد الإلكتروني</button>
          <p className="recovery-support"><HelpIcon/> تحتاج إلى مساعدة؟ استخدم قناة الدعم المتاحة في التطبيق.</p>
        </>}

        {stage === "email" && <p className="recovery-note">يتطلب إرسال البريد إعداد خدمة SMTP في Supabase، وأن يكون البريد مرتبطًا بالحساب. إذا لم تستخدم بريدًا عند إنشاء الحساب، اختر استعادة الهاتف.</p>}
        {stage === "email-sent" && <div className="recovery-result"><div className="recovery-success-mark">✓</div><button className="legal-outline-button" type="button" onClick={onBack}>العودة لتسجيل الدخول</button><button className="recovery-text-button" type="button" onClick={() => { setError(""); setStage("email"); }}>استخدام بريد آخر</button></div>}
        {stage === "complete" && <div className="recovery-result"><div className="recovery-success-mark">✓</div><button className="legal-primary-button" type="button" onClick={onBack}>تسجيل الدخول</button></div>}
        {(stage === "code" || stage === "password") && <button className="recovery-text-button" type="button" onClick={() => { setError(""); setCode(""); setStage("phone"); }}>تغيير رقم الهاتف</button>}
      </section>
      <BottomDecoration />
    </main>
  );
}

export function ResetPasswordScreen({ sessionReady, checkingSession, onBack, onUpdatePassword }: { sessionReady: boolean; checkingSession: boolean; onBack: () => void; onUpdatePassword: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("كلمة المرور يجب ألا تقل عن 8 أحرف."); return; }
    if (password !== confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
    setLoading(true);
    try { await onUpdatePassword(password); setComplete(true); }
    catch (cause) { setError(recoveryErrorMessage(cause)); }
    finally { setLoading(false); }
  }
  return <main className="sekka-legal-page" dir="rtl" lang="ar">
    <header className="legal-header"><button className="legal-back" type="button" onClick={onBack} aria-label="العودة لتسجيل الدخول">←</button><a className="legal-brand" href="/"><img src="/brand/sekka-mark.png" alt=""/><strong>سِكّة</strong></a></header>
    <section className="recovery-content">
      <div className="recovery-icon" aria-hidden="true"><RecoveryIcon/></div>
      <h1>{complete ? "تم تحديث كلمة المرور" : "تعيين كلمة مرور جديدة"}</h1>
      {complete ? <div className="recovery-result"><div className="recovery-success-mark">✓</div><p className="recovery-description">أصبحت كلمة المرور الجديدة جاهزة. سجّل الدخول للمتابعة.</p><button className="legal-primary-button" type="button" onClick={onBack}>العودة لتسجيل الدخول</button></div> : checkingSession ? <p className="recovery-description">جارٍ التحقق من رابط الاستعادة…</p> : !sessionReady ? <div className="recovery-result"><p className="recovery-description">رابط الاستعادة غير صالح أو انتهت صلاحيته. أرسل طلب استعادة جديدًا.</p><button className="legal-primary-button" type="button" onClick={() => { window.location.assign("/forgot-password"); }}>إرسال رابط جديد</button></div> : <>
        <p className="recovery-description">اكتب كلمة مرور جديدة لا تقل عن 8 أحرف.</p>
        <form className="recovery-form" onSubmit={submit} noValidate><TextField label="كلمة المرور الجديدة" type="password" autoComplete="new-password" minLength={8} placeholder="8 أحرف على الأقل" value={password} onChange={(event) => setPassword(event.target.value)} required/><TextField label="تأكيد كلمة المرور" type="password" autoComplete="new-password" minLength={8} placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/>{error && <InlineAlert>{error}</InlineAlert>}<Button type="submit" loading={loading} loadingLabel="جارٍ الحفظ…">حفظ كلمة المرور<span aria-hidden="true">←</span></Button></form>
      </>}
    </section><BottomDecoration/>
  </main>;
}

function recoveryErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (message.includes("rate limit") || message.includes("too many") || message.includes("429")) return "تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا.";
  if (message.includes("email_address_not_authorized")) return "إرسال البريد غير مهيأ لهذا العنوان في Supabase. استخدم رمز الهاتف أو تواصل مع الدعم.";
  if (message.includes("network") || message.includes("fetch")) return "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجددًا.";
  if (message.includes("expired") || message.includes("invalid")) return "انتهت صلاحية الرمز أو الرابط. اطلب رمزًا جديدًا وحاول مرة أخرى.";
  return "تعذر إتمام الاستعادة. تحقق من البيانات وحاول مرة أخرى.";
}

function RecoveryIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>; }
function MailIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>; }
function HelpIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.4 1.6c-1.1 1-2 1.3-2 2.9M12 17h.01"/></svg>; }
function BottomDecoration() { return <div className="legal-bottom-decoration" aria-hidden="true"><div className="legal-city"/><div className="legal-road"/></div>; }
