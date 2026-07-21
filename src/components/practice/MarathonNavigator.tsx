import { useState } from "react";
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
  /** Planned question count per set (used for chip count when a set is not done yet). */
  qCounts?: (number | undefined)[];
  /** In the current in-progress set, which question is active (0-based). */
  currentQ?: number;
  /** In the current in-progress set, per-question answered flags. */
  currentAnswered?: boolean[];
  isRetryMode?: boolean;
  /** Enable in-set chip jump for the current set. Off => chips still visible but no-op. */
  allowJumpInCurrent?: boolean;
  onReview: (setIndex: number, questionIndex: number) => void;
  onJumpQuestion?: (questionIndex: number) => void;
}

const MarathonNavigator = ({
  sets, results, currentIndex, qCounts,
  currentQ, currentAnswered,
  isRetryMode, allowJumpInCurrent = true,
  onReview, onJumpQuestion,
}: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);

  const totalCorrect = results.reduce((s, r) => s + (r?.correct ?? 0), 0);
  const totalWrong = results.reduce((s, r) => s + ((r?.total ?? 0) - (r?.correct ?? 0)), 0);

  const backToCurrent = () => {
    const el = document.getElementById(`marathon-nav-set-${currentIndex}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        <div className="text-xs">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{totalCorrect} đúng</span>
          <span className="mx-1.5 text-muted-foreground">/</span>
          <span className="font-semibold text-red-700 dark:text-red-400">{totalWrong} sai</span>
          <span className="ml-1.5 text-muted-foreground">· Đề {Math.min(currentIndex + 1, sets.length)}/{sets.length}</span>
        </div>

        <div className="rounded-md bg-muted/50 p-2 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500/70" /> đúng
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-500/70" /> sai
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-border bg-muted" /> chưa làm
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWrong}
              onChange={() => setOnlyWrong((v) => !v)}
              className="rounded border-border"
            />
            Chỉ hiện câu sai
          </label>
          <button
            type="button"
            onClick={backToCurrent}
            className="text-[11px] font-medium text-[#24085a] dark:text-primary hover:underline"
          >
            Về đề đang làm
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {sets.map((s, si) => {
          const r = results[si];
          const isDone = !!r;
          const isCurrent = si === currentIndex && !isDone;
          const isFuture = si > currentIndex && !isDone;

          // Determine chip count.
          const count = r?.total ?? qCounts?.[si] ?? 0;

          let label = "";
          if (isDone) label = `Đề ${si + 1} · ${r!.correct}/${r!.total}`;
          else if (isCurrent) label = `Đề ${si + 1} · đang làm`;
          else label = `Đề ${si + 1} · chưa làm`;

          return (
            <div
              key={s.id}
              id={`marathon-nav-set-${si}`}
              className={cn(
                "rounded-md",
                isCurrent && "bg-primary/5 border border-primary/20 p-2",
                isFuture && "opacity-45",
              )}
            >
              <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">{label}</div>

              {count === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">—</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: count }).map((_, qi) => {
                    let state: "correct" | "wrong" | "empty" = "empty";
                    if (isDone) {
                      const q = r!.qResults?.[qi];
                      state = q ? (q.is_correct ? "correct" : "wrong") : "empty";
                    } else if (isCurrent && currentAnswered?.[qi]) {
                      // still "empty" (not graded yet) — leave gray
                    }

                    const isCurrentChip = isCurrent && currentQ === qi;
                    const dim = onlyWrong && isDone && state !== "wrong";

                    const clickable =
                      (isDone) ||
                      (isCurrent && allowJumpInCurrent && onJumpQuestion);

                    const cls =
                      state === "correct"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                        : state === "wrong"
                        ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                        : "bg-muted text-muted-foreground border-border";

                    return (
                      <button
                        key={qi}
                        type="button"
                        disabled={!clickable}
                        onClick={() => {
                          if (isDone) onReview(si, qi);
                          else if (isCurrent && allowJumpInCurrent) onJumpQuestion?.(qi);
                        }}
                        className={cn(
                          "w-[26px] h-[26px] rounded text-[11px] font-semibold border transition-colors",
                          cls,
                          isCurrentChip && "ring-2 ring-[#24085a] ring-offset-1",
                          dim && "opacity-25",
                          !clickable && "cursor-not-allowed",
                        )}
                        title={`Đề ${si + 1} · Câu ${qi + 1}`}
                      >
                        {qi + 1}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
