import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Search, Clock, Shuffle, ArrowRight, Loader2, Infinity as InfinityIcon } from "lucide-react";
import { motion } from "framer-motion";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";
import ListeningMarathonEngine from "@/components/practice/ListeningMarathonEngine";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { ListeningPartType } from "@/components/listening/ListeningExamEngine";
import {
  mockListeningPart1, mockListeningPart2, mockListeningPart3, mockListeningPart4,
} from "@/data/listeningQuestions";
import { useExamSets, fetchExamQuestions, normalizePart, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4 } from "@/lib/examTransformers";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CompletionBadge from "@/components/practice/CompletionBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { saveTestResult } from "@/lib/testResults";
import { saveExamResult } from "@/lib/saveExamResult";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import LoginToPracticePrompt from "@/components/exam/LoginToPracticePrompt";
import { useSessionState } from "@/hooks/useSessionState";

const PARTS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "part1" as const, label: "Part 1", subtitle: "Word recognition" },
  { id: "part2" as const, label: "Part 2", subtitle: "Matching information" },
  { id: "part3" as const, label: "Part 3", subtitle: "Short conversations" },
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
}

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const Listening = () => {
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("listening");
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("listening");
  const { progress } = useUserExamProgress();
  const [exam, setExam] = useSessionState<ExamState>("listening:exam", {
    active: false, partType: "part1", testTitle: "", showResults: false,
    correct: 0, total: 0, loadingExam: false,
  }, { omitKeys: ["engineData"] });
  const [fullPractice, setFullPractice] = useSessionState<FullPracticeState>("listening:full", {
    active: false, fullTestId: "", title: "",
  });
  const [marathon, setMarathon] = useState<{ active: boolean; partType: ListeningPartType }>({
    active: false, partType: "part1",
  });
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
        handleStartFromDB(target);
      }
    } else {
      rehydratedRef.current = true;
      handleStartMock(exam.partType);
    }
  }, [exam.active, exam.engineData, exam.examSetId, exam.partType, examSets, loading]);

  const [searchParams, setSearchParams] = useSearchParams();
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    const setId = searchParams.get("set");
    if (!setId || loading || autoStartedRef.current === setId) return;
    const target = examSets.find((s) => s.id === setId);
    if (target) {
      autoStartedRef.current = setId;
      handleStartFromDB(target);
      const next = new URLSearchParams(searchParams);
      next.delete("set");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, examSets, loading]);

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activeTab)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets]);

  const marathonSets = useMemo(
    () => examSets.filter((s) => normalizePart(s.part) === marathon.partType),
    [examSets, marathon.partType]
  );


  const handleStartFromDB = async (set: ExamSetRow) => {
    const partType = normalizePart(set.part) as ListeningPartType;
    setExam((prev) => ({ ...prev, active: true, partType, testTitle: set.title, loadingExam: true, showResults: false, correct: 0, total: 0, examSetId: set.id, startedAt: Date.now() }));
    const questions = await fetchExamQuestions(set.id);
    const sourceQuestionIds = questions.map((q: any) => q.id);
    let engineData: any = { sourceQuestionIds };
    switch (partType) {
      case "part1": engineData.part1Questions = toListeningPart1(questions); break;
      case "part2": engineData.part2Questions = toListeningPart2(questions); break;
      case "part3": engineData.part3Questions = toListeningPart3(questions); break;
      case "part4": engineData.part4Questions = toListeningPart4(questions); break;
    }
    setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
  };

  const handleRandomPractice = () => {
    if (examSets.length > 0) {
      handleStartFromDB(examSets[Math.floor(Math.random() * examSets.length)]);
    } else {
      const parts: ListeningPartType[] = ["part1", "part2", "part3", "part4"];
      handleStartMock(parts[Math.floor(Math.random() * parts.length)]);
    }
  };

  const handleStartMock = (partType: ListeningPartType) => {
    const mockData: any = {};
    switch (partType) {
      case "part1": mockData.part1Questions = mockListeningPart1; break;
      case "part2": mockData.part2Questions = mockListeningPart2; break;
      case "part3": mockData.part3Questions = mockListeningPart3; break;
      case "part4": mockData.part4Questions = mockListeningPart4; break;
    }
    setExam({
      active: true, partType, testTitle: `${PARTS.find(p => p.id === partType)?.label} – Đề mẫu`,
      showResults: false, correct: 0, total: 0, engineData: mockData, loadingExam: false,
      examSetId: null, startedAt: Date.now(),
    });
  };

  const handleComplete = (correct: number, total: number, perQuestion?: any[]) => {
    setExam((prev) => {
      const timeSpent = prev.startedAt ? Math.floor((Date.now() - prev.startedAt) / 1000) : undefined;
      saveExamResult({
        examSetId: prev.examSetId ?? null,
        skill: "listening",
        correct, total, timeSpent,
        perQuestion,
      });
      return { ...prev, correct, total };
    });
    saveTestResult({ correct, total, skill: "listening" });
  };

  const handleExit = () => {
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
        onExit={() => setMarathon({ active: false, partType: marathon.partType })}
      />
    );
  }

  if (exam.active) {
    if (exam.loadingExam) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-24 pb-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      );
    }

    return (
      <ListeningExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={LISTENING_TIME[exam.partType] ?? 2400}
        onExit={handleExit} onComplete={handleComplete} showResultsOnSubmit
        examSetId={exam.examSetId ?? null}
        {...exam.engineData}
      />
    );
  }

  const activePartInfo = PARTS.find((t) => t.id === activeTab);
  const hasMockFallback = activeTab !== "full" && filteredSets.length === 0;

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
            ) : !authUser ? (
              <LoginToPracticePrompt message="Đăng nhập để luyện tập theo kỹ năng với giao diện giống đề thi thật 100%" />
            ) : (
              <FullPartSection
                progress={progress}
                skillName="Listening"
                sets={fullSets}
                loading={fullLoading}
                onStart={handleStartFullPractice}
              />
            )
          ) : (
            <>
              {activePartInfo && (
                <div className="mb-6">
                  <h2 className="text-lg font-heading font-semibold text-foreground">{activePartInfo.label} – {activePartInfo.subtitle}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {loading ? "Đang tải..." : `${filteredSets.length + (hasMockFallback ? 1 : 0)} bộ đề luyện tập`}
                  </p>
                </div>
              )}

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : !authUser ? (
                <LoginToPracticePrompt message="Đăng nhập để luyện tập theo kỹ năng với giao diện giống đề thi thật 100%" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative rounded-xl p-5 flex flex-col h-full border-2 border-primary/60 bg-gradient-to-br from-primary/10 via-accent/5 to-background shadow-lg shadow-primary/10">
                        <Badge className="w-fit text-[11px] font-semibold mb-3 bg-primary text-primary-foreground border-0 gap-1">
                          <InfinityIcon className="w-3 h-3" /> Marathon
                        </Badge>
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
                            onClick={() => setMarathon({ active: true, partType: activeTab as ListeningPartType })}
                            className="gap-1.5 font-semibold"
                          >
                            Bắt đầu <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {filteredSets.map((set, index) => (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
                      <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">{activePartInfo?.label}</Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">🎧 {set.description || "Đề luyện tập"}</span>
                        </div>
                        <div className="mb-4"><CompletionBadge item={progress.get(set.id)} /></div>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleStartFromDB(set)} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                            Luyện tập<ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {hasMockFallback && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      <div className="group relative tech-card bg-card border border-dashed border-border rounded-xl p-5 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-muted text-muted-foreground border-0">Đề mẫu</Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">Đề mẫu</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">🎧 Dữ liệu mẫu để luyện tập</span>
                        </div>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleStartMock(activeTab as ListeningPartType)} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                            Luyện tập<ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </>
          )}

          
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Listening;
