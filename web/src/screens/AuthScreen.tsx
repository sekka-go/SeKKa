import { useState, type FormEvent } from "react";
import BrandLogo from "../components/BrandLogo";
import { errorText } from "../lib/formatters";
import { api, type User } from "../api";
import type { Session, Toast } from "../types";
export default function AuthScreen({ onSignedIn, notify }: { onSignedIn: (session: Session) => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
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

  return <main className="auth-layout">
    <section className="auth-story">
      <BrandLogo variant="light" />
      <div className="auth-story-copy"><span className="eyebrow">معاك في السكة</span><h1>لو نفس السِكّة…<br /><em>سيبها على سِكّة.</em></h1><p>شارك الطريق مع ناس رايحة في نفس اتجاهك. خطط لأيامك، اختار مقعدك، وسيبها على سِكّة.</p>
        <div className="story-stats"><div><strong>4</strong><span>فئات تناسبك</span></div><i /><div><strong>5</strong><span>أيام خدمة أسبوعيًا</span></div></div>
      </div>
      <div className="story-route"><span className="route-point route-point-start" /><span className="route-dashes" /><span className="route-point route-point-end" /><span>القاهرة والجيزة</span></div>
      <div className="story-footer">© سِكّة للتنقل المشترك</div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>تسجيل الدخول</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>حساب جديد</button></div>
        <div className="auth-heading"><span className="eyebrow">{mode === "login" ? "سعيدين برجوعك" : "ابدأ رحلتك"}</span><h2>{mode === "login" ? "أهلًا بيك تاني" : "انضم لسِكّة"}</h2><p>{mode === "login" ? "سجّل دخولك وكمّل من حيث توقفت." : "اختار نوع حسابك وأنشئ حسابك في دقيقة."}</p></div>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && <>
            <label>الاسم بالكامل<input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: ياسمين أحمد" required /></label>
            <fieldset className="role-picker"><legend>هتستخدم سِكّة بصفتك؟</legend><button type="button" className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><span>♙</span><strong>راكب</strong><small>أدور على مشوار مشترك</small></button><button type="button" className={role === "captain" ? "selected" : ""} onClick={() => setRole("captain")}><span>⌖</span><strong>كابتن</strong><small>أوصل الركاب لوجهتهم</small></button></fieldset>
          </>}
          <label>رقم الهاتف<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          <label>كلمة السر<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "8 أحرف على الأقل" : "••••••••"} minLength={mode === "register" ? 8 : 1} required /></label>
          {error && <div className="inline-error">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "لحظة واحدة…" : mode === "login" ? "دخول إلى حسابي" : "إنشاء الحساب"}<span>←</span></button>
        </form>
        <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
      </div>
      <span className="auth-panel-note">آمن · بسيط · على الطريق</span>
    </section>
  </main>;
}
