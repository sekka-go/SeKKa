import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import arabicMessages from "./locales/ar.json";
import englishMessages from "./locales/en.json";

export type Language = "ar" | "en";
export type Direction = "rtl" | "ltr";

type Catalog = Record<string, unknown>;
type LanguageContextValue = {
  language: Language;
  direction: Direction;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
let activeLanguage: Language = "ar";

function isLanguage(value: string | null): value is Language {
  return value === "ar" || value === "en";
}

function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem("sekka.language");
    if (isLanguage(saved)) return saved;
  } catch { /* Keep Arabic as the first-run default when storage is unavailable. */ }

  if (typeof navigator !== "undefined") {
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    const supported = preferred.find((locale) => /^(ar|en)(-|$)/i.test(locale));
    if (supported?.toLowerCase().startsWith("en")) return "en";
  }
  return "ar";
}

function flattenCatalog(catalog: Catalog, output: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value === "string") output[key] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) flattenCatalog(value as Catalog, output);
  }
  return output;
}

const messagesByLanguage: Record<Language, Record<string, string>> = {
  ar: flattenCatalog(arabicMessages as Catalog),
  en: flattenCatalog(englishMessages as Catalog),
};

export function getLanguage(): Language {
  return activeLanguage;
}

export function getDirection(): Direction {
  return activeLanguage === "ar" ? "rtl" : "ltr";
}

export function t(sourceText: string): string {
  return messagesByLanguage[activeLanguage][sourceText] ?? sourceText;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);
  activeLanguage = language;
  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  const setLanguage = useCallback((nextLanguage: Language) => {
    activeLanguage = nextLanguage;
    setLanguageState(nextLanguage);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.documentElement.dataset.language = language;
    try { localStorage.setItem("sekka.language", language); } catch { /* Preserve the in-memory choice. */ }
  }, [language, direction]);

  const value = useMemo(() => ({ language, direction, setLanguage }), [language, direction, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
