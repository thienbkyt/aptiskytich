/**
 * Vietnam-timezone (Asia/Ho_Chi_Minh, UTC+7) date helpers.
 * Countdowns and "today" counters must use VN local days, not UTC,
 * otherwise the number of days is off by one for part of each day.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the current VN day. */
export function vnTodayISO(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instants bounding the current VN day: [start, end). */
export function vnTodayRangeUTC(now: Date = new Date()): { startISO: string; endISO: string } {
  const dayStartUTCms = Date.parse(`${vnTodayISO(now)}T00:00:00Z`) - VN_OFFSET_MS;
  return {
    startISO: new Date(dayStartUTCms).toISOString(),
    endISO: new Date(dayStartUTCms + 86400000).toISOString(),
  };
}

/** Whole days from the current VN day to `examDate` ("YYYY-MM-DD"). Negative = past. */
export function vnDaysUntil(examDate: string, now: Date = new Date()): number {
  const target = Date.parse(`${examDate}T00:00:00Z`);
  const today = Date.parse(`${vnTodayISO(now)}T00:00:00Z`);
  if (!Number.isFinite(target)) return 0;
  return Math.round((target - today) / 86400000);
}
