import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./product-system.css";
import "./brand-lockup.css";
import "./auth-layout.css";
import "./theme.css";
import "./design-system.css";
import "./splash.css";
import "./rider-experience.css";
import App from "./App";
import PwaNotice from "./components/PwaNotice";
import { registerPwa } from "./pwa";
import { LanguageProvider } from "./i18n/runtime";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
      <PwaNotice />
    </LanguageProvider>
  </StrictMode>,
);

registerPwa();

const brandFont = document.createElement("link");
brandFont.rel = "stylesheet";
brandFont.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap";
brandFont.media = "print";
brandFont.addEventListener("load", () => { brandFont.media = "all"; }, { once: true });
document.head.append(brandFont);
