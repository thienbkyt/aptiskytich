import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { safeSessionStorage } from "@/lib/safeStorage";

/**
 * Floating Zalo CTA — for sub-B2 users to reach a human tutor quickly.
 * Visible after a short delay, dismissible per-session.
 * Hidden inside the full-screen exam UI (body.exam-mode) to avoid covering controls.
 */
const ZALO_URL = "https://zalo.me/0867833227"; // Số Zalo Aptis Kỳ Tích

const ZaloFab = () => {
  const [hidden, setHidden] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (safeSessionStorage.getItem("zalo_fab_dismissed") === "1") {
      setDismissed(true);
      return;
    }
    const t = setTimeout(() => setHidden(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Auto-hide during exams / review (full-screen takeover).
  useEffect(() => {
    if (dismissed) return;
    const update = () => {
      const isExam =
        document.body.classList.contains("exam-mode") ||
        document.body.classList.contains("history-review-mode");
      setHidden(isExam);
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [dismissed]);


  if (dismissed || hidden) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="hidden sm:flex flex-col items-end max-w-[260px] mr-1">
        <div className="bg-white rounded-2xl rounded-br-sm shadow-lg border border-border px-3.5 py-2.5 text-xs text-foreground">
          Cần tư vấn lộ trình thi Aptis? <br />
          <span className="font-semibold text-primary">Nhắn Zalo miễn phí</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          safeSessionStorage.setItem("zalo_fab_dismissed", "1");
        }}
        className="w-6 h-6 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground -mr-1 self-start"
        aria-label="Đóng"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 rounded-full bg-[#0068FF] hover:bg-[#0055cc] text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Liên hệ Zalo"
      >
        {/* Zalo wordmark */}
        <span className="font-extrabold text-lg tracking-tight">Zalo</span>
      </a>
    </div>
  );
};

export default ZaloFab;
