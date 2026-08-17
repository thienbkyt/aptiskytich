import { useRef } from "react";
import PracticeScoreReport, { PracticeScoreReportHandle } from "@/components/fulltest/PracticeScoreReport";

export default function __TestReport() {
  const ref = useRef<PracticeScoreReportHandle>(null);
  const scores = {
    listening: { correct: 30, total: 50 },
    reading: { correct: 35, total: 50 },
    speaking: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
    grammar: { correct: 28, total: 50 },
  } as any;
  const overrides = {
    speaking: { scale50: 38, cefr: "B1" },
    writing: { scale50: 42, cefr: "B2" },
  } as any;
  return (
    <div className="p-8 bg-neutral-100 min-h-screen">
      <button
        className="mb-4 px-4 py-2 bg-red-600 text-white rounded"
        onClick={() => ref.current?.download()}
      >
        Tải PNG
      </button>
      <PracticeScoreReport ref={ref} scores={scores} sessionId="test-session-123" overrides={overrides} />
      <div className="mt-4 text-center text-sm text-neutral-500">Test render only</div>
    </div>
  );
}

