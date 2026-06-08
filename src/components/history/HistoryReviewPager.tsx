import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import SpeakingReviewPage from "@/components/history/SpeakingReviewPage";

export interface ReviewPage {
  testResultId: string;
  examSetId: string;
  skill: string; // normalized: grammar | reading | listening | writing | speaking
  part: string;
  testTitle: string;
  attemptCreatedAt: string;
}

interface QResult {
  exam_question_id: string;
  user_answer: string | null;
  is_correct: boolean;
}

interface Props {
  pages: ReviewPage[];
  initialPageIdx?: number;
  userId: string;
  onExit: () => void;
}

const HistoryReviewPager = ({ pages, initialPageIdx = 0, userId, onExit }: Props) => {
  const [pageIdx, setPageIdx] = useState(Math.min(initialPageIdx, Math.max(0, pages.length - 1)));
  // Cache per-page qResults
  const [qResultsByPage, setQResultsByPage] = useState<Record<string, QResult[]>>({});
  const [loadingPage, setLoadingPage] = useState(false);

  const current = pages[pageIdx];

  useEffect(() => {
    if (!current) return;
    if (qResultsByPage[current.testResultId]) return;
    let cancelled = false;
    setLoadingPage(true);
    (async () => {
      const { data } = await supabase
        .from("exam_question_results")
        .select("exam_question_id,user_answer,is_correct")
        .eq("test_result_id", current.testResultId);
      if (cancelled) return;
      setQResultsByPage((prev) => ({ ...prev, [current.testResultId]: (data || []) as any }));
      setLoadingPage(false);
    })();
    return () => { cancelled = true; };
  }, [current?.testResultId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pageIdx]);

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Không có nội dung để xem.</p>
      </div>
    );
  }

  const isFirst = pageIdx === 0;
  const isLast = pageIdx === pages.length - 1;
  const showPager = pages.length > 1;

  const qResults = qResultsByPage[current.testResultId] || [];

  const handleNext = () => {
    if (isLast) onExit();
    else setPageIdx((p) => p + 1);
  };
  const handlePrev = () => {
    if (!isFirst) setPageIdx((p) => p - 1);
  };

  const pagerBar = showPager ? (
    <div className="sticky top-0 z-30 bg-[#24085a] text-white px-4 py-2 flex items-center justify-between gap-3">
      <div className="text-xs">
        <span className="opacity-70">Xem lại</span>{" "}
        <span className="font-bold">{pageIdx + 1}/{pages.length}</span>
        <span className="opacity-70"> – {current.skill.toUpperCase()} {current.part}</span>
      </div>
      <div className="flex items-center gap-2">
        {!isFirst && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrev}
            className="gap-1 bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleNext}
          className="gap-1 bg-white text-[#24085a] hover:bg-white/90"
        >
          {isLast ? "Hoàn tất" : "Next"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  ) : null;

  const body = loadingPage && !qResultsByPage[current.testResultId] ? (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ) : current.skill === "speaking" ? (
    <SpeakingReviewPage
      userId={userId}
      examSetId={current.examSetId}
      attemptCreatedAt={current.attemptCreatedAt}
      testTitle={current.testTitle}
      partLabel={current.part || "Speaking"}
      onExit={onExit}
    />
  ) : (
    <HistoryReviewRenderer
      key={current.testResultId}
      examSetId={current.examSetId}
      skill={current.skill}
      part={current.part}
      testTitle={current.testTitle}
      qResults={qResults}
      onExit={onExit}
    />
  );

  return (
    <div className="min-h-screen">
      {pagerBar}
      {body}
    </div>
  );
};

export default HistoryReviewPager;
