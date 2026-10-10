import { t } from "../i18n/runtime";
import { getDirection } from "../i18n/runtime";
import { useRef, useState, type FormEvent } from "react";
import BrandLogo from "../components/BrandLogo";
import AppIcon from "../components/AppIcon";
import RiderRoutePreferences from "../components/RiderRoutePreferences";
import { errorText } from "../lib/formatters";
import { api, type SavedPlace, type User } from "../api";
import type { Session, Toast } from "../types";
import { InfoDocumentContent, type InfoPageKey } from "../components/InfoPages";
import SignupVerificationFlow from "../components/SignupVerificationFlow";

const TERMS_VERSION = "2026-10-05";
const PRIVACY_VERSION = "2026-10-05";

function AuthJourneyBackdrop() {
  return <div className="auth-journey-backdrop" aria-hidden="true">
    <span className="journey-car journey-car--taxi">🚕</span>
    <span className="journey-car journey-car--van">🚐</span>
    <span className="journey-car journey-car--smile">🚗😊</span>
    <div className="auth-journey-particles">
      <span className="journey-particle">😊</span>
      <span className="journey-particle">❤️</span>
      <span className="journey-particle">⭐</span>
      <span className="journey-particle">💛</span>
      <span className="journey-particle">✨</span>
      <span className="journey-particle">😊</span>
      <span className="journey-particle">❤️</span>
      <span className="journey-particle">⭐</span>
      <span className="journey-particle journey-confetti" />
      <span className="journey-particle journey-confetti" />
      <span className="journey-particle journey-confetti" />
      <span className="journey-particle journey-confetti" />
    </div>
  </div>;
}

export default function AuthScreen({ onSignedIn, notify }: { onSignedIn: (session: Session) => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const mode = window.location.pathname === "/register" ? "register" : "login";
  const [role, setRole] = useState<"rider" | "captain">("rider");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [readTerms, setReadTerms] = useState(false);
  const [readPrivacy, setReadPrivacy] = useState(false);
  const [readingPage, setReadingPage] = useState<Exclude<InfoPageKey, "faq"> | null>(null);
  const readingPanel = useRef<HTMLDivElement>(null);
  const [forgotStep, setForgotStep] = useState<"closed" | "request" | "complete">("closed");
  const [resetUrl, setResetUrl] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pendingRouteSetup, setPendingRouteSetup] = useState<Session | null>(null);
  const [pendingSignupVerification, setPendingSignupVerification] = useState<Session | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") {
        if (!accepted || !readTerms || !readPrivacy) throw new Error("اقرأ الشروط وسياسة الخصوصية ووافق عليهما قبل إنشاء الحساب.");
        await api("/auth/register", { method: "POST", body: { full_name: fullName.trim(), phone_number: phone.trim(), password, role, accepted_terms: true, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } });
      }
      const result = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { phone_number: phone.trim(), password } });
      const session = { token: result.token, user: result.user };
      if (mode === "register") {
        setPendingSignupVerification(session);
        return;
      }
      if (session.user.role === "rider") {
        let places: SavedPlace[] = [];
        try { places = (await api<{ places: SavedPlace[] }>("/rider/saved-places", { token: session.token })).places ?? []; }
        catch { setPendingRouteSetup(session); return; }
        if (!places.some((place) => place.place_type === "home") || !places.some((place) => place.place_type === "work")) {
          setPendingRouteSetup(session);
          return;
        }
      }
      onSignedIn(session);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  const requestReset = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ reset_url: string }>("/auth/password-reset/telegram", { method: "POST", body: { phone_number: phone.trim() } });
      setResetUrl(result.reset_url);
      setForgotStep("complete");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  const completeReset = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/auth/password-reset/complete", { method: "POST", body: { phone_number: phone.trim(), code: resetCode.trim(), new_password: newPassword } });
      setForgotStep("closed"); setPassword(""); setResetCode(""); setNewPassword("");
      notify(t("تم تغيير كلمة السر. سجّل الدخول بكلمة السر الجديدة."), "success");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  const markReadIfAtEnd = () => {
    const element = readingPanel.current;
    if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - 12) {
      if (readingPage === "terms") setReadTerms(true);
      if (readingPage === "privacy") setReadPrivacy(true);
    }
  };

  if (pendingRouteSetup) return <main className="auth-page">
    <header className="auth-page-header"><a href="/"><BrandLogo /></a></header>
    <section className="auth-page-content route-onboarding-content">
      <RiderRoutePreferences token={pendingRouteSetup.token} notify={notify} onboarding onComplete={() => { onSignedIn(pendingRouteSetup); setPendingRouteSetup(null); notify(t("أهلًا بك في سِكّة. حسابك ونقطك المفضلة جاهزين."), "success"); }} />
    </section>
  </main>;

  if (pendingSignupVerification) return <SignupVerificationFlow
    session={pendingSignupVerification}
    notify={notify}
    onExplore={(session) => {
      onSignedIn(session);
      notify(t("أهلًا بك في سِكّة. حسابك جاهز للاستكشاف."), "success");
    }}
  />;

  return <main className={`auth-page ${mode === "login" ? "auth-login-page" : "auth-register-page"}`}>
    <AuthJourneyBackdrop />
    <header className="auth-page-header"><a href="/"><BrandLogo /></a></header>
    <section className="auth-page-content">
      <div className={`auth-card auth-page-card ${mode === "login" ? "auth-login-card" : "auth-register-card"}`}>
        <div className="auth-tabs"><span className="active" aria-current="page">{mode === "login" ? t("تسجيل الدخول") : t("حساب جديد")}</span></div>
        <div className="auth-heading">
          {mode === "login" && <span className="eyebrow">{t("مبسوطين برجوعك")}</span>}
          <h1>{mode === "login" ? t("أهلًا بيك تاني") : t("انضم لسِكّة")}</h1>
          <p>{mode === "login" ? t("سجّل دخولك وكمّل من حيث توقفت.") : t("أنشئ حسابك وابدأ ترتّب مشاويرك.")}</p>
        </div>

        {forgotStep === "closed" ? <form onSubmit={submit} className="form-stack">
          {mode === "register" && <>
            <label>{t("الاسم بالكامل")}<input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("مثال: أحمد محمد أحمد")} required /></label>
            <fieldset className="role-picker"><legend>{t("هتستخدم سِكّة بصفتك؟")}</legend><button type="button" aria-pressed={role === "rider"} className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><span><AppIcon name="user" size={21} /></span><strong>{t("راكب")}</strong><small>{t("أدور على مشوار مشترك")}</small></button><button type="button" aria-pressed={role === "captain"} className={role === "captain" ? "selected" : ""} onClick={() => setRole("captain")}><span><AppIcon name="car" size={21} /></span><strong>{t("كابتن")}</strong><small>{t("أوصل الركاب لوجهتهم")}</small></button></fieldset>
          </>}
          <label>{t("رقم الهاتف")}<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          <label className="auth-password-label">{t("كلمة السر")}<span className="auth-password-control"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? t("8 أحرف على الأقل") : "••••••••"} minLength={mode === "register" ? 8 : 1} required /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? t("إخفاء كلمة السر") : t("إظهار كلمة السر")} aria-pressed={showPassword}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.4-6.1 9.8-6.1 9.8 6.1 9.8 6.1-3.4 6.1-9.8 6.1S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="2.7"/>{showPassword && <path d="m3 3 18 18"/>}</svg></button></span></label>
          {mode === "register" && <section className="auth-consent" aria-labelledby="auth-consent-title">
            <strong id="auth-consent-title">{t("قبل إنشاء حسابك")}</strong>
            <p>{t("اقرأ المستندين بالتمرير إلى نهايتهما، ثم أكّد موافقتك.")}</p>
            <div className="auth-consent-links"><button type="button" onClick={() => setReadingPage("terms")}>{readTerms ? "✓ " : t("اقرأ ")}{t("الشروط والأحكام")}</button><button type="button" onClick={() => setReadingPage("privacy")}>{readPrivacy ? "✓ " : t("اقرأ ")}{t("سياسة الخصوصية")}</button></div>
            <label className={`auth-consent-check ${!readTerms || !readPrivacy ? "is-disabled" : ""}`}><input type="checkbox" checked={accepted} disabled={!readTerms || !readPrivacy} onChange={(event) => setAccepted(event.target.checked)} required /><span>{t("قرأت الشروط وسياسة الخصوصية وأوافق عليهما.")}</span></label>
          </section>}
          {error && <div className="inline-error" role="alert">{error}</div>}
          {mode === "login" && error.includes("رقم الهاتف أو كلمة السر غلط") && <button type="button" className="auth-forgot-link" onClick={() => { setForgotStep("request"); setError(""); }}>{t("نسيت كلمة السر؟")}</button>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? mode === "login" ? t("loading.login") : t("لحظة واحدة…") : mode === "login" ? t("دخول إلى حسابي") : t("إنشاء الحساب")}<span aria-hidden="true">←</span></button>
        </form> : forgotStep === "request" ? <form className="form-stack auth-reset-form" onSubmit={requestReset}>
          <h2>{t("استعادة كلمة السر")}</h2><p>{t("أدخل رقم الهاتف المسجل، وسنجهز رابطًا آمنًا لبدء التحقق عبر بوت سِكّة في تيليجرام.")}</p>
          <label>{t("رقم الهاتف")}<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? t("لحظة واحدة…") : t("أرسل رابط تيليجرام")}</button>
          <button type="button" className="auth-forgot-link" onClick={() => { setForgotStep("closed"); setError(""); }}>{t("العودة لتسجيل الدخول")}</button>
        </form> : <form className="form-stack auth-reset-form" onSubmit={completeReset}>
          <h2>{t("تحقق من رقمك")}</h2><p>{t("افتح البوت وشارك رقم هاتفك المسجل. سيصلك رمز صالح لمدة ١٥ دقيقة.")}</p>
          <a className="button button-outline button-wide auth-telegram-link" href={resetUrl} target="_blank" rel="noreferrer">{t("فتح بوت سِكّة في تيليجرام ↗")}</a>
          <label>{t("رمز التحقق")}<input inputMode="numeric" autoComplete="one-time-code" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" minLength={6} maxLength={6} required /></label>
          <label>{t("كلمة السر الجديدة")}<input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? t("لحظة واحدة…") : t("حفظ كلمة السر الجديدة")}</button>
          <button type="button" className="auth-forgot-link" onClick={() => { setForgotStep("closed"); setError(""); }}>{t("العودة لتسجيل الدخول")}</button>
        </form>}

        {mode === "login" && forgotStep === "closed" && <p className="auth-switch">{t("لسه جديد في سِكّة؟")} <a href="/register">{t("أنشئ حسابك")}</a></p>}
        {mode === "register" && <p className="auth-switch">{t("عندك حساب بالفعل؟")} <a href="/login">{t("سجّل الدخول")}</a></p>}
      </div>
    </section>
    {readingPage && <div className="auth-document-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReadingPage(null); }}><section className="auth-document-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-document-title" dir={getDirection()}><header><h2 id="auth-document-title">{readingPage === "terms" ? t("الشروط والأحكام") : t("سياسة الخصوصية")}</h2><button type="button" onClick={() => setReadingPage(null)} aria-label={t("إغلاق")}>×</button></header><div className="auth-document-scroll" ref={readingPanel} onScroll={markReadIfAtEnd} onWheel={markReadIfAtEnd} onTouchEnd={markReadIfAtEnd}><InfoDocumentContent page={readingPage} /></div><footer><span>{(readingPage === "terms" ? readTerms : readPrivacy) ? t("تمت القراءة") : t("مرّر إلى نهاية المستند لتأكيد قراءته")}</span><button type="button" className="button button-primary" disabled={!(readingPage === "terms" ? readTerms : readPrivacy)} onClick={() => setReadingPage(null)}>{t("تم")}</button></footer></section></div>}
  </main>;
}

