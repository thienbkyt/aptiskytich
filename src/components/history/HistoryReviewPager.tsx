import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readingPartLabel } from "@/hooks/useExamSets";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import SpeakingReviewPage from "@/components/history/SpeakingReviewPage";

import ReviewAnswerPanel, { type ReviewQuestion } from "@/components/history/ReviewAnswerPanel";
import ReviewErrorBoundary from "@/components/history/ReviewErrorBoundary";
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
  const [qIdx, setQIdx] = useState(0);
  const [partPageCount, setPartPageCount] = useState(1);
  const enterAtLastRef = useRef(false);
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
    setPartPageCount(1);
  }, [pageIdx]);

  // When new part announces its page count, snap to last if we navigated back.
  useEffect(() => {
    if (enterAtLastRef.current) {
      setQIdx(Math.max(0, partPageCount - 1));
      enterAtLastRef.current = false;
    }
  }, [partPageCount]);

  const isFirst = pageIdx === 0;
  const isLast = pageIdx === pages.length - 1;
  const showPager = pages.length > 1 || partPageCount > 1;
  const atFirst = isFirst && qIdx === 0;
  const atLast = isLast && qIdx >= partPageCount - 1;

  const handleNext = () => {
    if (qIdx < partPageCount - 1) {
      setQIdx((i) => i + 1);
    } else if (pageIdx < pages.length - 1) {
      setQIdx(0);
      setPageIdx((p) => p + 1);
    } else {
      onExit();
    }
  };
  const handlePrev = () => {
    if (qIdx > 0) {
      setQIdx((i) => i - 1);
    } else if (pageIdx > 0) {
      enterAtLastRef.current = true;
      setPageIdx((p) => p - 1);
    }
  };

  useReviewKeyboard({
    onPrev: !atFirst ? handlePrev : undefined,
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
  const displayPart = current.skill === "reading" ? readingPartLabel(current.part) : current.part;

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
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground truncate">
            <span className="font-bold text-foreground">
              {pageIdx + 1}/{pages.length}
            </span>
            <span>·</span>
            <span className="text-[#24085a] font-semibold">{skillLabel}</span>
            {displayPart ? <span className="ml-1 text-muted-foreground">{displayPart}</span> : null}
            {partPageCount > 1 && (
              <span className="ml-2 text-muted-foreground">
                · Câu <span className="font-semibold text-foreground">{qIdx + 1}/{partPageCount}</span>
              </span>
            )}
          </div>
        </div>
        {showPager && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrev}
              disabled={atFirst}
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
              <span className="hidden sm:inline">{atLast ? "Hoàn tất" : "Sau"}</span>
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
        key={`${current.testResultId}-speaking`}
        userId={userId}
        examSetId={current.examSetId}
        attemptCreatedAt={current.attemptCreatedAt}
        testTitle={current.testTitle}
        partLabel={displayPart || "Speaking"}
        testResultId={current.testResultId}
        onExit={onExit}
        questionIndex={qIdx}
        onQuestionCount={setPartPageCount}
      />
    ) : (
      <>
        <HistoryReviewRenderer
          key={`${current.testResultId}-${qIdx}`}
          examSetId={current.examSetId}
          skill={current.skill}
          part={current.part}
          testTitle={current.testTitle}
          qResults={qResults}
          userId={userId}
          attemptCreatedAt={current.attemptCreatedAt}
          testResultId={current.testResultId}
          onExit={onExit}
          initialSection={qIdx}
          pageBase={0}
          pageTotal={partPageCount}
          onPageCount={setPartPageCount}
        />
        {/* Answer key + explanation panel — hidden for listening/reading (engine shows answers inline). */}
        {questions.length > 0 && current.skill !== "writing" && current.skill !== "listening" && current.skill !== "reading" && current.skill !== "grammar" && (
          <div className="max-w-3xl mx-auto px-4 pb-24">
            <ReviewAnswerPanel
              questions={questions}
              qResults={qResults}
              title={`Đáp án & Giải thích — ${displayPart || skillLabel}`}
            />
          </div>
        )}
      </>
    );


  return (
    <div className="min-h-screen bg-background">
      {pagerBar}
      <div key={fadeKey} className="animate-in fade-in duration-200">
        <ReviewErrorBoundary label="Phần này của bài xem lại gặp lỗi hiển thị">
          {body}
        </ReviewErrorBoundary>
      </div>

    </div>
  );
};

export default HistoryReviewPager;
