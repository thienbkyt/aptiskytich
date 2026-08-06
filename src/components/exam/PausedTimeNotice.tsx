import { memo } from "react";
import { formatPausedDuration } from "@/hooks/useCountdown";

/** Small results-screen line: total time the student kept the clock paused. */
const PausedTimeNotice = ({ pausedMs }: { pausedMs?: number }) => {
  if (!pausedMs || pausedMs < 1000) return null;
  return (
    <p className="text-center text-sm text-muted-foreground mb-4">
      Đã tạm dừng: <span className="font-semibold text-foreground">{formatPausedDuration(pausedMs)}</span>
    </p>
  );
};

export default memo(PausedTimeNotice);
