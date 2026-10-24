import { t } from "../i18n/runtime";
export type ThemePreference = "light" | "dark" | "system";

const choices: Array<{ value: ThemePreference; label: string; detail: string }> = [
  { value: "light", label: "فاتح", detail: "ألوان فاتحة" },
  { value: "dark", label: "داكن", detail: "ألوان داكنة" },
  { value: "system", label: "تلقائي", detail: "حسب جهازك" },
];

export default function ThemePreferenceCard({ value, onChange }: {
  value: ThemePreference;
  resolvedTheme: "light" | "dark";
  onChange: (value: ThemePreference) => void;
}) {
  return <section className="surface theme-preference-card" aria-labelledby="theme-preference-title">
    <div className="theme-preference-heading">
      <div className="theme-preference-copy">
        <span className="eyebrow">{t("مظهر التطبيق")}</span>
        <h2 id="theme-preference-title">{t("اختار الألوان المناسبة لك")}</h2>
        <p>{t("تقدر تغيّرها في أي وقت، وهيتطبق اختيارك على كل الشاشات.")}</p>
      </div>
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
        <span className="theme-choice-icon" aria-hidden="true">
          {choice.value === "light" && <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
          {choice.value === "dark" && <svg viewBox="0 0 24 24"><path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" /></svg>}
          {choice.value === "system" && <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4m-4-9 2-2 2 2 3-4" /></svg>}
        </span>
        <span className="theme-choice-copy"><strong>{t(choice.label)}</strong><small>{t(choice.detail)}</small></span>
      </button>)}
    </div>
  </section>;
}
