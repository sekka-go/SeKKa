import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./product-system.css";
import "./brand-lockup.css";
import "./auth-layout.css";
import "./splash.css";
import "./theme.css";
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
