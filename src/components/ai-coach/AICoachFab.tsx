import { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import aiCoachLogo from "@/assets/ai-coach-logo.png.asset.json";
import { SHOW_AI_ASSISTANT } from "@/config/features";

const AICoachPanel = lazy(() => import("./AICoachPanel"));

// Hide on full-screen exam routes to not break focus.
const HIDDEN_PATTERNS = [/^\/auth/, /^\/reset-password/];

export default function AICoachFab() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  if (!SHOW_AI_ASSISTANT) return null;

  // Hide on auth pages and when body has exam-fullscreen class (set by exam UI).
  if (HIDDEN_PATTERNS.some((re) => re.test(loc.pathname))) return null;
  if (typeof document !== "undefined" && document.body.classList.contains("exam-fullscreen")) {
    return null;
  }


  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng Coach AI" : "Mở Coach AI"}
        className={cn(
          "fixed z-40 right-6 bottom-24 md:bottom-6 w-14 h-14 rounded-full",
          "text-primary-foreground",
          "shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/60",
          "flex items-center justify-center transition-all duration-300",
          "hover:scale-110 active:scale-95",
          "ring-2 ring-primary/30 hover:ring-primary/50",
          open && "bg-gradient-to-br from-primary to-primary/70",
        )}
        style={{ animation: open ? undefined : "coach-pulse 2.5s ease-in-out infinite" }}
      >
        {open ? <X className="w-6 h-6" /> : <img src={aiCoachLogo.url} alt="AI Kỳ Tích" className="w-full h-full object-cover rounded-full" />}
        {!open && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-background text-primary border border-primary/40">
            AI
          </span>
        )}
      </button>
      <Suspense fallback={null}>
        {(open || undefined) && <AICoachPanel open={open} onClose={() => setOpen(false)} />}
      </Suspense>
      <style>{`
        @keyframes coach-pulse {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5), 0 10px 25px -5px hsl(var(--primary) / 0.4); }
          50% { box-shadow: 0 0 0 12px hsl(var(--primary) / 0), 0 10px 25px -5px hsl(var(--primary) / 0.4); }
        }
      `}</style>
    </>
  );
}
