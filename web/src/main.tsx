import { PreferencesProvider } from "./v2/preferences";
import React from "react";
import { createRoot } from "react-dom/client";
import SubscriptionApp from "./v2/App";
import MobileApp from "./v2/MobileApp";
import LaunchSplash from "./v2/LaunchSplash";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <PreferencesProvider>{window.location.pathname.startsWith("/dev/screens")?<SubscriptionApp/>:<LaunchSplash><MobileApp/></LaunchSplash>}</PreferencesProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{ /* Optional offline asset cache. */ });});
}
