import { lazy, Suspense, useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import RegisterScreen, { type SignupPayload } from "./screens/RegisterScreen";
import LoginScreen from "./screens/LoginScreen";
import PublicHomeScreen from "./screens/PublicHomeScreen";
import RiderHomeScreen, { type HomeAction } from "./screens/RiderHomeScreen";
import RiderTripsScreen from "./screens/RiderTripsScreen";
import ForgotPasswordScreen from "./screens/legal/ForgotPasswordScreen";
import LegalDocumentScreen from "./screens/legal/LegalDocumentScreen";
import RiderJourneyScreen, { type RiderJourneyKey } from "./screens/RiderJourneyScreen";
import CaptainJourneyScreen, { type CaptainJourneyKey } from "./screens/CaptainJourneyScreen";
import type { AdminLiveScreenKey as AdminScreenKey, SharedLiveScreenKey as SharedScreenKey } from "./screens/AdminConsoleLiveScreen";
import { adminApi, clearAdminApiToken, setAdminApiToken, type AdminApiSession } from "./lib/admin-api";
import { clearSekkaSession, getSekkaSession, saveSekkaSession, sekkaApi, SekkaApiError, type SekkaSession, type SekkaUser } from "./lib/sekka-api";

const AdminConsoleScreen = lazy(() => import("./screens/AdminConsoleLiveScreen"));
const adminScreenKeys: AdminScreenKey[] = ["dashboard", "users", "user", "captains", "documents", "vehicles", "offers", "rider-requests", "groups", "group", "subscriptions", "payments", "payment", "disputes", "complaints", "ratings", "notifications", "commission", "settings", "reports", "audit-log", "admin-permissions", "trip-operations", "pool-overview", "finance", "pricing", "campaigns", "otp-settings", "ledger"];
const sharedScreenKeys: SharedScreenKey[] = ["notifications", "loading", "error", "empty", "offline", "confirm", "access-denied", "not-found"];

type RegistrationState = "form" | "complete";
type PublicRouteState = "checking" | "guest" | "redirecting" | "error";
let cachedSupabaseClient: SupabaseClient | null | undefined;

function makeSupabaseClient(): SupabaseClient | null {
  if (cachedSupabaseClient !== undefined) return cachedSupabaseClient;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  if (!url || !key) { cachedSupabaseClient = null; return cachedSupabaseClient; }
  try {
    cachedSupabaseClient = createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } });
    return cachedSupabaseClient;
  } catch {
    cachedSupabaseClient = null;
    return cachedSupabaseClient;
  }
}

export default function App() {
  const supabase = makeSupabaseClient();
  const [state, setState] = useState<RegistrationState>("form");
  const [authSession, setAuthSession] = useState<SekkaSession | null>(() => getSekkaSession());
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isLoginPage = path === "/login";
  const isAdminLoginPage = path === "/admin/login";
  const isRegisterPage = path === "/register";
  const isPublicHome = path === "/";
  const isRiderHome = path === "/home";
  const isCaptainHome = path === "/captain/home";
  const captainJourneyMatch = path.match(/^\/captain\/journey\/([a-z-]+)$/);
  const captainJourneyKey = captainJourneyMatch?.[1] as CaptainJourneyKey | undefined;
  const adminPathMatch = path.match(/^\/admin\/([a-z-]+)$/);
  const adminScreenKey = (path === "/admin" ? "dashboard" : adminPathMatch?.[1]) as AdminScreenKey | undefined;
  const sharedPathMatch = path.match(/^\/shared\/([a-z-]+)$/);
  const sharedScreenKey = sharedPathMatch?.[1] as SharedScreenKey | undefined;
  const isTripsPage = path === "/trips";
  const isMyTripsPage = path === "/my-trips";
  const isRequestCreatePage = path === "/requests/new";
  const journeyMatch = path.match(/^\/journey\/([a-z-]+)$/);
  const journeyKey = journeyMatch?.[1] as RiderJourneyKey | undefined;
  const isRiderTripsPage = isTripsPage || isMyTripsPage || isRequestCreatePage;
  const isForgotPasswordPage = path === "/forgot-password";
  const isResetPasswordPage = path === "/reset-password";
  const isTermsPage = path === "/terms";
  const isPrivacyPage = path === "/privacy";
  const [publicRouteState, setPublicRouteState] = useState<PublicRouteState>(() => isPublicHome ? "checking" : "guest");

  useEffect(() => {
    const onExpired = () => { setAuthSession(null); if (window.location.pathname !== "/login" && !window.location.pathname.startsWith("/admin")) window.location.replace("/login?expired=1"); };
    window.addEventListener("sekka:session-expired", onExpired);
    return () => window.removeEventListener("sekka:session-expired", onExpired);
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      const saved = getSekkaSession();
      if (!saved) { if (active) { setAuthSession(null); setSessionReady(true); } return; }
      try {
        const response = await sekkaApi<{ user: SekkaUser }>("/auth/me", { token: saved.token });
        if (active) setAuthSession({ ...saved, user: response.user });
      } catch (cause) {
        if (active) {
          if ((cause as { status?: number }).status === 401) { clearSekkaSession(); setAuthSession(null); }
          else setSessionMessage("تعذر التحقق من جلستك الآن. تحقق من اتصال الإنترنت ثم أعد المحاولة.");
        }
      } finally { if (active) setSessionReady(true); }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const protectedRider = isRiderHome || isRiderTripsPage || Boolean(journeyKey);
    const protectedCaptain = isCaptainHome || Boolean(captainJourneyKey);
    if (!protectedRider && !protectedCaptain) return;
    if (!authSession) { window.location.replace("/login"); return; }
    const correctRole = protectedRider ? "rider" : "captain";
    if (authSession.user.role !== correctRole) {
      const destinations = { rider: "/home", captain: "/captain/home", admin: "/admin" };
      window.location.replace(destinations[authSession.user.role]);
    }
  }, [sessionReady, authSession, isRiderHome, isRiderTripsPage, journeyKey, isCaptainHome, captainJourneyKey]);

  useEffect(() => {
    if (!isPublicHome) return;
    if (!sessionReady) { setPublicRouteState("checking"); return; }
    if (!authSession) { setPublicRouteState("guest"); return; }
    const destinations = { rider: "/home", captain: "/captain/home", admin: "/admin" };
    setPublicRouteState("redirecting");
    window.location.replace(destinations[authSession.user.role]);
  }, [isPublicHome, sessionReady, authSession]);

  useEffect(() => {
    const journeyTitle: Partial<Record<RiderJourneyKey, string>> = { group: "تفاصيل المجموعة", subscriptions: "اشتراكاتي", subscription: "تفاصيل الاشتراك", receipt: "إيصال سِكّة", "payment-method": "اختيار وسيلة الدفع", proof: "رفع إثبات التحويل", "captain-confirmation": "انتظار تأكيد الكابتن", "payment-code": "تأكيد كود الدفع", "payment-result": "نتيجة الدفع", renewal: "التجديد الشهري", "replacement-captain": "البحث عن كابتن بديل", conversations: "المحادثات", conversation: "تفاصيل المحادثة", notifications: "الإشعارات", ratings: "التقييمات", complaint: "تقديم شكوى", "complaint-status": "متابعة الشكوى", profile: "الملف الشخصي والإعدادات" };
    const adminTitles: Partial<Record<AdminScreenKey,string>> = { dashboard:"لوحة المؤشرات",users:"إدارة المستخدمين",user:"تفاصيل المستخدم",captains:"إدارة الكباتن",documents:"مراجعة الوثائق",vehicles:"إدارة المركبات",offers:"إدارة العروض","rider-requests":"طلبات الركاب",groups:"إدارة المجموعات",group:"تفاصيل المجموعة",subscriptions:"إدارة الاشتراكات",payments:"مراقبة عمليات الدفع",payment:"تفاصيل الدفع",disputes:"النزاعات المالية",complaints:"الشكاوى والبلاغات",ratings:"إدارة التقييمات",notifications:"إدارة الإشعارات",commission:"العمولة المستقبلية",settings:"إعدادات التشغيل",reports:"التقارير والتحليلات","audit-log":"سجل التدقيق","admin-permissions":"صلاحيات الإدارة","trip-operations":"إدارة الرحلات","pool-overview":"مؤشرات المجموعات",finance:"الملخص المالي",pricing:"إعدادات التسعير",campaigns:"الحملات","otp-settings":"إعدادات التحقق",ledger:"دفتر الحسابات" };
    const sharedTitles: Partial<Record<SharedScreenKey,string>> = { notifications:"مركز الإشعارات",loading:"حالة التحميل",error:"حالة الخطأ",empty:"حالة عدم وجود بيانات",offline:"حالة عدم الاتصال",confirm:"تأكيد إجراء حساس","access-denied":"الوصول مرفوض","not-found":"الصفحة غير موجودة" };
    document.title = isLoginPage || isAdminLoginPage ? `${isAdminLoginPage ? "دخول الإدارة" : "تسجيل الدخول"} | سِكّة` : isRegisterPage ? "إنشاء حساب جديد | سِكّة" : isForgotPasswordPage ? "استعادة الحساب | سِكّة" : isResetPasswordPage ? "تعيين كلمة مرور | سِكّة" : isTermsPage ? "الشروط والأحكام | سِكّة" : isPrivacyPage ? "سياسة الخصوصية | سِكّة" : isRiderHome ? "الرئيسية | سِكّة" : isCaptainHome || captainJourneyKey === "home" ? "الرئيسية للكابتن | سِكّة" : isTripsPage || isRequestCreatePage ? "الرحلات المتاحة | سِكّة" : isMyTripsPage ? "رحلاتي | سِكّة" : journeyKey ? `${journeyTitle[journeyKey] ?? "حسابي"} | سِكّة` : captainJourneyKey ? `الكابتن | ${captainJourneyKey} | سِكّة` : adminScreenKey ? `${adminTitles[adminScreenKey] ?? "الإدارة"} | سِكّة` : sharedScreenKey ? `${sharedTitles[sharedScreenKey] ?? "سِكّة"} | سِكّة` : isPublicHome ? "سِكّة | تنقّل منتظم" : "الصفحة غير موجودة | سِكّة";
  }, [isLoginPage, isAdminLoginPage, isRegisterPage, isForgotPasswordPage, isResetPasswordPage, isTermsPage, isPrivacyPage, isRiderHome, isCaptainHome, isTripsPage, isMyTripsPage, isRequestCreatePage, isPublicHome, journeyKey, captainJourneyKey, adminScreenKey, sharedScreenKey]);

  async function register(payload: SignupPayload) {
    setError("");
    setLoading(true);
    try {
      await sekkaApi<{ user: SekkaUser }>("/auth/register", {
        method: "POST",
        body: {
          full_name: payload.fullName,
          phone_number: toEgyptianPhone(payload.phone),
          password: payload.password,
          role: payload.role,
          accepted_terms: true,
          acknowledged_privacy: true,
          terms_version: "2026-10-24",
          privacy_version: "2026-10-24",
          policy_locale: "ar",
        },
      });
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
    setLoading(true);
    try {
      if (isAdminLoginPage) {
        const session = await adminApi<AdminApiSession>("/auth/login", {
          method: "POST",
          body: { phone_number: toEgyptianPhone(phoneNumber), password },
        });
        if (session.user?.role !== "admin" || !session.token) {
          if (session.token) {
            await adminApi("/auth/logout", { token: session.token, method: "POST" }).catch(() => undefined);
          }
          throw new Error("هذا المسار مخصص لحسابات الإدارة فقط.");
        }
        clearAdminApiToken();
        setAdminApiToken(session.token);
        window.location.replace("/admin");
        return;
      }
      const session = await sekkaApi<{ token: string; user: SekkaUser }>("/auth/login", {
        method: "POST",
        body: { phone_number: toEgyptianPhone(phoneNumber), password },
      });
      const destinations: Record<string, string> = { rider: "/home", captain: "/captain/home", admin: "/admin" };
      if (!session.token || !session.user || !destinations[session.user.role]) throw new Error("تعذر تأكيد بيانات الحساب.");
      const saved = saveSekkaSession(session);
      setAuthSession(saved);
      window.location.replace(destinations[session.user.role]);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const token = authSession?.token;
    try { if (token) await sekkaApi<unknown>("/auth/logout", { method: "POST", token }); }
    finally { clearSekkaSession(); setAuthSession(null); window.location.replace("/login"); }
  }

  async function sendRecoveryPhoneCode(phoneNumber: string) {
    const response = await sekkaApi<{ reset_url: string }>("/auth/password-reset/telegram", { method: "POST", body: { phone_number: toEgyptianPhone(phoneNumber) } });
    return response.reset_url;
  }

  async function completePhonePasswordReset(phoneNumber: string, code: string, password: string) {
    await sekkaApi("/auth/password-reset/complete", { method: "POST", body: { phone_number: toEgyptianPhone(phoneNumber), code, new_password: password } });
  }

  const needsRiderSession = isRiderHome || isRiderTripsPage || Boolean(journeyKey);
  const needsCaptainSession = isCaptainHome || Boolean(captainJourneyKey);
  if ((needsRiderSession || needsCaptainSession) && !sessionReady) return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ استعادة جلسة حسابك…</span></main>;
  if ((needsRiderSession || needsCaptainSession) && sessionMessage) return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><h1>تعذر الاتصال بحسابك</h1><p>{sessionMessage}</p><button onClick={() => window.location.reload()}>إعادة المحاولة</button></main>;
  if ((needsRiderSession || needsCaptainSession) && !authSession) return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ فتح تسجيل الدخول…</span></main>;
  if (needsRiderSession && authSession?.user.role !== "rider") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><span>جارٍ فتح الصفحة المناسبة لحسابك…</span></main>;
  if (needsCaptainSession && authSession?.user.role !== "captain") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><span>جارٍ فتح الصفحة المناسبة لحسابك…</span></main>;

  if (state === "complete") {
    return (
      <main className="sekka-register-screen" dir="rtl" lang="ar">
        <section className="sekka-register-card sekka-register-result" aria-live="polite">
          <a className="sekka-register-brand" href="/" aria-label="سِكّة"><img src="/brand/sekka-mark.png" alt="شعار سِكّة" /></a>
          <div className="sekka-register-success-mark" aria-hidden="true">✓</div>
          <h1>تم إنشاء حسابك</h1>
          <p className="sekka-register-result-copy">أصبح حسابك جاهزًا. سجّل الدخول برقم الهاتف وكلمة المرور للمتابعة.</p>
          <a className="sekka-register-submit sekka-register-link-button" href="/login">الانتقال لتسجيل الدخول <span aria-hidden="true">←</span></a>
        </section>
      </main>
    );
  }

  if (isLoginPage || isAdminLoginPage) {
    return <LoginScreen adminMode={isAdminLoginPage} onLogin={login} onCreateAccount={() => { window.location.assign("/register"); }} onForgotPassword={() => { window.location.assign("/forgot-password"); }} loading={loading} error={error} success={loginSuccess} />;
  }

  if (isRegisterPage) {
    const initialRole = new URLSearchParams(window.location.search).get("role") === "captain" ? "captain" : "rider";
    return <RegisterScreen initialRole={initialRole} onRegister={register} onLogin={() => { window.location.assign("/login"); }} onTerms={() => { window.location.assign("/terms"); }} onPrivacy={() => { window.location.assign("/privacy"); }} loading={loading} error={error} />;
  }

  if (isForgotPasswordPage) return <ForgotPasswordScreen onBack={() => { window.location.assign("/login"); }} onSendPhoneCode={sendRecoveryPhoneCode} onCompletePhoneReset={completePhonePasswordReset} />;
  if (isResetPasswordPage) { window.location.replace("/forgot-password"); return null; }
  if (isTermsPage || isPrivacyPage) return <LegalDocumentScreen kind={isTermsPage ? "terms" : "privacy"} onBack={() => { if (window.history.length > 1) window.history.back(); else window.location.assign("/register"); }} />;

  if (isRiderHome) {
    const routes: Record<HomeAction, string> = {
      home: "/home",
      explore: "/trips",
      myTrips: "/my-trips",
      conversations: "/journey/conversations",
      mySubscriptions: "/journey/subscriptions",
      myRequests: "/my-trips",
      newTrip: "/requests/new",
      support: "/journey/complaint",
      profile: "/journey/profile",
      notifications: "/journey/notifications",
      allTrips: "/my-trips",
      featuredTrips: "/trips",
      recentTrip: "/my-trips",
    };
    return <RiderHomeScreen supabase={supabase} user={authSession?.user ?? null} onLogout={logout} onAction={(action) => window.location.assign(routes[action])} />;
  }

  if (isCaptainHome) return <CaptainJourneyScreen supabase={supabase} screen="home" onNavigate={(target) => window.location.assign(target)} />;
  if (captainJourneyKey) return <CaptainJourneyScreen supabase={supabase} screen={captainJourneyKey} onNavigate={(target) => window.location.assign(target)} />;
  if (adminScreenKey && adminScreenKeys.includes(adminScreenKey)) return <Suspense fallback={<main className="sekka-public-route-state" dir="rtl">جارٍ فتح لوحة الإدارة…</main>}><AdminConsoleScreen supabase={supabase} screen={adminScreenKey} onNavigate={(target) => window.location.assign(target)} /></Suspense>;
  if (sharedScreenKey && sharedScreenKeys.includes(sharedScreenKey)) return <Suspense fallback={<main className="sekka-public-route-state" dir="rtl">جارٍ تحميل الصفحة…</main>}><AdminConsoleScreen supabase={supabase} screen={sharedScreenKey} shared onNavigate={(target) => window.location.assign(target)} /></Suspense>;

  if (isRiderTripsPage) return <RiderTripsScreen supabase={supabase} mode={isMyTripsPage ? "mine" : isRequestCreatePage ? "daily" : "available"} onHome={() => window.location.assign("/home")} />;
  if (journeyKey) return <RiderJourneyScreen supabase={supabase} screen={journeyKey} onNavigate={(target) => window.location.assign(target)} />;

  if (isPublicHome && publicRouteState === "checking") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ التحقق من حسابك…</span></main>;
  if (isPublicHome && publicRouteState === "redirecting") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><span>جارٍ فتح صفحتك الرئيسية…</span></main>;
  if (isPublicHome && publicRouteState === "error") return <main className="sekka-public-route-state" dir="rtl" lang="ar"><img src="/brand/sekka-mark.png" alt="سِكّة"/><h1>تعذر فتح الصفحة الرئيسية لحسابك</h1><p>تعذر التحقق من جلسة الدخول أو أن دور الحساب غير محدد. سجّل الدخول مجددًا أو تواصل مع الدعم.</p><a href="/login">الانتقال لتسجيل الدخول</a></main>;
  if (isPublicHome) return <PublicHomeScreen />;

  return <AdminConsoleScreen supabase={supabase} screen="not-found" shared onNavigate={(target) => window.location.assign(target)} />;
}

function authErrorMessage(error: unknown): string {
  if (error instanceof SekkaApiError) return error.message;
  const rawMessage = error instanceof Error ? error.message : "";
  if (rawMessage.includes("مخصص لحسابات الإدارة")) return rawMessage;
  if (rawMessage.includes("رقم الهاتف أو كلمة السر غلط")) return "رقم الهاتف أو كلمة المرور غير صحيحة.";
  if (rawMessage.includes("محاولات كتير")) return "تم إرسال محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.";
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
