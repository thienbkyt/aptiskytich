import { useEffect, useRef, useState } from "react";

export interface UseCountdownOptions {
  /** Full duration of the clock in seconds (used when initialLeft is not given). */
  totalSeconds: number;
  /** Remaining seconds to start from (e.g. a shared clock carried across parts). */
  initialLeft?: number | null;
  /** While false the clock is frozen (not started / already submitted / parent-driven). */
  running: boolean;
  /** Student pressed pause — clock frozen but content stays usable. */
  paused?: boolean;
  onTick?: (remaining: number) => void;
}

/**
 * Wall-clock countdown.
 *
 * Engines used to do `setInterval(() => setTimeLeft(t => t - 1), 1000)`, which
 * drifts badly: browsers throttle timers in hidden tabs, so switching tabs
 * effectively granted extra exam time. Here the deadline is an absolute
 * timestamp, so remaining time is always derived from real elapsed time.
 */
export function useCountdown({
  totalSeconds,
  initialLeft,
  running,
  paused = false,
  onTick,
}: UseCountdownOptions): { timeLeft: number; pausedMs: number; restart: (seconds?: number) => void } {
  const startLeft = Math.max(0, initialLeft ?? totalSeconds);
  const endAtRef = useRef<number>(Date.now() + startLeft * 1000);
  const pausedAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef<number>(0);
  const [pausedMs, setPausedMs] = useState(0);
  const [timeLeft, setTimeLeft] = useState(startLeft);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Re-anchor when the caller hands us a materially different remaining time
  // (new part on a shared clock, parent-driven clock while `running` is false).
  // Self-ticks stay within ~1s of our own value, so they never re-anchor.
  useEffect(() => {
    if (initialLeft == null) return;
    const target = Math.max(0, initialLeft);
    setTimeLeft((cur) => {
      if (Math.abs(cur - target) <= (running ? 1.5 : 0)) return cur;
      endAtRef.current = Date.now() + target * 1000 + (pausedAtRef.current ? 0 : 0);
      if (pausedAtRef.current != null) pausedAtRef.current = Date.now();
      return target;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeft]);

  // Pause / resume: push the deadline forward by the paused duration.
  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = Date.now();
      return;
    }
    if (pausedAtRef.current != null) {
      const delta = Date.now() - pausedAtRef.current;
      endAtRef.current += delta;
      pausedMsRef.current += delta;
      pausedAtRef.current = null;
      setPausedMs(pausedMsRef.current);
    }
  }, [paused]);

  useEffect(() => {
    if (!running || paused) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setTimeLeft((cur) => {
        if (cur === remaining) return cur;
        onTickRef.current?.(remaining);
        return remaining;
      });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, paused]);

  const restart = (seconds?: number) => {
    const left = Math.max(0, seconds ?? totalSeconds);
    endAtRef.current = Date.now() + left * 1000;
    pausedAtRef.current = paused ? Date.now() : null;
    pausedMsRef.current = 0;
    setPausedMs(0);
    setTimeLeft(left);
  };

  return { timeLeft, pausedMs, restart };
}

export const formatPausedDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} phút ${s} giây`;
};
