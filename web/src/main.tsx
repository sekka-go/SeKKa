import React from "react";
import { createRoot } from "react-dom/client";
import SubscriptionApp from "./v2/App";
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <React.StrictMode>
    <SubscriptionApp />
  </React.StrictMode>,
);
