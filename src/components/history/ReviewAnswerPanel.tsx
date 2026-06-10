import { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReviewQuestion {
  id: string;
  order_index: number;
  question_text: string;
  options: any;
  correct_answer: number | null;
  explanation: string | null;
  question_type?: string;
}

export interface ReviewQResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface Props {
  questions: ReviewQuestion[];
  qResults: ReviewQResult[];
  /** Title shown at top of the panel. */
  title?: string;
  /** When true, panel is expanded by default. */
  defaultOpen?: boolean;
}

/** Render the option text for a given option index, or null if unavailable. */
const optionLabel = (options: any, idx: number | null | undefined): string | null => {
  if (idx === null || idx === undefined || !Number.isFinite(idx)) return null;
  if (Array.isArray(options)) {
    const v = options[idx as number];
    return typeof v === "string" ? v : v != null ? String(v) : null;
  }
  return null;
};

/** Try to render user's stored answer as a human-readable string. */
const renderUserAnswer = (raw: string | null, options: any): string => {
  if (raw == null || raw === "") return "—";
  // Numeric MCQ index?
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && optionLabel(options, n)) {
    return optionLabel(options, n) as string;
  }
  // JSON envelope — show compact preview, not raw JSON.
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

const ReviewAnswerPanel = ({ questions, qResults, title = "Đáp án & Giải thích", defaultOpen = true }: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!questions.length) return null;

  const ansMap: Record<string, ReviewQResult> = {};
  qResults.forEach((r) => {
    ansMap[r.exam_question_id] = r;
  });

  const sorted = [...questions].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const correctCount = sorted.filter((q) => ansMap[q.id]?.is_correct).length;
  const attemptedCount = sorted.filter((q) => {
    const a = ansMap[q.id]?.user_answer;
    return a != null && a !== "";
  }).length;
  const blankCount = sorted.length - attemptedCount;
  const wrongCount = attemptedCount - correctCount;

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
        {open ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {sorted.map((q, idx) => {
            const r = ansMap[q.id];
            const userRaw = r?.user_answer ?? null;
            const isBlank = userRaw == null || userRaw === "";
            const ok = !!r?.is_correct && !isBlank;
            const userText = renderUserAnswer(userRaw, q.options);
            const correctText = optionLabel(q.options, q.correct_answer);
            const hasExplanation = !!q.explanation && q.explanation.trim().length > 0;

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
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Câu {idx + 1}
                    </p>
                    {q.question_text && (
                      <p className="text-sm text-foreground mb-2 whitespace-pre-wrap break-words">
                        {q.question_text}
                      </p>
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
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {q.explanation}
                        </p>
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
