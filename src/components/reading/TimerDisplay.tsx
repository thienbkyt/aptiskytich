import { memo } from "react";
import { Pause, Play } from "lucide-react";
import { useTimer } from "@/components/reading/TimerContext";

interface TimerDisplayProps {
  timeLeft?: number;
  totalTime?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  hideTimer?: boolean;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Self-subscribing timer display. When a TimerProvider is mounted up the tree,
 * this component re-renders every second WITHOUT re-rendering its siblings
 * (e.g. heavy question renderers). Falls back to props otherwise.
 */
const TimerDisplay = ({
  timeLeft: timeLeftProp,
  totalTime: totalTimeProp,
  isPaused = false,
  onTogglePause,
  hideTimer = false,
}: TimerDisplayProps) => {
  const ctx = useTimer();
  const timeLeft = ctx ? ctx.timeLeft : (timeLeftProp ?? 0);
  const totalTime = ctx ? ctx.totalTime : (totalTimeProp ?? 0);
  const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isPausedEff = isPaused || !!ctx?.isPaused;
  const toggle = onTogglePause ?? ctx?.togglePause;
  const showPause = !!toggle && !hideTimer;

  return (
    <div className="exam-timer-display flex items-center justify-end gap-2">
      {showPause && (
        <button
          type="button"
          onClick={toggle}
          aria-label={isPausedEff ? "Tiếp tục tính giờ" : "Tạm dừng tính giờ"}
          title={isPausedEff ? "Tiếp tục" : "Tạm dừng"}
          className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
            isPausedEff
              ? "border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {isPausedEff ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      )}
      <div
        className={`text-right rounded-md px-2 py-1 border transition-colors ${
          isPausedEff ? "border-amber-500 bg-amber-50/60" : "border-transparent"
        }`}
      >
        <div
          className={`font-heading text-2xl font-extrabold tracking-wider leading-none tabular-nums inline-block min-w-[9ch] ${
            isPausedEff ? "text-foreground/40" : "text-foreground"
          }`}
        >
          {formatTime(timeLeft)}
        </div>
        <div className={`text-[11px] mt-0.5 ${isPausedEff ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
          {isPausedEff ? "Đã tạm dừng" : "Time remaining"}
        </div>
        {/* Progress bar under timer */}
        <div className="h-[3px] w-full bg-muted rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isPausedEff ? "bg-amber-500" : "bg-[#230859]"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );

    </div>
  );
};

export default memo(TimerDisplay);
