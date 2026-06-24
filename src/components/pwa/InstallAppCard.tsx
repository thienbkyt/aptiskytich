import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "kt_install_card_dismissed";

const InstallAppCard = () => {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
      setTimeout(() => setMounted(true), 50);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show || !deferred) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setMounted(false);
    setTimeout(() => setShow(false), 300);
  };
  const install = async () => {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 transition-all duration-300 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div
        className="relative rounded-2xl bg-white border border-[#F2D7C5] p-4 pr-10"
        style={{ boxShadow: "0 20px 40px -16px rgba(204, 28, 1, 0.3), 0 8px 16px -8px rgba(77, 13, 13, 0.15)" }}
      >
        <button
          onClick={dismiss}
          aria-label="Đóng"
          className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[#FFF1E6] transition-colors"
        >
          <X className="w-4 h-4 text-[#8B6B5C]" />
        </button>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-extrabold text-sm leading-tight mb-0.5" style={{ color: "#4D0D0D" }}>
              Cài đặt ứng dụng Aptis Kỳ Tích
            </div>
            <div className="text-xs leading-snug" style={{ color: "#8B6B5C" }}>
              Học mọi lúc mọi nơi — cài miễn phí từ trình duyệt
            </div>
          </div>
        </div>
        <button
          onClick={install}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#CC1C01] to-[#E85A1F] text-white text-sm font-semibold hover:opacity-95 transition-opacity"
        >
          <Download className="w-4 h-4" /> Cài đặt ngay
        </button>
      </div>
    </div>
  );
};

export default InstallAppCard;
