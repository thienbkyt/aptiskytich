import { useState, useMemo, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, Search, Clock, Shuffle, ArrowRight, ArrowLeft, RotateCcw, Loader2, Inbox, Infinity as InfinityIcon } from "lucide-react";
import { motion } from "framer-motion";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import WritingMarathonEngine from "@/components/practice/WritingMarathonEngine";
import { loadMarathonProgress, clearMarathonProgress } from "@/lib/marathonProgress";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { WritingPartType } from "@/components/writing/WritingExamEngine";
import { toast } from "sonner";
import { useExamSets, fetchExamQuestions, normalizePart, isNewSet, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4 } from "@/lib/examTransformers";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useUserGradedProgress } from "@/hooks/useUserGradedProgress";
import { saveExamResult } from "@/lib/saveExamResult";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";

import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";

const partToTask: Record<string, WritingPartType> = {
  part1: "task1", part2: "task2", part3: "task3", part4: "task4",
};

const WRITING_TIME: Record<string, number> = {
  task1: 360,
  task2: 720,
  task3: 1020,
  task4: 900,
};

const TASKS = [
  { id: "full" as const, partKey: "full", label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "task1" as const, partKey: "part1", label: "Part 1", subtitle: "Short answers" },
  { id: "task2" as const, partKey: "part2", label: "Part 2", subtitle: "Social media response" },
  { id: "task3" as const, partKey: "part3", label: "Part 3", subtitle: "Three questions" },
  { id: "task4" as const, partKey: "part4", label: "Part 4", subtitle: "Informal & Formal email" },
];

interface ExamState {
  active: boolean;
  partType: WritingPartType;
  testTitle: string;
  completed: boolean;
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

const Writing = () => {
  usePageMeta({
    title: "Luyện Writing Aptis — AI chấm bài viết theo CEFR | Aptis Kỳ Tích",
    description: "Luyện Writing Aptis 4 parts: AI chấm Task Response, Grammar, Vocabulary, Coherence; highlight lỗi và gợi ý nâng cấp câu.",
    path: "/writing",
  });
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("writing");
  const { guard, isLocked, LockModal } = useExamAccessGate();
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("writing");
  const { progress } = useUserExamProgress();
  const { progress: gradedProgress } = useUserGradedProgress("writing");
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "task1", testTitle: "", completed: false, loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({ active: false, fullTestId: "", title: "" });
  const [marathon, setMarathon] = useState<{ active: boolean; partType: WritingPartType; resume?: boolean }>({ active: false, partType: "task1" });
  const [progressTick, setProgressTick] = useState(0);
  const { user: authUser, loading: authLoading } = useAuth();

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

  const activePartKey = TASKS.find(t => t.id === activeTab)?.partKey || "part1";

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activePartKey)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets, activePartKey]);

  const handleStartFromDB = async (set: ExamSetRow, opts?: { skipIntro?: boolean }) => {
    const normalizedPart = normalizePart(set.part);
    const partType = partToTask[normalizedPart] || "task1";
    setExam({ active: true, partType, testTitle: set.title, completed: false, loadingExam: true, examSetId: set.id, startedAt: Date.now(), skipIntro: opts?.skipIntro ?? false });
    try {
      const questions = await fetchExamQuestions(set.id);
      if (!questions || questions.length === 0) {
        toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
        setExam({ active: false, partType: "task1", testTitle: "", completed: false, loadingExam: false });
        return;
      }
      const sourceQuestionIds = questions.map((q: any) => q.id);
      let engineData: any = { sourceQuestionIds };
      switch (normalizedPart) {
        case "part1": engineData.part1Data = toWritingPart1(questions); break;
        case "part2": engineData.part2Data = toWritingPart2(questions); break;
        case "part3": engineData.part3Data = toWritingPart3(questions); break;
        case "part4": engineData.part4Data = toWritingPart4(questions); break;
      }
      setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
    } catch (e) {
      console.error("[Writing.handleStartFromDB] failed", e);
      toast.error("Không tải được đề. Vui lòng kiểm tra mạng và thử lại.");
      setExam({ active: false, partType: "task1", testTitle: "", completed: false, loadingExam: false });
    } finally {
      setExam((prev) => prev.active ? { ...prev, loadingExam: false } : prev);
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
    setExam({ active: false, partType: "task1", testTitle: "", completed: false, loadingExam: false });
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
        skill="writing"
        testTitle={fullPractice.title}
        onExit={handleExitFullPractice}
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
              <Button variant="outline" size="sm" onClick={handleExit} className="mt-4">Thoát</Button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <WritingExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={WRITING_TIME[exam.partType] ?? 3000}
        examSetId={exam.examSetId ?? null}
        onExit={handleExit} onComplete={async (perQuestion) => {
          const timeSpent = exam.startedAt ? Math.floor((Date.now() - exam.startedAt) / 1000) : undefined;
          const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
          // Derive user texts from perQuestion[0].user_answer (engine merges to a single string).
          const userText = perQuestion?.[0]?.user_answer ?? "";
          const snap = buildReviewSnapshot({
            skill: "writing",
            part: exam.partType,
            testTitle: exam.testTitle,
            score: 0, total: 1,
            items: [{
              questionText: exam.testTitle,
              userAnswer: userText,
              isCorrect: false,
              ai: null,
            }],
            raw: { engineData: exam.engineData, perQuestion: perQuestion || [] },
          });
          const id = await saveExamResult({
            examSetId: exam.examSetId ?? null,
            skill: "writing",
            correct: 0, total: 1, timeSpent,
            perQuestion,
            reviewSnapshot: snap,
          });
          return id ?? null;
        }}
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
                  <PenLine className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5"><Clock className="w-3 h-3" />50 phút</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Phần thi Writing</h1>
              <div className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl whitespace-pre-line">
                Luyện viết theo format bài thi Aptis Writing. Hoàn thành các task viết với thời gian giống bài thi thật.{"\n"}
                AI chấm bài và nhận band điểm Writing ngay sau khi làm bài.{"\n\n"}
              </div>
              <Button asChild variant="outline" className="mt-4 rounded-full border-primary text-primary hover:bg-primary/10 hover:text-primary h-9 px-4 text-sm font-medium">
                <Link to="/meo-thi-aptis/meo-hoc-writing-aptis">💡 Xem ngay{"\u00a0"}- Mẹo làm bài Writing</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="section-container pt-6 md:pt-8">
          <ProgressBanner skill="writing" skillLabel="Writing" />
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm bộ đề Writing..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
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
                      : "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-md"
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
                skillKey="writing"
                skillName="Writing"
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

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.map((set, index) => {
                    const locked = isLocked(set);
                    return (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                        <div className="absolute top-3 right-3"><CornerResultBadge item={gradedProgress.get(set.id)} /></div>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary border-0">{activeTaskInfo?.label}</Badge>
                          <ExamTierBadge tier={set.access_tier} locked={locked} />
                          {isNewSet(set) && (
                            <Badge className="w-fit text-[11px] font-semibold bg-emerald-500 text-white border-0 hover:bg-emerald-500">MỚI</Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">✍️ {set.description || "Đề luyện tập"}</span>
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

export default Writing;
