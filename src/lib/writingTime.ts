/**
 * Thời gian làm bài Writing theo chuẩn Aptis General (British Council).
 * Part 1: 3 phút · Part 2: 7 phút · Part 3: 10 phút · Part 4: 30 phút (10 + 20)
 * Tổng: 50 phút.
 */
export const WRITING_TIME: Record<"task1" | "task2" | "task3" | "task4", number> = {
  task1: 180,
  task2: 420,
  task3: 600,
  task4: 1800,
};

/** Tổng thời gian Writing (Full Part / Full Test) = 50 phút. */
export const WRITING_TOTAL_TIME =
  WRITING_TIME.task1 + WRITING_TIME.task2 + WRITING_TIME.task3 + WRITING_TIME.task4;

export const getWritingTime = (partType: string): number =>
  WRITING_TIME[partType as keyof typeof WRITING_TIME] ?? WRITING_TOTAL_TIME;
