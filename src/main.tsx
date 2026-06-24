import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { safeSessionStorage } from "./lib/safeStorage";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__ktInstallPrompt = e;
  window.dispatchEvent(new Event("kt-install-available"));
});

// Auto-reload on stale chunk errors (after a new deploy). Throttle to avoid loops.
const maybeReloadForStaleChunk = () => {
  const KEY = "kt_chunk_reloaded_at";
  const last = Number(safeSessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10_000) return;
  safeSessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
};
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault?.();
  maybeReloadForStaleChunk();
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
    maybeReloadForStaleChunk();
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
    maybeReloadForStaleChunk();
    return;
  }
  pushOverlay(`Unhandled Rejection: ${msg}\n${reason?.stack || ""}`);
});

createRoot(document.getElementById("root")!).render(<App />);
