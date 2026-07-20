import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Facebook } from "lucide-react";
import { ZALO_URL, FB_URL } from "@/config/contact";

const BRAND = "#CC1C01";

export default function SupportChatFab() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      const b = document.body.classList;
      setHidden(b.contains("exam-active") || b.contains("history-review-mode"));
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[80] flex flex-col items-end gap-2"
      style={{ bottom: 16, right: 16 }}
    >
      {open && (
        <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <a
            href={ZALO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 text-sm font-semibold shadow-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
          >
            <span className="w-7 h-7 rounded-full bg-[#0068FF] text-white flex items-center justify-center text-[10px] font-extrabold">
              Zalo
            </span>
            Chat Zalo
          </a>
          <a
            href={FB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white pl-3 pr-4 py-2 text-sm font-semibold shadow-lg border border-slate-200 text-slate-800 hover:bg-slate-50"
          >
            <span className="w-7 h-7 rounded-full bg-[#1877F2] text-white flex items-center justify-center">
              <Facebook className="w-4 h-4" />
            </span>
            Nhắn Facebook
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Liên hệ hỗ trợ"
        aria-expanded={open}
        className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: BRAND }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
