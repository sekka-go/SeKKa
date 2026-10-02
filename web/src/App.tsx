import { useCallback, useEffect, useState } from "react";
import { ApiError, api, clearSession, getStoredSession, storeSession, type User } from "./api";
import AuthScreen from "./screens/AuthScreen";
import LandingScreen from "./screens/LandingScreen";
import Workspace from "./screens/Workspace";
import type { Session, Toast } from "./types";
export default function App() {
  const [session, setSession] = useState<Session | null>(() => getStoredSession());
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 4200);
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
        clearSession(); setSession(null); notify("انتهت جلستك، سجّل الدخول مرة أخرى.", "info");
      }
    });
    return () => { active = false; };
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSignedIn = (next: Session) => { storeSession(next.token, next.user); setSession(next); };
  const signOut = async () => {
    if (session) await api("/auth/logout", { method: "POST", token: session.token }).catch(() => undefined);
    clearSession(); setSession(null); notify("تم تسجيل الخروج.", "success");
  };

  return <div className="app-shell" dir="rtl">
    {toast && <div className={`toast toast-${toast.tone}`} role="status">{toast.text}<button onClick={() => setToast(null)} aria-label="إغلاق">×</button></div>}
    {session ? <Workspace session={session} onSignOut={signOut} notify={notify} /> : window.location.pathname === "/login" || window.location.pathname === "/register" ? <AuthScreen onSignedIn={onSignedIn} notify={notify} /> : <LandingScreen />}
  </div>;
}
