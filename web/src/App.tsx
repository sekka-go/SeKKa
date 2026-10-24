import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, clearSession, getStoredSession, storeSession, type User } from "./api";
import LandingScreen from "./screens/LandingScreen";
import RouteChunkBoundary from "./components/RouteChunkBoundary";
import SekkaSplash from "./components/SekkaSplash";
import type { Session, Toast } from "./types";
import type { ThemePreference } from "./components/ThemePreferenceCard";
import { t, useLanguage } from "./i18n/runtime";
import InfoPages from "./components/InfoPages";
import type { InfoPageKey } from "./components/InfoPages";
import BrandLogo from "./components/BrandLogo";
import PublicLanguageToggle from "./components/PublicLanguageToggle";

function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem("sekka.theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const protectedPagePaths = new Set([
  "/admin", "/admin/users", "/admin/documents", "/admin/trips", "/admin/complaints", "/admin/finance", "/admin/finance/adjustment", "/admin/pricing", "/admin/audit", "/account", "/settings", "/captain", "/captain/trips", "/captain/earnings", "/publish",
  "/search", "/trips", "/messages", "/notifications", "/broadcast",
]);
const currentPathname = () => window.location.pathname.replace(/\/+$/, "") || "/";
const publicPolicyPath = (path: string): Exclude<InfoPageKey, "faq"> | null => path === "/terms" ? "terms" : path === "/privacy" ? "privacy" : null;
const isProtectedPath = (path: string) => protectedPagePaths.has(path) || /^\/admin\/users\/\d+$/.test(path);
const welcomeSeenKey = "sekka.hasSeenWelcome";
const legacyIntroSessionKey = "sekka.intro-seen";
function hasSeenWelcome() {
  try {
    if (window.localStorage.getItem(welcomeSeenKey) === "true") return true;
  } catch { /* Treat unavailable storage as a first visit. */ }
  try {
    if (window.sessionStorage.getItem(legacyIntroSessionKey) === "true") {
      try { window.localStorage.setItem(welcomeSeenKey, "true"); } catch { /* Keep the legacy value for this session. */ }
      return true;
    }
  } catch { /* Treat unavailable storage as a first visit. */ }
  return false;
}
const loadAuthScreen = () => import("./screens/AuthScreen");
const AuthScreen = lazy(loadAuthScreen);
const Workspace = lazy(() => import("./screens/Workspace"));

function RouteLoading() {
  return <div className="route-chunk-loading" role="status" aria-live="polite"><span className="spinner" /><span>{t("loading.general")}</span></div>;
}

export default function App() {
  const { direction } = useLanguage();
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [sessionCheckPending, setSessionCheckPending] = useState(() => Boolean(getStoredSession()));
  const [sessionCheckTimedOut, setSessionCheckTimedOut] = useState(false);
  const [showWelcome] = useState(() => currentPathname() === "/" && !getStoredSession() && !hasSeenWelcome());
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const resolvedTheme = resolveTheme(themePreference);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ text, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToast(null); toastTimer.current = null; }, 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const applyTheme = () => {
      const theme = resolveTheme(themePreference);
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem("sekka.theme", themePreference); } catch { /* Keep the in-memory choice if storage is unavailable. */ }
      const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeColor) themeColor.content = getComputedStyle(document.documentElement).getPropertyValue("--color-background").trim();
      const statusBarStyle = document.querySelector<HTMLMetaElement>("meta[name=\"apple-mobile-web-app-status-bar-style\"]");
      if (statusBarStyle) statusBarStyle.content = theme === "light" ? "default" : "black";
    };
    applyTheme();
    if (themePreference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themePreference]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    api<{ user: User }>("/auth/me", { token: session.token }).then(({ user }) => {
      if (!active) return;
      const next = { ...session, user };
      setSession(next); storeSession(next.token, user);
    }).catch(async (error) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        await loadAuthScreen().catch(() => undefined);
        if (!active) return;
        clearSession(); setSession(null); notify(t("انتهت جلستك، سجّل الدخول مرة أخرى."), "info");
      }
    }).finally(() => {
      if (active) {
        setSessionCheckPending(false);
        setSessionCheckTimedOut(false);
      }
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !sessionCheckPending) return;
    const timeout = window.setTimeout(() => setSessionCheckTimedOut(true), 4000);
    return () => window.clearTimeout(timeout);
  }, [session?.token, sessionCheckPending]);

  useEffect(() => {
    if (!showWelcome) return;
    try { window.localStorage.setItem(welcomeSeenKey, "true"); } catch { /* The welcome page remains usable without storage. */ }
  }, [showWelcome]);

  const onSignedIn = (next: Session) => { storeSession(next.token, next.user); setSession(next); };
  const signOut = async () => {
    if (session) await api("/auth/logout", { method: "POST", token: session.token }).catch(() => undefined);
    clearSession(); setSession(null);
  };

  const policyPage = publicPolicyPath(currentPathname());

  return <div className="app-shell" data-theme={resolvedTheme} dir={direction}>
    {sessionCheckPending && !sessionCheckTimedOut && <SekkaSplash title={t("اسم التطبيق")} tagline={t("طريقك أسهل مع سِكّة")} accessibleLabel={t("جاري فتح سِكّة")} />}
    {sessionCheckPending && sessionCheckTimedOut && <div className="startup-home-skeleton" role="status" aria-label={t("جاري تحميل الصفحة الرئيسية")}><span /><span /><span /><span /></div>}
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}><span className="toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span><span className="toast-message">{toast.text}</span><button onClick={() => { setToast(null); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = null; }} aria-label={t("إغلاق")}>×</button></div>}
    {policyPage ? <main className="public-policy-page"><header><a href="/" aria-label="SeKKa"><BrandLogo /></a><PublicLanguageToggle /></header><InfoPages page={policyPage} onBack={() => { window.location.assign("/"); }} /></main> : session ? <RouteChunkBoundary><Suspense fallback={<RouteLoading />}><Workspace session={session} onSignOut={signOut} notify={notify} themePreference={themePreference} resolvedTheme={resolvedTheme} onThemePreferenceChange={setThemePreference} /></Suspense></RouteChunkBoundary> : currentPathname() === "/login" || currentPathname() === "/register" || isProtectedPath(currentPathname()) || !showWelcome ? <RouteChunkBoundary><Suspense fallback={<RouteLoading />}><AuthScreen onSignedIn={onSignedIn} notify={notify} /></Suspense></RouteChunkBoundary> : <LandingScreen />}
  </div>;
}

