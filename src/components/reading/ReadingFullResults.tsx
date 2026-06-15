import { useState } from "react";
import { ArrowLeft, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSkillBand, getLevelColor } from "@/data/questions";
import ReadingResults from "@/components/reading/ReadingResults";
import type { ReadingPartType, ReadingAnswersState } from "@/components/reading/ReadingExamEngine";
import type {
  ReadingSentenceQuestion,
  ReadingCohesionQuestion,
  ReadingOpinionQuestion,
  ReadingLongQuestion,
} from "@/data/readingQuestions";

export interface ReadingFullPartResult {
  partType: ReadingPartType;
  correct: number;
  total: number;
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
  const totalCorrect = parts.reduce((s, p) => s + p.correct, 0);
  const totalQuestions = parts.reduce((s, p) => s + p.total, 0);
  const band = getSkillBand(score50, "reading");

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
            <Button variant="secondary" onClick={() => setView("review")} className="gap-2">
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

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView("summary")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          ← Quay lại kết quả
        </button>
        <span className="text-sm font-medium text-foreground">Xem lại bài làm</span>
      </div>

      {parts.map((p, idx) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-heading font-bold text-foreground">{partLabel(p.partType)}</h3>
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
              {p.correct}/{p.total}
            </span>
          </div>
          <ReadingResults
            detailOnly
            correct={p.correct}
            total={p.total}
            partLabel={partLabel(p.partType)}
            onExit={() => {}}
            onRetry={() => {}}
            partType={p.partType}
            part1Question={p.part1Question}
            part1Answers={p.answers.p1}
            part2Question={p.part2Question}
            part2Placements={p.answers.p2}
            part3Question={p.part3Question}
            part3Answers={p.answers.p3}
            part4Question={p.part4Question}
            part4Answers={p.answers.p4}
          />
        </div>
      ))}

      <div className="flex items-center justify-center pt-2">
        <Button variant="outline" onClick={() => setView("summary")}>
          ← Quay lại kết quả
        </Button>
      </div>
    </div>
  );
};

export default ReadingFullResults;
