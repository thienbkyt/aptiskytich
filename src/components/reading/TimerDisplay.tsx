import { memo } from "react";
import { useTimer } from "@/components/reading/TimerContext";

interface TimerDisplayProps {
  timeLeft?: number;
  totalTime?: number;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Self-subscribing timer display. When a TimerProvider is mounted up the tree,
 * this component re-renders every second WITHOUT re-rendering its siblings
 * (e.g. heavy question renderers). Falls back to props otherwise.
 */
const TimerDisplay = ({ timeLeft: timeLeftProp, totalTime: totalTimeProp }: TimerDisplayProps) => {
  const ctx = useTimer();
  const timeLeft = ctx ? ctx.timeLeft : (timeLeftProp ?? 0);
  const totalTime = ctx ? ctx.totalTime : (totalTimeProp ?? 0);
  const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;

  return (
    <div className="exam-timer-display text-right">
      <div className="font-heading text-2xl font-extrabold text-foreground tracking-wider leading-none tabular-nums inline-block min-w-[9ch]">
        {formatTime(timeLeft)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">Time remaining</div>
      {/* Progress bar under timer */}
      <div className="h-[3px] w-full bg-muted rounded-full mt-1 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 bg-[#230859]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default memo(TimerDisplay);

