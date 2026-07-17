import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ListChecks, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readingPartLabel } from "@/hooks/useExamSets";
import { getSkillBand, toScaledScore } from "@/data/questions";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import SpeakingReviewPage from "@/components/history/SpeakingReviewPage";

import ReviewAnswerPanel, { type ReviewQuestion } from "@/components/history/ReviewAnswerPanel";
import ReviewErrorBoundary from "@/components/history/ReviewErrorBoundary";
import ReviewNavigator, { type PageStatus, type SkillMeta } from "@/components/history/ReviewNavigator";
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
  const [statuses, setStatuses] = useState<Record<number, PageStatus>>({});
  const [skillMeta, setSkillMeta] = useState<Record<string, SkillMeta>>({});
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);


  const current = pages[pageIdx];

  // Toggle body class so engine-internal exam controls hide via CSS.
  useEffect(() => {
    document.body.classList.add("history-review-mode");
    return () => {
      document.body.classList.remove("history-review-mode");
    };
  }, []);

  // Bulk-fetch page statuses (correctness per question) — snapshot-first, then
  // fall back to exam_question_results.is_correct. Only status data, no heavy content.
  useEffect(() => {
    if (!pages.length) return;
    let cancelled = false;
    (async () => {
      const trIds = Array.from(new Set(pages.map((p) => p.testResultId)));
      const [snapRes, eqrRes, wsrRes, ssrRes] = await Promise.all([
        supabase.from("test_results").select("id,review_snapshot").in("id", trIds),
        supabase
          .from("exam_question_results")
          .select("test_result_id,is_correct")
          .in("test_result_id", trIds),
        supabase
          .from("writing_skill_results")
          .select("test_result_id,parts,cefr")
          .in("test_result_id", trIds),

        supabase
          .from("speaking_skill_results")
          .select("test_result_id,parts")
          .in("test_result_id", trIds),
      ]);
      if (cancelled) return;
      const snapByTr: Record<string, any> = {};
      (snapRes.data || []).forEach((r: any) => {
        snapByTr[r.id] = r.review_snapshot;
      });
      const eqrByTr: Record<string, boolean[]> = {};
      (eqrRes.data || []).forEach((r: any) => {
        (eqrByTr[r.test_result_id] ||= []).push(!!r.is_correct);
      });
      // Writing/Speaking skill_results have ONE row per session whose test_result_id
      // points at the LAST part only. But that row's `parts` JSON contains ALL parts
      // (task1..task4 / part1..part4). Merge all fetched rows into a single parts map
      // per skill so every part page can look up its own rawPart by key.
      const wsrPartsMerged: Record<string, any> = {};
      let wsrCefrAny: string | null = null;
      (wsrRes.data || []).forEach((r: any) => {
        Object.assign(wsrPartsMerged, r.parts || {});
        if (!wsrCefrAny && typeof r.cefr === "string" && r.cefr) wsrCefrAny = r.cefr;
      });
      const ssrPartsMerged: Record<string, any> = {};
      (ssrRes.data || []).forEach((r: any) => {
        Object.assign(ssrPartsMerged, r.parts || {});
      });
      const extractPartNum = (s: string | undefined): number | null => {
        if (!s) return null;
        const m = s.match(/(\d+)/);
        return m ? Number(m[1]) : null;
      };
      const map: Record<number, PageStatus> = {};
      pages.forEach((p, i) => {
        const isAI = p.skill === "speaking" || p.skill === "writing";
        const snap = snapByTr[p.testResultId];
        const band =
          typeof snap?.band === "string" && snap.band ? (snap.band as string) : null;
        let items: PageStatus["items"] = [];
        let aiRaw: number | null = null;
        if (isAI) {
          // AI-graded parts: navigator shows a single neutral "open" entry per page.
          items = [];
          const num = extractPartNum(p.part);
          if (num) {
            const parts = p.skill === "writing" ? wsrPartsMerged : ssrPartsMerged;
            const key = p.skill === "writing" ? `task${num}` : `part${num}`;
            const raw = parts?.[key]?.rawPart;
            if (typeof raw === "number" && !Number.isNaN(raw)) {
              aiRaw = Math.min(30, Math.round(raw));
            }
          }

        } else if (Array.isArray(snap?.items) && snap.items.length > 0) {
          items = snap.items.map((it: any) => ({
            isCorrect: typeof it?.isCorrect === "boolean" ? it.isCorrect : null,
          }));
        } else {
          const rows = eqrByTr[p.testResultId] || [];
          items = rows.map((v) => ({ isCorrect: v }));
        }
        map[i] = { items, band, isAI, aiRaw };
      });
      setStatuses(map);

      // Per-skill band / converted score for the navigator skill headers.
      const groups: Record<string, number[]> = {};
      const order: string[] = [];
      pages.forEach((p, i) => {
        if (!groups[p.skill]) {
          groups[p.skill] = [];
          order.push(p.skill);
        }
        groups[p.skill].push(i);
      });
      const meta: Record<string, SkillMeta> = {};
      order.forEach((sk) => {
        const idxs = groups[sk];
        if (sk === "listening" || sk === "reading") {
          let correct = 0;
          let total = 0;
          idxs.forEach((i) => {
            const st = map[i];
            if (!st || st.isAI) return;
            total += st.items.length;
            correct += st.items.filter((it) => it.isCorrect === true).length;
          });
          if (total > 0) {
            const scale50 = toScaledScore(correct, total);
            meta[sk] = { band: getSkillBand(scale50, sk as any) };
          }
        } else if (sk === "grammar") {
          let correct = 0;
          let total = 0;
          idxs.forEach((i) => {
            const st = map[i];
            if (!st || st.isAI) return;
            total += st.items.length;
            correct += st.items.filter((it) => it.isCorrect === true).length;
          });
          if (total > 0) {
            meta[sk] = { score50: toScaledScore(correct, total) };
          }
        } else if (sk === "writing") {
          if (wsrCefrAny) meta[sk] = { band: wsrCefrAny };

        } else if (sk === "speaking") {
          const cefr = idxs.map((i) => map[i]?.band).find(Boolean) || null;
          if (cefr) meta[sk] = { band: cefr };
        }
      });
      setSkillMeta(meta);
    })();

    return () => {
      cancelled = true;
    };
  }, [pages]);


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

  // Ordered list of wrong-answer positions across all pages.
  const wrongList = useMemo(() => {
    const out: Array<{ pageIdx: number; qIdx: number }> = [];
    Object.entries(statuses).forEach(([pi, st]) => {
      if (!st || st.isAI) return;
      st.items.forEach((it, qi) => {
        if (it.isCorrect === false) out.push({ pageIdx: Number(pi), qIdx: qi });
      });
    });
    out.sort((a, b) => a.pageIdx - b.pageIdx || a.qIdx - b.qIdx);
    return out;
  }, [statuses]);

  const noWrongAvailable = onlyWrong && wrongList.length === 0;

  const handleJump = (pi: number, qi: number) => {
    setPageIdx(pi);
    setQIdx(qi);
    setDrawerOpen(false);
  };

  const handleNext = () => {
    if (onlyWrong && wrongList.length > 0) {
      const nxt = wrongList.find(
        (w) => w.pageIdx > pageIdx || (w.pageIdx === pageIdx && w.qIdx > qIdx),
      );
      if (nxt) {
        handleJump(nxt.pageIdx, nxt.qIdx);
      } else {
        onExit();
      }
      return;
    }
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
    if (onlyWrong && wrongList.length > 0) {
      const rev = [...wrongList].reverse();
      const prv = rev.find(
        (w) => w.pageIdx < pageIdx || (w.pageIdx === pageIdx && w.qIdx < qIdx),
      );
      if (prv) handleJump(prv.pageIdx, prv.qIdx);
      return;
    }
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
              disabled={atFirst || noWrongAvailable}
              className="gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Trước</span>
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={noWrongAvailable}
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
      <div className="lg:flex lg:items-stretch">
        <div key={fadeKey} className="flex-1 min-w-0 animate-in fade-in duration-200">
          <ReviewErrorBoundary label="Phần này của bài xem lại gặp lỗi hiển thị">
            {body}
          </ReviewErrorBoundary>
        </div>
        {/* Desktop right dock */}
        <div className="hidden lg:block w-[340px] shrink-0 sticky top-[49px] self-start h-[calc(100vh-49px)]">
          <ReviewNavigator
            pages={pages}
            statuses={statuses}
            skillMeta={skillMeta}
            currentPage={pageIdx}
            currentQ={qIdx}
            onlyWrong={onlyWrong}
            onToggleOnlyWrong={() => setOnlyWrong((v) => !v)}
            onJump={handleJump}
          />

        </div>
      </div>

      {/* Mobile FAB + drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-[#24085a] text-white shadow-lg text-xs font-semibold"
      >
        <ListChecks className="w-4 h-4" /> Mục lục
      </button>
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="w-80 max-w-[85vw] h-full bg-card shadow-xl">
            <ReviewNavigator
              pages={pages}
              statuses={statuses}
              skillMeta={skillMeta}
              currentPage={pageIdx}
              currentQ={qIdx}
              onlyWrong={onlyWrong}
              onToggleOnlyWrong={() => setOnlyWrong((v) => !v)}
              onJump={handleJump}
              onClose={() => setDrawerOpen(false)}
            />

          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryReviewPager;
