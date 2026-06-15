import { useState } from "react";
import type { WritingGradingResult } from "@/hooks/useExamGrading";
import { getSkillBand, getLevelColor } from "@/data/questions";

interface Submission {
  partType: string;
  text: string;
  questions: string[];
}

interface WritingFullResultsProps {
  results: WritingGradingResult[];
  score50: number;
  onExit: () => void;
  submissions?: Submission[];
}

const partLabel = (pt: string) => {
  const m: Record<string, string> = { task1: "Part 1", task2: "Part 2", task3: "Part 3", task4: "Part 4" };
  return m[pt] || pt;
};

const WritingFullResults = ({ results, score50, onExit, submissions = [] }: WritingFullResultsProps) => {
  const [view, setView] = useState<"summary" | "review">("summary");
  const total100 = results.reduce((s, r) => s + (r.partScore || 0), 0);
  const band = getSkillBand(score50, "writing");
  const bandColor = getLevelColor(band);

  // ── Summary view ──
  if (view === "summary") {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-6">
        <div className="w-16 h-16 mx-auto mb-2 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl">✍️</span>
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Kết quả Writing</h2>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-4">
          <div className="inline-block px-6 py-3 rounded-full text-3xl font-bold bg-primary/10 text-primary">
            {score50}/50
          </div>
          <p className="text-sm text-muted-foreground">Tổng {total100}/100</p>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-1">Trình độ</p>
            <p className={`text-2xl font-bold ${bandColor}`}>{band}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setView("review")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Xem lại bài làm & nhận xét chi tiết →
          </button>
          <button
            onClick={onExit}
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Thoát
          </button>
        </div>
      </div>
    );
  }

  // ── Review view ──
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView("summary")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          ← Quay lại tổng kết
        </button>
        <span className="text-sm text-muted-foreground">|</span>
        <span className="text-sm font-medium text-foreground">Xem lại bài làm</span>
      </div>

      {results.map((r, idx) => {
        const sub = submissions[idx];
        const allErrors = [
          ...(r.grammarErrors || []).map((e) => ({ ...e, kind: "Ngữ pháp" })),
          ...(r.spellingErrors || []).map((e) => ({ ...e, kind: "Chính tả" })),
        ];
        const hasPenalties =
          (r.wordPenaltyPercent || 0) > 0 ||
          (r.coherencePenaltyPercent || 0) > 0 ||
          (r.openingClosingPenalty || 0) > 0;

        return (
          <div key={idx} className="bg-card border border-border rounded-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-heading font-bold text-foreground">{partLabel(r.partType)}</h3>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
                {r.partScore}/{r.maxPoints}
              </span>
            </div>

            {/* Prompt */}
            {sub && sub.questions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Đề bài</p>
                <div className="text-sm text-foreground bg-muted/40 rounded-xl p-4 space-y-1">
                  {sub.questions.map((q, i) => (
                    <p key={i} className="leading-relaxed">{q}</p>
                  ))}
                </div>
              </div>
            )}

            {/* User text */}
            {sub && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Bài làm của bạn</p>
                <div className="text-sm text-foreground bg-muted/60 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {sub.text || <span className="italic text-muted-foreground">(Không có nội dung)</span>}
                </div>
              </div>
            )}

            {/* Feedback */}
            {r.feedback && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Nhận xét</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.feedback}</p>
              </div>
            )}

            {/* Penalties */}
            {hasPenalties && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Các khoản trừ</p>
                <div className="flex flex-wrap gap-2">
                  {(r.wordPenaltyPercent || 0) > 0 && (
                    <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                      Phạt thiếu/tăng từ: −{r.wordPenaltyPercent}%
                    </span>
                  )}
                  {(r.coherencePenaltyPercent || 0) > 0 && (
                    <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                      Trừ mạch lạc: −{r.coherencePenaltyPercent}%
                    </span>
                  )}
                  {(r.openingClosingPenalty || 0) > 0 && (
                    <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                      Thiếu opening/closing: −{r.openingClosingPenalty}đ
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Errors */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lỗi cần sửa</p>
              {allErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Không phát hiện lỗi ngữ pháp/chính tả.</p>
              ) : (
                <div className="space-y-3">
                  {allErrors.map((m, i) => (
                    <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">{m.kind}</p>
                      <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">&ldquo;{m.original}&rdquo;</p>
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ &ldquo;{m.corrected}&rdquo;</p>
                      <p className="text-xs text-muted-foreground">{m.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-center pt-2 pb-8">
        <button
          onClick={() => setView("summary")}
          className="bg-muted hover:bg-muted/80 text-foreground px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          ← Quay lại tổng kết
        </button>
      </div>
    </div>
  );
};

export default WritingFullResults;
