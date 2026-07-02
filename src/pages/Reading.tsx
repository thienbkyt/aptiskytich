import { useState, useMemo, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search, Clock, Shuffle, ArrowRight, Loader2, Infinity as InfinityIcon, Inbox } from "lucide-react";
import { motion } from "framer-motion";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import ReadingMarathonEngine from "@/components/practice/ReadingMarathonEngine";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { ReadingPartType } from "@/components/reading/ReadingExamEngine";
import { toast } from "sonner";
import { useExamSets, fetchExamQuestions, normalizePart, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4 } from "@/lib/examTransformers";
import { computeReadingFullTotal } from "@/lib/readingFullTotal";
import { supabase } from "@/integrations/supabase/client";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useUserMarathonProgress } from "@/hooks/useUserMarathonProgress";
import { saveTestResult } from "@/lib/testResults";
import { saveExamResult } from "@/lib/saveExamResult";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import LoginToPracticePrompt from "@/components/exam/LoginToPracticePrompt";
import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";

const PARTS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "part1" as const, label: "Part 1", subtitle: "Sentence comprehension" },
  { id: "part2" as const, label: "Part 2", subtitle: "Text cohesion" },
  { id: "part3" as const, label: "Part 3", subtitle: "Opinion matching" },
  { id: "part4" as const, label: "Part 4", subtitle: "Long reading" },
];

const READING_TIME: Record<string, number> = {
  part1: 360,
  part2: 420,
  part3: 420,
  part4: 900,
};

interface ExamState {
  active: boolean;
  partType: ReadingPartType;
  testTitle: string;
  showResults: boolean;
  correct: number;
  total: number;
  engineData?: any;
  loadingExam: boolean;
  examSetId?: string | null;
  startedAt?: number;
  totalForScore?: number | null;
  skipIntro?: boolean;
}

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const Reading = () => {
  usePageMeta({
    title: "Luyện Reading Aptis — 4 parts có giải thích | Aptis Kỳ Tích",
    description: "Luyện Reading Aptis 4 parts: điền từ, sắp xếp câu, ghép tiêu đề. Có giải thích chi tiết và tra từ ngay trong bài.",
    path: "/reading",
  });
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("reading");
  const { guard, isLocked, LockModal } = useExamAccessGate();
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("reading");
  const { progress } = useUserExamProgress();
  const { progress: marathonProgress } = useUserMarathonProgress("reading");
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "part1", testTitle: "", showResults: false,
    correct: 0, total: 0, loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });
  const [marathon, setMarathon] = useState<{ active: boolean; partType: ReadingPartType; keyId?: string | null; prio?: string | null }>({
    active: false, partType: "part1", keyId: null, prio: null,
  });
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

  // Auto-start when arriving via ?set=<examSetId> (e.g. from history "Làm lại")
  const [searchParams, setSearchParams] = useSearchParams();
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    const setId = searchParams.get("set");
    if (!setId || loading || autoStartedRef.current === setId) return;
    const target = examSets.find((s) => s.id === setId);
    if (target) {
      autoStartedRef.current = setId;
      const jump = searchParams.get("jump") === "1";
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
    const token = `${mp}|${keyId ?? ""}`;
    if (marathonAutoRef.current === token) return;
    marathonAutoRef.current = token;
    setMarathon({ active: true, partType: mp as ReadingPartType, keyId: keyId || null });
    const next = new URLSearchParams(searchParams);
    next.delete("marathon");
    next.delete("keyId");
    setSearchParams(next, { replace: true });
  }, [searchParams]);

  // Fetch prediction items for the selected key
  useEffect(() => {
    if (!marathon.keyId) { setKeySetIds(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("prediction_items")
        .select("exam_set_id")
        .eq("key_id", marathon.keyId);
      if (cancelled) return;
      setKeySetIds(new Set((data ?? []).map((r: any) => r.exam_set_id)));
    })();
    return () => { cancelled = true; };
  }, [marathon.keyId]);

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activeTab)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets]);

  const marathonSets = useMemo(
    () => examSets.filter((s) => normalizePart(s.part) === marathon.partType && (!marathon.keyId || (keySetIds?.has(s.id) ?? false))),
    [examSets, marathon.partType, marathon.keyId, keySetIds]
  );

  const handleStartFromDB = async (set: ExamSetRow, opts?: { skipIntro?: boolean }) => {
    const partType = normalizePart(set.part) as ReadingPartType;
    setExam((prev) => ({ ...prev, active: true, partType, testTitle: set.title, loadingExam: true, showResults: false, correct: 0, total: 0, examSetId: set.id, startedAt: Date.now(), totalForScore: null, skipIntro: opts?.skipIntro ?? false }));
    const [questions, fullRow] = await Promise.all([
      fetchExamQuestions(set.id),
      supabase.from("exam_sets").select("full_test_id").eq("id", set.id).maybeSingle(),
    ]);
    const fullTestId = (fullRow.data as any)?.full_test_id ?? null;
    const sourceQuestionIds = questions.map((q: any) => q.id);
    let engineData: any = { sourceQuestionIds };
    switch (partType) {
      case "part1": engineData.part1Question = toReadingPart1(questions); break;
      case "part2": engineData.part2Question = toReadingPart2(questions); break;
      case "part3": engineData.part3Question = toReadingPart3(questions); break;
      case "part4": engineData.part4Question = toReadingPart4(questions); break;
    }
    setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
    // Fire-and-forget: compute T from sibling parts in the same full test.
    computeReadingFullTotal(fullTestId).then((T) => {
      setExam((prev) => (prev.examSetId === set.id ? { ...prev, totalForScore: T } : prev));
    });
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
        const { buildReviewRequest } = await import("@/lib/readingReview");
        const { buildReadingItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
        let translations: Record<string, string> = {};
        let part3Evidence: Record<string, { person: string; sentence: string }> = {};
        try {
          const partLike = { partType: exam.partType, ...(exam.engineData || {}) } as any;
          const { items, part3 } = buildReviewRequest(partLike);
          if ((items?.length || 0) > 0 || (part3?.length || 0) > 0) {
            const res = await supabase.functions.invoke("translate-review", {
              body: { exam_set_id: exam.examSetId, items, part3 },
            });
            const p = (res?.data || {}) as any;
            translations = p.translations || {};
            part3Evidence = p.part3Evidence || {};
          }
        } catch (e) { /* best-effort */ }
        const builtItems = buildReadingItems(exam.partType, exam.engineData, translations, part3Evidence, perQuestion || []);
        const { scaled50, band } = computeScaleAndBand("reading", correct, total);
        return buildReviewSnapshot({
          skill: "reading",
          part: exam.partType,
          testTitle: exam.testTitle,
          score: correct, total,
          scaled50, band,
          items: builtItems,
          raw: {
            engineData: exam.engineData,
            perQuestion: perQuestion || [],
            translations,
            part3Evidence,
          },
        });
      } catch { return null; }
    })();
    setExam((prev) => {
      const timeSpent = prev.startedAt ? Math.floor((Date.now() - prev.startedAt) / 1000) : undefined;
      saveExamResult({
        examSetId: prev.examSetId ?? null,
        skill: "reading",
        correct, total, timeSpent,
        perQuestion,
        reviewSnapshot: snap,
      });
      return { ...prev, correct, total };
    });
    saveTestResult({ correct, total, skill: "reading" });
  };

  const navigate = useNavigate();
  const handleExit = () => {
    if (searchParams.get("from") === "key") { navigate("/thi-thu?tab=key"); return; }
    setExam({ active: false, partType: "part1", testTitle: "", showResults: false, correct: 0, total: 0, loadingExam: false });
  };

  const handleStartFullPractice = (set: SkillFullSetItem) => {
    setFullPractice({ active: true, fullTestId: set.fullTestId, title: set.title });
  };

  const handleExitFullPractice = () => {
    setFullPractice({ active: false, fullTestId: "", title: "" });
  };

  if (fullPractice.active) {
    return (
      <SkillFullPracticeEngine
        fullTestId={fullPractice.fullTestId}
        skill="reading"
        testTitle={fullPractice.title}
        onExit={handleExitFullPractice}
      />
    );
  }

  if (marathon.active) {
    const partLabel = PARTS.find((p) => p.id === marathon.partType)?.label ?? "Part";
    return (
      <ReadingMarathonEngine
        sets={marathonSets}
        partType={marathon.partType}
        skillLabel={`Reading · Marathon ${partLabel}`}
        onExit={() => {
          if (searchParams.get("from") === "key") { navigate("/thi-thu?tab=key"); return; }
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
          <main className="flex-1 pt-24 pb-20 flex items-center justify-center">
            <div className="space-y-4 text-center">
              <TechSkeleton variant="circle" className="h-12 w-12 mx-auto" />
              <TechSkeleton variant="text" className="w-32 mx-auto" />
            </div>
          </main>
        </div>
      );
    }

    return (
      <ReadingExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={READING_TIME[exam.partType] ?? 2100}
        examSetId={exam.examSetId ?? null}
        totalForScore={exam.totalForScore ?? null}
        onExit={handleExit} onComplete={handleComplete} showResultsOnSubmit allowReveal {...exam.engineData} skipIntro={exam.skipIntro}
      />
    );
  }

  const activePartInfo = PARTS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="red" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />30 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Phần thi Reading</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện đọc hiểu theo format bài thi Aptis Reading. Làm quen với các dạng câu hỏi và nâng cao kỹ năng đọc nhanh.
              </p>
            </div>
          </div>
        </section>

        <section className="section-container pt-6 md:pt-8">
          <ProgressBanner skill="reading" skillLabel="Reading" />
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm bộ đề Reading..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
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
                {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
              </div>
            ) : !authUser ? (
              <LoginToPracticePrompt message="Đăng nhập để luyện tập theo kỹ năng với giao diện giống đề thi thật 100%" />
            ) : (
              <FullPartSection
                progress={progress}
                skillKey="reading"
                skillName="Reading"
                sets={fullSets}
                loading={fullLoading}
                onStart={handleStartFullPractice}
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

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
                </div>
              ) : !authUser ? (
                <LoginToPracticePrompt message="Đăng nhập để luyện tập theo kỹ năng với giao diện giống đề thi thật 100%" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.length > 0 && (() => {
                    const rankT = (t: string) => t === "premium" ? 2 : t === "pro" ? 1 : 0;
                    const maxTier = filteredSets.reduce((acc, s) => {
                      const rt = (s.access_tier === "free" || s.access_tier === "pro" || s.access_tier === "premium") ? s.access_tier : "pro";
                      return rankT(rt) > rankT(acc) ? rt : acc;
                    }, "free" as "free" | "pro" | "premium");
                    const marathonLocked = isLocked({ access_tier: maxTier } as any);
                    return (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative rounded-xl p-5 flex flex-col h-full border-2 border-primary/60 bg-gradient-to-br from-primary/10 via-accent/5 to-background shadow-lg shadow-primary/10">
                        <div className="absolute top-3 right-3"><CornerResultBadge item={marathonProgress.get(activeTab)} /></div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className="w-fit text-[11px] font-semibold bg-primary text-primary-foreground border-0 gap-1">
                            <InfinityIcon className="w-3 h-3" /> Marathon
                          </Badge>
                          <ExamTierBadge tier={maxTier} locked={marathonLocked} />
                        </div>
                        <h3 className="text-xl font-heading font-extrabold text-foreground mb-2">
                          Luyện tất cả đề {activePartInfo?.label}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Làm liên tục toàn bộ {filteredSets.length} đề — không giới hạn giờ
                        </p>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => guard({ access_tier: maxTier } as any, () => setMarathon({ active: true, partType: activeTab as ReadingPartType }))}
                            className="gap-1.5 font-semibold"
                          >
                            {marathonLocked ? <>Mở khóa</> : <>Bắt đầu <ArrowRight className="w-4 h-4" /></>}
                          </Button>
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
                        </div>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">📖 {set.description || "Đề luyện tập"}</span>
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

export default Reading;
