import { useState } from "react";

interface TimerDisplayProps {
  timeLeft: number;
  totalTime: number;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const TimerDisplay = ({ timeLeft, totalTime }: TimerDisplayProps) => {
  const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;

  return (
    <div className="text-right">
      <div className="font-heading text-2xl font-extrabold text-foreground tracking-wider leading-none">
        {formatTime(timeLeft)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">Time remaining</div>
      {/* Progress bar under timer */}
      <div className="h-[3px] w-full bg-muted rounded-full mt-1 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default TimerDisplay;
