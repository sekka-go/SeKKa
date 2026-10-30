import { useState, type FormEvent } from "react";
import "./register-screen.css";

type LoginScreenProps = {
  onLogin: (phone: string, password: string) => Promise<void>;
  onCreateAccount: () => void;
  loading?: boolean;
  error?: string;
  success?: string;
};

export default function LoginScreen({ onLogin, onCreateAccount, loading = false, error = "", success = "" }: LoginScreenProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
      setFormError("من فضلك أدخل رقم هاتف مصري صحيحًا.");
      return;
    }
    if (!password) {
      setFormError("أدخل كلمة المرور للمتابعة.");
      return;
    }
    try {
      await onLogin(normalizedPhone, password);
    } catch {
      setFormError("تعذر تسجيل الدخول. تحقق من رقم الهاتف وكلمة المرور وحاول مجددًا.");
    }
  }

  return (
    <main className="sekka-register-screen" dir="rtl" lang="ar">
      <div className="sekka-register-screen__accent" aria-hidden="true" />
      <section className="sekka-register-card sekka-login-card" aria-labelledby="sekka-login-title">
        <a className="sekka-register-brand" href="/" aria-label="سِكّة - إنشاء حساب">
          <img src="/brand/sekka-mark.png" alt="شعار سِكّة" />
        </a>
        <header className="sekka-register-intro">
          <p className="sekka-register-eyebrow">مرحبًا بعودتك</p>
          <h1 id="sekka-login-title">تسجيل الدخول</h1>
          <p>سجّل دخولك وكمّل من حيث توقفت</p>
        </header>

        <form className="sekka-register-form" onSubmit={submit} noValidate>
          <label className="sekka-register-field">
            <span>رقم الهاتف</span>
            <input type="tel" name="phone" inputMode="tel" autoComplete="tel-national" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" required />
          </label>
          <label className="sekka-register-field">
            <span>كلمة المرور</span>
            <input type={visible ? "text" : "password"} name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" required />
            <button type="button" className="sekka-register-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={visible} />
            <PasswordIcon visible={visible} />
          </label>

          {(formError || error) && <p className="sekka-register-error" role="alert">{formError || error}</p>}
          {success && <p className="sekka-login-success" role="status">{success}</p>}
          <button className="sekka-register-submit" type="submit" disabled={loading}>
            {loading ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
            {!loading && <span aria-hidden="true">←</span>}
          </button>
        </form>

        <p className="sekka-register-login">ليس لديك حساب؟ <button type="button" onClick={onCreateAccount}>سجّل الآن</button></p>
      </section>
    </main>
  );
}

function PasswordIcon({ visible }: { visible: boolean }) {
  return (
    <svg className="sekka-register-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
      {visible ? <><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" /></> : <><path d="m3 3 18 18M10.6 6.2A10.9 10.9 0 0 1 12 6c6.3 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.6M6.2 6.3C3.8 8 2.5 12 2.5 12s3.2 6 9.5 6c1.3 0 2.5-.3 3.5-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>}
    </svg>
  );
}
