import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Search, Clock, Shuffle, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";

import ListeningResults from "@/components/listening/ListeningResults";
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

const PARTS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả các Part" },
  { id: "part1" as const, label: "Part 1", subtitle: "Word recognition" },
  { id: "part2" as const, label: "Part 2", subtitle: "Matching information" },
  { id: "part3" as const, label: "Part 3", subtitle: "Short conversations" },
  { id: "part4" as const, label: "Part 4", subtitle: "Monologues" },
];

interface ExamState {
  active: boolean;
  partType: ListeningPartType;
  testTitle: string;
  showResults: boolean;
  correct: number;
  total: number;
  engineData?: any;
  loadingExam: boolean;
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
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "part1", testTitle: "", showResults: false,
    correct: 0, total: 0, loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    return examSets
      .filter((s) => normalizePart(s.part) === activeTab)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets]);

  const handleStartFromDB = async (set: ExamSetRow) => {
    const partType = normalizePart(set.part) as ListeningPartType;
    setExam((prev) => ({ ...prev, active: true, partType, testTitle: set.title, loadingExam: true, showResults: false, correct: 0, total: 0 }));
    const questions = await fetchExamQuestions(set.id);
    let engineData: any = {};
    switch (partType) {
      case "part1": engineData = { part1Questions: toListeningPart1(questions) }; break;
      case "part2": engineData = { part2Questions: toListeningPart2(questions) }; break;
      case "part3": engineData = { part3Questions: toListeningPart3(questions) }; break;
      case "part4": engineData = { part4Questions: toListeningPart4(questions) }; break;
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
    });
  };

  const handleComplete = (correct: number, total: number) => {
    setExam((prev) => ({ ...prev, showResults: true, correct, total }));
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

    if (exam.showResults) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-24 pb-20">
            <div className="section-container">
              <ListeningResults
                correct={exam.correct} total={exam.total} partLabel={exam.testTitle}
                onExit={handleExit} onRetry={() => setExam((prev) => ({ ...prev, showResults: false }))}
              />
            </div>
          </main>
        </div>
      );
    }

    return (
      <ListeningExamEngine
        partType={exam.partType} testTitle={exam.testTitle} timeLimit={2100}
        onExit={handleExit} onComplete={handleComplete} {...exam.engineData}
      />
    );
  }

  const activePartInfo = PARTS.find((t) => t.id === activeTab);
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

        <section className="border-b border-border">
          <div className="section-container py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 border border-primary/20 rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Shuffle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground text-base">Luyện Listening ngẫu nhiên</h2>
                  <p className="text-sm text-muted-foreground">Luyện 1 bộ đề Aptis Listening ngẫu nhiên</p>
                </div>
              </div>
              <Button onClick={handleRandomPractice} className="bg-primary hover:bg-brand-brown text-white shrink-0">
                Bắt đầu<ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
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
            <FullPartSection
              skillName="Listening"
              sets={fullSets}
              loading={fullLoading}
              onStart={handleStartFullPractice}
            />
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

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.map((set, index) => (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
                      <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">{activePartInfo?.label}</Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1.5">🎧 {set.description || "Đề luyện tập"}</span>
                        </div>
                        <div className="mb-4"><span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Chưa bắt đầu</span></div>
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

          <ExamPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Listening;
