import { useState, useCallback } from "react";
import { ArrowLeft, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSkillBand, getLevelColor } from "@/data/questions";
import ListeningExamEngine, { type ListeningPartType } from "@/components/listening/ListeningExamEngine";
import { useListeningHighlightData } from "@/hooks/useListeningHighlightData";
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";

export interface ListeningFullPartResult {
  partType: ListeningPartType;
  correct: number;
  total: number;
  examSetId?: string | null;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
  answers: any[];
}

interface Props {
  parts: ListeningFullPartResult[];
  score50: number;
  onExit: () => void;
  onRetry: () => void;
}

const partLabel = (pt: ListeningPartType) => ({
  part1: "Part 1 – Word Recognition",
  part2: "Part 2 – Matching Information",
  part3: "Part 3 – Short Conversations",
  part4: "Part 4 – Monologues",
}[pt]);

const ListeningFullResults = ({ parts, score50, onExit, onRetry }: Props) => {
  const [view, setView] = useState<"summary" | "review">("summary");
  const [reviewPartIndex, setReviewPartIndex] = useState(0);
  const totalCorrect = parts.reduce((s, p) => s + p.correct, 0);
  const totalQuestions = parts.reduce((s, p) => s + p.total, 0);
  const band = getSkillBand(score50, "listening");

  const current = parts[reviewPartIndex];

  const { data: highlightData, status: highlightStatus } = useListeningHighlightData(
    current?.examSetId ?? null,
    current
      ? {
          partType: current.partType,
          part1Questions: current.part1Questions,
          part2Questions: current.part2Questions,
          part3Questions: current.part3Questions,
          part4Questions: current.part4Questions,
        }
      : null,
    view === "review",
  );


  if (view === "summary") {
    return (
      <div className="max-w-3xl mx-auto pb-10 space-y-6">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-2xl font-heading font-bold text-foreground mb-6">
            Kết quả Listening
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

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-heading font-bold text-foreground mb-4">
            Chi tiết bài làm
          </h3>
          <div className="space-y-3">
            {parts.map((p, i) => {
              const T = totalQuestions > 0 ? totalQuestions : p.total;
              const partScore = T > 0 ? Math.round((p.correct / T) * 50) : 0;
              const partMax = T > 0 ? Math.round((p.total / T) * 50) : 0;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                >
                  <span className="text-sm font-medium text-foreground">
                    {partLabel(p.partType)}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Số câu đúng: <span className="font-semibold text-foreground">{p.correct}/{p.total}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Điểm: <span className="font-semibold text-primary">{partScore}/{partMax}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="min-h-screen">
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

      <ListeningExamEngine
        key={`lreview-${reviewPartIndex}`}
        reviewMode
        skipIntro
        testTitle="Listening"
        timeLimit={0}
        partType={current.partType}
        initialAnswers={current.answers}
        part1Questions={current.part1Questions}
        part2Questions={current.part2Questions}
        part3Questions={current.part3Questions}
        part4Questions={current.part4Questions}
        examSetId={current.examSetId ?? null}
        highlightData={highlightData}
        highlightLoading={highlightStatus === "loading"}
        onExit={() => setView("summary")}
      />
    </div>
  );
};

export default ListeningFullResults;
