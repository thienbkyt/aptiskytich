export const WRITING_WORD_LIMITS = {
  task1: 10,
  task2: 45,
  task3: 60,
  task4Informal: 75,
  task4Formal: 225,
} as const;

export const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export const clampWords = (text: string, limit?: number) => {
  if (!limit) return text;
  const ws = Array.from(text.matchAll(/\S+/g));
  if (ws.length <= limit) return text;
  const last = ws[limit - 1];
  const end = (last.index ?? 0) + last[0].length;
  const trail = text.slice(end).match(/^[^\S\n]*/)?.[0] ?? "";
  return text.slice(0, end) + trail;
};
