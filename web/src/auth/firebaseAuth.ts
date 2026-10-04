import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  linkWithCredential,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type User,
} from "firebase/auth";
import { firebaseAuth, firebaseAuthConfigured } from "../firebaseConfig";

const PENDING_CREDENTIAL_KEY = "sekka.firebase.pending-credential";

export class FirebaseSignInError extends Error {
  constructor(readonly code: string, message: string, readonly email?: string) {
    super(message);
    this.name = "FirebaseSignInError";
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope("email");
facebookProvider.addScope("public_profile");

function getAuthOrThrow(): Auth {
  if (!firebaseAuthConfigured || !firebaseAuth) {
    throw new FirebaseSignInError(
      "auth/configuration-not-ready",
      "إعدادات تسجيل Google وFacebook غير مكتملة بعد.",
    );
  }
  return firebaseAuth;
}

function isMobileBrowser() {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function savePendingCredential(error: unknown) {
  const firebaseError = error as { code?: string; customData?: { email?: string } };
  const credential = OAuthProvider.credentialFromError(error as never);
  if (!credential) return;

  try {
    sessionStorage.setItem(PENDING_CREDENTIAL_KEY, JSON.stringify(credential.toJSON()));
  } catch {
    throw new FirebaseSignInError(
      "auth/account-link-storage-unavailable",
      "تعذّر حفظ خطوة ربط الحساب في هذه الجلسة. فعّل تخزين الموقع ثم حاول مرة أخرى.",
      firebaseError.customData?.email,
    );
  }

  throw new FirebaseSignInError(
    "auth/account-exists-with-different-credential",
    "هذا البريد مرتبط بطريقة دخول أخرى. سجّل بالطريقة المرتبطة أولاً وسنربط الحسابين تلقائياً.",
    firebaseError.customData?.email,
  );
}

function mapFirebaseError(error: unknown): FirebaseSignInError {
  const value = error as { code?: string; customData?: { email?: string } };
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user": "أُغلقت نافذة تسجيل الدخول قبل اكتماله.",
    "auth/cancelled-popup-request": "يوجد طلب تسجيل دخول آخر قيد التنفيذ.",
    "auth/unauthorized-domain": "هذا النطاق غير مسموح به في إعدادات Firebase.",
    "auth/user-disabled": "هذا الحساب معطّل. تواصل مع الدعم.",
    "auth/network-request-failed": "تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.",
    "auth/credential-already-in-use": "طريقة الدخول هذه مرتبطة بحساب آخر.",
    "auth/provider-already-linked": "طريقة الدخول هذه مرتبطة بحسابك بالفعل.",
  };
  return new FirebaseSignInError(
    value.code ?? "auth/unknown",
    messages[value.code ?? ""] ?? "تعذّر تسجيل الدخول. حاول مرة أخرى.",
    value.customData?.email,
  );
}

async function linkPendingCredential(user: User) {
  let serialized: string | null = null;
  try {
    serialized = sessionStorage.getItem(PENDING_CREDENTIAL_KEY);
  } catch {
    return user;
  }
  if (!serialized) return user;

  try {
    const credential = OAuthProvider.credentialFromJSON(JSON.parse(serialized));
    if (!credential) throw new Error("Invalid pending Firebase credential");
    const result = await linkWithCredential(user, credential);
    sessionStorage.removeItem(PENDING_CREDENTIAL_KEY);
    return result.user;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

async function signIn(provider: GoogleAuthProvider | FacebookAuthProvider) {
  const auth = getAuthOrThrow();
  if (isMobileBrowser()) {
    await signInWithRedirect(auth, provider);
    return null;
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return await linkPendingCredential(result.user);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/account-exists-with-different-credential") {
      savePendingCredential(error);
    }
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/web-storage-unsupported") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw mapFirebaseError(error);
  }
}

export const signInWithGoogle = () => signIn(googleProvider);
export const signInWithFacebook = () => signIn(facebookProvider);

export async function getFirebaseRedirectUser() {
  const auth = getAuthOrThrow();
  try {
    const result = await getRedirectResult(auth);
    return result ? await linkPendingCredential(result.user) : null;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/account-exists-with-different-credential") {
      savePendingCredential(error);
    }
    throw mapFirebaseError(error);
  }
}

export function getFirebaseIdToken(user: User) {
  return user.getIdToken();
}

export function subscribeToFirebaseAuthState(
  callback: (user: User | null) => void,
  onError?: (error: FirebaseSignInError) => void,
) {
  if (!firebaseAuthConfigured || !firebaseAuth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth, callback, (error) => onError?.(mapFirebaseError(error)));
}
