import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FreshApp from "./fresh/FreshApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FreshApp />
  </StrictMode>,
);
