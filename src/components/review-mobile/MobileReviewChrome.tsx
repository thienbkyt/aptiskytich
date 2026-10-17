import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tách "Part 1 - Personal Information" → { short: "Part 1", sub: "Personal Information" }. */
export function splitPartLabel(label: string | null | undefined): { short: string; sub: string } {
  const s = String(label ?? "").trim();
  const m = s.match(/^(part\s*\d+)\s*[-–—:·]\s*(.+)$/i);
  if (m) return { short: m[1].replace(/\s+/g, " ").replace(/^part/i, "Part"), sub: m[2].trim() };
  return { short: s, sub: "" };
}

export type SegState = "ok" | "no" | "neutral";

interface TopBarProps {
  title: string;
  subtitle?: string;
  count?: string | null;
  onClose: () => void;
  chips?: Array<{ key: string | number; label: string; active: boolean; onClick: () => void }>;
  segments?: SegState[];
  currentSeg?: number;
}

/** Thanh trên DUY NHẤT của màn xem lại trên điện thoại (thay thanh "Đóng" + thanh tím). */
export const MobileReviewTopBar = ({ title, subtitle, count, onClose, chips, segments, currentSeg }: TopBarProps) => (
  <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
    <div className="flex items-center gap-2 py-2 pl-1.5 pr-3">
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng xem lại"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-foreground active:bg-muted"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-exam-accent">{title}</p>
        {subtitle && <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>}
      </div>
      {count && (
        <span className="shrink-0 rounded-full bg-exam-accent/10 px-2.5 py-1 text-[12px] font-bold text-exam-accent tabular-nums">
          {count}
        </span>
      )}
    </div>
    {chips && chips.length > 1 && (
      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onClick}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              c.active
                ? "border-exam-accent bg-exam-accent text-exam-accent-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
    )}
    {segments && segments.length > 1 && (
      <div className="flex gap-[3px] px-3 pb-2">
        {segments.map((sg, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              sg === "ok" && "bg-emerald-500",
              sg === "no" && "bg-rose-500",
              sg === "neutral" && (i === currentSeg ? "bg-exam-accent" : "bg-border"),
              i === currentSeg && sg !== "neutral" && "outline outline-2 outline-offset-1 outline-exam-accent",
            )}
          />
        ))}
      </div>
    )}
  </div>
);

interface BottomBarProps {
  onPrev: () => void;
  onNext: () => void;
  onMenu: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel: string;
  menuHint?: string | null;
}

/** Thanh dưới cố định: Câu trước · Mục lục · Câu sau (thay nút "Mục lục" nổi che nội dung). */
export const MobileReviewBottomBar = ({ onPrev, onNext, onMenu, prevDisabled, nextDisabled, nextLabel, menuHint }: BottomBarProps) => (
  <div
    className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-background/95 px-3 pt-2.5 backdrop-blur"
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
  >
    <button
      type="button"
      onClick={onPrev}
      disabled={prevDisabled}
      aria-label="Câu trước"
      className="grid h-11 w-12 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground disabled:opacity-35"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
    <button
      type="button"
      onClick={onMenu}
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[14px] font-semibold text-exam-accent"
    >
      <ListChecks className="h-4 w-4 shrink-0" />
      Mục lục
      {menuHint && <span className="truncate text-[12px] font-semibold text-muted-foreground">· {menuHint}</span>}
    </button>
    <button
      type="button"
      onClick={onNext}
      disabled={nextDisabled}
      className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-exam-accent px-4 text-[14px] font-semibold text-exam-accent-foreground disabled:opacity-40"
    >
      {nextLabel}
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

/** Bottom sheet chứa Mục lục. */
export const MobileReviewSheet = ({ onClose, children }: { onClose: () => void; children: ReactNode }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end">
    <div className="absolute inset-0 bg-black/45 animate-in fade-in duration-150" onClick={onClose} />
    <div
      className="relative max-h-[82vh] overflow-hidden rounded-t-[22px] bg-card shadow-2xl animate-in slide-in-from-bottom duration-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto mb-1 mt-2 h-1.5 w-10 rounded-full bg-border" />
      <div className="max-h-[calc(82vh-14px)] overflow-y-auto">{children}</div>
    </div>
  </div>
);
