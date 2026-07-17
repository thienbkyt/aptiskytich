import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { readingPartLabel } from "@/hooks/useExamSets";
import type { ReviewPage } from "./HistoryReviewPager";

export interface NavItemStatus {
  isCorrect: boolean | null; // true=correct, false=wrong, null=untouched/AI
}

export interface PageStatus {
  items: NavItemStatus[];
  band?: string | null;
  isAI: boolean;
  aiRaw?: number | null;
}

export interface SkillMeta {
  band?: string | null;
  score50?: number | null;
}



interface Props {
  pages: ReviewPage[];
  statuses: Record<number, PageStatus>;
  currentPage: number;
  currentQ: number;
  onlyWrong: boolean;
  onToggleOnlyWrong: () => void;
  onJump: (pageIdx: number, qIdx: number) => void;
  onClose?: () => void;
}

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

const ReviewNavigator = ({
  pages,
  statuses,
  currentPage,
  currentQ,
  onlyWrong,
  onToggleOnlyWrong,
  onJump,
  onClose,
}: Props) => {
  // Group pages by skill, preserving pager order.
  const groups: Record<string, number[]> = {};
  const order: string[] = [];
  pages.forEach((p, i) => {
    if (!groups[p.skill]) {
      groups[p.skill] = [];
      order.push(p.skill);
    }
    groups[p.skill].push(i);
  });

  let totalCorrect = 0;
  let totalWrong = 0;
  for (let i = 0; i < pages.length; i++) {
    const st = statuses[i];
    if (!st || st.isAI) continue;
    for (const it of st.items) {
      if (it.isCorrect === true) totalCorrect++;
      else if (it.isCorrect === false) totalWrong++;
    }
  }

  return (
    <aside className="w-full h-full bg-card/95 border-l border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">Mục lục xem lại</div>
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

      <div className="p-3 border-b border-border space-y-2">
        <div className="text-xs">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{totalCorrect} đúng</span>
          <span className="mx-1.5 text-muted-foreground">/</span>
          <span className="font-semibold text-red-700 dark:text-red-400">{totalWrong} sai</span>
          <span className="ml-1 text-muted-foreground">(tự chấm)</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWrong}
            onChange={onToggleOnlyWrong}
            className="rounded border-border"
          />
          Chỉ hiện câu sai
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {order.map((sk) => {
          const idxs = groups[sk];
          const firstAI = statuses[idxs[0]]?.isAI;
          const band = idxs.map((i) => statuses[i]?.band).find(Boolean) || null;
          return (
            <div key={sk}>
              <div className="text-xs font-semibold text-[#24085a] dark:text-primary mb-2 flex items-center gap-1.5">
                <span>{SKILL_LABELS[sk] || sk}</span>
                {firstAI && band ? (
                  <span className="text-muted-foreground font-normal">· {band}</span>
                ) : null}
              </div>
              <div className="space-y-2.5">
                {idxs.map((pi) => {
                  const p = pages[pi];
                  const st = statuses[pi];
                  const items = st?.items || [];
                  const partLabel =
                    sk === "reading" ? readingPartLabel(p.part) : p.part || "—";
                  const showEmpty = items.length === 0;
                  let scoreSuffix: string | null = null;
                  if (st?.isAI) {
                    if (typeof st.aiRaw === "number") scoreSuffix = `(${st.aiRaw}/30)`;
                  } else if (items.length > 0) {
                    const correct = items.reduce((n, it) => n + (it.isCorrect === true ? 1 : 0), 0);
                    scoreSuffix = `(${correct}/${items.length})`;
                  }
                  return (
                    <div key={pi}>
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {partLabel}
                        {scoreSuffix ? (
                          <span className="ml-1 text-secondary-foreground/60">{scoreSuffix}</span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {showEmpty ? (
                          <button
                            type="button"
                            onClick={() => onJump(pi, 0)}
                            className={cn(
                              "min-w-[32px] h-8 px-2 rounded text-xs font-medium border transition-all",
                              "bg-muted/60 text-foreground border-border hover:bg-muted",
                              currentPage === pi && "ring-2 ring-[#24085a] ring-offset-1",
                            )}
                          >
                            Mở
                          </button>
                        ) : (
                          items.map((it, qi) => {
                            const isCurrent = currentPage === pi && currentQ === qi;
                            const isWrong = it.isCorrect === false;
                            const dim = onlyWrong && !st?.isAI && !isWrong;
                            let cls =
                              "bg-muted text-muted-foreground border-transparent hover:bg-muted/80";
                            if (st?.isAI) {
                              cls =
                                "bg-muted/60 text-foreground border-border hover:bg-muted";
                            } else if (it.isCorrect === true) {
                              cls =
                                "bg-emerald-100 text-emerald-700 border-emerald-400 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/50";
                            } else if (it.isCorrect === false) {
                              cls =
                                "bg-rose-100 text-red-700 border-red-400 hover:bg-rose-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/50";
                            }
                            return (
                              <button
                                key={qi}
                                type="button"
                                onClick={() => onJump(pi, qi)}
                                className={cn(
                                  "w-8 h-8 rounded text-xs font-medium border transition-all",
                                  cls,
                                  isCurrent && "ring-2 ring-[#24085a] ring-offset-1",
                                  dim && "opacity-30",
                                )}
                                title={`${SKILL_LABELS[sk] || sk} · ${partLabel} · Câu ${qi + 1}`}
                              >
                                {qi + 1}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ReviewNavigator;
