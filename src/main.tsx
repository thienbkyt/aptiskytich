import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__ktInstallPrompt = e;
  window.dispatchEvent(new Event("kt-install-available"));
});

// Auto-reload on stale chunk errors (after a new deploy). Throttle to avoid loops.
const maybeReloadForStaleChunk = () => {
  const KEY = "kt_chunk_reloaded_at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
};
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault?.();
  maybeReloadForStaleChunk();
});
window.addEventListener("error", (e) => {
  const msg = e?.message || "";
  if (msg.includes("Failed to fetch dynamically imported module")) maybeReloadForStaleChunk();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e as any)?.reason?.message || (e as any)?.reason || "");
  if (msg.includes("Failed to fetch dynamically imported module")) maybeReloadForStaleChunk();
});

createRoot(document.getElementById("root")!).render(<App />);
