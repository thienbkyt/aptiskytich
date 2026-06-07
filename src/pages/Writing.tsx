import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, Search, Clock, Shuffle, ArrowRight, ArrowLeft, RotateCcw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import WritingExamEngine from "@/components/writing/WritingExamEngine";

import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import type { WritingPartType } from "@/components/writing/WritingExamEngine";
import {
  mockWritingPart1, mockWritingPart2, mockWritingPart3, mockWritingPart4,
} from "@/data/writingQuestions";
import { useExamSets, fetchExamQuestions, normalizePart, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4 } from "@/lib/examTransformers";
import { Skeleton } from "@/components/ui/skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CompletionBadge from "@/components/practice/CompletionBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { saveExamResult } from "@/lib/saveExamResult";

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
}

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const Writing = () => {
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("writing");
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("writing");
  const { progress } = useUserExamProgress();
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "task1", testTitle: "", completed: false, loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });

  const activePartKey = TASKS.find(t => t.id === activeTab)?.partKey || "part1";

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activePartKey)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets, activePartKey]);

  const handleStartFromDB = async (set: ExamSetRow) => {
    const normalizedPart = normalizePart(set.part);
    const partType = partToTask[normalizedPart] || "task1";
    setExam({ active: true, partType, testTitle: set.title, completed: false, loadingExam: true, examSetId: set.id, startedAt: Date.now() });
    const questions = await fetchExamQuestions(set.id);
    const sourceQuestionIds = questions.map((q: any) => q.id);
    let engineData: any = { sourceQuestionIds };
    switch (normalizedPart) {
      case "part1": engineData.part1Data = toWritingPart1(questions); break;
      case "part2": engineData.part2Data = toWritingPart2(questions); break;
      case "part3": engineData.part3Data = toWritingPart3(questions); break;
      case "part4": engineData.part4Data = toWritingPart4(questions); break;
    }
    setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
  };

  const handleRandomPractice = () => {
    if (examSets.length > 0) {
      handleStartFromDB(examSets[Math.floor(Math.random() * examSets.length)]);
    } else {
      const randomTask = TASKS.filter(t => t.id !== "full")[Math.floor(Math.random() * 4)];
      handleStartMock(randomTask.id as WritingPartType);
    }
  };

  const handleStartMock = (taskId: WritingPartType) => {
    const mockData: any = {};
    switch (taskId) {
      case "task1": mockData.part1Data = mockWritingPart1[0]; break;
      case "task2": mockData.part2Data = mockWritingPart2[0]; break;
      case "task3": mockData.part3Data = mockWritingPart3[0]; break;
      case "task4": mockData.part4Data = mockWritingPart4[0]; break;
    }
    setExam({
      active: true, partType: taskId, testTitle: `${TASKS.find(p => p.id === taskId)?.label} – Đề mẫu`,
      completed: false, engineData: mockData, loadingExam: false,
      examSetId: null, startedAt: Date.now(),
    });
  };

  const handleExit = () => {
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
          <main className="flex-1 pt-24 pb-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      );
    }

    if (exam.completed) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-24 pb-20">
            <div className="section-container max-w-3xl">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-8 text-center">
                <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Bài viết đã được nộp! ✍️</h2>
                <p className="text-sm text-muted-foreground mb-6">{exam.testTitle}</p>
                <p className="text-muted-foreground text-sm mb-8">Bài viết của bạn đã được ghi nhận. Hãy so sánh với bài mẫu để cải thiện kỹ năng viết.</p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={handleExit} className="gap-2"><ArrowLeft className="w-4 h-4" /> Quay lại</Button>
                  <Button onClick={() => setExam((p) => ({ ...p, completed: false }))} className="gap-2"><RotateCcw className="w-4 h-4" /> Làm lại</Button>
                </div>
              </motion.div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <WritingExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={WRITING_TIME[exam.partType] ?? 3000}
        onExit={handleExit} onComplete={(perQuestion) => {
          setExam((p) => {
            const timeSpent = p.startedAt ? Math.floor((Date.now() - p.startedAt) / 1000) : undefined;
            saveExamResult({
              examSetId: p.examSetId ?? null,
              skill: "writing",
              correct: 0, total: perQuestion?.length || 0, timeSpent,
              perQuestion,
            });
            return { ...p, completed: true };
          });
        }}
        {...exam.engineData}
      />
    );
  }

  const activeTaskInfo = TASKS.find((t) => t.id === activeTab);
  const hasMockFallback = activeTab !== "full" && filteredSets.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5"><Clock className="w-3 h-3" />50 phút</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Phần thi Writing</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện viết theo format bài thi Aptis Writing. Hoàn thành các task viết với thời gian giống bài thi thật.
              </p>
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
            <FullPartSection
              progress={progress}
              skillName="Writing"
              sets={fullSets}
              loading={fullLoading}
              onStart={handleStartFullPractice}
            />
          ) : (
            <>
              {activeTaskInfo && (
                <div className="mb-6">
                  <h2 className="text-lg font-heading font-semibold text-foreground">{activeTaskInfo.label} – {activeTaskInfo.subtitle}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {loading ? "Đang tải..." : `${filteredSets.length + (hasMockFallback ? 1 : 0)} bộ đề luyện tập`}
                  </p>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.map((set, index) => (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
                      <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary border-0">{activeTaskInfo?.label}</Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">✍️ {set.description || "Đề luyện tập"}</span>
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
                      <div className="group relative bg-card border border-dashed border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-muted text-muted-foreground border-0">Đề mẫu</Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">Đề mẫu</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">✍️ Dữ liệu mẫu để luyện tập</span>
                        </div>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleStartMock(activeTab as WritingPartType)} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
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

export default Writing;
