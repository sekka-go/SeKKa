import { PreferencesProvider } from "./v2/preferences";
import React from "react";
import { createRoot } from "react-dom/client";
import SubscriptionApp from "./v2/App";
import MobileApp from "./v2/MobileApp";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <PreferencesProvider>{window.location.pathname.startsWith("/dev/screens")?<SubscriptionApp/>:<MobileApp/>}</PreferencesProvider>
  </React.StrictMode>,
);
