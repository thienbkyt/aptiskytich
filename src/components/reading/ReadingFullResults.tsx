import { useState } from "react";
import { ArrowLeft, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSkillBand, getLevelColor } from "@/data/questions";
import ReadingExamEngine, {
  type ReadingPartType,
  type ReadingAnswersState,
} from "@/components/reading/ReadingExamEngine";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";
import { useReadingReviewData } from "@/hooks/useReadingReviewData";

export interface ReadingFullPartResult {
  partType: ReadingPartType;
  correct: number;
  total: number;
  examSetId?: string | null;
  part1Question?: ReadingSentenceQuestion;
  part2Question?: ReadingCohesionQuestion;
  part3Question?: ReadingOpinionQuestion;
  part4Question?: ReadingLongQuestion;
  answers: Partial<ReadingAnswersState>;
}

interface Props {
  parts: ReadingFullPartResult[];
  score50: number;
  onExit: () => void;
  onRetry: () => void;
}

const partLabel = (pt: ReadingPartType) => ({
  part1: "Part 1 – Gap Fill",
  part2: "Part 2 – Text Cohesion",
  part3: "Part 3 – Opinion Matching",
  part4: "Part 4 – Long Reading",
}[pt]);

const ReadingFullResults = ({ parts, score50, onExit, onRetry }: Props) => {
  const [view, setView] = useState<"summary" | "review">("summary");
  const [reviewPartIndex, setReviewPartIndex] = useState(0);
  const totalCorrect = parts.reduce((s, p) => s + p.correct, 0);
  const totalQuestions = parts.reduce((s, p) => s + p.total, 0);
  const band = getSkillBand(score50, "reading");

  const current = parts[reviewPartIndex];
  const { data: reviewData, status: reviewStatus } = useReadingReviewData(
    current?.examSetId ?? null,
    current
      ? {
          partType: current.partType,
          part1Question: current.part1Question,
          part2Question: current.part2Question,
          part3Question: current.part3Question,
          part4Question: current.part4Question,
        }
      : null,
    view === "review",
  );


  if (view === "summary") {
    return (
      <div className="max-w-3xl mx-auto pb-10">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-2xl font-heading font-bold text-foreground mb-6">
            Kết quả Reading
          </h2>
          <div className="flex items-center justify-center gap-8 mt-4 flex-wrap">
            <div>
              <p className="text-4xl font-heading font-extrabold text-primary">{score50}/50</p>
              <p className="text-sm text-muted-foreground mt-1">Điểm</p>
            </div>
            <div>
              <p className={`text-4xl font-heading font-extrabold ${getLevelColor(band)}`}>{band}</p>
              <p className="text-sm text-muted-foreground mt-1">Trình độ</p>
            </div>
            <div>
              <p className="text-4xl font-heading font-extrabold text-foreground">
                {totalCorrect}/{totalQuestions}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Số câu đúng</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <Button variant="outline" onClick={onExit} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Thoát
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setReviewPartIndex(0); setView("review"); }}
              className="gap-2"
            >
              <Eye className="w-4 h-4" /> Xem lại từng câu →
            </Button>
            <Button onClick={onRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Làm lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const current = parts[reviewPartIndex];
  const { data: reviewData, status: reviewStatus } = useReadingReviewData(
    current?.examSetId ?? null,
    current
      ? {
          partType: current.partType,
          part1Question: current.part1Question,
          part2Question: current.part2Question,
          part3Question: current.part3Question,
          part4Question: current.part4Question,
        }
      : null,
    view === "review",
  );
  if (!current) return null;

  return (
    <div className="min-h-screen">
      {/* Top review bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setView("summary")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Quay lại kết quả
          </button>
          <div className="flex items-center gap-2">
            {parts.map((p, i) => (
              <button
                key={i}
                onClick={() => setReviewPartIndex(i)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  i === reviewPartIndex
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
              onClick={() => setReviewPartIndex((i) => Math.max(0, i - 1))}
              disabled={reviewPartIndex === 0}
            >
              ← Part trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewPartIndex((i) => Math.min(parts.length - 1, i + 1))}
              disabled={reviewPartIndex === parts.length - 1}
            >
              Part sau →
            </Button>
          </div>
        </div>
      </div>

      <ReadingExamEngine
        key={`review-part-${reviewPartIndex}`}
        reviewMode
        skipIntro
        testTitle="Reading"
        timeLimit={0}
        partType={current.partType}
        initialAnswers={current.answers}
        part1Question={current.part1Question}
        part2Question={current.part2Question}
        part3Question={current.part3Question}
        part4Question={current.part4Question}
        onExit={() => setView("summary")}
        reviewData={reviewData}
        reviewDataLoading={reviewStatus === "loading"}
      />
    </div>
  );
};

export default ReadingFullResults;
