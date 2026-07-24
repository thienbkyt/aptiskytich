import { useState, useMemo, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Search, Clock, Shuffle, ArrowRight, Loader2, Infinity as InfinityIcon, Inbox } from "lucide-react";
import { motion } from "framer-motion";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";
import ListeningMarathonEngine from "@/components/practice/ListeningMarathonEngine";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { ListeningPartType } from "@/components/listening/ListeningExamEngine";
import { toast } from "sonner";
import { useExamSets, fetchExamQuestions, normalizePart, isNewSet, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4 } from "@/lib/examTransformers";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useUserMarathonProgress } from "@/hooks/useUserMarathonProgress";
import { saveTestResult } from "@/lib/testResults";
import { saveExamResult } from "@/lib/saveExamResult";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";
import { loadMarathonProgress, loadMarathonLast, clearMarathonProgress } from "@/lib/marathonProgress";
import { useExamPriorityLabels } from "@/hooks/useExamPriorityLabels";
import PriorityBadge from "@/components/practice/PriorityBadge";
import PriorityFilter, { type PriorityFilterValue } from "@/components/practice/PriorityFilter";

const PARTS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "part1" as const, label: "Part 1", subtitle: "Word recognition (Câu 1 - 13)" },
  { id: "part2" as const, label: "Part 2", subtitle: "Matching information (Câu 14)" },
  { id: "part3" as const, label: "Part 3", subtitle: "Short conversations (Câu 15)" },
  { id: "part4" as const, label: "Part 4", subtitle: "Monologues" },
];

const LISTENING_TIME: Record<string, number> = {
  part1: 480,
  part2: 600,
  part3: 600,
  part4: 720,
};

interface ExamState {
  active: boolean;
  partType: ListeningPartType;
  testTitle: string;
  showResults: boolean;
  correct: number;
  total: number;
  engineData?: any;
  loadingExam: boolean;
  examSetId?: string | null;
  startedAt?: number;
  skipIntro?: boolean;
}

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const Listening = () => {
  usePageMeta({
    title: "Luyện Listening Aptis — 4 parts, audio chuẩn đề thật | Aptis Kỳ Tích",
    description: "Luyện Listening Aptis 4 parts với audio chuẩn đề thật. Giới hạn 2 lần nghe mỗi câu, có script và giải thích sau khi nộp bài.",
    path: "/listening",
  });
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("listening");
  const { guard, isLocked, LockModal } = useExamAccessGate();
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("listening");
  const { progress } = useUserExamProgress();
  const { progress: marathonProgress } = useUserMarathonProgress("listening");
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "part1", testTitle: "", showResults: false,
    correct: 0, total: 0, loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });
  const [marathon, setMarathon] = useState<{ active: boolean; partType: ListeningPartType; keyId?: string | null; prio?: string | null; resume?: boolean; retryWrongSetIds?: string[]; wrongQuestionIdsBySet?: Record<string, string[]>; priorityLabel?: "high" | "medium" | "low" | null; setIds?: string[] | null }>({
    active: false, partType: "part1", keyId: null, prio: null, priorityLabel: null,
  });
  const [progressTick, setProgressTick] = useState(0);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>("all");
  const { labels: priorityLabels } = useExamPriorityLabels();
  const [keySetIds, setKeySetIds] = useState<Set<string> | null>(null);
  const [keyPrio, setKeyPrio] = useState<Map<string, string>>(new Map());
  const { user: authUser, loading: authLoading } = useAuth();

  // Rehydrate engineData after remount (HMR / Fast Refresh) if exam was active.
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return;
    if (!exam.active || exam.engineData) return;
    if (exam.examSetId) {
      if (loading) return;
      const target = examSets.find((s) => s.id === exam.examSetId);
      if (target) {
        rehydratedRef.current = true;
        handleStartFromDB(target, { skipIntro: exam.skipIntro });
      }
    } else {
      rehydratedRef.current = true;
    }
  }, [exam.active, exam.engineData, exam.examSetId, exam.partType, examSets, loading]);

  const [searchParams, setSearchParams] = useSearchParams();
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    const setId = searchParams.get("set");
    const jump = searchParams.get("jump") === "1";
    if (!setId || loading || autoStartedRef.current === setId) return;
    const target = examSets.find((s) => s.id === setId);
    if (target) {
      autoStartedRef.current = setId;
      handleStartFromDB(target, { skipIntro: jump });
      const next = new URLSearchParams(searchParams);
      next.delete("set");
      next.delete("jump");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, examSets, loading]);

  // Auto-start marathon via ?marathon=partN(&keyId=<uuid>)
  const marathonAutoRef = useRef<string | null>(null);
  useEffect(() => {
    const mp = searchParams.get("marathon");
    if (!mp) return;
    const keyId = searchParams.get("keyId");
    const prio = searchParams.get("prio");
    const token = `${mp}|${keyId ?? ""}|${prio ?? ""}`;
    if (marathonAutoRef.current === token) return;
    marathonAutoRef.current = token;
    setMarathon({ active: true, partType: mp as ListeningPartType, keyId: keyId || null, prio: prio || null });
    const next = new URLSearchParams(searchParams);
    next.delete("marathon");
    next.delete("keyId");
    next.delete("prio");
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  useEffect(() => {
    if (!marathon.keyId) { setKeySetIds(null); setKeyPrio(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("prediction_items")
        .select("exam_set_id, priority")
        .eq("key_id", marathon.keyId);
      if (cancelled) return;
      const rows = (data ?? []) as any[];
      setKeySetIds(new Set(rows.map((r) => r.exam_set_id)));
      const m = new Map<string, string>();
      rows.forEach((r) => { if (r.exam_set_id && r.priority) m.set(r.exam_set_id, r.priority); });
      setKeyPrio(m);
    })();
    return () => { cancelled = true; };
  }, [marathon.keyId]);

  const partSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activeTab)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets]);
  const priorityCounts = useMemo(() => {
    const c = { all: partSets.length, high: 0, medium: 0, low: 0 } as Record<string, number>;
    partSets.forEach((s) => { const l = priorityLabels.get(s.id)?.label; if (l) c[l]++; });
    return c;
  }, [partSets, priorityLabels]);
  const hasPriority = useMemo(() => partSets.some((s) => priorityLabels.get(s.id)?.label != null), [partSets, priorityLabels]);
  useEffect(() => { if (!hasPriority && priorityFilter !== "all") setPriorityFilter("all"); }, [hasPriority, priorityFilter]);
  const filteredSets = useMemo(() => {
    let list = partSets;
    if (priorityFilter !== "all") list = list.filter((s) => priorityLabels.get(s.id)?.label === priorityFilter);
    const rank = (id: string) => { const l = priorityLabels.get(id)?.label; return l === "high" ? 0 : l === "medium" ? 1 : l === "low" ? 2 : 3; };
    const num = (t: string) => { const m = (t || "").match(/\d+/); return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER; };
    return [...list].sort((a, b) => {
      const ga = a.access_tier === "free" ? 0 : 1;
      const gb = b.access_tier === "free" ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const ra = rank(a.id), rb = rank(b.id);
      if (ra !== rb) return ra - rb;
      const na = num(a.title), nb = num(b.title);
      if (na !== nb) return na - nb;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [partSets, priorityFilter, priorityLabels]);

  const marathonSets = useMemo(() => {
    let base = examSets.filter((s) =>
      normalizePart(s.part) === marathon.partType
      && (!marathon.keyId || (keySetIds?.has(s.id) ?? false))
      && (!marathon.prio || keyPrio.get(s.id) === marathon.prio)
      && (!marathon.priorityLabel || priorityLabels.get(s.id)?.label === marathon.priorityLabel)
    );
    if (marathon.retryWrongSetIds?.length) {
      const ids = new Set(marathon.retryWrongSetIds);
      base = base.filter((s) => ids.has(s.id));
    }
    return base;
  }, [examSets, marathon.partType, marathon.keyId, marathon.prio, marathon.priorityLabel, marathon.retryWrongSetIds, keySetIds, keyPrio, priorityLabels]);


  const handleStartFromDB = async (set: ExamSetRow, opts?: { skipIntro?: boolean }) => {
    const partType = normalizePart(set.part) as ListeningPartType;
    setExam((prev) => ({ ...prev, active: true, partType, testTitle: set.title, loadingExam: true, showResults: false, correct: 0, total: 0, examSetId: set.id, startedAt: Date.now(), skipIntro: opts?.skipIntro ?? false }));
    try {
      const questions = await fetchExamQuestions(set.id);
      if (!questions || questions.length === 0) {
        toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
        setExam({ active: false, partType: "part1", testTitle: "", showResults: false, correct: 0, total: 0, loadingExam: false });
        return;
      }
      const sourceQuestionIds = questions.map((q: any) => q.id);
      let engineData: any = { sourceQuestionIds };
      switch (partType) {
        case "part1": engineData.part1Questions = toListeningPart1(questions); break;
        case "part2": engineData.part2Questions = toListeningPart2(questions); break;
        case "part3": engineData.part3Questions = toListeningPart3(questions); break;
        case "part4": engineData.part4Questions = toListeningPart4(questions); break;
      }
      setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
    } catch (e) {
      console.error("[Listening.handleStartFromDB] failed", e);
      toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
      setExam({ active: false, partType: "part1", testTitle: "", showResults: false, correct: 0, total: 0, loadingExam: false });
    } finally {
      setExam((prev) => (prev.loadingExam ? { ...prev, loadingExam: false } : prev));
    }
  };


  const handleRandomPractice = () => {
    if (examSets.length > 0) {
      handleStartFromDB(examSets[Math.floor(Math.random() * examSets.length)]);
    } else {
      toast("Chưa có đề để luyện");
    }
  };

  const handleComplete = async (correct: number, total: number, perQuestion?: any[]) => {
    const snap = await (async () => {
      try {
        const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
        const { supabase } = await import("@/integrations/supabase/client");
        const { buildHighlightRequest } = await import("@/lib/listeningReview");
        const { buildListeningItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
        let highlights: Record<string, string> = {};
        try {
          const partLike = { partType: exam.partType, ...(exam.engineData || {}) } as any;
          const items = buildHighlightRequest(partLike);
          if ((items?.length || 0) > 0) {
            const res = await supabase.functions.invoke("listening-highlight", {
              body: { exam_set_id: exam.examSetId, items },
            });
            const p = (res?.data || {}) as any;
            highlights = p.highlights || {};
          }
        } catch { /* best-effort */ }
        const builtItems = buildListeningItems(exam.partType, exam.engineData, highlights, perQuestion || []);
        const { scaled50, band } = computeScaleAndBand("listening", correct, total);
        return buildReviewSnapshot({
          skill: "listening",
          part: exam.partType,
          testTitle: exam.testTitle,
          score: correct, total,
          scaled50, band,
          items: builtItems,
          raw: {
            engineData: exam.engineData,
            perQuestion: perQuestion || [],
            highlights,
          },
        });
      } catch { return null; }
    })();
    setExam((prev) => {
      const timeSpent = prev.startedAt ? Math.floor((Date.now() - prev.startedAt) / 1000) : undefined;
      saveExamResult({
        examSetId: prev.examSetId ?? null,
        skill: "listening",
        correct, total, timeSpent,
        perQuestion,
        reviewSnapshot: snap,
      });
      return { ...prev, correct, total };
    });
    saveTestResult({ correct, total, skill: "listening" });
  };

  const navigate = useNavigate();
  const handleExit = () => {
    if (searchParams.get("from") === "key") { navigate("/key-du-doan"); return; }
    setExam({ active: false, partType: "part1", testTitle: "", showResults: false, correct: 0, total: 0, loadingExam: false });
  };

  const handleStartFullPractice = (set: SkillFullSetItem) => {
    setFullPractice({ active: true, fullTestId: set.fullTestId, title: set.title });
  };

  const handleExitFullPractice = () => {
    setFullPractice({ active: false, fullTestId: "", title: "" });
  };

  // Full practice mode
  if (fullPractice.active) {
    return (
      <SkillFullPracticeEngine
        fullTestId={fullPractice.fullTestId}
        skill="listening"
        testTitle={fullPractice.title}
        onExit={handleExitFullPractice}
      />
    );
  }

  if (marathon.active) {
    const partLabel = PARTS.find((p) => p.id === marathon.partType)?.label ?? "Part";
    return (
      <ListeningMarathonEngine
        sets={marathonSets}
        partType={marathon.partType}
        skillLabel={`Listening · Marathon ${partLabel}`}
        resume={marathon.resume}
        persist={!marathon.retryWrongSetIds}
        wrongQuestionIdsBySet={marathon.wrongQuestionIdsBySet}
        onExit={() => {
          setProgressTick((t) => t + 1);
          if (searchParams.get("from") === "key") { navigate("/key-du-doan"); return; }
          setMarathon({ active: false, partType: marathon.partType });
        }}
      />
    );
  }

  if (exam.active) {
    if (exam.loadingExam) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-[144px] md:pt-24 pb-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <Button variant="outline" size="sm" className="mt-6" onClick={handleExit}>Thoát</Button>
            </div>

          </main>
        </div>
      );
    }

    return (
      <ListeningExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={LISTENING_TIME[exam.partType] ?? 2400}
        onExit={handleExit} onComplete={handleComplete} showResultsOnSubmit allowReveal
        examSetId={exam.examSetId ?? null}
        {...exam.engineData} skipIntro={exam.skipIntro}
      />
    );
  }

  const activePartInfo = PARTS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="red" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />35 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Phần thi Listening</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện nghe theo format bài thi Aptis Listening. Làm quen với các dạng câu hỏi và luyện tập với audio giống bài thi thật. Mỗi đoạn audio chỉ được nghe tối đa 2 lần.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full border-primary text-primary hover:bg-primary/10 hover:text-primary h-9 px-4 text-sm font-medium">
                <Link to="/meo-thi-aptis/meo-hoc-listening-aptis">💡 Xem ngay{"\u00a0"}- Mẹo làm bài Listening</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="section-container pt-6 md:pt-8">
          <ProgressBanner skill="listening" skillLabel="Listening" />
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm bộ đề Listening..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {PARTS.map((part) => (
                <TabsTrigger
                  key={part.id}
                  value={part.id}
                  className={`flex-1 min-w-[120px] text-xs sm:text-sm py-2.5 transition-all ${
                    part.id === "full"
                      ? "data-[state=active]:bg-[#CC1C01] data-[state=active]:text-white data-[state=active]:shadow-md"
                      : "data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md"
                  }`}
                >
                  <span className="font-semibold">{part.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {part.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeTab === "full" ? (
            fullLoading || authLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : (
              <FullPartSection
                progress={progress}
                skillKey="listening"
                skillName="Listening"
                sets={fullSets}
                loading={fullLoading}
                onStart={(set) => guard(set as any, () => handleStartFullPractice(set))}
                isLocked={isLocked}
                onLockedClick={(set) => guard(set, () => {})}
              />

            )
          ) : (
            <>
              {activePartInfo && (
                <div className="mb-6">
                  <h2 className="text-lg font-heading font-semibold text-foreground">{activePartInfo.label} – {activePartInfo.subtitle}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {loading ? "Đang tải..." : `${filteredSets.length} bộ đề luyện tập`}
                  </p>
                </div>
              )}
              {hasPriority && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Nhãn ưu tiên dựa trên mức độ đề hay xuất hiện trong các key dự đoán gần đây — Ưu tiên cao là đề hay gặp nhất, nên luyện trước.
                  </p>
                  <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} counts={priorityCounts as any} />
                </div>
              )}

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.length > 0 && (() => {
                    const rankT = (t: string) => t === "premium" ? 2 : t === "pro" ? 1 : 0;
                    const maxTier = filteredSets.reduce((acc, s) => {
                      const rt = (s.access_tier === "free" || s.access_tier === "pro" || s.access_tier === "premium") ? s.access_tier : "pro";
                      return rankT(rt) > rankT(acc) ? rt : acc;
                    }, "free" as "free" | "pro" | "premium");
                    const marathonLocked = isLocked({ access_tier: maxTier } as any);
                    void progressTick;
                    const activePrio = priorityFilter === "all" ? null : priorityFilter as "high" | "medium" | "low";
                    const prioName = activePrio === "high" ? "ưu tiên cao" : activePrio === "medium" ? "ưu tiên vừa" : activePrio === "low" ? "ưu tiên thấp" : null;
                    const savedProg = !activePrio ? loadMarathonProgress("listening", activeTab) : null;
                    const lastRun = !activePrio ? loadMarathonLast("listening", activeTab) : null;
                    const doneCount = savedProg?.results?.filter(Boolean).length ?? 0;
                    const hasResume = !!savedProg && doneCount > 0 && doneCount < filteredSets.length;
                    const wrongQMap: Record<string, string[]> = {};
                    (savedProg?.results ?? []).forEach((r: any) => {
                      if (!r?.qResults) return;
                      const wq = r.qResults.filter((q: any) => !q.is_correct).map((q: any) => q.exam_question_id);
                      if (wq.length) wrongQMap[r.examSetId] = wq;
                    });
                    if (Object.keys(wrongQMap).length === 0 && lastRun?.wrongQuestionsBySet) {
                      Object.assign(wrongQMap, lastRun.wrongQuestionsBySet);
                    }
                    const wrongSetIds = Object.keys(wrongQMap);
                    const wrongQTotal = Object.values(wrongQMap).reduce((s, a) => s + a.length, 0);
                    const isPart1 = activeTab === "part1";
                    const wrongCount = isPart1 ? wrongQTotal : wrongSetIds.length;
                    return (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative rounded-xl p-5 flex flex-col h-full border-2 border-primary/60 bg-gradient-to-br from-primary/10 via-accent/5 to-background shadow-lg shadow-primary/10">
                        <div className="absolute top-3 right-3">{!activePrio && <CornerResultBadge item={marathonProgress.get(activeTab)} />}</div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className="w-fit text-[11px] font-semibold bg-primary text-primary-foreground border-0 gap-1">
                            <InfinityIcon className="w-3 h-3" /> Marathon
                          </Badge>
                          <ExamTierBadge tier={maxTier} locked={marathonLocked} />
                        </div>
                        <h3 className="text-xl font-heading font-extrabold text-foreground mb-2">
                          {prioName ? `Luyện đề ${prioName} ${activePartInfo?.label}` : `Luyện tất cả đề ${activePartInfo?.label}`}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-1">
                          Làm liên tục {filteredSets.length} đề{prioName ? ` (${prioName})` : ""} — không giới hạn giờ
                        </p>
                        {hasResume && (
                          <p className="text-xs text-primary font-semibold mb-3">
                            Đang làm dở: đã xong {doneCount}/{filteredSets.length} đề ({Math.round((doneCount / filteredSets.length) * 100)}%)
                          </p>
                        )}
                        {!hasResume && lastRun && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Lần trước: đúng {lastRun.correct}/{lastRun.total}
                          </p>
                        )}
                        <div className="flex-1" />
                        <div className="flex flex-wrap justify-end gap-2">
                          {hasResume ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => guard({ access_tier: maxTier } as any, () => { clearMarathonProgress("listening", activeTab); setProgressTick((t) => t + 1); setMarathon({ active: true, partType: activeTab as ListeningPartType, priorityLabel: activePrio }); })}
                                className="gap-1.5 font-semibold"
                              >
                                Làm lại từ đầu
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => guard({ access_tier: maxTier } as any, () => setMarathon({ active: true, partType: activeTab as ListeningPartType, resume: true, priorityLabel: activePrio }))}
                                className="gap-1.5 font-semibold"
                              >
                                {marathonLocked ? <>Mở khóa</> : <>Tiếp tục (đề {doneCount + 1}/{filteredSets.length}) <ArrowRight className="w-4 h-4" /></>}
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => guard({ access_tier: maxTier } as any, () => setMarathon({ active: true, partType: activeTab as ListeningPartType, priorityLabel: activePrio }))}
                              className="gap-1.5 font-semibold"
                            >
                              {marathonLocked ? <>Mở khóa</> : <>Bắt đầu <ArrowRight className="w-4 h-4" /></>}
                            </Button>
                          )}
                          {wrongCount > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => guard({ access_tier: maxTier } as any, () => setMarathon({
                                active: true,
                                partType: activeTab as ListeningPartType,
                                retryWrongSetIds: wrongSetIds,
                                wrongQuestionIdsBySet: isPart1 ? wrongQMap : undefined,
                                priorityLabel: activePrio,
                              }))}
                              className="gap-1.5 font-semibold"
                            >
                              {isPart1 ? `Làm lại câu sai (${wrongQTotal} câu)` : `Làm lại đề có câu sai (${wrongSetIds.length})`}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    );
                  })()}
                  {filteredSets.map((set, index) => {
                    const locked = isLocked(set);
                    return (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                        <div className="absolute top-3 right-3"><CornerResultBadge item={progress.get(set.id)} /></div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">{activePartInfo?.label}</Badge>
                          <ExamTierBadge tier={set.access_tier} locked={locked} />
                          <PriorityBadge label={priorityLabels.get(set.id)?.label} />

                          {isNewSet(set) && (
                            <Badge className="w-fit text-[11px] font-semibold bg-emerald-500 text-white border-0 hover:bg-emerald-500">MỚI</Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">🎧 {set.description || "Đề luyện tập"}</span>
                        </div>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => guard(set, () => handleStartFromDB(set))} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                            {locked ? "Mở khóa" : "Luyện tập"}<ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                    );
                  })}


                  {filteredSets.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                      <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Chưa có đề cho phần này</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          
        </section>
      </main>
      <Footer />
      <LockModal />
    </div>
  );
};

export default Listening;
