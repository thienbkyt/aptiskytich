import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerPWA } from "./lib/registerPWA";
import { supabase } from "@/integrations/supabase/client";

registerPWA();

// Kick the bootstrap RPC as early as possible if a Supabase session already
// lives in localStorage. This fires in parallel with the rest of the JS bundle
// loading so React Query can consume the resolved promise instead of issuing a
// second network round-trip after mount. Anon visitors skip this entirely,
// keeping the landing page at 0 Supabase calls when signed out.
try {
  const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
  const storageKey = projectId ? `sb-${projectId}-auth-token` : null;
  if (storageKey && typeof localStorage !== "undefined" && localStorage.getItem(storageKey)) {
    (window as any).__ktBootstrapPromise = (supabase as any).rpc("get_user_bootstrap");
  }
} catch {
  /* ignore */
}



window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__ktInstallPrompt = e;
  window.dispatchEvent(new Event("kt-install-available"));
});

// Show a small update banner on chunk load errors (usually after a new deploy).
// Do NOT auto-reload — user may be mid-exam. Only reload when they click.
let updateBanner: HTMLDivElement | null = null;
function showUpdateBanner() {
  if (updateBanner) return;
  try {
    const el = document.createElement("div");
    updateBanner = el;
    el.setAttribute("data-kt-update-banner", "");
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      zIndex: "2147483647",
      background: "#fff",
      color: "#0F0F10",
      borderTop: "1px solid #e5e5e5",
      boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      font: "14px/1.4 -apple-system, system-ui, sans-serif",
    } as Partial<CSSStyleDeclaration> as any);
    const msg = document.createElement("span");
    msg.textContent = "Đã có bản cập nhật mới.";
    const btn = document.createElement("button");
    btn.textContent = "Tải lại";
    Object.assign(btn.style, {
      background: "#CC1C01",
      color: "#fff",
      border: "none",
      padding: "8px 16px",
      borderRadius: "6px",
      fontWeight: "600",
      cursor: "pointer",
    } as Partial<CSSStyleDeclaration> as any);
    btn.onclick = () => window.location.reload();
    el.appendChild(msg);
    el.appendChild(btn);
    if (document.body) document.body.appendChild(el);
    else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el));
  } catch {
    /* ignore */
  }
}
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault?.();
  showUpdateBanner();
});

// ───────── Global error overlay (helps debug white-screen on iPhone Safari) ─────────
let overlay: HTMLDivElement | null = null;
function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.setAttribute("data-kt-error-overlay", "");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    maxHeight: "50vh",
    overflow: "auto",
    background: "rgba(204,28,1,0.95)",
    color: "#fff",
    font: "12px/1.4 -apple-system, system-ui, sans-serif",
    padding: "10px 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    WebkitOverflowScrolling: "touch",
  } as Partial<CSSStyleDeclaration> as any);
  const close = document.createElement("button");
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "4px",
    right: "8px",
    background: "transparent",
    color: "#fff",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
  } as Partial<CSSStyleDeclaration> as any);
  close.onclick = () => overlay && (overlay.style.display = "none");
  overlay.appendChild(close);
  if (document.body) document.body.prepend(overlay);
  else document.addEventListener("DOMContentLoaded", () => document.body.prepend(overlay!));
  return overlay;
}
function pushOverlay(text: string) {
  try {
    const el = ensureOverlay();
    el.style.display = "block";
    const line = document.createElement("div");
    line.style.borderTop = "1px solid rgba(255,255,255,0.3)";
    line.style.padding = "6px 0";
    line.textContent = text;
    el.appendChild(line);
  } catch {
    /* ignore */
  }
}

window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (msg.includes("Failed to fetch dynamically imported module")) {
    showUpdateBanner();
    return;
  }
  pushOverlay(
    `Error: ${msg}\nat ${e.filename || "?"}:${e.lineno || "?"}:${e.colno || "?"}\n${
      (e.error && (e.error.stack || "")) || ""
    }`,
  );
});
window.addEventListener("unhandledrejection", (e) => {
  const reason: any = (e as any)?.reason;
  const msg = String(reason?.message || reason || "");
  if (msg.includes("Failed to fetch dynamically imported module")) {
    showUpdateBanner();
    return;
  }
  pushOverlay(`Unhandled Rejection: ${msg}\n${reason?.stack || ""}`);
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
