import { Fragment, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

export interface ReviewQuestion {
  id: string;
  order_index: number;
  question_text: string;
  options: any;
  correct_answer: number | null;
  explanation: string | null;
  question_type?: string;
  extra_data?: any;
}

export interface ReviewQResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface Props {
  questions: ReviewQuestion[];
  qResults: ReviewQResult[];
  title?: string;
  defaultOpen?: boolean;
}

const optionLabel = (options: any, idx: number | null | undefined): string | null => {
  if (idx === null || idx === undefined || !Number.isFinite(idx)) return null;
  if (Array.isArray(options)) {
    const v = options[idx as number];
    return typeof v === "string" ? v : v != null ? String(v) : null;
  }
  return null;
};

const renderUserAnswer = (raw: string | null, options: any): string => {
  if (raw == null || raw === "") return "—";
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && optionLabel(options, n)) {
    return optionLabel(options, n) as string;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return "Đã trả lời (xem trên bài thi ở trên)";
    }
  } catch {
    /* not json */
  }
  return raw;
};

/** Parse stored user_answer; returns gap answers array if it's a gap-fill envelope. */
const parseGapAnswers = (raw: string | null): (number | null)[] | null => {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.answers)) return p.answers as (number | null)[];
  } catch {
    /* not json */
  }
  return null;
};

const isGapFill = (q: ReviewQuestion): boolean => {
  const gaps = q.extra_data?.gaps;
  return Array.isArray(gaps) && /\{\d+\}/.test(q.question_text || "");
};

const chipCorrect =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";
const chipWrong =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-destructive/10 text-destructive border border-destructive/20 line-through";
const chipBlank =
  "inline-flex items-center rounded px-1.5 py-0.5 mx-0.5 text-sm font-semibold bg-muted text-muted-foreground border border-border";

interface GapStats { correct: number; wrong: number; blank: number; total: number }

const renderGapFillPassage = (q: ReviewQuestion, userAnswers: (number | null)[] | null): { node: JSX.Element; stats: GapStats } => {
  const gaps: Array<{ options: string[]; correct: number }> = q.extra_data?.gaps || [];
  const parts = (q.question_text || "").split(/\{(\d+)\}/g);
  let correct = 0, wrong = 0, blank = 0, total = 0;

  const node = (
    <div className="text-base text-foreground leading-[2.2] whitespace-pre-line">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const gapIndex = parseInt(part, 10);
        const gap = gaps[gapIndex];
        if (!gap) return <span key={i} className="text-muted-foreground">{`{${gapIndex}}`}</span>;
        const isExample = !gap.options || gap.options.length === 0;
        const correctText = gap.options?.[gap.correct] ?? "";
        if (isExample) {
          // "done for you" — just show the example word if present, else placeholder
          return (
            <span key={i} className={chipCorrect} title="Ví dụ (đã cho sẵn)">
              {correctText || `{${gapIndex}}`}
            </span>
          );
        }
        total++;
        const userPick = userAnswers?.[gapIndex];
        const userText = userPick != null && Number.isFinite(userPick) ? gap.options[userPick as number] : null;
        if (userPick == null) {
          blank++;
          return (
            <Fragment key={i}>
              <span className={chipBlank}>—</span>
              <span className={chipCorrect}>{correctText}</span>
            </Fragment>
          );
        }
        if (userPick === gap.correct) {
          correct++;
          return <span key={i} className={chipCorrect}>{correctText}</span>;
        }
        wrong++;
        return (
          <Fragment key={i}>
            <span className={chipWrong}>{userText ?? "?"}</span>
            <span className={chipCorrect}>{correctText}</span>
          </Fragment>
        );
      })}
    </div>
  );

  return { node, stats: { correct, wrong, blank, total } };
};

const ReviewAnswerPanel = ({ questions, qResults, title = "Đáp án & Giải thích", defaultOpen = true }: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!questions.length) return null;

  const ansMap: Record<string, ReviewQResult> = {};
  qResults.forEach((r) => { ansMap[r.exam_question_id] = r; });

  const sorted = [...questions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Pre-compute summary across both gap-fill and normal questions.
  let correctCount = 0, wrongCount = 0, blankCount = 0;
  sorted.forEach((q) => {
    const r = ansMap[q.id];
    if (isGapFill(q)) {
      const userAns = parseGapAnswers(r?.user_answer ?? null);
      const gaps: Array<{ options: string[]; correct: number }> = q.extra_data?.gaps || [];
      gaps.forEach((g, gi) => {
        if (!g.options || g.options.length === 0) return;
        const pick = userAns?.[gi];
        if (pick == null) blankCount++;
        else if (pick === g.correct) correctCount++;
        else wrongCount++;
      });
    } else {
      const userRaw = r?.user_answer ?? null;
      const blank = userRaw == null || userRaw === "";
      if (blank) blankCount++;
      else if (r?.is_correct) correctCount++;
      else wrongCount++;
    }
  });

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#24085a]/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#24085a]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">{title}</p>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              <span className="text-emerald-600 font-medium">Đúng {correctCount}</span>
              <span className="text-destructive font-medium">Sai {wrongCount}</span>
              <span className="text-muted-foreground">Bỏ trống {blankCount}</span>
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {sorted.map((q, idx) => {
            const r = ansMap[q.id];
            const hasExplanation = !!q.explanation && q.explanation.trim().length > 0;

            if (isGapFill(q)) {
              const userAns = parseGapAnswers(r?.user_answer ?? null);
              const { node, stats } = renderGapFillPassage(q, userAns);
              const allOk = stats.wrong === 0 && stats.blank === 0;
              return (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {stats.blank === stats.total ? (
                        <MinusCircle className="w-5 h-5 text-muted-foreground" />
                      ) : allOk ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Câu {idx + 1} · <span className="text-emerald-600">Đúng {stats.correct}</span> · <span className="text-destructive">Sai {stats.wrong}</span> · Bỏ trống {stats.blank}
                      </p>
                      {node}
                      {hasExplanation && (
                        <div className="mt-3 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                          <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const userRaw = r?.user_answer ?? null;
            const isBlank = userRaw == null || userRaw === "";
            const ok = !!r?.is_correct && !isBlank;
            const userText = renderUserAnswer(userRaw, q.options);
            const correctText = optionLabel(q.options, q.correct_answer);

            return (
              <div key={q.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isBlank ? (
                      <MinusCircle className="w-5 h-5 text-muted-foreground" />
                    ) : ok ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Câu {idx + 1}</p>
                    {q.question_text && (
                      <p className="text-sm text-foreground mb-2 whitespace-pre-wrap break-words">{q.question_text}</p>
                    )}

                    <div className="grid sm:grid-cols-2 gap-2 mb-2">
                      <div className={`rounded-md px-3 py-2 text-xs ${
                        isBlank ? "bg-muted/60 text-muted-foreground"
                        : ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-destructive/5 text-destructive border border-destructive/20"
                      }`}>
                        <span className="font-semibold">Đáp án của bạn: </span>
                        <span className="break-words">{isBlank ? "Bỏ trống" : userText}</span>
                      </div>
                      {correctText && (
                        <div className="rounded-md px-3 py-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="font-semibold">Đáp án đúng: </span>
                          <span className="break-words">{correctText}</span>
                        </div>
                      )}
                    </div>

                    {hasExplanation && (
                      <div className="mt-2 border-l-2 border-[#24085a]/40 pl-3 py-1 bg-[#24085a]/5 rounded-r-md">
                        <p className="text-xs font-semibold text-[#24085a] mb-0.5">Giải thích</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewAnswerPanel;
