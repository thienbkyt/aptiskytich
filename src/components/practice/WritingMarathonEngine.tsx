import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import WritingExamEngine, { type WritingPartType } from "@/components/writing/WritingExamEngine";
import ExamHeader from "@/components/exam/ExamHeader";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import { fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import {
  toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4,
} from "@/lib/examTransformers";
import MarathonNavigator from "@/components/practice/MarathonNavigator";
import { saveMarathonProgress, loadMarathonProgress, newMarathonSessionId } from "@/lib/marathonProgress";
import { upsertMarathonResult } from "@/lib/saveExamResult";

interface Props {
  sets: ExamSetRow[];
  partType: WritingPartType;
  skillLabel: string;
  onExit: () => void;
  resume?: boolean;
  persist?: boolean;
}

type Phase = "loading" | "exam";

type WritingAnswers = {
  shortAnswers: string[];
  textAnswer: string;
  part3Answers: string[];
  informalAnswer: string;
  formalAnswer: string;
};

const emptyAnswers = (): WritingAnswers => ({
  shortAnswers: [], textAnswer: "", part3Answers: [], informalAnswer: "", formalAnswer: "",
});

const isNonEmpty = (a: WritingAnswers | undefined): boolean => {
  if (!a) return false;
  const anyStr = (s?: string) => !!(s && s.trim());
  if (a.shortAnswers?.some(anyStr)) return true;
  if (a.part3Answers?.some(anyStr)) return true;
  return anyStr(a.textAnswer) || anyStr(a.informalAnswer) || anyStr(a.formalAnswer);
};

const HUGE_TIME = 24 * 60 * 60;

const partKey = (p: WritingPartType) =>
  p === "task1" ? "part1" : p === "task2" ? "part2" : p === "task3" ? "part3" : "part4";

const partName = (p: WritingPartType) =>
  p === "task1" ? "Part 1" : p === "task2" ? "Part 2" : p === "task3" ? "Part 3" : "Part 4";

const CHECKLISTS: Record<WritingPartType, string[]> = {
  task1: [
    "Mỗi câu trả lời đúng trọng tâm câu hỏi.",
    "Chính tả, ngữ pháp cụm từ đúng.",
    "Trả lời trong 1–5 từ.",
  ],
  task2: [
    "Trả lời đúng chủ đề, viết thành câu hoàn chỉnh.",
    "Đủ 20–30 từ.",
    "Ngữ pháp, chính tả chính xác.",
    "Từ vựng đa dạng, dùng đúng chỗ.",
    "Ý mạch lạc, giọng thân thiện.",
  ],
  task3: [
    "Đúng loại từng câu: kể kinh nghiệm / đưa lời khuyên / nêu quan điểm.",
    "Mỗi câu đủ 30–40 từ.",
    "Ngữ pháp chính xác.",
    "Giữ giọng casual; lời khuyên kiểu \"You should…\", tránh \"I strongly recommend that you…\".",
  ],
  task4: [
    "Email cho bạn ~40–50 từ, văn phong thân mật.",
    "Email cho chủ tịch club 120–150 từ, văn phong trang trọng.",
    "Hai email thể hiện rõ hai văn phong khác nhau.",
    "Đủ số từ; ngữ pháp, từ vựng chính xác.",
  ],
};

const Checklist = ({ partType }: { partType: WritingPartType }) => {
  const items = CHECKLISTS[partType];
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
        CHECKLIST VIẾT BÀI · {partName(partType).toUpperCase()}
      </p>
      <p className="text-sm italic text-muted-foreground mb-3">
        Điểm cao đến từ viết chính xác và đúng văn phong, không phải dùng từ khó, dựa vào checklist viết để được điểm tối đa nha!
      </p>
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground">
        {items.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Muốn sửa bài chi tiết và chấm band? Chuyển qua&nbsp;
        <span className="font-semibold block sm:inline">Luyện Part lẻ hoặc Full test</span>&nbsp;nhé.
      </p>
    </div>
  );
};

const WritingMarathonEngine = ({ sets, partType, skillLabel, onExit, resume = false, persist = true }: Props) => {
  const marathonKey = partKey(partType);
  const savedInit = resume && persist ? loadMarathonProgress("writing", marathonKey) : null;

  const [currentIndex, setCurrentIndex] = useState(savedInit?.currentIndex ?? 0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [engineData, setEngineData] = useState<any>(null);
  const [attempt, setAttempt] = useState(0);

  // Written answers per set id (persisted). Truthy entry with non-empty content = "written".
  const [answersMap, setAnswersMap] = useState<Record<string, WritingAnswers>>(() => (savedInit?.drafts as any) ?? {});
  // Snapshot of live answers for the current set — used to decide "written" on exit.
  const currentAnswersRef = useRef<WritingAnswers>(emptyAnswers());

  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const questionsCacheRef = useRef<Map<string, any[]>>(new Map());

  const buildEngineData = useCallback((questions: any[]) => {
    const data: any = { sourceQuestionIds: questions.map((q: any) => q.id) };
    switch (partType) {
      case "task1": data.part1Data = toWritingPart1(questions); break;
      case "task2": data.part2Data = toWritingPart2(questions); break;
      case "task3": data.part3Data = toWritingPart3(questions); break;
      case "task4": data.part4Data = toWritingPart4(questions); break;
    }
    return data;
  }, [partType]);

  // Load questions for the active set (or the reviewing set).
  const activeSetIndex = reviewIndex ?? currentIndex;
  useEffect(() => {
    if (activeSetIndex < 0 || activeSetIndex >= sets.length) return;
    const set = sets[activeSetIndex];
    const cached = questionsCacheRef.current.get(set.id);
    if (cached) {
      setEngineData(buildEngineData(cached));
      setPhase("exam");
      // prefetch neighbor
      const nextSet = sets[activeSetIndex + 1];
      if (nextSet && !questionsCacheRef.current.has(nextSet.id)) {
        fetchExamQuestions(nextSet.id).then((qs) => { questionsCacheRef.current.set(nextSet.id, qs); }).catch(() => {});
      }
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setEngineData(null);
    (async () => {
      try {
        const qs = await fetchExamQuestions(set.id);
        if (cancelled) return;
        questionsCacheRef.current.set(set.id, qs);
        setEngineData(buildEngineData(qs));
        setPhase("exam");
        const nextSet = sets[activeSetIndex + 1];
        if (nextSet && !questionsCacheRef.current.has(nextSet.id)) {
          fetchExamQuestions(nextSet.id).then((q2) => { if (!cancelled) questionsCacheRef.current.set(nextSet.id, q2); }).catch(() => {});
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [activeSetIndex, sets, buildEngineData, attempt]);

  // Commit current set's live answers into the persistent map (if non-empty).
  const commitCurrent = useCallback((idx: number) => {
    const setId = sets[idx]?.id;
    if (!setId) return;
    const a = currentAnswersRef.current;
    setAnswersMap((prev) => {
      const next = { ...prev };
      if (isNonEmpty(a)) next[setId] = a;
      else delete next[setId];
      if (persist) {
        saveMarathonProgress("writing", marathonKey, {
          currentIndex: idx,
          results: [],
          drafts: next as any,
          updatedAt: Date.now(),
        });
      }
      return next;
    });
  }, [sets, persist, marathonKey]);

  // Persist draft snapshot when leaving via unload.
  useEffect(() => {
    const onBeforeUnload = () => { commitCurrent(currentIndex); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [commitCurrent, currentIndex]);

  // "written" state per set → results array shape expected by navigator.
  const results = useMemo(() => {
    return sets.map((s) => (isNonEmpty(answersMap[s.id]) ? ({} as any) : undefined));
  }, [sets, answersMap]);

  const goToSet = (si: number) => {
    if (si < 0 || si >= sets.length) return;
    commitCurrent(currentIndex);
    setReviewIndex(null);
    setCurrentIndex(si);
    setAttempt((a) => a + 1);
    currentAnswersRef.current = emptyAnswers();
  };

  const openReview = (si: number) => {
    if (si < 0 || si >= sets.length) return;
    commitCurrent(currentIndex);
    setReviewIndex(si);
    setCurrentIndex(si);
    setAttempt((a) => a + 1);
  };

  const handleRetrySet = (si: number) => {
    if (si < 0 || si >= sets.length) return;
    const setId = sets[si]?.id;
    if (!setId) return;
    setAnswersMap((prev) => {
      const next = { ...prev };
      delete next[setId];
      if (persist) {
        saveMarathonProgress("writing", marathonKey, {
          currentIndex: si,
          results: [],
          drafts: next as any,
          updatedAt: Date.now(),
        });
      }
      return next;
    });
    currentAnswersRef.current = emptyAnswers();
    setReviewIndex(null);
    setCurrentIndex(si);
    setAttempt((a) => a + 1);
  };

  const handleExit = () => {
    commitCurrent(currentIndex);
    onExit();
  };

  const initialAnswers = useMemo(() => {
    const setId = sets[activeSetIndex]?.id;
    if (!setId) return undefined;
    return answersMap[setId];
  }, [sets, activeSetIndex, answersMap]);

  const isReviewingSet = reviewIndex !== null && !!answersMap[sets[reviewIndex]?.id];


  return (
    <div className="lg:flex lg:items-stretch min-h-screen">
      <div className="flex-1 min-w-0">
        {phase === "loading" || !engineData ? (
          <div className="min-h-screen flex flex-col">
            <ExamHeader skillLabel={skillLabel} partLabel={`Marathon · ${partName(partType)}`} onExit={handleExit} />
            <main className="flex-1 flex items-center justify-center">
              <div className="space-y-4 text-center">
                <TechSkeleton variant="circle" className="h-12 w-12 mx-auto" />
                <TechSkeleton variant="text" className="w-40 mx-auto" />
              </div>
            </main>
          </div>
        ) : (
          <WritingExamEngine
            key={`${attempt}-${activeSetIndex}-${reviewIndex ?? "live"}`}
            partType={partType}
            testTitle={`${partName(partType)} · Đề ${activeSetIndex + 1}/${sets.length}`}
            timeLimit={HUGE_TIME}
            skipIntro
            hideTimer
            hideBottomNav
            allowReveal
            onExit={handleExit}
            onMarathonFinish={handleExit}
            initialAnswers={initialAnswers}
            onAnswersChange={(a) => { currentAnswersRef.current = a; }}
            reviewMode={isReviewingSet}
            belowContent={<Checklist partType={partType} />}
            {...engineData}
          />
        )}
      </div>


      <MarathonNavigator
        sets={sets}
        results={results as any}
        currentIndex={currentIndex}
        reviewingIndex={reviewIndex}
        mode="writing"
        onReview={(si) => openReview(si)}
        onEnterSet={(si) => goToSet(si)}
        onRetrySet={(si) => handleRetrySet(si)}
      />
    </div>
  );
};

export default WritingMarathonEngine;
