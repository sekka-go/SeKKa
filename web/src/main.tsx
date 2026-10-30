import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./sekka-system.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
