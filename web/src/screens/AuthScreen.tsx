import { useEffect, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import BrandLogo from "../components/BrandLogo";
import RiderRoutePreferences from "../components/RiderRoutePreferences";
import { errorText } from "../lib/formatters";
import { api, ApiError, type SavedPlace, type User } from "../api";
import { firebaseAuthConfigured } from "../firebaseConfig";
import { FirebaseSignInError, getFirebaseIdToken, getFirebaseRedirectUser, signInWithFacebook, signInWithGoogle, subscribeToFirebaseAuthState } from "../auth/firebaseAuth";
import type { Session, Toast } from "../types";

export default function AuthScreen({ onSignedIn, notify }: { onSignedIn: (session: Session) => void; notify: (text: string, tone?: Toast["tone"]) => void }) {
  const mode = window.location.pathname === "/register" ? "register" : "login";
  const [role, setRole] = useState<"rider" | "captain">("rider");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingRouteSetup, setPendingRouteSetup] = useState<Session | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(firebaseAuthConfigured);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialLinkExisting, setSocialLinkExisting] = useState(false);

  useEffect(() => {
    if (!firebaseAuthConfigured) return;
    let active = true;
    const unsubscribe = subscribeToFirebaseAuthState((user) => {
      if (!active) return;
      setFirebaseUser(user);
      setFirebaseLoading(false);
    }, (cause) => {
      if (active) { setError(cause.message); setFirebaseLoading(false); }
    });
    getFirebaseRedirectUser().then(async (user) => {
      if (active && user) await acceptFirebaseUser(user);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof FirebaseSignInError ? cause.message : errorText(cause));
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const acceptSession = async (session: Session, registering: boolean) => {
    if (session.user.role === "rider") {
      let places: SavedPlace[] = [];
      try { places = (await api<{ places: SavedPlace[] }>("/rider/saved-places", { token: session.token })).places ?? []; }
      catch { if (registering) { setPendingRouteSetup(session); return; } }
      if (registering || !places.some((place) => place.place_type === "home") || !places.some((place) => place.place_type === "work")) {
        setPendingRouteSetup(session);
        return;
      }
    }
    onSignedIn(session);
    notify(registering ? "أهلًا بك في سِكّة. حسابك جاهز." : "تم تسجيل الدخول.", "success");
  };

  const acceptFirebaseUser = async (user: FirebaseUser) => {
    const idToken = await getFirebaseIdToken(user);
    const result = await api<{ token?: string; user?: User; needs_registration?: boolean; full_name?: string }>("/auth/firebase/session", { method: "POST", body: { id_token: idToken } });
    if (result.needs_registration) {
      setFirebaseUser(user);
      setFullName((current) => current || result.full_name || user.displayName || "");
      setError("");
      return;
    }
    if (!result.token || !result.user) throw new Error("استجابة تسجيل الدخول غير مكتملة.");
    await acceptSession({ token: result.token, user: result.user }, false);
  };

  const handleFirebaseSignIn = async (provider: "google" | "facebook") => {
    setSocialBusy(true); setError("");
    try {
      const user = provider === "google" ? await signInWithGoogle() : await signInWithFacebook();
      if (user) await acceptFirebaseUser(user);
    } catch (cause) { setError(cause instanceof FirebaseSignInError ? cause.message : errorText(cause)); }
    finally { setSocialBusy(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (firebaseUser) {
        const idToken = await getFirebaseIdToken(firebaseUser);
        if (socialLinkExisting) {
          const result = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { phone_number: phone.trim(), password } });
          await api("/auth/firebase/link", { method: "POST", token: result.token, body: { id_token: idToken } });
          await acceptSession({ token: result.token, user: result.user }, false);
          return;
        }
        try {
          const result = await api<{ token: string; user: User }>("/auth/firebase/register", { method: "POST", body: { id_token: idToken, full_name: fullName.trim(), phone_number: phone.trim(), password, role } });
          await acceptSession({ token: result.token, user: result.user }, true);
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 409 && cause.message.includes("رقم الهاتف مسجّل")) {
            setSocialLinkExisting(true);
            setError("الرقم له حساب بالفعل. سجّل دخولك بهاتفك وكلمة السر لربط الحسابين.");
            return;
          }
          throw cause;
        }
        return;
      }
      const registering = mode === "register";
      if (registering) {
        await api("/auth/register", { method: "POST", body: { full_name: fullName.trim(), phone_number: phone.trim(), password, role } });
      }
      const result = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { phone_number: phone.trim(), password } });
      const session = { token: result.token, user: result.user };
      await acceptSession(session, registering);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };

  if (pendingRouteSetup) return <main className="auth-page">
    <header className="auth-page-header"><a href="/" aria-label="سِكّة، الرئيسية"><BrandLogo /></a></header>
    <section className="auth-page-content route-onboarding-content">
      <RiderRoutePreferences token={pendingRouteSetup.token} notify={notify} onboarding onComplete={() => { onSignedIn(pendingRouteSetup); setPendingRouteSetup(null); notify("أهلًا بك في سِكّة. حسابك ونقطك المفضلة جاهزين.", "success"); }} />
    </section>
  </main>;

  return <main className="auth-page">
    <header className="auth-page-header">
      <a href="/" aria-label="سِكّة، الرئيسية"><BrandLogo /></a>
    </header>
    <section className="auth-page-content">
      <div className="auth-card auth-page-card">
        <div className="auth-tabs">
          <span className="active" aria-current="page">{mode === "login" ? "تسجيل الدخول" : "حساب جديد"}</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">{mode === "login" ? "سعيدين برجوعك" : "ابدأ رحلتك"}</span>
          <h1>{mode === "login" ? "أهلًا بيك تاني" : "انضم لسِكّة"}</h1>
          <p>{mode === "login" ? "سجّل دخولك وكمّل من حيث توقفت." : "أنشئ حسابك وابدأ ترتّب مشاويرك."}</p>
        </div>
        <form onSubmit={submit} className="form-stack">
          {(mode === "register" || (firebaseUser && !socialLinkExisting)) && <>
            <label>الاسم بالكامل<input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: ياسمين أحمد" required /></label>
            <fieldset className="role-picker"><legend>هتستخدم سِكّة بصفتك؟</legend><button type="button" className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><span>♙</span><strong>راكب</strong><small>أدور على مشوار مشترك</small></button><button type="button" className={role === "captain" ? "selected" : ""} onClick={() => setRole("captain")}><span>⌖</span><strong>كابتن</strong><small>أوصل الركاب لوجهتهم</small></button></fieldset>
          </>}
          {firebaseUser && !socialLinkExisting && <p className="auth-social-note">هنربط الحساب برقم الهاتف ونوع الحساب المختارين. البريد: {firebaseUser.email || "غير متاح"}</p>}
          {firebaseUser && socialLinkExisting && <p className="auth-social-note">أثبت ملكيتك للحساب الموجود برقم الهاتف وكلمة السر؛ لن ندمج الحسابات اعتمادًا على البريد وحده.</p>}
          <label>رقم الهاتف<input autoComplete="tel" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required /></label>
          <label>كلمة السر<input autoComplete={socialLinkExisting ? "current-password" : mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" || (firebaseUser && !socialLinkExisting) ? "8 أحرف على الأقل" : "••••••••"} minLength={mode === "register" || (firebaseUser && !socialLinkExisting) ? 8 : 1} required /></label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy || socialBusy || firebaseLoading}>{busy ? "لحظة واحدة…" : firebaseUser ? socialLinkExisting ? "ربط الحساب الحالي" : "إنشاء الحساب بالمتابعة" : mode === "login" ? "دخول إلى حسابي" : "إنشاء الحساب"}<span aria-hidden="true">←</span></button>
        </form>
        {mode === "login" && !firebaseUser && firebaseAuthConfigured && <>
          <div className="auth-social-divider"><span>أو سجّل الدخول باستخدام</span></div>
          <div className="auth-social-actions">
            <button className="button button-outline" type="button" disabled={busy || socialBusy || firebaseLoading} onClick={() => void handleFirebaseSignIn("google")}>{socialBusy ? "لحظة واحدة…" : "Google"}</button>
            <button className="button button-outline" type="button" disabled={busy || socialBusy || firebaseLoading} onClick={() => void handleFirebaseSignIn("facebook")}>{socialBusy ? "لحظة واحدة…" : "Facebook"}</button>
          </div>
        </>}
        <p className="auth-legal">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
        {firebaseUser ? <p className="auth-switch"><button type="button" className="auth-social-cancel" onClick={() => { setFirebaseUser(null); setSocialLinkExisting(false); setError(""); }}>إلغاء المتابعة بالحساب الاجتماعي</button></p> : mode === "login"
          ? <p className="auth-switch">لسه جديد في سِكّة؟ <a href="/register">أنشئ حسابك</a></p>
          : <p className="auth-switch">عندك حساب بالفعل؟ <a href="/login">سجّل الدخول</a></p>}
      </div>
    </section>
  </main>;
}
