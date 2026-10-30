import { useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import RegisterScreen, { type SignupPayload } from "./screens/RegisterScreen";

type RegistrationState = "form" | "verify" | "complete";

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

  return <RegisterScreen onRegister={register} onLogin={() => { window.location.assign("/login"); }} loading={loading} error={error} />;
}

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already registered") || message.includes("already been registered")) return "رقم الهاتف مسجل بالفعل. سجّل الدخول أو استخدم استعادة الحساب.";
  if (message.includes("password") && (message.includes("weak") || message.includes("short"))) return "كلمة المرور ضعيفة. استخدم كلمة مرور أطول وأكثر أمانًا.";
  if (message.includes("phone") && (message.includes("invalid") || message.includes("not supported"))) return "تعذر قبول رقم الهاتف. تأكد من الرقم وحاول مرة أخرى.";
  if (message.includes("rate limit") || message.includes("too many")) return "تم إرسال محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.";
  if (message.includes("fetch") || message.includes("network")) return "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مجددًا.";
  return "تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.";
}
