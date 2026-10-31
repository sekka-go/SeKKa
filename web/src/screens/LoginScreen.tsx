import { useState, type FormEvent } from "react";
import { Button, InlineAlert, TextField } from "../design-system/components";
import "./register-screen.css";

type LoginScreenProps = {
  onLogin: (phone: string, password: string) => Promise<void>;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  loading?: boolean;
  error?: string;
  success?: string;
  adminMode?: boolean;
};

export default function LoginScreen({ onLogin, onCreateAccount, onForgotPassword, loading = false, error = "", success = "", adminMode = false }: LoginScreenProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
      setFormError("اكتب رقم موبايل مصري من 11 رقم.");
      return;
    }
    if (!password) {
      setFormError("اكتب كلمة السر عشان تكمّل.");
      return;
    }
    try {
      await onLogin(normalizedPhone, password);
    } catch {
      setFormError("الدخول ما تمّش. راجع رقم الموبايل وكلمة السر وجرّب تاني.");
    }
  }

  return (
    <main className="sekka-register-screen" dir="rtl" lang="ar">
      <div className="sekka-register-screen__accent" aria-hidden="true" />
      <section className="sekka-register-card sekka-login-card" aria-labelledby="sekka-login-title">
        <a className="sekka-register-brand" href="/" aria-label="سِكّة - الصفحة الرئيسية">
          <img src="/brand/sekka-mark.svg" alt="شعار سِكّة" />
        </a>
        <header className="sekka-register-intro">
          <p className="sekka-register-eyebrow">{adminMode ? "دخول الإدارة" : "أهلًا برجوعك"}</p>
          <h1 id="sekka-login-title">{adminMode ? "دخول الإدارة" : "سجّل دخول"}</h1>
          <p>{adminMode ? "الدخول هنا لحسابات الإدارة بس." : "سجّل دخول وكمّل من آخر مرة."}</p>
        </header>

        <form className="sekka-register-form" onSubmit={submit} noValidate>
          <TextField label="رقم الموبايل" type="tel" name="phone" inputMode="tel" autoComplete="tel-national" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" required />
          <TextField label="كلمة السر" name="password" type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="اكتب كلمة السر" required trailing={<><button type="button" className="sekka-register-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "اخفي كلمة السر" : "اظهر كلمة السر"} aria-pressed={visible} /><PasswordIcon visible={visible} /></>} />

          <button className="auth-forgot-link" type="button" onClick={onForgotPassword}>نسيت كلمة السر؟</button>

          {(formError || error) && <InlineAlert>{formError || error}</InlineAlert>}
          {success && <InlineAlert tone="success">{success}</InlineAlert>}
          <Button type="submit" loading={loading} loadingLabel="بنسجّل دخولك…">دخول <span aria-hidden="true">←</span></Button>
        </form>

        {!adminMode && <p className="sekka-register-login">لسه معندكش حساب؟ <button type="button" onClick={onCreateAccount}>اعمل حساب</button></p>}
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
