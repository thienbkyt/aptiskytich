import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__ktInstallPrompt = e;
  window.dispatchEvent(new Event("kt-install-available"));
});

createRoot(document.getElementById("root")!).render(<App />);
