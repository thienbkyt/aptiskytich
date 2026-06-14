import { createContext, useContext, ReactNode } from "react";

interface TimerCtx {
  timeLeft: number;
  totalTime: number;
}

const TimerContext = createContext<TimerCtx | null>(null);

export const TimerProvider = ({
  timeLeft,
  totalTime,
  children,
}: TimerCtx & { children: ReactNode }) => (
  <TimerContext.Provider value={{ timeLeft, totalTime }}>{children}</TimerContext.Provider>
);

export const useTimer = (): TimerCtx | null => useContext(TimerContext);
