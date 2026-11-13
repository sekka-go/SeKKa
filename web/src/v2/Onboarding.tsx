import { usePreferences } from "./preferences";
import { translate } from "./translations";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./onboarding.css";
export type Appearance = "dark" | "light";
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
  "استكمال الملف الشخصي",
  "الأذونات",
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
  const {language} = usePreferences();
  const t = (text:string) => translate(text,language);
  const id = screen === 37 ? 2 : screen;
  const [phone, setPhone] = useState(""),
    [fullName, setFullName] = useState(""),
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
    1: t("معاك في السِكّة"),
    2: t("معاك في السِكّة"),
    3: t("اختر نوع حسابك"),
    4: t("أدخل رقم موبايلك"),
    5: t("أدخل كود التحقق"),
    6: t("استكمال الملف الشخصي"),
    7: t("الأذونات"),
  }[id];
  return (
    <div className={`phase-one-stage ${theme}`}>
      <nav className="phase-review-bar" aria-label={t("معاينة المرحلة الأولى")}>
        <div className="review-screen-nav">
          <button
            onClick={() => go(Math.max(1, id - 1))}
            disabled={id === 1}
            aria-label={t("الشاشة السابقة")}
          >
            ‹
          </button>
          <label>
            <span className="sr-only">{t("الشاشة")}</span>
            <select value={id} onChange={(e) => go(Number(e.target.value))}>
              {names.map((name, i) => (
                <option value={i + 1} key={name}>
                  {String(i + 1).padStart(2, "0")} · {t(name)}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => go(Math.min(7, id + 1))}
            disabled={id === 7}
            aria-label={t("الشاشة التالية")}
          >
            ›
          </button>
        </div>
        <div className="review-themes">
          <button
            aria-pressed={theme === "dark"}
            onClick={() => onTheme("dark")}
          >
            {t("دارك")}</button>
          <button
            aria-pressed={theme === "light"}
            onClick={() => onTheme("light")}
          >
            {t("لايت")}</button>
        </div>
      </nav>
      <p className="phase-preview-note" id="phase-preview-note">
        {id === 6
          ? t("معاينة استكمال الملف الشخصي — لم يتم حفظ حساب أو التحقق من رقم.")
          : id >= 4
            ? t("معاينة التصميم — إرسال الرسائل وإنشاء الحسابات غير مفعّلين.")
            : t("معاينة المرحلة الأولى · 7 شاشات")}
      </p>
      <main
        className={`phase-canvas phase-screen-${id}`}
        aria-label={`${t("المرحلة الأولى")} — ${t(names[id - 1])}`}
      >
        {id !== 1 && (
          <>
            <div className="phase-top-wave" aria-hidden="true" />
            <div className="phase-logo">
              <Wordmark />
            </div>
            {id !== 2 && (
              <button className="phase-back" onClick={back} aria-label={t("رجوع")}>
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
              aria-label={t("ابدأ مع سِكّة")}
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
              {t("أسهل طريقة للاشتراك في خطك اليومي")}<br />
              {t("والاشتراك في خطوط موثوقة")}</p>
            <ReferenceArt
              source={2}
              theme={theme}
              crop={[54, 310, 662, 326]}
              className="phase-welcome-art"
              label={t("راكب مستعد لمشواره اليومي بجوار خط سِكّة")}
            />
            <div className="phase-benefits">
              {[
                ["bus", t("خطوط متنوعة")],
                ["calendar", t("اشتراكات مرنة")],
                ["shield", t("موثوق وآمن")],
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
              {t("ابدأ الآن")}<Arrow />
            </button>
            <p className="phase-login">
              {t("لديك حساب بالفعل؟")}{" "}
              <button disabled title={t(held)}>
                {t("سجل الدخول")}</button>
            </p>
            <div className="phase-dots" aria-label={t("صفحة الترحيب الأولى")}>
              <i />
              <i />
              <i />
            </div>
          </>
        ) : id === 3 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">{t("قولنا هتستخدم سكة كراكب ولا كابتن؟")}</p>
            <div
              className="phase-roles"
              role="radiogroup"
              aria-label={t("نوع الحساب")}
            >
              {[
                {
                  value: "rider",
                  title: t("راكب"),
                  description: (
                    <>
                      {t("احجز مكانك في خطوط")}<br />
                      {t("مواصلات ثابتة واشترك")}<br />
                      {t("أسبوعي أو شهري.")}</>
                  ),
                  crop: [445, 337, 277, 217] as Crop,
                },
                {
                  value: "captain",
                  title: t("كابتن"),
                  description: (
                    <>
                      <span className="phase-copy-line">
                        {t("سجل ككابتن، أضف عربيتك")}</span>
                      <span className="phase-copy-line">{t("وخطوطك، واستقبل")}</span>
                      <span className="phase-copy-line">{t("مشتركين جدد.")}</span>
                    </>
                  ),
                  crop: [425, 593, 299, 220] as Crop,
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
              {t("متابعة")}<Arrow />
            </button>
          </>
        ) : id === 4 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              {t("هنبعتلك كود التحقق في رسالة قصيرة (SMS)")}</p>
            <ReferenceArt
              source={4}
              crop={[202, 331, 362, 243]}
              theme={theme}
              className="phase-phone-art"
              label={t("رسم موبايل ورسالة كود تحقق")}
            />
            <label className="phase-phone-input">
              <span className="sr-only">{t("رقم الموبايل")}</span>
              <span
                className="phase-country"
                aria-label={t("مصر، كود الدولة زائد 20")}
              >
                <b>+20</b>
                <span aria-hidden="true">🇪🇬</span>
                <span className="country-chevron" aria-hidden="true">
                  ⌄
                </span>
              </span>
              <input
                type="tel"
                aria-label={t("رقم الموبايل")}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="010 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby="phase-preview-note"
              />
            </label>
            <button className="phase-primary phase-send" disabled title={t(held)}>
              {t("إرسال كود التحقق")}<Arrow />
            </button>
          </>
        ) : id === 5 ? (
          <>
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              {t("تم إرسال كود من 4 أرقام إلى رقمك")}<br />
              <strong dir="ltr">{phone || "010 1234 5678"}</strong>
            </p>
            <ReferenceArt
              source={5}
              crop={[207, 335, 354, 220]}
              theme={theme}
              className="phase-otp-art"
              label={t("رسم موبايل ورسالة كود تحقق")}
            />
            <div
              className="phase-otp-inputs"
              dir="ltr"
              role="group"
              aria-label={t("كود التحقق — معاينة")}
            >
              <div className="sr-only" id="otp-hint">
                {t("معاينة أربع خانات فقط؛ طول الكود الفعلي يتحدد عند ربط مزوّد التحقق.")}</div>
              {digits.map((value, i) => (
                <input
                  key={i}
                  ref={(node) => {
                    otpRefs.current[i] = node;
                  }}
                  aria-label={language === "en" ? `Verification code digit ${i + 1}` : `الرقم ${i + 1} من كود التحقق`}
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
              <button disabled title={t(held)}>
                {t("أعد إرسال الكود")}</button>
            </div>
            <button
              className="phase-primary phase-verify"
              disabled
              title={t(held)}
            >
              {t("تحقق")}<Arrow />
            </button>
          </>
        ) : id === 6 ? (
          <div className="phase-flow-content">
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              {t("كمّل اسمك عشان نجهّز حسابك. بيانات الكابتن ومستنداته ليها خطوات منفصلة.")}</p>
            <label className="phase-register-field">
              <span>{t("الاسم الكامل")}</span>
              <input
                aria-label={t("الاسم الكامل")}
                value={fullName}
                minLength={2}
                maxLength={100}
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="phase-register-field">
              <span>{t("الصورة الشخصية (اختياري — معاينة محلية)")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                aria-label={t("الصورة الشخصية الاختيارية")}
              />
            </label>
            <p className="phase-subtitle">
              {t("البيانات هنا للمعاينة؛ حفظ الحساب محتاج تحقق الموبايل الفعلي.")}</p>
            <button
              className="phase-primary"
              disabled={fullName.trim().length < 2}
              onClick={() => go(7)}
            >
              {t("متابعة للمعاينة")}<Arrow />
            </button>
          </div>
        ) : (
          <div className="phase-flow-content">
            <h1 className="phase-title">{heading}</h1>
            <p className="phase-subtitle">
              {t("الأذونات باختيارك، وتقدر تكمل من غيرها.")}</p>
            <section className="phase-register-fields">
              <h2>{t("الإشعارات")}</h2>
              <p>
                {t("عشان توصلك تحديثات الحجز والدفع. تفعيلها هيكون متاح بعد تجهيز خدمة الإشعارات.")}</p>
              <h2>{t("الموقع")}</h2>
              <p>{t("مش مطلوب للتسجيل. هنطلبه وقت استخدام ميزة محتاجاه بس.")}</p>
            </section>
            <button
              className="phase-primary"
              onClick={() => go(role === "captain" ? 37 : 8)}
            >
              {t("تخطي ومتابعة")}<Arrow />
            </button>
          </div>
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
