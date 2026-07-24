import { useState, useMemo, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Search, Clock, Shuffle, ArrowRight, Loader2, Inbox, Eye, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import SpeakingExamEngine from "@/components/speaking/SpeakingExamEngine";
import SpeakingBrowseViewer from "@/components/speaking/SpeakingBrowseViewer";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { SpeakingPartType } from "@/data/speakingQuestions";
import { toast } from "sonner";
import { useExamSets, fetchExamQuestions, normalizePart, isNewSet, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4 } from "@/lib/examTransformers";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useUserGradedProgress } from "@/hooks/useUserGradedProgress";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";

import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";
import { useExamPriorityLabels } from "@/hooks/useExamPriorityLabels";
import PriorityBadge from "@/components/practice/PriorityBadge";
import PriorityFilter, { type PriorityFilterValue } from "@/components/practice/PriorityFilter";

const TASKS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "part1" as const, label: "Part 1", subtitle: "Personal Questions" },
  { id: "part2" as const, label: "Part 2", subtitle: "Describe a Picture" },
  { id: "part3" as const, label: "Part 3", subtitle: "Compare Pictures" },
  { id: "part4" as const, label: "Part 4", subtitle: "Opinion Questions" },
];

const BROWSE_PARTS: { id: SpeakingPartType; label: string; subtitle: string }[] = [
  { id: "part1", label: "Part 1", subtitle: "Personal Questions" },
  { id: "part2", label: "Part 2", subtitle: "Describe a Picture" },
  { id: "part3", label: "Part 3", subtitle: "Compare Pictures" },
  { id: "part4", label: "Part 4", subtitle: "Opinion Questions" },
];

const TIME_LIMITS: Record<SpeakingPartType, number> = {
  part1: 180, part2: 120, part3: 150, part4: 240,
};

interface ExamState {
  active: boolean;
  partType: SpeakingPartType;
  testTitle: string;
  engineData?: any;
  loadingExam: boolean;
  examSetId?: string | null;
  skipIntro?: boolean;
}

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const Speaking = () => {
  usePageMeta({
    title: "Luyện Speaking Aptis — AI chấm phát âm & ngữ pháp | Aptis Kỳ Tích",
    description: "Luyện Speaking Aptis 4 parts với AI chấm fluency, pronunciation, grammar, vocabulary theo CEFR A1–C1. Có ghi âm và feedback chi tiết.",
    path: "/speaking",
  });
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("speaking");
  const { guard, isLocked, LockModal } = useExamAccessGate();
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("speaking");
  const { progress } = useUserExamProgress();
  const { progress: gradedProgress } = useUserGradedProgress("speaking");
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "part1", testTitle: "", loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });
  const [browsePart, setBrowsePart] = useState<SpeakingPartType | null>(null);
  const [browseSetIds, setBrowseSetIds] = useState<string[] | null>(null);
  const [browsePriorityLabel, setBrowsePriorityLabel] = useState<PriorityFilterValue>("all");
  const { user: authUser, loading: authLoading } = useAuth();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>("all");
  const { labels: priorityLabels } = useExamPriorityLabels();

  // Rehydrate engineData after remount.
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

  const browseSets = useMemo(() => {
    if (!browsePart) return [];
    const inPart = examSets.filter((s) => normalizePart(s.part) === browsePart);
    if (browseSetIds && browseSetIds.length) {
      const allow = new Set(browseSetIds);
      return inPart.filter((s) => allow.has(s.id));
    }
    return inPart;
  }, [browsePart, browseSetIds, examSets]);

  // Max tier per part for PRO gating in browse tab
  const partMaxTier = useMemo(() => {
    const rank = (t: string) => (t === "premium" ? 2 : t === "pro" ? 1 : 0);
    const m: Record<string, "free" | "pro" | "premium"> = { part1: "free", part2: "free", part3: "free", part4: "free" };
    for (const s of examSets) {
      const p = normalizePart(s.part);
      const t = (s.access_tier === "free" || s.access_tier === "pro" || s.access_tier === "premium") ? s.access_tier : "pro";
      if (rank(t) > rank(m[p] ?? "free")) m[p] = t;
    }
    return m;
  }, [examSets]);

  const handleStartFromDB = async (set: ExamSetRow, opts?: { skipIntro?: boolean }) => {
    const partType = normalizePart(set.part) as SpeakingPartType;
    setExam({ active: true, partType, testTitle: set.title, loadingExam: true, skipIntro: opts?.skipIntro ?? false, ...( { examSetId: set.id } as any) });
    try {
      const questions = await fetchExamQuestions(set.id);
      if (!questions || questions.length === 0) {
        toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
        setExam({ active: false, partType: "part1", testTitle: "", loadingExam: false });
        return;
      }
      const sourceQuestionIds = questions.map((q: any) => q.id);
      let engineData: any = { sourceQuestionIds };
      switch (partType) {
        case "part1": engineData.part1Data = toSpeakingPart1(questions); break;
        case "part2": engineData.part2Data = toSpeakingPart2(questions); break;
        case "part3": engineData.part3Data = toSpeakingPart3(questions); break;
        case "part4": engineData.part4Data = toSpeakingPart4(questions); break;
      }
      setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
    } catch (e) {
      console.error("[Speaking.handleStartFromDB] failed", e);
      toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
      setExam({ active: false, partType: "part1", testTitle: "", loadingExam: false });
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

  const navigate = useNavigate();
  const handleExit = () => {
    if (searchParams.get("from") === "key") { navigate("/key-du-doan"); return; }
    setExam({ active: false, partType: "part1", testTitle: "", loadingExam: false });
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
        skill="speaking"
        testTitle={fullPractice.title}
        onExit={handleExitFullPractice}
      />
    );
  }

  // Browse (view-only) mode
  if (browsePart) {
    const info = BROWSE_PARTS.find((p) => p.id === browsePart);
    return (
      <SpeakingBrowseViewer
        sets={browseSets}
        partType={browsePart}
        partLabel={info?.label ?? "Part"}
        onExit={() => setBrowsePart(null)}
      />
    );
  }

  if (exam.active) {
    if (exam.loadingExam) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-[144px] md:pt-24 pb-20 flex items-center justify-center">
            <div className="space-y-4 text-center">
              <TechSkeleton variant="circle" className="h-12 w-12 mx-auto" />
              <TechSkeleton variant="text" className="w-32 mx-auto" />
              <Button variant="outline" size="sm" className="mt-6" onClick={handleExit}>Thoát</Button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <SpeakingExamEngine
        partType={exam.partType} testTitle={exam.testTitle}
        timeLimit={TIME_LIMITS[exam.partType]} onExit={handleExit} onComplete={() => {}}
        examSetId={(exam as any).examSetId ?? null}
        {...exam.engineData} skipIntro={exam.skipIntro}
        allowReveal
      />
    );
  }

  const activeTaskInfo = TASKS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="orange" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />12 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Phần thi Speaking</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl whitespace-pre-line">
                Luyện nói qua các đề thi với format Aptis Speaking. Ghi âm câu trả lời với thời gian chuẩn bị và trả lời giống bài thi thật.{"\u00a0"}
                AI chấm bài và nhận band điểm Speaking ngay sau khi làm bài.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full border-primary text-primary hover:bg-primary/10 hover:text-primary h-9 px-4 text-sm font-medium">
                <Link to="/meo-thi-aptis/meo-hoc-speaking-aptis">💡 Xem ngay{"\u00a0"}- Mẹo làm bài Speaking</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="section-container pt-6 md:pt-8">
          <ProgressBanner skill="speaking" skillLabel="Speaking" />
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm bộ đề Speaking..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {TASKS.map((task) => (
                <TabsTrigger
                  key={task.id}
                  value={task.id}
                  className={`flex-1 min-w-[120px] text-xs sm:text-sm py-2.5 transition-all ${
                    task.id === "full"
                      ? "data-[state=active]:bg-[#CC1C01] data-[state=active]:text-white data-[state=active]:shadow-md"
                      : "data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md"
                  }`}
                >
                  <span className="font-semibold">{task.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {task.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeTab === "full" ? (
            fullLoading || authLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
              </div>
            ) : (
              <FullPartSection
                progress={gradedProgress}
                skillKey="speaking"
                skillName="Speaking"
                sets={fullSets}
                loading={fullLoading}
                onStart={(set) => guard(set as any, () => handleStartFullPractice(set))}
                isLocked={isLocked}
                onLockedClick={(set) => guard(set, () => {})}
              />
            )
          ) : (

            <>
              {activeTaskInfo && (
                <div className="mb-6">
                  <h2 className="text-lg font-heading font-semibold text-foreground">{activeTaskInfo.label} – {activeTaskInfo.subtitle}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {loading ? "Đang tải..." : `${filteredSets.length} bộ đề luyện tập`}
                  </p>
                </div>
              )}
              {hasPriority && (
                <div className="mb-4">
                  <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} counts={priorityCounts as any} />
                </div>
              )}

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {(() => {
                    const partId = activeTab as SpeakingPartType;
                    const info = BROWSE_PARTS.find((p) => p.id === partId);
                    if (!info) return null;
                    const partSets = examSets.filter((s) => normalizePart(s.part) === partId);
                    const count = partSets.length;
                    const tier = partMaxTier[partId] ?? "pro";
                    const locked = isLocked({ access_tier: tier } as any);
                    const disabled = count === 0;
                    return (
                      <motion.div key={`browse-${partId}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                        <div className="group relative tech-card bg-card border-2 border-primary/40 rounded-xl p-5 flex flex-col h-full">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">
                              {info.label}
                            </Badge>
                            <ExamTierBadge tier={tier} locked={locked} />
                          </div>
                          <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                            Xem toàn bộ đề {info.label}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Bài nói mẫu tham khảo — chỉ để xem, không ghi âm, không chấm điểm.
                          </p>
                          <div className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> {count} đề · Bài nói mẫu
                          </div>
                          <div className="flex-1" />
                          <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => guard({ access_tier: tier } as any, () => setBrowsePart(partId))}
                            className="w-full gap-1.5 font-semibold bg-primary hover:bg-[#4D0D0D] text-primary-foreground"
                          >
                            {disabled ? "Chưa có đề" : locked ? "Mở khóa" : (<>Xem đề <ArrowRight className="w-4 h-4" /></>)}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })()}
                  {filteredSets.map((set, index) => {
                    const locked = isLocked(set);
                    return (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                        <div className="absolute top-3 right-3"><CornerResultBadge item={gradedProgress.get(set.id)} label={gradedProgress.get(set.id) ? `${gradedProgress.get(set.id)!.bestPct}% điểm` : undefined} /></div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">{activeTaskInfo?.label}</Badge>
                          <ExamTierBadge tier={set.access_tier} locked={locked} />
                          <PriorityBadge label={priorityLabels.get(set.id)?.label} />

                          {isNewSet(set) && (
                            <Badge className="w-fit text-[11px] font-semibold bg-emerald-500 text-white border-0 hover:bg-emerald-500">MỚI</Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">🎤 Ghi âm</span>
                          <span className="flex items-center gap-1.5">⏱️ AI chấm và sửa bài</span>
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

export default Speaking;
