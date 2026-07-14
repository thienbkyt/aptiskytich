// Shared range-selector helpers for Admin Report tabs.
// Client-side: only chooses ISO bounds to pass to server RPCs.

export const RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tùy chọn (từ - đến)" },
] as const;

export interface Bounds {
  gte: string | null;
  lte: string | null;
  /** number of days spanned; null when "all" and custom is empty */
  windowDays: number | null;
}

export function resolveBounds(range: string, customFrom: string, customTo: string): Bounds {
  const now = new Date();
  if (range === "custom") {
    if (!customFrom || !customTo) return { gte: null, lte: null, windowDays: null };
    const f = new Date(`${customFrom}T00:00:00`);
    const t = new Date(`${customTo}T23:59:59.999`);
    const wd = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1);
    return { gte: f.toISOString(), lte: t.toISOString(), windowDays: wd };
  }
  if (range === "all") return { gte: null, lte: null, windowDays: null };
  if (range === "today") {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return { gte: s.toISOString(), lte: null, windowDays: 1 };
  }
  const n = Number(range);
  const f = new Date(now);
  f.setDate(f.getDate() - n);
  return { gte: f.toISOString(), lte: null, windowDays: n };
}

export function periodLabel(range: string, customFrom: string, customTo: string, windowDays: number | null): string {
  if (range === "custom") return customFrom && customTo ? `${customFrom} → ${customTo}` : "Tùy chọn";
  if (windowDays == null) return "Tất cả";
  if (windowDays === 1) return "Hôm nay";
  return `${windowDays} ngày qua`;
}

export const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
