import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./onboarding.css";
export type Appearance = "dark" | "light";
export function readAppearance(): Appearance {
  const value = new URLSearchParams(location.search).get("theme");
  if (value === "dark" || value === "light") return value;
  try {
    return localStorage.getItem("sekka.appearance") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
type Crop = [number, number, number, number];
// Original paired references are preserved. CSS windows show ONLY illustration/logo regions.
function ReferenceArt({
  source,
  crop,
  theme,
  className = "",
  label,
}: {
  source: number;
  crop: Crop;
  theme: Appearance;
  className?: string;
  label?: string;
}) {
  const [x, y, w, h] = crop;
  const style: CSSProperties = {
    aspectRatio: `${w}/${h}`,
    "--source-width": `${(1536 / w) * 100}%`,
    "--source-left": `${(-(x + (theme === "light" ? 768 : 0)) / w) * 100}%`,
    "--source-top": `${(-y / h) * 100}%`,
  } as CSSProperties;
  return (
    <span
      className={`reference-art ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img
        src={`/references/phase-1/${String(source).padStart(2, "0")}.png`}
        alt=""
        draggable={false}
      />
    </span>
  );
}
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`phase-wordmark ${className}`} role="img" aria-label="سِكّة">
      <ReferenceArt
        source={1}
        crop={[185, 280, 445, 225]}
        theme="dark"
        className="wordmark-dark"
      />
      <ReferenceArt
        source={1}
        crop={[185, 280, 445, 225]}
        theme="light"
        className="wordmark-light"
      />
    </span>
  );
}
function SvgIcon({ name }: { name: string }) {
  const p = {
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "person")
    return (
      <svg {...p}>
        <circle cx="16" cy="9" r="5" />
        <path d="M5 29v-4c0-6 4-9 11-9s11 3 11 9v4" />
      </svg>
    );
  if (name === "phone")
    return (
      <svg {...p}>
        <rect x="8" y="2" width="16" height="28" rx="3" />
        <path d="M15 26h2" />
      </svg>
    );
  if (name === "lock")
    return (
      <svg {...p}>
        <rect x="5" y="14" width="22" height="16" rx="3" />
        <path d="M9 14V8a7 7 0 0 1 14 0v6m-7 6v4" />
      </svg>
    );
  if (name === "eye")
    return (
      <svg {...p}>
        <path d="M3 3 29 29M13 7c8-2 15 9 15 9a33 33 0 0 1-6 6M9 9a34 34 0 0 0-6 7s6 11 15 9m-5-12a4 4 0 0 0 6 6" />
      </svg>
    );
  if (name === "clock")
    return (
      <svg {...p}>
        <circle cx="16" cy="16" r="13" />
        <path d="M16 7v10l6 3" />
      </svg>
    );
  if (name === "shield")
    return (
      <svg {...p}>
        <path d="M16 2 28 7v9c0 7-7 12-12 15C11 28 4 23 4 16V7zM10 15l4 4 8-9" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...p}>
        <rect x="4" y="6" width="24" height="24" rx="3" />
        <path d="M10 2v9m12-9v9M4 14h24m-18 6h2m7 0h2m-11 5h2m7 0h2" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="2" y="5" width="28" height="21" rx="5" />
      <path d="M11 5v14m10-14v14M2 19h28" />
      <circle cx="9" cy="27" r="3" />
      <circle cx="24" cy="27" r="3" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg viewBox="0 0 32 26" aria-hidden="true">
      <path
        d="M2 13h26M17 2l11 11-11 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const names = [
  "البداية",
  "الترحيب",
  "نوع الحساب",
  "رقم الموبايل",
  "كود التحقق",
  "نجاح التحقق",
  "إنشاء حساب",
];
const held = "الربط معلّق حسب طلبك. المعاينة لا ترسل رسائل ولا تنشئ حسابات.";
export default function Onboarding({
  screen,
  theme,
  onTheme,
  go,
  role,
  onRole,
}: {
  screen: number;
  theme: Appearance;
  onTheme: (t: Appearance) => void;
  go: (id: number) => void;
  role: string;
  onRole: (r: string) => void;
  children?: ReactNode;
}) {
  const id = screen === 37 ? 2 : screen;
  const [phone, setPhone] = useState(""),
    [fullName, setFullName] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [digits, setDigits] = useState(["", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const frozen = new URLSearchParams(location.search).get("inspect") === "1";
  useEffect(() => {
    if (id !== 1 || frozen) return;
    const t = window.setTimeout(() => go(2), 2600);
    return () => window.clearTimeout(t);
  }, [id, go, frozen]);
  function otpChange(index: number, value: string) {
    const numbers = value
      .replace(/[^0-9٠-٩]/g, "")
      .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
    if (numbers.length > 1) {
      const next = [...digits];
      for (let i = 0; i < Math.min(numbers.length, 4 - index); i++)
        next[index + i] = numbers[i];
      setDigits(next);
      otpRefs.current[Math.min(3, index + numbers.length)]?.focus();
    } else {
      setDigits(digits.map((d, i) => (i === index ? numbers : d)));
      if (numbers && index < 3) otpRefs.current[index + 1]?.focus();
    }
  }
  const back = () => go(id === 6 ? 5 : id === 7 ? 6 : Math.max(1, id - 1));
  const heading = {
    1: "معاك في السِكّة",
    2: "معاك في السِكّة",
    3: "اختر نوع حسابك",
    4: "أدخل رقم موبايلك",
    5: "أدخل كود التحقق",
    6: "تم التحقق بنجاح!",
    7: "إنشاء حساب جديد",
  }[id];
  return (
    <div className={`phase-one-stage ${theme}`}>
      <nav className="phase-review-bar" aria-label="معاينة المرحلة الأولى">
        <div className="review-screen-nav">
          <button
            onClick={() => go(Math.max(1, id - 1))}
            disabled={id === 1}
            aria-label="الشاشة السابقة"
          >
            ‹
          </button>
          <label>
            <span className="sr-only">الشاشة</span>
            <select value={id} onChange={(e) => go(Number(e.target.value))}>
              {names.map((name, i) => (
                <option value={i + 1} key={name}>
                  {String(i + 1).padStart(2, "0")} · {name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => go(Math.min(7, id + 1))}
            disabled={id === 7}
            aria-label="الشاشة التالية"
          >
            ›
          </button>
        </div>
        <div className="review-themes">
          <button
            aria-pressed={theme === "dark"}
            onClick={() => onTheme("dark")}
          >
            دارك
          </button>
          <button
            aria-pressed={theme === "light"}
            onClick={() => onTheme("light")}
          >
            لايت
          </button>
        </div>
      </nav>
      <p className="phase-preview-note" id="phase-preview-note">
        {id === 6
          ? "معاينة شكل شاشة النجاح فقط — لم يتم التحقق من أي رقم."
          : id >= 4
            ? "معاينة التصميم — إرسال الرسائل وإنشاء الحسابات غير مفعّلين."
            : "معاينة المرحلة الأولى · 7 شاشات"}
      </p>
      <main
        className={`phase-canvas phase-screen-${id}`}
        aria-label={`المرحلة الأولى — ${names[id - 1]}`}
      >
        {id !== 1 && (
          <>
            <div className="phase-top-wave" aria-hidden="true" />
            <div className="phase-logo">
              <Wordmark />
            </div>
            {id !== 2 && (
              <button className="phase-back" onClick={back} aria-label="رجوع">
                <svg viewBox="0 0 20 30" aria-hidden="true">
                  <path
                    d="m16 3-12 12 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </>
        )}
        {id === 1 ? (
          <>
            <button
              className="phase-splash-brand"
              onClick={() => go(2)}
              aria-label="ابدأ مع سِكّة"
            >
              <Wordmark />
              <h1>{heading}</h1>
            </button>
            <ReferenceArt
              source={1}
              theme={theme}
              crop={[0, 604, 768, 420]}
              className="phase-splash-road"
            />
          </>
        ) : id === 2 ? (
          <>
            <h1 className="phase-title">
              {heading}
              <span className="phase-rays" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </h1>
            <p className="phase-subtitle">
              أسهل طريقة لحجز مشوارك اليومي
              <br />
              والاشتراك في خطوط موثوقة
            </p>
            <ReferenceArt
              source={2}
              theme={theme}
              crop={[54, 310, 662, 326]}
              className="phase-welcome-art"
              label="راكب مستعد لمشواره اليومي بجوار خط سِكّة"
            />
            <div className="phase-benefits">
              {[
                ["bus", "خطوط متنوعة"],
                ["calendar", "اشتراكات مرنة"],
                ["shield", "موثوق وآمن"],
              ].map(([icon, text]) => (
                <div key={icon}>
                  <span>
                    <SvgIcon name={icon} />
                  </span>
                  <strong>{text}</strong>
                </div>
              ))}
            </div>
            <button className="phase-primary phase-start" onClick={() => go(3)}>
              ابدأ الآن <Arrow />
            </button>
            <p className="phase-login">
              لديك حساب بالفعل؟{" "}
              <button disabled title={held}>
                سجل الدخول
              </button>
            </p>
            <div className="phase-dots" aria-label="صفحة الترحيب الأولى">
              <i />
              <i />
              <i />
            </div>
          </>
        ) : id === 3 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">قولنا هتستخدم سكة كراكب ولا كابتن؟</p>
            <div
              className="phase-roles"
              role="radiogroup"
              aria-label="نوع الحساب"
            >
              {[
                {
                  value: "rider",
                  title: "راكب",
                  description: (
                    <>
                      احجز مكانك في خطوط
                      <br />
                      مواصلات ثابتة واشترك
                      <br />
                      أسبوعي أو شهري.
                    </>
                  ),
                  crop: [445, 337, 277, 217] as Crop,
                },
                {
                  value: "captain",
                  title: "كابتن",
                  description: (
                    <>
                      سجل ككابتن، أضف عربيتك
                      <br />
                      وخطوطك، واستقبل
                      <br />
                      مشتركين جدد.
                    </>
                  ),
                  crop: [395, 593, 329, 220] as Crop,
                },
              ].map((r) => (
                <button
                  key={r.value}
                  className={`phase-role-card ${role === r.value ? "selected" : ""}`}
                  role="radio"
                  aria-checked={role === r.value}
                  onClick={() => onRole(r.value)}
                >
                  <ReferenceArt
                    source={3}
                    crop={r.crop}
                    theme={theme}
                    className="phase-role-art"
                  />
                  <span className="phase-role-copy">
                    <strong>{r.title}</strong>
                    <span>{r.description}</span>
                  </span>
                  <span className="phase-radio" />
                </button>
              ))}
            </div>
            <button
              className="phase-primary phase-role-next"
              onClick={() => go(4)}
            >
              متابعة <Arrow />
            </button>
          </>
        ) : id === 4 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              هنبعتلك كود التحقق في رسالة قصيرة (SMS)
            </p>
            <ReferenceArt
              source={4}
              crop={[202, 331, 362, 243]}
              theme={theme}
              className="phase-phone-art"
              label="رسم موبايل ورسالة كود تحقق"
            />
            <label className="phase-phone-input">
              <span className="sr-only">رقم الموبايل</span>
              <span
                className="phase-country"
                aria-label="مصر، كود الدولة زائد 20"
              >
                <b>+20</b>
                <span aria-hidden="true">🇪🇬</span>
                <span className="country-chevron" aria-hidden="true">
                  ⌄
                </span>
              </span>
              <input
                type="tel"
                aria-label="رقم الموبايل"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="010 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby="phase-preview-note"
              />
            </label>
            <button className="phase-primary phase-send" disabled title={held}>
              إرسال كود التحقق <Arrow />
            </button>
          </>
        ) : id === 5 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              تم إرسال كود من 4 أرقام إلى رقمك
              <br />
              <strong dir="ltr">{phone || "010 1234 5678"}</strong>
            </p>
            <ReferenceArt
              source={5}
              crop={[207, 335, 354, 220]}
              theme={theme}
              className="phase-otp-art"
              label="رسم موبايل ورسالة كود تحقق"
            />
            <div
              className="phase-otp-inputs"
              dir="ltr"
              role="group"
              aria-label="كود التحقق — معاينة"
            >
              <div className="sr-only" id="otp-hint">
                معاينة أربع خانات فقط؛ طول الكود الفعلي يتحدد عند ربط مزوّد
                التحقق.
              </div>
              {digits.map((value, i) => (
                <input
                  key={i}
                  ref={(node) => {
                    otpRefs.current[i] = node;
                  }}
                  aria-label={`الرقم ${i + 1} من كود التحقق`}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  placeholder="_"
                  value={value}
                  onChange={(e) => otpChange(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !value && i > 0)
                      otpRefs.current[i - 1]?.focus();
                  }}
                  aria-describedby="otp-hint phase-preview-note"
                />
              ))}
            </div>
            <div className="phase-resend">
              <span>
                <SvgIcon name="clock" />
                00:59
              </span>
              <button disabled title={held}>
                أعد إرسال الكود
              </button>
            </div>
            <button
              className="phase-primary phase-verify"
              disabled
              title={held}
            >
              تحقق <Arrow />
            </button>
          </>
        ) : id === 6 ? (
          <>
            <ReferenceArt
              source={6}
              crop={[167, 192, 453, 306]}
              theme={theme}
              className="phase-success-art"
              label="رسم توضيحي لعلامة تحقق ناجحة — معاينة فقط"
            />
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              تم تأكيد رقم موبايلك،
              <br />
              يمكنك الآن متابعة إنشاء حسابك.
            </p>
            <button
              className="phase-primary phase-success-next"
              onClick={() => go(7)}
            >
              متابعة <Arrow />
            </button>
          </>
        ) : (
          <>
            <h1 className="phase-title">
              {heading}
              <span className="phase-rays" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </h1>
            <p className="phase-subtitle">أنشئ حسابك في سكة في خطوات بسيطة</p>
            <div className="phase-register-fields">
              <label className="phase-register-field">
                <SvgIcon name="person" />
                <span className="sr-only">الاسم الكامل</span>
                <input
                  aria-label="الاسم الكامل"
                  autoComplete="name"
                  placeholder="الاسم الكامل"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="phase-register-field">
                <SvgIcon name="phone" />
                <span className="sr-only">رقم الموبايل</span>
                <input
                  type="tel"
                aria-label="رقم الموبايل"
                  autoComplete="tel-national"
                  inputMode="tel"
                  placeholder="رقم الموبايل"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="phase-register-field">
                <SvgIcon name="lock" />
                <span className="sr-only">كلمة المرور</span>
                <input
                  aria-label="كلمة المرور"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="phase-show-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  <SvgIcon name="eye" />
                </button>
              </label>
            </div>
            <button
              className="phase-primary phase-create-account"
              disabled
              title={held}
            >
              إنشاء حساب <Arrow />
            </button>
            <div className="phase-or">
              <span />
              أو
              <span />
            </div>
            <div className="phase-social">
              <button disabled title={held}>
                <ReferenceArt
                  source={7}
                  crop={[431, 781, 45, 45]}
                  theme={theme}
                />
                متابعة بفيسبوك
              </button>
              <button disabled title={held}>
                <ReferenceArt
                  source={7}
                  crop={[94, 780, 50, 50]}
                  theme={theme}
                />
                متابعة بجوجل
              </button>
            </div>
            <p className="phase-login">
              لديك حساب بالفعل؟{" "}
              <button disabled title={held}>
                سجل الدخول
              </button>
            </p>
          </>
        )}
        {id !== 1 && id !== 2 && (
          <ReferenceArt
            source={4}
            crop={[0, 900, 768, 124]}
            theme={theme}
            className="phase-footer-road"
          />
        )}
      </main>
    </div>
  );
}
