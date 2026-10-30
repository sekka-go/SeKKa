import { useState, type FormEvent } from "react";
import { Button, InlineAlert, TextField } from "../design-system/components";
import "./register-screen.css";

export type SignupRole = "rider" | "captain";

export type SignupPayload = {
  fullName: string;
  phone: string;
  password: string;
  role: SignupRole;
};

type RegisterScreenProps = {
  onRegister: (payload: SignupPayload) => void | Promise<void>;
  onLogin: () => void;
  onGoogleRegister?: () => void | Promise<void>;
  onTerms?: () => void;
  onPrivacy?: () => void;
  initialRole?: SignupRole;
  loading?: boolean;
  error?: string;
};

export default function RegisterScreen({
  onRegister,
  onLogin,
  onGoogleRegister,
  onTerms,
  onPrivacy,
  initialRole = "rider",
  loading = false,
  error: externalError = "",
}: RegisterScreenProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [localError, setLocalError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLocalError("");

    const normalizedPhone = phone.replace(/[\s()-]/g, "");
    if (fullName.trim().length < 3) {
      setLocalError("من فضلك أدخل اسمك بالكامل.");
      return;
    }
    if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
      setLocalError("من فضلك أدخل رقم هاتف مصري صحيحًا.");
      return;
    }
    if (password.length < 8) {
      setLocalError("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (!accepted) {
      setLocalError("يجب الموافقة على الشروط والأحكام وسياسة الخصوصية.");
      return;
    }

    try {
      await onRegister({
        fullName: fullName.trim(),
        phone: normalizedPhone,
        password,
        role,
      });
    } catch {
      setLocalError("تعذر إنشاء الحساب الآن. حاول مرة أخرى بعد قليل.");
    }
  }

  const error = localError || externalError;

  async function registerWithGoogle() {
    if (!onGoogleRegister || loading) return;
    setLocalError("");
    try {
      await onGoogleRegister();
    } catch {
      setLocalError("تعذر التسجيل باستخدام Google الآن. حاول مرة أخرى لاحقًا.");
    }
  }

  return (
    <main className="sekka-register-screen" dir="rtl" lang="ar">
      <div className="sekka-register-screen__accent" aria-hidden="true" />

      <section className="sekka-register-card" aria-labelledby="sekka-register-title">
        <a className="sekka-register-brand" href="/" aria-label="سِكّة - الصفحة الرئيسية">
          <img src="/brand/sekka-mark.png" alt="شعار سِكّة" />
        </a>

        <header className="sekka-register-intro">
          <p className="sekka-register-eyebrow">أهلًا بك في سِكّة</p>
          <h1 id="sekka-register-title">{role === "captain" ? "أنشئ حساب كابتن" : "أنشئ حسابك"}</h1>
          <p>{role === "captain" ? "انضم إلى الكباتن وانشر رحلاتك" : "ابدأ رحلتك بسهولة وسرعة"}</p>
        </header>

        <form className="sekka-register-form" onSubmit={submit} noValidate>
          <TextField label="الاسم بالكامل" name="full_name" type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="اكتب اسمك كما يظهر في بطاقتك" required />
          <TextField label="رقم الهاتف" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" required />
          <TextField label="كلمة المرور" name="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف على الأقل" minLength={8} required trailing={<PasswordToggle visible={showPassword} label="كلمة المرور" onToggle={() => setShowPassword((visible) => !visible)} />} />
          <TextField label="تأكيد كلمة المرور" name="confirm-password" type={showConfirm ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="أعد كتابة كلمة المرور" minLength={8} required trailing={<PasswordToggle visible={showConfirm} label="تأكيد كلمة المرور" onToggle={() => setShowConfirm((visible) => !visible)} />} />

          <div className="sekka-register-consent">
            <label>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>أوافق على الشروط والأحكام وسياسة الخصوصية</span>
            </label>
            <span className="sekka-register-consent-links">
              <button type="button" onClick={onTerms} disabled={!onTerms}>الشروط والأحكام</button>
              <button type="button" onClick={onPrivacy} disabled={!onPrivacy}>سياسة الخصوصية</button>
            </span>
          </div>

          {error && <InlineAlert>{error}</InlineAlert>}

          <Button type="submit" loading={loading} loadingLabel="جارٍ إنشاء الحساب…">إنشاء حساب جديد <span aria-hidden="true">←</span></Button>
        </form>

        <div className="sekka-register-role-switch">
          <div className="sekka-register-divider"><span>أو</span></div>
          <button type="button" onClick={() => { setRole(role === "rider" ? "captain" : "rider"); setLocalError(""); }} disabled={loading}>
            <CarIcon />
            {role === "rider" ? "التسجيل ككابتن" : "التسجيل كراكب"}
          </button>
        </div>

        {onGoogleRegister && (
          <>
            <div className="sekka-register-divider"><span>أو</span></div>
            <button className="sekka-register-google" type="button" onClick={registerWithGoogle} disabled={loading}>
              <GoogleIcon /> التسجيل باستخدام Google
            </button>
          </>
        )}

        <p className="sekka-register-login">
          لديك حساب بالفعل؟ <button type="button" onClick={onLogin}>تسجيل الدخول</button>
        </p>
      </section>
    </main>
  );
}

function CarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.4-4.2A2.7 2.7 0 0 1 9 5h6a2.7 2.7 0 0 1 2.6 1.8L19 11l1.5 1.2c.3.2.5.6.5 1v4.3c0 .8-.7 1.5-1.5 1.5H18v-2H6v2H4.5c-.8 0-1.5-.7-1.5-1.5v-4.3c0-.4.2-.8.5-1L5 11Zm2.1-.5h9.8l-1.1-3.3a.9.9 0 0 0-.9-.6H9.1a.9.9 0 0 0-.9.6l-1.1 3.3ZM7 14a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 7 14Zm10 0a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 17 14Z" fill="currentColor" /></svg>;
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg className="sekka-register-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
      {visible ? (
        <>
          <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.7" />
        </>
      ) : (
        <>
          <path d="m3 3 18 18M10.6 6.2A10.9 10.9 0 0 1 12 6c6.3 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.6M6.2 6.3C3.8 8 2.5 12 2.5 12s3.2 6 9.5 6c1.3 0 2.5-.3 3.5-.7" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
    </svg>
  );
}

function PasswordToggle({ visible, label, onToggle }: { visible: boolean; label: string; onToggle: () => void }) {
  return <><button type="button" className="sekka-register-toggle" onClick={onToggle} aria-label={`${visible ? "إخفاء" : "إظهار"} ${label}`} aria-pressed={visible} /><PasswordVisibilityIcon visible={visible} /></>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;
}
