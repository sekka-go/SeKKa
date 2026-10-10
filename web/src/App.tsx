import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, clearSession, getStoredSession, storeSession, type User } from "./api";
import AuthScreen from "./screens/AuthScreen";
import LandingScreen from "./screens/LandingScreen";
import Workspace from "./screens/Workspace";
import SikkaSplash from "./components/SikkaSplash";
import SikkaMark from "./components/SikkaMark";
import type { Session, Toast } from "./types";
import type { ThemePreference } from "./components/ThemePreferenceCard";
import { t, useLanguage } from "./i18n/runtime";

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
  "/admin", "/account", "/captain", "/captain/trips", "/publish",
  "/search", "/trips", "/messages", "/notifications", "/broadcast",
]);
const currentPathname = () => window.location.pathname.replace(/\/+$/, "") || "/";

export default function App() {
  const { direction } = useLanguage();
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const resolvedTheme = resolveTheme(themePreference);
  const [toast, setToast] = useState<Toast | null>(null);
  const [introStage, setIntroStage] = useState<"mark" | "splash" | null>(() =>
    !getStoredSession() && window.location.pathname === "/" && !sessionStorage.getItem("sekka.intro-flow.v2") ? "mark" : null,
  );
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
      if (themeColor) themeColor.content = theme === "light" ? "#f2f5f9" : "#0f172a";
    };
    applyTheme();
    if (themePreference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themePreference]);
  useEffect(() => {
    if (introStage !== "mark") return;
    const timer = window.setTimeout(() => setIntroStage("splash"), 1650);
    return () => window.clearTimeout(timer);
  }, [introStage]);
  const completeIntro = useCallback(() => {
    sessionStorage.setItem("sekka.intro-flow.v2", "1");
    setIntroStage(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    api<{ user: User }>("/auth/me", { token: session.token }).then(({ user }) => {
      if (!active) return;
      const next = { ...session, user };
      setSession(next); storeSession(next.token, user);
    }).catch((error) => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) {
        clearSession(); setSession(null); notify(t("انتهت جلستك، سجّل الدخول مرة أخرى."), "info");
      }
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSignedIn = (next: Session) => { storeSession(next.token, next.user); setSession(next); };
  const signOut = async () => {
    if (session) await api("/auth/logout", { method: "POST", token: session.token }).catch(() => undefined);
    clearSession(); setSession(null);
  };

  return <div className="app-shell" data-theme={resolvedTheme} dir={direction}>
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}><span className="toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span><span className="toast-message">{toast.text}</span><button onClick={() => { setToast(null); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = null; }} aria-label={t("إغلاق")}>×</button></div>}
    {session ? <Workspace session={session} onSignOut={signOut} notify={notify} themePreference={themePreference} resolvedTheme={resolvedTheme} onThemePreferenceChange={setThemePreference} /> : introStage ? null : currentPathname() === "/login" || currentPathname() === "/register" || protectedPagePaths.has(currentPathname()) ? <AuthScreen onSignedIn={onSignedIn} notify={notify} /> : <LandingScreen />}
    {introStage === "mark" && <div className="intro-logo-screen" role="status" aria-label={t("سِكّة")} aria-live="polite"><SikkaMark className="intro-logo-mark" /></div>}
    {introStage === "splash" && <SikkaSplash onComplete={completeIntro} />}
  </div>;
}

