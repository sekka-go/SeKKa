import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./brand-lockup.css";
import "./auth-layout.css";
import "./messages.css";
import "./splash.css";
import "./rider-experience.css";
import "./rider-stitch-screens.css";
import "./captain-stitch-screens.css";
import "./sekka-system.css";
import App from "./App";
import PwaNotice from "./components/PwaNotice";
import { registerPwa } from "./pwa";
import { LanguageProvider } from "./i18n/runtime";

const previewStyles = import.meta.env.DEV
  ? ({
    "/redesign-rider": () => import("./redesign/rider-screens-preview.css"),
    "/redesign-preview": () => import("./redesign/public-screens-preview.css"),
    "/redesign-admin": () => import("./redesign/admin-screens-preview.css"),
  } as Record<string, (() => Promise<unknown>) | undefined>)[window.location.pathname]?.() ?? Promise.resolve()
  : Promise.resolve();

void previewStyles.then(() => createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
      <PwaNotice />
    </LanguageProvider>
  </StrictMode>,
));

registerPwa();

const brandFont = document.createElement("link");
brandFont.rel = "stylesheet";
brandFont.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap";
brandFont.media = "print";
brandFont.addEventListener("load", () => { brandFont.media = "all"; }, { once: true });
document.head.append(brandFont);
