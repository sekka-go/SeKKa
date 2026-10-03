import { useState, type FormEvent } from "react";
import BrandLogo from "../components/BrandLogo";
import { errorText } from "../lib/formatters";
import { api, type User } from "../api";
import type { Session, Toast } from "../types";

export default function AuthScreen({ onSignedIn, notify }: { onSignedIn: (session: Session) => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [mode, setMode] = useState<"login" | "register">(() => window.location.pathname === "/register" ? "register" : "login");
  const [role, setRole] = useState<"rider" | "captain">("rider");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") {
        await api("/auth/register", { method: "POST", body: { full_name: fullName.trim(), phone_number: phone.trim(), password, role } });
      }
      const result = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { phone_number: phone.trim(), password } });
      onSignedIn({ token: result.token, user: result.user });
      notify(mode === "register" ? "أهلًا بك في سِكّة. حسابك جاهز." : "تم تسجيل الدخول.", "success");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <header className="auth-page-header">
      <a href="/" aria-label="سِكّة، الرئيسية"><BrandLogo /></a>
    </header>
    <section className="auth-page-content">
      <div className="auth-card auth-page-card">
        <div className="auth-tabs">
          <span className="active" aria-current="page">{mode === "login" ? "تسجيل الدخول" : "حساب جديد"}</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">{mode === "login" ? "سعيدين برجوعك" : "ابدأ رحلتك"}</span>
          <h1>{mode === "login" ? "أهلًا بيك تاني" : "انضم لسِكّة"}</h1>
          <p>{mode === "login" ? "سجّل دخولك وكمّل من حيث توقفت." : "أنشئ حسابك وابدأ ترتّب مشاويرك."}</p>
        </div>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && <>
            <label>الاسم بالكامل<input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: ياسمين أحمد" required /></label>
            <fieldset className="role-picker"><legend>هتستخدم سِكّة بصفتك؟</legend><button type="button" className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><span>♙</span><strong>راكب</strong><small>أدور على مشوار مشترك</small></button><button type="button" className={role === "captain" ? "selected" : ""} onClick={() => setRole("captain")}><span>⌖</span><strong>كابتن</strong><small>أوصل الركاب لوجهتهم</small></button></fieldset>
          </>}
          <label>رقم الهاتف<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          <label>كلمة السر<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "8 أحرف على الأقل" : "••••••••"} minLength={mode === "register" ? 8 : 1} required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "لحظة واحدة…" : mode === "login" ? "دخول إلى حسابي" : "إنشاء الحساب"}<span aria-hidden="true">←</span></button>
        </form>
        <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
        {mode === "login"
          ? <p className="auth-switch">لسه جديد في سِكّة؟ <a href="/register">أنشئ حسابك</a></p>
          : <p className="auth-switch">عندك حساب بالفعل؟ <a href="/login">سجّل الدخول</a></p>}
      </div>
    </section>
  </main>;
}
