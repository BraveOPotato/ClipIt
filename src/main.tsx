import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { preloadWasm } from "./media";
import "./styles.css";

// Start before rendering; a failed background download is retried when media opens.
void preloadWasm().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
