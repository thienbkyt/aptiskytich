import { useRef } from "react";
import PracticeScoreReport, { type PracticeScoreReportHandle } from "@/components/fulltest/PracticeScoreReport";

const SAMPLE_SCORES = {
  grammar: { correct: 18, total: 25 },
  listening: { correct: 30, total: 50 },
  reading: { correct: 35, total: 50 },
  speaking: { correct: 0, total: 0 },
  writing: { correct: 0, total: 0 },
};

const SAMPLE_OVERRIDES = {
  speaking: { scale50: 32, cefr: "B1" },
  writing: { scale50: 28, cefr: "B1" },
};

export default function __TestReport() {
  const ref = useRef<PracticeScoreReportHandle>(null);

  return (
    <div className="p-8 bg-background min-h-screen">
      <button
        className="mb-6 px-4 py-2 bg-primary text-white rounded-md font-semibold"
        onClick={() => ref.current?.download()}
      >
        Tải phiếu điểm PNG
      </button>
      <PracticeScoreReport
        ref={ref}
        scores={SAMPLE_SCORES}
        sessionId="test-session-123"
        overrides={SAMPLE_OVERRIDES}
      />
    </div>
  );
}
