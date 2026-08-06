import { createContext, useContext, ReactNode } from "react";

interface TimerCtx {
  timeLeft: number;
  totalTime: number;
  isPaused?: boolean;
  togglePause?: () => void;
}

const TimerContext = createContext<TimerCtx | null>(null);

export const TimerProvider = ({
  timeLeft,
  totalTime,
  isPaused = false,
  togglePause,
  children,
}: TimerCtx & { children: ReactNode }) => (
  <TimerContext.Provider value={{ timeLeft, totalTime, isPaused, togglePause }}>
    {children}
  </TimerContext.Provider>
);

export const useTimer = (): TimerCtx | null => useContext(TimerContext);
