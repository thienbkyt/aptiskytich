import { useState, useEffect } from "react";
import type { WritingGradingResult } from "@/hooks/useExamGrading";
import { getLevelColor } from "@/data/questions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";
import WritingExamEngine, { type WritingPartType } from "@/components/writing/WritingExamEngine";
import type {
  WritingPart1Data,
  WritingPart2Data,
  WritingPart3Data,
  WritingPart4Data,
} from "@/data/writingQuestions";

interface Submission {
  partType: string;
  text: string;
  questions: string[];
}

export interface WritingFullReviewPart {
  partType: WritingPartType;
  partData: WritingPart1Data | WritingPart2Data | WritingPart3Data | WritingPart4Data;
  answers: {
    shortAnswers?: string[];
    textAnswer?: string;
    part3Answers?: string[];
    informalAnswer?: string;
    formalAnswer?: string;
  };
  grading: WritingGradingResult;
}

interface WritingFullResultsProps {
  results: WritingGradingResult[];
  score50: number;
  cefr?: string;
  onExit: () => void;
  submissions?: Submission[];
  parts?: WritingFullReviewPart[];
}

const partLabel = (pt: string) => {
  const m: Record<string, string> = { task1: "Part 1", task2: "Part 2", task3: "Part 3", task4: "Part 4" };
  return m[pt] || pt;
};

const WritingFullResults = ({ results, score50, cefr, onExit, parts = [] }: WritingFullResultsProps) => {
  const [view, setView] = useState<"summary" | "review">("summary");
  const [reviewIdx, setReviewIdx] = useState(0);
  const total100 = results.reduce((s, r) => s + (r.partScore || 0), 0);
  const band = cefr && cefr.length > 0 ? cefr : "—";
  const bandColor = getLevelColor(band);

  useEffect(() => {
    if (view === "review") {
      document.body.classList.add("history-review-mode");
      return () => document.body.classList.remove("history-review-mode");
    }
  }, [view]);

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
          <p className="text-sm text-muted-foreground">{"\n"}</p>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-1">Trình độ</p>
            <p className={`text-2xl font-bold ${bandColor}`}>{band}</p>
          </div>
        </div>

        {/* Chi tiết bài làm */}
        <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-3">
          <h3 className="text-base font-heading font-bold text-foreground mb-3">Chi tiết bài làm</h3>
          {results.map((r, i) => {
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{partLabel(r.partType)}</span>
                <span className="text-muted-foreground">
                  Điểm: <span className="font-semibold text-foreground">{r.partScore}/{r.maxPoints}</span>
                </span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2 leading-relaxed">
            {"\n"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {parts.length > 0 && (
            <button
              onClick={() => { setReviewIdx(0); setView("review"); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Xem lại bài làm & nhận xét chi tiết →
            </button>
          )}
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

  // ── Review view (engine per part with tab bar) ──
  const current = parts[reviewIdx];
  if (!current) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">Không có dữ liệu xem lại.</p>
        <Button onClick={() => setView("summary")}>← Quay lại tổng kết</Button>
      </div>
    );
  }

  const partData: any = current.partData;
  const engineProps: any = {};
  if (current.partType === "task1") engineProps.part1Data = partData;
  else if (current.partType === "task2") engineProps.part2Data = partData;
  else if (current.partType === "task3") engineProps.part3Data = partData;
  else if (current.partType === "task4") engineProps.part4Data = partData;

  return (
    <div className="min-h-screen">
      {/* Top review bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setView("summary")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Quay lại tổng kết
          </button>
          <div className="flex items-center gap-2">
            {parts.map((p, i) => (
              <button
                key={i}
                onClick={() => setReviewIdx(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  i === reviewIdx
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                {partLabel(p.partType)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewIdx((i) => Math.max(0, i - 1))}
              disabled={reviewIdx === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewIdx((i) => Math.min(parts.length - 1, i + 1))}
              disabled={reviewIdx === parts.length - 1}
            >
              Trang sau →
            </Button>
          </div>
        </div>
      </div>

      <WritingExamEngine
        key={`wreview-${reviewIdx}`}
        reviewMode
        skipIntro
        testTitle="Writing"
        timeLimit={0}
        partType={current.partType}
        initialAnswers={current.answers}
        gradingResult={current.grading}
        onExit={() => setView("summary")}
        {...engineProps}
      />
    </div>
  );
};

export default WritingFullResults;
