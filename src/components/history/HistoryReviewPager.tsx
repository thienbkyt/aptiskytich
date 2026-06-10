import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import SpeakingReviewPage from "@/components/history/SpeakingReviewPage";
import WritingFeedbackCard from "@/components/history/WritingFeedbackCard";
import ReviewAnswerPanel, { type ReviewQuestion } from "@/components/history/ReviewAnswerPanel";
import useReviewKeyboard from "@/hooks/useReviewKeyboard";


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

interface PageData {
  qResults: QResult[];
  questions: ReviewQuestion[];
}

interface Props {
  pages: ReviewPage[];
  initialPageIdx?: number;
  userId: string;
  onExit: () => void;
}

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

const HistoryReviewPager = ({ pages, initialPageIdx = 0, userId, onExit }: Props) => {
  const [pageIdx, setPageIdx] = useState(Math.min(initialPageIdx, Math.max(0, pages.length - 1)));
  const [dataByPage, setDataByPage] = useState<Record<string, PageData>>({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  const current = pages[pageIdx];

  // Toggle body class so engine-internal exam controls hide via CSS.
  useEffect(() => {
    document.body.classList.add("history-review-mode");
    return () => {
      document.body.classList.remove("history-review-mode");
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    if (dataByPage[current.testResultId]) return;
    let cancelled = false;
    setLoadingPage(true);
    (async () => {
      const { data: qr } = await supabase
        .from("exam_question_results")
        .select("exam_question_id,user_answer,is_correct")
        .eq("test_result_id", current.testResultId);
      const qResults = (qr || []) as QResult[];

      // Fetch question metadata (text, options, correct answer, explanation) for the panel.
      const qIds = qResults.map((r) => r.exam_question_id);
      let questions: ReviewQuestion[] = [];
      if (qIds.length > 0) {
        const { data: qs } = await supabase
          .from("exam_questions")
          .select("id,question_text,options,correct_answer,explanation,order_index,question_type,extra_data")
          .in("id", qIds);
        questions = (qs || []) as ReviewQuestion[];
      }
      if (cancelled) return;
      setDataByPage((prev) => ({
        ...prev,
        [current.testResultId]: { qResults, questions },
      }));
      setLoadingPage(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.testResultId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setFadeKey((k) => k + 1);
  }, [pageIdx]);

  const isFirst = pageIdx === 0;
  const isLast = pageIdx === pages.length - 1;
  const showPager = pages.length > 1;

  const handleNext = () => {
    if (isLast) onExit();
    else setPageIdx((p) => p + 1);
  };
  const handlePrev = () => {
    if (!isFirst) setPageIdx((p) => p - 1);
  };

  useReviewKeyboard({
    onPrev: !isFirst ? handlePrev : undefined,
    onNext: handleNext,
    onExit,
  });

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Không có nội dung để xem.</p>
      </div>
    );
  }

  const pageData = dataByPage[current.testResultId];
  const qResults = pageData?.qResults || [];
  const questions = pageData?.questions || [];

  const skillLabel = SKILL_LABELS[current.skill] || current.skill.toUpperCase();

  // Top sticky pager bar — neutral background with navy text so it doesn't compete
  // with the engine's navy header underneath.
  const pagerBar = (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" /> Đóng
          </button>
          <div className="hidden sm:block text-xs text-muted-foreground truncate">
            {showPager ? (
              <>
                <span className="font-bold text-foreground">
                  {pageIdx + 1}/{pages.length}
                </span>{" "}
                · <span className="text-[#24085a] font-semibold">{skillLabel}</span>
                {current.part ? <span className="ml-1 text-muted-foreground">{current.part}</span> : null}
              </>
            ) : (
              <>
                <span className="text-[#24085a] font-semibold">{skillLabel}</span>
                {current.part ? <span className="ml-1 text-muted-foreground">· {current.part}</span> : null}
              </>
            )}
          </div>
        </div>
        {showPager && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrev}
              disabled={isFirst}
              className="gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Trước</span>
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 bg-[#24085a] text-white hover:bg-[#24085a]/90"
            >
              <span className="hidden sm:inline">{isLast ? "Hoàn tất" : "Sau"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const loading = loadingPage && !pageData;

  const body =
    loading ? (
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
      <>
        {current.skill === "writing" && (
          <WritingFeedbackCard userId={userId} attemptCreatedAt={current.attemptCreatedAt} />
        )}
        <HistoryReviewRenderer
          key={current.testResultId}
          examSetId={current.examSetId}
          skill={current.skill}
          part={current.part}
          testTitle={current.testTitle}
          qResults={qResults}
          onExit={onExit}
        />
        {/* Answer key + explanation panel — the heart of the review UX. */}
        {questions.length > 0 && current.skill !== "writing" && (
          <div className="max-w-3xl mx-auto px-4 pb-24">
            <ReviewAnswerPanel
              questions={questions}
              qResults={qResults}
              title={`Đáp án & Giải thích — ${current.part || skillLabel}`}
            />
          </div>
        )}
      </>
    );


  return (
    <div className="min-h-screen bg-background">
      {pagerBar}
      <div key={fadeKey} className="animate-in fade-in duration-200">
        {body}
      </div>
    </div>
  );
};

export default HistoryReviewPager;
