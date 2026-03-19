import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Search, Clock, Shuffle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import SpeakingExamEngine from "@/components/speaking/SpeakingExamEngine";
import type { SpeakingPartType } from "@/data/speakingQuestions";
import {
  mockSpeakingPart1,
  mockSpeakingPart2,
  mockSpeakingPart3,
  mockSpeakingPart4,
} from "@/data/speakingQuestions";

const TASKS = [
  { id: "part1" as const, label: "Part 1", subtitle: "Personal Questions" },
  { id: "part2" as const, label: "Part 2", subtitle: "Describe a Picture" },
  { id: "part3" as const, label: "Part 3", subtitle: "Compare Pictures" },
  { id: "part4" as const, label: "Part 4", subtitle: "Opinion Questions" },
];

const TESTS_PER_TASK = 9;

interface TestCard {
  taskId: SpeakingPartType;
  taskLabel: string;
  testNumber: number;
}

const generateTests = (): TestCard[] => {
  const tests: TestCard[] = [];
  TASKS.forEach((task) => {
    for (let i = 1; i <= TESTS_PER_TASK; i++) {
      tests.push({ taskId: task.id, taskLabel: task.label, testNumber: i });
    }
  });
  return tests;
};

const allTests = generateTests();

interface ExamState {
  active: boolean;
  partType: SpeakingPartType;
  testTitle: string;
}

const TIME_LIMITS: Record<SpeakingPartType, number> = {
  part1: 180,  // 3 min
  part2: 120,  // 2 min
  part3: 150,  // 2.5 min
  part4: 240,  // 4 min
};

const Speaking = () => {
  const [activeTab, setActiveTab] = useState("part1");
  const [searchQuery, setSearchQuery] = useState("");
  const [exam, setExam] = useState<ExamState>({
    active: false,
    partType: "part1",
    testTitle: "",
  });

  const filteredTests = useMemo(() => {
    return allTests
      .filter((t) => t.taskId === activeTab)
      .filter((t) =>
        searchQuery.trim()
          ? `TEST ${t.testNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      );
  }, [activeTab, searchQuery]);

  const handleStartTest = (test: TestCard) => {
    setExam({
      active: true,
      partType: test.taskId,
      testTitle: `${test.taskLabel} – TEST ${test.testNumber}`,
    });
  };

  const handleRandomPractice = () => {
    const randomTask = TASKS[Math.floor(Math.random() * TASKS.length)];
    handleStartTest({
      taskId: randomTask.id,
      taskLabel: randomTask.label,
      testNumber: Math.floor(Math.random() * TESTS_PER_TASK) + 1,
    });
  };

  const handleExit = () => {
    setExam({ active: false, partType: "part1", testTitle: "" });
  };

  // Exam mode
  if (exam.active) {
    const engineProps = {
      partType: exam.partType,
      testTitle: exam.testTitle,
      timeLimit: TIME_LIMITS[exam.partType],
      onExit: handleExit,
      onComplete: () => {},
      ...(exam.partType === "part1" && { part1Data: mockSpeakingPart1 }),
      ...(exam.partType === "part2" && { part2Data: mockSpeakingPart2 }),
      ...(exam.partType === "part3" && { part3Data: mockSpeakingPart3 }),
      ...(exam.partType === "part4" && { part4Data: mockSpeakingPart4 }),
    };

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <SpeakingExamEngine {...engineProps} />
          </div>
        </main>
      </div>
    );
  }

  // Listing page
  const activeTaskInfo = TASKS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-orange-500" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />
                  12 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
                Phần thi Speaking
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện nói qua các đề thi với format Aptis Speaking. Ghi âm câu trả lời với thời gian chuẩn bị và trả lời giống bài thi thật.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="section-container py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/5 to-orange-500/10 dark:from-orange-500/10 dark:to-orange-500/5 border border-orange-500/20 rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                  <Shuffle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground text-base">
                    Luyện Speaking ngẫu nhiên
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Luyện 1 bộ đề thi Aptis Speaking ngẫu nhiên
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRandomPractice}
                className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
              >
                Bắt đầu
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm bộ đề Speaking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {TASKS.map((task) => (
                <TabsTrigger
                  key={task.id}
                  value={task.id}
                  className="flex-1 min-w-[140px] text-xs sm:text-sm py-2.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <span className="font-semibold">{task.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {task.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeTaskInfo && (
            <div className="mb-6">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                {activeTaskInfo.label} – {activeTaskInfo.subtitle}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredTests.length} bộ đề luyện tập
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredTests.map((test, index) => (
              <motion.div
                key={`${test.taskId}-${test.testNumber}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                  <Badge
                    variant="secondary"
                    className="w-fit text-[11px] font-medium mb-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-0"
                  >
                    {test.taskLabel}
                  </Badge>

                  <h3 className="text-xl font-heading font-bold text-foreground mb-3">
                    TEST {test.testNumber}
                  </h3>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1.5">🎤 Ghi âm</span>
                    <span className="flex items-center gap-1.5">⏱️ Có thời gian chuẩn bị</span>
                  </div>

                  <div className="mb-4">
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Chưa bắt đầu
                    </span>
                  </div>

                  <div className="flex-1" />

                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartTest(test)}
                      className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                    >
                      Luyện tập
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredTests.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                Không tìm thấy bộ đề nào phù hợp.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Speaking;
