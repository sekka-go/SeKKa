import { t, useLanguage } from "../i18n/runtime";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const label = language === "ar" ? t("لغة التطبيق") : t("App language");

  return <label className="language-selector">
    <span>{label}</span>
    <select aria-label={label} value={language} onChange={(event) => setLanguage(event.target.value as "ar" | "en")}>
      <option value="ar">{t("العربية")}</option>
      <option value="en">English</option>
    </select>
  </label>;
}
