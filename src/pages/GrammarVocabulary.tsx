import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookA, Search, Shuffle, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ExamPagination from "@/components/ExamPagination";
import GrammarResults from "@/components/grammar/GrammarResults";
import FullPartSection from "@/components/practice/FullPartSection";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import { fetchQuestionsBySkill } from "@/lib/questions";
import { type Question } from "@/data/questions";
import { useExamSets, fetchExamQuestions, type ExamSetRow } from "@/hooks/useExamSets";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { toGrammarQuestions } from "@/lib/examTransformers";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = [
  { id: "full" as const, label: "Full Part", subtitle: "Tất cả" },
  { id: "sets" as const, label: "Bộ đề lẻ", subtitle: "Grammar & Vocab" },
];

type ExamState = {
  active: boolean;
  questions: Question[];
  title: string;
  showResults: boolean;
  answers: (number | null)[];
  fillAnswers: string[];
  loadingExam: boolean;
};

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
}

const GrammarVocabulary = () => {
  const [activeTab, setActiveTab] = useState("full");
  const [searchQuery, setSearchQuery] = useState("");
  const { examSets, loading, page, setPage, totalPages } = useExamSets("grammar_vocab");
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("grammar_vocab");
  const [exam, setExam] = useState<ExamState>({
    active: false, questions: [], title: "", showResults: false,
    answers: [], fillAnswers: [], loadingExam: false,
  });
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });

  const filteredSets = useMemo(() => {
    if (activeTab === "full") return [];
    if (!searchQuery.trim()) return examSets;
    const q = searchQuery.toLowerCase();
    return examSets.filter((s) => s.title.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
  }, [searchQuery, examSets, activeTab]);

  const handleStartFromDB = async (set: ExamSetRow) => {
    setExam((prev) => ({ ...prev, active: true, title: set.title, loadingExam: true, showResults: false }));
    const questions = await fetchExamQuestions(set.id);
    const transformed = toGrammarQuestions(questions);
    setExam({
      active: true, questions: transformed, title: set.title, showResults: false,
      answers: new Array(transformed.length).fill(null),
      fillAnswers: new Array(transformed.length).fill(""),
      loadingExam: false,
    });
  };

  const handleRandomPractice = async () => {
    if (examSets.length > 0) {
      handleStartFromDB(examSets[Math.floor(Math.random() * examSets.length)]);
    } else {
      setExam((prev) => ({ ...prev, loadingExam: true, active: true, title: "Luyện tập ngẫu nhiên" }));
      const qs = await fetchQuestionsBySkill("grammar");
      const shuffled = qs.sort(() => Math.random() - 0.5).slice(0, 10);
      setExam({
        active: true, questions: shuffled, title: "Luyện tập ngẫu nhiên", showResults: false,
        answers: new Array(shuffled.length).fill(null),
        fillAnswers: new Array(shuffled.length).fill(""),
        loadingExam: false,
      });
    }
  };

  const handleComplete = () => {
    setExam((prev) => ({ ...prev, showResults: true }));
  };

  const handleExit = () => {
    setExam({ active: false, questions: [], title: "", showResults: false, answers: [], fillAnswers: [], loadingExam: false });
  };

  const handleRetry = () => {
    setExam((prev) => ({
      ...prev, showResults: false,
      answers: new Array(prev.questions.length).fill(null),
      fillAnswers: new Array(prev.questions.length).fill(""),
    }));
  };

  const handleStartFullPractice = (set: SkillFullSetItem) => {
    setFullPractice({ active: true, fullTestId: set.fullTestId, title: set.title });
  };

  const handleExitFullPractice = () => {
    setFullPractice({ active: false, fullTestId: "", title: "" });
  };

  if (fullPractice.active) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <SkillFullPracticeEngine
              fullTestId={fullPractice.fullTestId}
              skill="grammar_vocab"
              testTitle={fullPractice.title}
              onExit={handleExitFullPractice}
            />
          </div>
        </main>
      </div>
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
              <GrammarResults questions={exam.questions} answers={exam.answers} fillAnswers={exam.fillAnswers} onExit={handleExit} onRetry={handleRetry} />
            </div>
          </main>
        </div>
      );
    }

    return (
      <GrammarExamEngine
        questions={exam.questions} testTitle={exam.title} timeLimit={600}
        onExit={handleExit} onComplete={handleComplete}
        onAnswersChange={(answers, fillAnswers) => setExam((prev) => ({ ...prev, answers, fillAnswers }))}
      />
    );
  }

  const hasMockFallback = activeTab === "sets" && filteredSets.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookA className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Grammar & Vocabulary</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện ngữ pháp và từ vựng thường gặp trong bài thi Aptis. Hệ thống bài luyện từ cơ bản đến nâng cao.
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
                  <h2 className="font-heading font-semibold text-foreground text-base">Luyện Grammar & Vocabulary ngẫu nhiên</h2>
                  <p className="text-sm text-muted-foreground">Luyện 10 câu hỏi ngẫu nhiên từ ngân hàng câu hỏi.</p>
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
            <Input placeholder="Tìm kiếm chủ đề ngữ pháp hoặc từ vựng..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex-1 min-w-[140px] text-xs sm:text-sm py-2.5 transition-all ${
                    tab.id === "full"
                      ? "data-[state=active]:bg-[#CC1C01] data-[state=active]:text-white data-[state=active]:shadow-md"
                      : "data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md"
                  }`}
                >
                  <span className="font-semibold">{tab.label}</span>
                  <span className="hidden sm:inline ml-1 opacity-80">– {tab.subtitle}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeTab === "full" ? (
            <FullPartSection
              skillName="Grammar & Vocabulary"
              sets={fullSets}
              loading={fullLoading}
              onStart={handleStartFullPractice}
            />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-heading font-semibold text-foreground">Bộ đề luyện tập</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {loading ? "Đang tải..." : `${filteredSets.length + (hasMockFallback ? 1 : 0)} bộ đề`}
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {filteredSets.map((set, index) => (
                    <motion.div key={set.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
                      <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                        <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">
                          Grammar & Vocab
                        </Badge>
                        <h3 className="text-xl font-heading font-bold text-foreground mb-2">{set.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{set.description || "Đề luyện tập"}</p>
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
                        <h3 className="text-xl font-heading font-bold text-foreground mb-2">Đề mẫu</h3>
                        <p className="text-sm text-muted-foreground mb-3">Dữ liệu mẫu để luyện tập</p>
                        <div className="flex-1" />
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={handleRandomPractice} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
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

export default GrammarVocabulary;
