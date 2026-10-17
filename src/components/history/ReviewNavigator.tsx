import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { readingPartLabel } from "@/hooks/useExamSets";
import type { ReviewPage } from "./HistoryReviewPager";

export interface NavItemStatus {
  isCorrect: boolean | null; // true=correct, false=wrong, null=untouched/AI
}

export interface PageStatus {
  items: NavItemStatus[];
  /** Optional override for navigator chips when the pager pages by a different
   *  unit than scored questions (e.g. Reading Part 2 pages by section). */
  navItems?: NavItemStatus[];
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
  skillMeta?: Record<string, SkillMeta>;
  currentPage: number;
  currentQ: number;
  onlyWrong: boolean;
  onToggleOnlyWrong: () => void;
  onJump: (pageIdx: number, qIdx: number) => void;
  onClose?: () => void;
  /** "sheet" = bottom sheet trên điện thoại (ô to, màu nhạt). Mặc định "dock" (máy tính, giữ nguyên). */
  variant?: "dock" | "sheet";
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
  skillMeta = {},
  currentPage,
  currentQ,
  onlyWrong,
  onToggleOnlyWrong,
  onJump,
  onClose,
  variant = "dock",
}: Props) => {
  const sheet = variant === "sheet";

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
  let hasObjective = false;
  for (let i = 0; i < pages.length; i++) {
    const st = statuses[i];
    if (!st || st.isAI) continue;
    if (st.items.length > 0) hasObjective = true;
    for (const it of st.items) {
      if (it.isCorrect === true) totalCorrect++;
      else if (it.isCorrect === false) totalWrong++;
    }
  }

  // Writing/Speaking are AI-graded — show band/score instead of correct/wrong counts.
  const aiSummary: string[] = [];
  if (!hasObjective) {
    for (const sk of order) {
      const meta = skillMeta[sk];
      const fb = groups[sk].map((i) => statuses[i]?.band).find(Boolean) || null;
      const band = meta?.band || fb;
      const parts = [band, meta?.score50 != null ? `${meta.score50}/50` : null].filter(Boolean);
      if (parts.length) aiSummary.push(`${SKILL_LABELS[sk] || sk}: ${parts.join(" · ")}`);
    }
  }

  if (sheet) {
    return (
      <div className="px-4 pb-5 pt-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[16px] font-bold text-foreground">Mục lục xem lại</p>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {hasObjective ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[12px] text-muted-foreground">
                <b className="block text-[18px] text-emerald-700 dark:text-emerald-400">{totalCorrect}</b>câu đúng
              </div>
              <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] text-muted-foreground">
                <b className="block text-[18px] text-rose-600 dark:text-rose-400">{totalWrong}</b>câu sai
              </div>
            </div>
            <label className="mb-3 flex cursor-pointer select-none items-center justify-between border-y border-border py-2.5 text-[13.5px] font-semibold text-foreground">
              Chỉ hiện câu sai
              <span className={cn("relative h-6 w-10 rounded-full transition-colors", onlyWrong ? "bg-exam-accent" : "bg-border")}>
                <span className={cn("absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all", onlyWrong ? "left-[19px]" : "left-[3px]")} />
              </span>
              <input type="checkbox" checked={onlyWrong} onChange={onToggleOnlyWrong} className="sr-only" />
            </label>
          </>
        ) : aiSummary.length > 0 ? (
          <div className="mb-3 space-y-1 rounded-xl bg-exam-accent/5 px-3 py-2.5 text-[13px]">
            {aiSummary.map((t) => (
              <div key={t} className="font-semibold text-foreground">{t}</div>
            ))}
            <div className="text-[12px] text-muted-foreground">Bài chấm AI — không tính đúng/sai từng câu.</div>
          </div>
        ) : null}

        <div className="space-y-4">
          {order.map((sk) => (
            <div key={sk} className="space-y-3">
              {groups[sk].map((pi) => {
                const p = pages[pi];
                const st = statuses[pi];
                const scoreItems = st?.items || [];
                const items = st?.navItems || scoreItems;
                const partLabel = sk === "reading" ? readingPartLabel(p.part) : p.part || "—";
                let suffix: string | null = null;
                if (st?.isAI) {
                  if (typeof st.aiRaw === "number") suffix = `${st.aiRaw}/30`;
                } else if (scoreItems.length > 0) {
                  suffix = `${scoreItems.filter((it) => it.isCorrect === true).length}/${scoreItems.length}`;
                }
                return (
                  <div key={pi}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="truncate font-bold text-foreground">
                        {SKILL_LABELS[sk] || sk} · <span className="font-semibold text-muted-foreground">{partLabel}</span>
                      </span>
                      {suffix && <span className="shrink-0 font-semibold text-muted-foreground">{suffix}</span>}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => onJump(pi, 0)}
                          className={cn(
                            "col-span-2 h-10 rounded-[10px] border border-exam-accent/20 bg-exam-accent/10 text-[12px] font-bold text-exam-accent",
                            currentPage === pi && "outline outline-2 outline-offset-1 outline-exam-accent",
                          )}
                        >
                          Mở
                        </button>
                      ) : (
                        items.map((it, qi) => {
                          const isCurrent = currentPage === pi && currentQ === qi;
                          const dim = onlyWrong && !st?.isAI && it.isCorrect !== false;
                          return (
                            <button
                              key={qi}
                              type="button"
                              onClick={() => onJump(pi, qi)}
                              className={cn(
                                "h-10 rounded-[10px] border text-[13px] font-bold tabular-nums",
                                st?.isAI
                                  ? "border-exam-accent/20 bg-exam-accent/10 text-exam-accent"
                                  : it.isCorrect === true
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : it.isCorrect === false
                                      ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                      : "border-border bg-background text-muted-foreground",
                                isCurrent && "outline outline-2 outline-offset-1 outline-exam-accent",
                                dim && "opacity-30",
                              )}
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
          ))}
        </div>
      </div>
    );
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

      {(hasObjective || aiSummary.length > 0) && (
        <div className="p-3 border-b border-border space-y-2">
          {hasObjective ? (
            <>
              <div className="text-xs">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{totalCorrect} đúng</span>
                <span className="mx-1.5 text-muted-foreground">/</span>
                <span className="font-semibold text-red-700 dark:text-red-400">{totalWrong} sai</span>
                <span className="ml-1 text-muted-foreground">(Điểm số)</span>
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
            </>
          ) : (
            <div className="text-xs space-y-1">
              {aiSummary.map((s) => (
                <div key={s} className="font-semibold text-foreground">{s}</div>
              ))}
              <div className="text-muted-foreground font-normal">Bài chấm AI — không tính đúng/sai từng câu.</div>
            </div>
          )}
        </div>
      )}


      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {order.map((sk) => {
          const idxs = groups[sk];
          const meta = skillMeta[sk];
          const fallbackBand = idxs.map((i) => statuses[i]?.band).find(Boolean) || null;
          return (
            <div key={sk}>
              <div className="text-xs font-semibold text-[#24085a] dark:text-primary mb-2 flex items-center gap-1.5">
                <span>{SKILL_LABELS[sk] || sk}</span>
                {meta?.band ? (
                  <span className="text-muted-foreground font-normal">· {meta.band}</span>
                ) : meta?.score50 != null ? (
                  <span className="text-muted-foreground font-normal">· {meta.score50}/50</span>
                ) : fallbackBand ? (
                  <span className="text-muted-foreground font-normal">· {fallbackBand}</span>
                ) : null}
              </div>

              <div className="space-y-2.5">
                {idxs.map((pi) => {
                  const p = pages[pi];
                  const st = statuses[pi];
                  const scoreItems = st?.items || [];
                  const items = st?.navItems || scoreItems;
                  const partLabel =
                    sk === "reading" ? readingPartLabel(p.part) : p.part || "—";
                  const showEmpty = items.length === 0;
                  let scoreSuffix: string | null = null;
                  if (st?.isAI) {
                    if (typeof st.aiRaw === "number") scoreSuffix = `(${st.aiRaw}/30)`;
                  } else if (scoreItems.length > 0) {
                    const correct = scoreItems.reduce((n, it) => n + (it.isCorrect === true ? 1 : 0), 0);
                    scoreSuffix = `(${correct}/${scoreItems.length})`;
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
                                "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 dark:bg-emerald-600 dark:border-emerald-500";
                            } else if (it.isCorrect === false) {
                              cls =
                                "bg-red-500 text-white border-red-600 hover:bg-red-600 dark:bg-red-600 dark:border-red-500";
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
