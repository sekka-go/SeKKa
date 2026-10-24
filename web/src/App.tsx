import { lazy, Suspense, useCallback, useEffect, useRef, useState, type AnimationEvent } from "react";
import { ApiError, api, clearSession, getStoredSession, storeSession, type User } from "./api";
import LandingScreen from "./screens/LandingScreen";
import RouteChunkBoundary from "./components/RouteChunkBoundary";
import SekkaSplash from "./components/SekkaSplash";
import type { Session, Toast } from "./types";
import type { ThemePreference } from "./components/ThemePreferenceCard";
import { isRefreshNavigation, t, useLanguage } from "./i18n/runtime";
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
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  return <div className="route-chunk-loading" role="status" aria-label={t("loading.general")}><span className="spinner" /></div>;
}

export default function App() {
  const { direction } = useLanguage();
  const isRefresh = isRefreshNavigation();
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [sessionCheckPending, setSessionCheckPending] = useState(() => Boolean(getStoredSession()));
  const [sessionCheckTimedOut, setSessionCheckTimedOut] = useState(false);
  const [refreshSplashVisible, setRefreshSplashVisible] = useState(() => isRefresh && Boolean(getStoredSession()));
  const [refreshSplashExiting, setRefreshSplashExiting] = useState(false);
  const refreshSplashActive = refreshSplashVisible || refreshSplashExiting || sessionCheckPending && !sessionCheckTimedOut;
  const refreshSplashActiveRef = useRef(refreshSplashActive);
  refreshSplashActiveRef.current = refreshSplashActive;
  const markCaptainHomeReady = useCallback(() => {
    if (!sessionCheckPending && refreshSplashVisible) setRefreshSplashExiting(true);
  }, [sessionCheckPending, refreshSplashVisible]);
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
      const background = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const currentThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const nextThemeColor = document.createElement("meta");
      nextThemeColor.name = "theme-color";
      nextThemeColor.content = background;
      if (currentThemeColor) currentThemeColor.replaceWith(nextThemeColor);
      else document.head.append(nextThemeColor);
      const statusBarStyle = document.querySelector<HTMLMetaElement>("meta[name=\"apple-mobile-web-app-status-bar-style\"]");
      if (statusBarStyle) statusBarStyle.content = theme === "light" ? "default" : "black";
    };
    applyTheme();
    if (themePreference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themePreference]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    let authRejected = false;
    api<{ user: User }>("/auth/me", { token: session.token }).then(({ user }) => {
      if (!active) return;
      const next = { ...session, user };
      setSession(next); storeSession(next.token, user);
    }).catch(async (error) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        authRejected = true;
        await loadAuthScreen().catch(() => undefined);
        if (!active) return;
        clearSession(); setSession(null); notify(t("انتهت جلستك، سجّل الدخول مرة أخرى."), "info");
        if (refreshSplashActiveRef.current) setRefreshSplashExiting(true);
      }
    }).finally(() => {
      if (!active) return;
      const finish = () => {
        if (!active) return;
        setSessionCheckPending(false);
        setSessionCheckTimedOut(false);
        const captainHomeRefresh = session.user.role === "captain" && ["/", "/captain"].includes(currentPathname());
        if (authRejected) {
          setRefreshSplashVisible(false);
          if (!refreshSplashActiveRef.current) setRefreshSplashExiting(false);
        } else if (captainHomeRefresh) {
          setRefreshSplashVisible(true);
          setRefreshSplashExiting(false);
        } else if (refreshSplashActiveRef.current) {
          setRefreshSplashVisible(true);
          setRefreshSplashExiting(true);
        } else {
          setRefreshSplashVisible(false);
          setRefreshSplashExiting(false);
        }
      };
      finish();
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !sessionCheckPending) return;
    const timeout = window.setTimeout(() => {
      setSessionCheckTimedOut(true);
      setRefreshSplashExiting(true);
    }, isRefresh ? 1500 : 4000);
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
  const handleRefreshSplashAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== "refresh-splash-exit") return;
    setRefreshSplashVisible(false);
    setRefreshSplashExiting(false);
  };

  return <div className={`app-shell${refreshSplashActive ? " is-refresh-splash-active" : ""}`} data-theme={resolvedTheme} dir={direction}>
    {refreshSplashActive && <SekkaSplash title={t("اسم التطبيق")} tagline={t("طريقك أسهل مع سِكّة")} accessibleLabel={t("جاري فتح سِكّة")} variant="refresh" exiting={refreshSplashExiting} onAnimationEnd={handleRefreshSplashAnimationEnd} />}
    {sessionCheckPending && sessionCheckTimedOut && <div className="startup-home-skeleton" role="status" aria-label={t("جاري تحميل الصفحة الرئيسية")}><span /><span /><span /><span /></div>}
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}><span className="toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span><span className="toast-message">{toast.text}</span><button onClick={() => { setToast(null); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = null; }} aria-label={t("إغلاق")}>×</button></div>}
    {policyPage ? <main className="public-policy-page"><header><a href="/" aria-label="SeKKa"><BrandLogo /></a><PublicLanguageToggle /></header><InfoPages page={policyPage} onBack={() => { window.location.assign("/"); }} /></main> : session ? <RouteChunkBoundary><Suspense fallback={<RouteLoading />}><Workspace session={session} onSignOut={signOut} notify={notify} themePreference={themePreference} resolvedTheme={resolvedTheme} onThemePreferenceChange={setThemePreference} onCaptainHomeReady={markCaptainHomeReady} /></Suspense></RouteChunkBoundary> : currentPathname() === "/login" || currentPathname() === "/register" || isProtectedPath(currentPathname()) || !showWelcome ? <RouteChunkBoundary><Suspense fallback={<RouteLoading />}><AuthScreen onSignedIn={onSignedIn} notify={notify} /></Suspense></RouteChunkBoundary> : <LandingScreen />}
  </div>;
}

