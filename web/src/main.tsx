import { PreferencesProvider } from "./v2/preferences";
import React from "react";
// Shared global tokens/reset must stay in the production entry after gallery code-splitting.
import "./v2/theme.css";
import { createRoot } from "react-dom/client";

import MobileApp from "./v2/MobileApp";
import LaunchSplash from "./v2/LaunchSplash";
// Keep the approved 73-screen developer gallery out of the public PWA's initial bundle.
const SubscriptionApp = React.lazy(() => import("./v2/App"));
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <PreferencesProvider>{["/dev/screens", "/dev/screens/"].includes(window.location.pathname)
      ? <React.Suspense fallback={<div role="status">Loading developer preview…</div>}><SubscriptionApp/></React.Suspense>
      : <LaunchSplash><MobileApp/></LaunchSplash>}</PreferencesProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{ /* Optional offline asset cache. */ });});
}
