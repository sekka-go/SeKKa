import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import arabicMessages from "./locales/ar.json";

export type Language = "ar" | "en";
export type Direction = "rtl" | "ltr";

type Catalog = Record<string, unknown>;
type LanguageContextValue = {
  language: Language;
  direction: Direction;
  catalogReady: boolean;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
let activeLanguage: Language = "ar";
const applicationNames: Record<Language, string> = { ar: "sekka", en: "sekka" };

function applicationName(language: Language) {
  return applicationNames[language];
}

export function isRefreshNavigation() {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === "reload";
}

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

function flattenCatalog(catalog: Catalog, output: Record<string, string> = {}, parentPath = "") {
  for (const [key, value] of Object.entries(catalog)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (typeof value === "string") {
      // Keep legacy source-text lookups while also supporting explicit namespace paths.
      output[key] = value;
      output[path] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenCatalog(value as Catalog, output, path);
    }
  }
  return output;
}

const messagesByLanguage: Partial<Record<Language, Record<string, string>>> = {
  ar: flattenCatalog(arabicMessages as Catalog),
};
let englishCatalogPromise: Promise<Record<string, string>> | null = null;

function loadCatalog(language: Language): Promise<Record<string, string>> {
  if (messagesByLanguage[language]) return Promise.resolve(messagesByLanguage[language]!);
  if (language === "en") {
    englishCatalogPromise ??= import("./locales/en.json").then(({ default: catalog }) => {
      const messages = flattenCatalog(catalog as Catalog);
      messagesByLanguage.en = messages;
      return messages;
    }).catch((error: unknown) => {
      englishCatalogPromise = null;
      throw error;
    });
    return englishCatalogPromise;
  }
  return Promise.resolve(messagesByLanguage.ar!);
}

function activateLanguage(language: Language) {
  activeLanguage = language;
}

export function getLanguage(): Language {
  return activeLanguage;
}

export function getDirection(): Direction {
  return activeLanguage === "ar" ? "rtl" : "ltr";
}

export function getApplicationName(language: Language): string {
  return applicationName(language);
}

export function t(sourceText: string): string {
  if (sourceText === "اسم التطبيق") return applicationName(activeLanguage);
  return messagesByLanguage[activeLanguage]?.[sourceText] ?? sourceText;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);
  const [catalogReady, setCatalogReady] = useState(() => language === "ar");
  const languageRequest = useRef(0);
  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    let mounted = true;
    void loadCatalog(language).then(() => {
      if (!mounted) return;
      activateLanguage(language);
      setCatalogReady(true);
    }).catch(() => {
      if (!mounted) return;
      activateLanguage("ar");
      setLanguageState("ar");
      setCatalogReady(true);
    });
    return () => { mounted = false; };
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    const request = ++languageRequest.current;
    void loadCatalog(nextLanguage).then(() => {
      if (request !== languageRequest.current) return;
      activateLanguage(nextLanguage);
      setLanguageState(nextLanguage);
    }).catch(() => undefined);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.documentElement.dataset.language = language;
    document.title = language === "ar" ? "sekka | معاك في السكة" : "sekka | With you on the road";
    try { localStorage.setItem("sekka.language", language); } catch { /* Preserve the in-memory choice. */ }
  }, [language, direction]);

  const value = useMemo(() => ({ language, direction, catalogReady, setLanguage }), [language, direction, catalogReady, setLanguage]);
  return <LanguageContext.Provider value={value}>
    {children}
  </LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
