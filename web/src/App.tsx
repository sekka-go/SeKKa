import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, clearSession, getStoredSession, storeSession, type User } from "./api";
import AuthScreen from "./screens/AuthScreen";
import LandingScreen from "./screens/LandingScreen";
import Workspace from "./screens/Workspace";
import SikkaSplash from "./components/SikkaSplash";
import type { Session, Toast } from "./types";
export default function App() {
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [toast, setToast] = useState<Toast | null>(null);
  const [splashVisible, setSplashVisible] = useState(() => !sessionStorage.getItem("sekka.splash.seen"));
  const toastTimer = useRef<number | null>(null);
  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ text, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToast(null); toastTimer.current = null; }, 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);
  useEffect(() => { if (splashVisible) sessionStorage.setItem("sekka.splash.seen", "1"); }, [splashVisible]);
  const completeSplash = useCallback(() => setSplashVisible(false), []);

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
        clearSession(); setSession(null); notify("انتهت جلستك، سجّل الدخول مرة أخرى.", "info");
      }
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSignedIn = (next: Session) => { storeSession(next.token, next.user); setSession(next); };
  const signOut = async () => {
    if (session) await api("/auth/logout", { method: "POST", token: session.token }).catch(() => undefined);
    clearSession(); setSession(null);
  };

  return <div className="app-shell" dir="rtl">
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} aria-live={toast.tone === "error" ? "assertive" : "polite"}><span className="toast-icon" aria-hidden="true">{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span><span className="toast-message">{toast.text}</span><button onClick={() => { setToast(null); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = null; }} aria-label="إغلاق">×</button></div>}
    {session ? <Workspace session={session} onSignOut={signOut} notify={notify} /> : window.location.pathname === "/login" || window.location.pathname === "/register" ? <AuthScreen onSignedIn={onSignedIn} notify={notify} /> : <LandingScreen />}
    {splashVisible && <SikkaSplash onComplete={completeSplash} />}
  </div>;
}

