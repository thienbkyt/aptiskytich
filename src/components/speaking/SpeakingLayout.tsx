import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface SpeakingLayoutProps {
  partLabel: string;
  timeLeft: number;
  totalTime: number;
  children: ReactNode;
  onNext?: () => void;
  nextDisabled?: boolean;
  onExit?: () => void;
  showFooter?: boolean;
}

const HEADER_COLOR = "#24085a";
const BG_COLOR = "#F3F3F3";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const SpeakingLayout = ({
  partLabel,
  timeLeft,
  totalTime,
  children,
  onNext,
  nextDisabled = true,
  onExit,
  showFooter = true,
}: SpeakingLayoutProps) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ backgroundColor: BG_COLOR }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 md:px-8 h-14 shrink-0"
        style={{ backgroundColor: HEADER_COLOR }}
      >
        <div className="flex items-center gap-3">
          {onExit && (
            <button
              onClick={onExit}
              className="text-white/70 hover:text-white text-xs mr-2"
            >
              ✕
            </button>
          )}
          <span className="text-white font-bold text-sm md:text-base tracking-wide">
            {partLabel}
          </span>
        </div>

        <div className="bg-white rounded-lg px-4 py-1.5 flex items-center gap-2 shadow-sm">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span
            className={`text-sm font-mono font-bold tabular-nums ${
              timeLeft <= 30 ? "text-red-600" : "text-gray-800"
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
          {children}
        </div>
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 md:px-8 py-3 flex items-center justify-end">
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              nextDisabled
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "text-white hover:opacity-90"
            }`}
            style={!nextDisabled ? { backgroundColor: HEADER_COLOR } : undefined}
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeakingLayout;
