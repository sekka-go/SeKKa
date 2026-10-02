import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";
import PwaNotice from "./components/PwaNotice";
import { registerPwa } from "./pwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <App />
      <PwaNotice />
    </>
  </StrictMode>,
);

registerPwa();
