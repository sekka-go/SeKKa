import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import RegisterScreen, { type SignupPayload } from "./screens/RegisterScreen";
import LoginScreen from "./screens/LoginScreen";
import PublicHomeScreen from "./screens/PublicHomeScreen";
import RiderHomeScreen, { type HomeAction } from "./screens/RiderHomeScreen";
import RiderTripsScreen from "./screens/RiderTripsScreen";
import ForgotPasswordScreen, { ResetPasswordScreen } from "./screens/legal/ForgotPasswordScreen";
import LegalDocumentScreen from "./screens/legal/LegalDocumentScreen";
import RiderJourneyScreen, { type RiderJourneyKey } from "./screens/RiderJourneyScreen";
import CaptainJourneyScreen, { type CaptainJourneyKey } from "./screens/CaptainJourneyScreen";

type RegistrationState = "form" | "verify" | "complete";
type PublicRouteState = "checking" | "guest" | "redirecting" | "error";

function makeSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } });
  } catch {
    return null;
  }
}

export default function App() {
  const supabase = useMemo(makeSupabaseClient, []);
  const [state, setState] = useState<RegistrationState>("form");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [resetSessionReady, setResetSessionReady] = useState(false);
  const [checkingResetSession, setCheckingResetSession] = useState(false);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isLoginPage = path === "/login";
  const isRegisterPage = path === "/register";
  const isPublicHome = path === "/";
  const isRiderHome = path === "/home";
  const isCaptainHome = path === "/captain/home";
  const captainJourneyMatch = path.match(/^\/captain\/journey\/([a-z-]+)$/);
  const captainJourneyKey = captainJourneyMatch?.[1] as CaptainJourneyKey | undefined;
  const isTripsPage = path === "/trips";
  const isMyTripsPage = path === "/my-trips";
  const journeyMatch = path.match(/^\/journey\/([a-z-]+)$/);
  const journeyKey = journeyMatch?.[1] as RiderJourneyKey | undefined;
  const isRiderTripsPage = isTripsPage || isMyTripsPage;
  const isForgotPasswordPage = path === "/forgot-password";
  const isResetPasswordPage = path === "/reset-password";
  const isTermsPage = path === "/terms";
  const isPrivacyPage = path === "/privacy";
  const [publicRouteState, setPublicRouteState] = useState<PublicRouteState>(() => isPublicHome && supabase ? "checking" : "guest");

  useEffect(() => {
    if (!isResetPasswordPage || !supabase) { setCheckingResetSession(false); return; }
    let active = true;
    setCheckingResetSession(true);
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session && active) {
        setResetSessionReady(true);
        setCheckingResetSession(false);
      }
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (!sessionError && data.session) setResetSessionReady(true);
      setCheckingResetSession(false);
    }).catch(() => { if (active) setCheckingResetSession(false); });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, [isResetPasswordPage, supabase]);

  useEffect(() => {
    if (!isPublicHome || !supabase) { setPublicRouteState("guest"); return; }
    let active = true;
    async function redirectAuthenticatedUser() {
      try {
        const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) { if (active) setPublicRouteState("guest"); return; }
        const { data: profile, error: profileError } = await supabase!.from("profiles").select("role").eq("id", sessionData.session.user.id).maybeSingle();
        if (profileError) throw profileError;
        const destinations: Record<string, string> = { rider: "/home", captain: "/captain/home", admin: "/admin" };
        const destination = profile?.role ? destinations[profile.role] : undefined;
        if (!destination) throw new Error("missing-role");
        if (active) setPublicRouteState("redirecting");
        window.location.replace(destination);
      } catch {
        if (active) setPublicRouteState("error");
      }
    }
    void redirectAuthenticatedUser();
    return () => { active = false; };
  }, [isPublicHome, supabase]);

  useEffect(() => {
    const journeyTitle: Partial<Record<RiderJourneyKey, string>> = { group: "تفاصيل المجموعة", subscriptions: "اشتراكاتي", subscription: "تفاصيل الاشتراك", receipt: "إيصال سِكّة", "payment-method": "اختيار وسيلة الدفع", proof: "رفع إثبات التحويل", "captain-confirmation": "انتظار تأكيد الكابتن", "payment-code": "تأكيد كود الدفع", "payment-result": "نتيجة الدفع", renewal: "التجديد الشهري", "replacement-captain": "البحث عن كابتن بديل", conversations: "المحادثات", conversation: "تفاصيل المحادثة", notifications: "الإشعارات", ratings: "التقييمات", complaint: "تقديم شكوى", "complaint-status": "متابعة الشكوى", profile: "الملف الشخصي والإعدادات" };
    document.title = isLoginPage ? "تسجيل الدخول | سِكّة" : isRegisterPage ? "إنشاء حساب جديد | سِكّة" : isForgotPasswordPage ? "استعادة الحساب | سِكّة" : isResetPasswordPage ? "تعيين كلمة مرور | سِكّة" : isTermsPage ? "الشروط والأحكام | سِكّة" : isPrivacyPage ? "سياسة الخصوصية | سِكّة" : isRiderHome ? "الرئيسية | سِكّة" : isCaptainHome || captainJourneyKey === "home" ? "الرئيسية للكابتن | سِكّة" : isTripsPage ? "الرحلات المتاحة | سِكّة" : isMyTripsPage ? "رحلاتي | سِكّة" : journeyKey ? `${journeyTitle[journeyKey] ?? "حسابي"} | سِكّة` : captainJourneyKey ? `الكابتن | ${captainJourneyKey} | سِكّة` : isPublicHome ? "سِكّة | تنقّل منتظم" : "الصفحة غير موجودة | سِكّة";
  }, [isLoginPage, isRegisterPage, isForgotPasswordPage, isResetPasswordPage, isTermsPage, isPrivacyPage, isRiderHome, isCaptainHome, isTripsPage, isMyTripsPage, isPublicHome, journeyKey, captainJourneyKey]);

  async function register(payload: SignupPayload) {
    setError("");
    if (!supabase) {
      setError("التسجيل غير متاح حاليًا. إعدادات الاتصال بالخدمة غير مكتملة.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        phone: `+20${payload.phone.slice(1)}`,
        password: payload.password,
        options: { data: { full_name: payload.fullName, requested_role: payload.role } },
      });
      if (signupError) throw signupError;
      setPhone(`+20${payload.phone.slice(1)}`);
      if (data.session) setState("complete");
      else setState("verify");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || loading) return;
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp.trim(), type: "sms" });
      if (verifyError) throw verifyError;
      setState("complete");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function login(phoneNumber: string, password: string) {
    setError("");
    setLoginSuccess("");
    if (!supabase) {
      setError("تسجيل الدخول غير متاح حاليًا. إعدادات الاتصال بالخدمة غير مكتملة.");
      return;
    }
    setLoading(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        phone: `+20${phoneNumber.slice(1)}`,
        password,
      });
      if (loginError) throw loginError;
      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!authData.user) throw new Error("Authenticated user was not returned");
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
      if (profileError) throw profileError;
      const destinations: Record<string, string> = { rider: "/home", captain: "/captain/home", admin: "/admin" };
      const destination = profile?.role ? destinations[profile.role] : undefined;
      if (destination) window.location.replace(destination);
      else setError("تم تسجيل الدخول، لكن نوع الحساب غير محدد. تواصل مع الدعم لاستكمال بيانات حسابك.");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function sendRecoveryPhoneCode(phoneNumber: string) {
    if (!supabase) throw new Error("service unavailable");
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toEgyptianPhone(phoneNumber), options: { shouldCreateUser: false } });
    if (otpError) throw otpError;
  }

  async function verifyRecoveryPhoneCode(phoneNumber: string, token: string) {
    if (!supabase) throw new Error("service unavailable");
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: toEgyptianPhone(phoneNumber), token, type: "sms" });
    if (verifyError) throw verifyError;
  }

  async function sendEmailPasswordReset(email: string) {
    if (!supabase) throw new Error("service unavailable");
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (recoveryError) throw recoveryError;
  }

  async function updateRecoveredPassword(password: string) {
    if (!supabase) throw new Error("service unavailable");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
    await supabase.auth.signOut();
  }

  if (state === "verify" || state === "complete") {
    return (
      <main className="sekka-register-screen" dir="rtl" lang="ar">
        <section className="sekka-register-card sekka-register-result" aria-live="polite">
          <a className="sekka-register-brand" href="/" aria-label="سِكّة"><img src="/brand/sekka-mark.png" alt="شعار سِكّة" /></a>
          {state === "verify" ? (
            <>
              <p className="sekka-register-eyebrow">خطوة أخيرة</p>
              <h1>تحقق من رقم هاتفك</h1>
              <p className="sekka-register-result-copy">أرسلنا رمز التحقق إلى <bdi dir="ltr">{phone}</bdi></p>
              <form className="sekka-register-form" onSubmit={verifyPhone}>
                <label className="sekka-register-field"><span>رمز التحقق</span><input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={8} required /></label>
                {error && <p className="sekka-register-error" role="alert">{error}</p>}
                <button className="sekka-register-submit" type="submit" disabled={loading}>{loading ? "جارٍ التحقق…" : "تأكيد رقم الهاتف"}</button>
              </form>
              <button className="sekka-register-back" type="button" onClick={() => { setError(""); setState("form"); }}>العودة للتسجيل</button>
            </>
          ) : (
            <>
              <div className="sekka-register-success-mark" aria-hidden="true">✓</div>
              <h1>تم إنشاء حسابك</h1>
              <p className="sekka-register-result-copy">تم التحقق من رقم هاتفك بنجاح. يمكنك الآن تسجيل الدخول.</p>
              <a className="sekka-register-submit sekka-register-link-button" href="/login">الانتقال لتسجيل الدخول <span aria-hidden="true">←</span></a>
              <p className="sekka-register-role-note">سيتم تفعيل صلاحيات الحساب بعد ربط اختيار الدور بإعدادات الحساب المعتمدة.</p>
            </>
          )}
        </section>
      </main>
    );
  }

  if (isLoginPage) {
    return <LoginScreen onLogin={login} onCreateAccount={() => { window.location.assign("/register"); }} onForgotPassword={() => { window.location.assign("/forgot-password"); }} loading={loading} error={error} success={loginSuccess} />;
  }

  if (isRegisterPage) {
    const initialRole = new URLSearchParams(window.location.search).get("role") === "captain" ? "captain" : "rider";
    return <RegisterScreen initialRole={initialRole} onRegister={register} onLogin={() => { window.location.assign("/login"); }} onTerms={() => { window.location.assign("/terms"); }} onPrivacy={() => { window.location.assign("/privacy"); }} loading={loading} error={error} />;
  }

  if (isForgotPasswordPage) return <ForgotPasswordScreen onBack={() => { window.location.assign("/login"); }} onSendPhoneCode={sendRecoveryPhoneCode} onVerifyPhoneCode={verifyRecoveryPhoneCode} onSendEmailReset={sendEmailPasswordReset} onUpdatePassword={updateRecoveredPassword} />;
  if (isResetPasswordPage) return <ResetPasswordScreen sessionReady={resetSessionReady} checkingSession={checkingResetSession} onBack={() => { window.location.assign("/login"); }} onUpdatePassword={updateRecoveredPassword} />;
  if (isTermsPage || isPrivacyPage) return <LegalDocumentScreen kind={isTermsPage ? "terms" : "privacy"} onBack={() => { if (window.history.length > 1) window.history.back(); else window.location.assign("/register"); }} />;

  if (isRiderHome) {
    const routes: Record<HomeAction, string> = {
      home: "/home",
      explore: "/trips",
      myTrips: "/my-trips",
      mySubscriptions: "/journey/subscriptions",
      myRequests: "/requests",
      newTrip: "/requests/new",
      support: "/journey/complaint",
      profile: "/journey/profile",
      notifications: "/journey/notifications",
      allTrips: "/my-trips",
      featuredTrips: "/trips",
      recentTrip: "/my-trips",
    };
    return <RiderHomeScreen supabase={supabase} onAction={(action) => window.location.assign(routes[action])} />;
  }

  if (isCaptainHome) return <CaptainJourneyScreen supabase={supabase} screen="home" onNavigate={(target) => window.location.assign(target)} />;
  if (captainJourneyKey) return <CaptainJourneyScreen supabase={supabase} screen={captainJourneyKey} onNavigate={(target) => window.location.assign(target)} />;

  if (isRiderTripsPage) return <RiderTripsScreen supabase={supabase} mode={isMyTripsPage ? "mine" : "available"} onHome={() => window.location.assign("/home")} />;
  if (journeyKey) return <RiderJourneyScreen supabase={supabase} screen={journeyKey} onNavigate={(target) => window.location.assign(target)} />;

  if (isPublicHome && publicRouteState === "checking") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ التحقق من حسابك…</span></main>;
  if (isPublicHome && publicRouteState === "redirecting") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ فتح صفحتك الرئيسية…</span></main>;
  if (isPublicHome && publicRouteState === "error") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><h1>تعذر فتح الصفحة الرئيسية لحسابك</h1><p>تعذر التحقق من جلسة الدخول أو أن دور الحساب غير محدد. سجّل الدخول مجددًا أو تواصل مع الدعم.</p><a href="/login">الانتقال لتسجيل الدخول</a></main>;
  if (isPublicHome) return <PublicHomeScreen />;

  return (
    <main className="sekka-register-screen" dir="rtl" lang="ar">
      <section className="sekka-register-card sekka-register-result">
        <a className="sekka-register-brand" href="/" aria-label="سِكّة - الصفحة الرئيسية"><img src="/brand/sekka-mark.png" alt="شعار سِكّة" /></a>
        <h1>الصفحة غير موجودة</h1>
        <p className="sekka-register-result-copy">الرابط الذي فتحته غير متاح.</p>
        <a className="sekka-register-submit sekka-register-link-button" href="/">العودة إلى الصفحة الرئيسية</a>
      </section>
    </main>
  );
}

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "رقم الهاتف أو كلمة المرور غير صحيحة.";
  if (message.includes("already registered") || message.includes("already been registered")) return "رقم الهاتف مسجل بالفعل. سجّل الدخول أو استخدم استعادة الحساب.";
  if (message.includes("password") && (message.includes("weak") || message.includes("short"))) return "كلمة المرور ضعيفة. استخدم كلمة مرور أطول وأكثر أمانًا.";
  if (message.includes("phone") && (message.includes("invalid") || message.includes("not supported"))) return "تعذر قبول رقم الهاتف. تأكد من الرقم وحاول مرة أخرى.";
  if (message.includes("rate limit") || message.includes("too many")) return "تم إرسال محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.";
  if (message.includes("fetch") || message.includes("network")) return "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجددًا.";
  return "تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.";
}

function toEgyptianPhone(phoneNumber: string) {
  const normalized = phoneNumber.replace(/[\s()-]/g, "");
  return normalized.startsWith("+20") ? normalized : `+20${normalized.replace(/^0/, "")}`;
}
