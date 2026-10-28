import { useLanguage } from "../i18n/runtime";

export default function PublicLanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <button
    className="stitch-language-toggle"
    type="button"
    onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
    aria-label={language === "ar" ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
  >{language === "ar" ? "English" : "العربية"}</button>;
}
