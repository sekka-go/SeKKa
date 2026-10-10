import { t } from "../i18n/runtime";
export type ThemePreference = "light" | "dark" | "system";

const choices: Array<{ value: ThemePreference; label: string; detail: string }> = [
  { value: "light", label: "فاتح", detail: "ألوان فاتحة" },
  { value: "dark", label: "داكن", detail: "ألوان داكنة" },
  { value: "system", label: "تلقائي", detail: "حسب جهازك" },
];

export default function ThemePreferenceCard({ value, resolvedTheme, onChange }: {
  value: ThemePreference;
  resolvedTheme: "light" | "dark";
  onChange: (value: ThemePreference) => void;
}) {
  const nextTheme = resolvedTheme === "light" ? "dark" : "light";
  return <section className="surface theme-preference-card" aria-labelledby="theme-preference-title">
    <div className="theme-preference-heading">
      <div className="theme-preference-copy">
        <span className="eyebrow">{t("مظهر التطبيق")}</span>
        <h2 id="theme-preference-title">{t("اختار الألوان المناسبة لك")}</h2>
        <p>{t("تقدر تغيّرها في أي وقت، وهيتطبق اختيارك على كل الشاشات.")}</p>
      </div>
      <button
        type="button"
        className="theme-mode-toggle"
        aria-label={`${t("التبديل إلى الوضع")} ${t(nextTheme === "light" ? "الفاتح" : "الداكن")}`}
        title={t("التبديل يدويًا عن وضع الجهاز")}
        onClick={() => onChange(nextTheme)}
      >
        {nextTheme === "light" ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" /><path d="m16.5 4 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" /></svg>}
      </button>
    </div>
    <div className="theme-preference-options" role="radiogroup" aria-labelledby="theme-preference-title">
      {choices.map((choice) => <button
        key={choice.value}
        type="button"
        role="radio"
        aria-checked={value === choice.value}
        className={`theme-preference-option ${value === choice.value ? "is-selected" : ""}`}
        onClick={() => onChange(choice.value)}
      >
        <span className="theme-choice-indicator" aria-hidden="true" />
        <span><strong>{t(choice.label)}</strong><small>{t(choice.detail)}</small></span>
      </button>)}
    </div>
  </section>;
}
