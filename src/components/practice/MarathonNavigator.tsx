import { useMemo, useState } from "react";
import { X, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export type MarathonQ = { is_correct: boolean; exam_question_id?: string };
export type MarathonResult = {
  correct: number;
  total: number;
  examSetId: string;
  qResults: MarathonQ[];
};

interface Props {
  sets: { id: string }[];
  results: (MarathonResult | undefined)[];
  currentIndex: number;
  /** When the parent is inline-reviewing a submitted set, highlight this set instead of currentIndex. */
  reviewingIndex?: number | null;
  /** Authoritative chip count per set (from exam_sets.question_count). */
  qCounts?: (number | undefined | null)[];
  /** Active question index within the current in-progress set (0-based). */
  currentQ?: number;
  /** Active question index within the reviewing set (when reviewingIndex is set). */
  reviewingQ?: number;
  /** Per-question answered flags for the CURRENT (in-progress) set. */
  currentAnswered?: boolean[];
  /** Per-question locked/graded flags for the CURRENT set (marathon per-question grading). */
  currentLocked?: boolean[];
  isRetryMode?: boolean;
  /** Enable in-set chip jump for the current set. */
  allowJumpInCurrent?: boolean;
  /**
   * Mode: default = correct/wrong marathons (Reading/Listening).
   * writing = only 2 states (đã viết / chưa viết), one chip per set, no retry button.
   */
  mode?: "default" | "writing";
  /** Chip labelling: "question" (default, per-question) or "set" (one chip = one đề). */
  chipLabelMode?: "question" | "set";
  onReview: (setIndex: number, questionIndex: number) => void;
  onJumpQuestion?: (questionIndex: number) => void;
  /** Switch marathon to any not-yet-done set at the given question index (forward or backward). */
  onEnterSet?: (setIndex: number, questionIndex: number) => void;
  /** Marathon: reset a submitted set so the user can redo it. Enables "Làm lại đề này". */
  onRetrySet?: (setIndex: number) => void;
}

const MarathonNavigator = ({
  sets, results, currentIndex, reviewingIndex, qCounts,
  currentQ, reviewingQ, currentAnswered, currentLocked,
  isRetryMode, allowJumpInCurrent = true, mode = "default",
  onReview, onJumpQuestion, onEnterSet, onRetrySet,
}: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Flatten all chips: global index -> { si, qi }. Skips sets with missing/0 count.
  const flat = useMemo(() => {
    const out: { si: number; qi: number }[] = [];
    try {
      for (let si = 0; si < sets.length; si++) {
        const done = results[si]?.qResults?.length;
        const planned = qCounts?.[si];
        const raw = (typeof done === "number" && done > 0)
          ? done
          : (typeof planned === "number" && planned > 0 ? planned : 0);
        const count = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
        for (let qi = 0; qi < count; qi++) out.push({ si, qi });
      }
    } catch {
      return [];
    }
    return out;
  }, [sets.length, results, qCounts]);

  const totalChips = flat.length;

  // Đếm theo ĐỀ: đã làm = số đề đã nộp; tổng = số đề.
  const submittedSets = useMemo(
    () => results.reduce((n, r) => n + (r ? 1 : 0), 0),
    [results],
  );
  const totalSets = sets.length;

  // Đề đang đứng: xem lại thì theo đề đang xem, không thì theo đề đang làm.
  const isReviewingMode = (reviewingIndex ?? -1) >= 0;
  const activeSetIndex = isReviewingMode ? (reviewingIndex as number) : currentIndex;
  const activeSetNumber = Math.min(activeSetIndex + 1, Math.max(totalSets, 1));

  const isWriting = mode === "writing";

  const body = (onClose?: () => void) => (
    <aside className="w-full h-full bg-card/95 border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">
          {isRetryMode ? "Mục lục marathon · Làm lại câu sai" : "Mục lục marathon"}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-3 border-b border-border space-y-2.5">
        <div className="text-xs text-foreground">
          <span className="font-semibold">
            {isWriting ? "Đã làm" : "Đã làm"} {submittedSets}/{totalSets || 0}
          </span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Đề {activeSetNumber}/{totalSets}
          </span>
        </div>

        <div className="rounded-md bg-muted/50 p-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-muted-foreground/40" /> {isWriting ? "Đã làm" : "đã làm"}
          </span>
          {!isWriting && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded border-2 border-blue-500 bg-muted dark:border-blue-400" /> đang làm dở
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-border bg-muted" /> {isWriting ? "Chưa làm" : "chưa làm"}
          </span>
        </div>

        {isReviewingMode && onRetrySet && !!results[activeSetIndex] && (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onRetrySet(activeSetIndex)}
              className="text-[11px] font-semibold text-[#CC1C01] hover:underline whitespace-nowrap shrink-0"
            >
              {isWriting ? "Làm lại đề này" : "Làm lại câu này"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isWriting ? (
          <div className="flex flex-wrap gap-1.5">
            {sets.map((_, si) => {
              const isDone = !!results[si];
              const isActive = si === activeSetIndex;
              const cls = isDone
                ? "bg-muted-foreground/25 text-foreground border border-border hover:bg-muted-foreground/35 dark:bg-muted-foreground/20"
                : "bg-muted text-muted-foreground border border-border";
              return (
                <button
                  key={si}
                  type="button"
                  onClick={() => {
                    try {
                      if (isDone) onReview(si, 0);
                      else onEnterSet?.(si, 0);
                    } catch { /* noop */ }
                  }}
                  className={cn(
                    "min-w-[36px] h-[26px] px-1.5 rounded text-[11px] font-semibold transition-colors",
                    cls,
                    isActive && "ring-2 ring-[#24085a] ring-offset-1",
                    "cursor-pointer",
                  )}
                  title={`Đề ${si + 1}`}
                >
                  {si + 1}
                </button>
              );
            })}
          </div>
        ) : totalChips === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">—</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {flat.map((cell, gi) => {
              const { si, qi } = cell;
              const r = results[si];
              const isDone = !!r;
              const isCurrent = !isDone && si === currentIndex;
              const isReviewing = (reviewingIndex ?? -1) === si;

              let state: "done" | "answered" | "empty" = "empty";
              if (isDone) state = "done";
              else if (isCurrent && currentLocked?.[qi]) state = "done";
              else if (isCurrent && currentAnswered?.[qi]) state = "answered";

              const isCurrentChip = isReviewingMode
                ? (isReviewing && (reviewingQ ?? 0) === qi)
                : (isCurrent && (currentQ ?? -1) === qi);

              const cls =
                state === "done"
                  ? "bg-muted-foreground/25 text-foreground border border-border hover:bg-muted-foreground/35 dark:bg-muted-foreground/20"
                  : state === "answered"
                  ? "bg-muted text-foreground border-2 border-blue-500 dark:border-blue-400 hover:bg-muted"
                  : "bg-muted text-muted-foreground border border-border";

              return (
                <button
                  key={gi}
                  id={`marathon-nav-chip-${gi}`}
                  type="button"
                  onClick={() => {
                    try {
                      if (si < 0 || si >= sets.length) return;
                      if (isDone) {
                        onReview(si, qi);
                      } else if (si === currentIndex) {
                        if (allowJumpInCurrent) onJumpQuestion?.(qi);
                      } else {
                        onEnterSet?.(si, qi);
                      }
                    } catch { /* swallow to keep exam alive */ }
                  }}
                  className={cn(
                    "w-[26px] h-[26px] rounded text-[11px] font-semibold transition-colors",
                    cls,
                    isCurrentChip && "ring-2 ring-[#24085a] ring-offset-1",
                    "cursor-pointer",
                  )}
                  title={`Câu ${gi + 1} · Đề ${si + 1} · Câu ${qi + 1}`}
                >
                  {gi + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop dock */}
      <div className="hidden lg:block w-[320px] shrink-0 sticky top-[49px] self-start h-[calc(100vh-49px)]">
        {body()}
      </div>

      {/* Mobile FAB + drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-[#24085a] text-white shadow-lg text-xs font-semibold"
      >
        <ListChecks className="w-4 h-4" /> Mục lục
      </button>
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="w-80 max-w-[85vw] h-full bg-card shadow-xl">
            {body(() => setDrawerOpen(false))}
          </div>
        </div>
      )}
    </>
  );
};

export default MarathonNavigator;
