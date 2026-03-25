import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Search, Clock, Shuffle, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import SpeakingExamEngine from "@/components/speaking/SpeakingExamEngine";
import type { SpeakingPartType } from "@/data/speakingQuestions";
import {
  mockSpeakingPart1, mockSpeakingPart2, mockSpeakingPart3, mockSpeakingPart4,
} from "@/data/speakingQuestions";
import { useExamSets, fetchExamQuestions, normalizePart, type ExamSetRow } from "@/hooks/useExamSets";
import { toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4 } from "@/lib/examTransformers";
import { Skeleton } from "@/components/ui/skeleton";

const TASKS = [
  { id: "part1" as const, label: "Part 1", subtitle: "Personal Questions" },
  { id: "part2" as const, label: "Part 2", subtitle: "Describe a Picture" },
  { id: "part3" as const, label: "Part 3", subtitle: "Compare Pictures" },
  { id: "part4" as const, label: "Part 4", subtitle: "Opinion Questions" },
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
}

const Speaking = () => {
  const [activeTab, setActiveTab] = useState("part1");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading } = useExamSets("speaking");
  const [exam, setExam] = useState<ExamState>({
    active: false, partType: "part1", testTitle: "", loadingExam: false,
  });

  const filteredSets = useMemo(() => {
    return examSets
      .filter((s) => normalizePart(s.part) === activeTab)
      .filter((s) => searchQuery.trim() ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) : true);
  }, [activeTab, searchQuery, examSets]);

  const handleStartFromDB = async (set: ExamSetRow) => {
    const partType = normalizePart(set.part) as SpeakingPartType;
    setExam({ active: true, partType, testTitle: set.title, loadingExam: true });
    const questions = await fetchExamQuestions(set.id);
    let engineData: any = {};
    switch (partType) {
      case "part1": engineData = { part1Data: toSpeakingPart1(questions) }; break;
      case "part2": engineData = { part2Data: toSpeakingPart2(questions) }; break;
      case "part3": engineData = { part3Data: toSpeakingPart3(questions) }; break;
      case "part4": engineData = { part4Data: toSpeakingPart4(questions) }; break;
    }
    setExam((prev) => ({ ...prev, engineData, loadingExam: false }));
  };

  const handleRandomPractice = () => {
    if (examSets.length > 0) {
      handleStartFromDB(examSets[Math.floor(Math.random() * examSets.length)]);
    } else {
      handleStartMock(TASKS[Math.floor(Math.random() * TASKS.length)].id);
    }
  };

  const handleStartMock = (partType: SpeakingPartType) => {
    const mockData: any = {};
    switch (partType) {
      case "part1": mockData.part1Data = mockSpeakingPart1; break;
      case "part2": mockData.part2Data = mockSpeakingPart2; break;
      case "part3": mockData.part3Data = mockSpeakingPart3; break;
      case "part4": mockData.part4Data = mockSpeakingPart4; break;
    }
    setExam({
      active: true, partType, testTitle: `${TASKS.find(p => p.id === partType)?.label} – Đề mẫu`,
      engineData: mockData, loadingExam: false,
    });
  };

  const handleExit = () => {
    setExam({ active: false, partType: "part1", testTitle: "", loadingExam: false });
  };

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
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <SpeakingExamEngine
              partType={exam.partType} testTitle={exam.testTitle}
              timeLimit={TIME_LIMITS[exam.partType]} onExit={handleExit} onComplete={() => {}}
              {...exam.engineData}
            />
          </div>
        </main>
      </div>
    );
  }

  const activeTaskInfo = TASKS.find((t) => t.id === activeTab);
  const hasMockFallback = filteredSets.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
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
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện nói qua các đề thi với format Aptis Speaking. Ghi âm câu trả lời với thời gian chuẩn bị và trả lời giống bài thi thật.
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
                  <h2 className="font-heading font-semibold text-foreground text-base">Luyện Speaking ngẫu nhiên</h2>
                  <p className="text-sm text-muted-foreground">Luyện 1 bộ đề thi Aptis Speaking ngẫu nhiên</p>
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
            <Input placeholder="Tìm kiếm bộ đề Speaking..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {TASKS.map((task) => (
                <TabsTrigger key={task.id} value={task.id} className="flex-1 min-w-[140px] text-xs sm:text-sm py-2.5 data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
                  <span className="font-semibold">{task.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {task.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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
                    <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">{activeTaskInfo?.label}</Badge>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-3">{set.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1.5">🎤 Ghi âm</span>
                      <span className="flex items-center gap-1.5">⏱️ Có thời gian chuẩn bị</span>
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
                      <span className="flex items-center gap-1.5">🎤 Dữ liệu mẫu để luyện tập</span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleStartMock(activeTab as SpeakingPartType)} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                        Luyện tập<ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Speaking;
