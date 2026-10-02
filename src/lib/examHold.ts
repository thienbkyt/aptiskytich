import { useEffect, useState } from "react";

/**
 * "Giữ" đồng hồ làm bài trong lúc học viên mở xem nội dung phụ (vd. Bảng Kỳ Tích).
 * Mọi đồng hồ dùng useCountdown + đồng hồ chuẩn bị/ghi âm Speaking sẽ tạm dừng
 * khi có ít nhất 1 "hold" và chạy tiếp khi tất cả hold được thả.
 */
let holdCount = 0;
const subscribers = new Set<(held: boolean) => void>();

export function holdExamClock(): () => void {
  holdCount += 1;
  if (holdCount === 1) subscribers.forEach((fn) => fn(true));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount = Math.max(0, holdCount - 1);
    if (holdCount === 0) subscribers.forEach((fn) => fn(false));
  };
}

export const isExamClockHeld = () => holdCount > 0;

export function onExamClockHold(fn: (held: boolean) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useExamClockHeld(): boolean {
  const [held, setHeld] = useState(isExamClockHeld);
  useEffect(() => onExamClockHold(setHeld), []);
  return held;
}
