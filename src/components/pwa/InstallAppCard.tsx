import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "kt_install_card_dismissed";

const InstallAppCard = () => {
  const [deferred, setDeferred] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const pick = () => {
      const e = (window as any).__ktInstallPrompt;
      if (e) { setDeferred(e); setTimeout(() => setMounted(true), 50); }
    };
    pick();
    window.addEventListener("kt-install-available", pick);
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("kt-install-available", pick);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, "1"); setMounted(false); setTimeout(() => setDeferred(null), 300); };
  const install = async () => { deferred.prompt(); await deferred.userChoice; (window as any).__ktInstallPrompt = null; setDeferred(null); };

  return createPortal(
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] w-[300px] max-w-[calc(100vw-2rem)] transition-all duration-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="relative rounded-xl bg-card border border-border shadow-2xl p-3.5">
        <button onClick={dismiss} aria-label="Đóng" className="absolute top-2.5 right-2.5 text-muted-foreground/60 hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-2.5 pr-4">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-[#CC1C01]/10 flex items-center justify-center">
            <Download className="w-4 h-4 text-[#CC1C01]" />
          </div>
          <div>
            <h4 className="text-sm font-heading font-bold text-foreground leading-tight">Cài đặt Aptis Kỳ Tích</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Tập trung học tập, tránh xao nhãng</p>
          </div>
        </div>
        <button onClick={install} className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95" style={{ background: "linear-gradient(90deg,#F2722E,#CC1C01)" }}>
          <Download className="w-3.5 h-3.5" /> Cài đặt miễn phí
        </button>
      </div>
    </div>,
    document.body
  );
};

export default InstallAppCard;
