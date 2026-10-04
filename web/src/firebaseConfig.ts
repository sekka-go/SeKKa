import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseAuthConfigured = Object.values(config).every((value) => typeof value === "string" && value.length > 0);

const app = firebaseAuthConfigured
  ? (getApps().length ? getApp() : initializeApp(config as FirebaseOptions))
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
