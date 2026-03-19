import { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookA, Search, Shuffle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import GrammarResults from "@/components/grammar/GrammarResults";
import { fetchQuestionsBySkill } from "@/lib/questions";
import { getQuestionsBySkill, type Question } from "@/data/questions";

const TOPICS = [
  { id: "basic-grammar", name: "Basic Grammar", description: "Ngữ pháp cơ bản cho người mới bắt đầu", questionCount: 45 },
  { id: "tenses", name: "Tenses", description: "Các thì trong tiếng Anh", questionCount: 78 },
  { id: "nouns", name: "Nouns", description: "Danh từ trong tiếng Anh", questionCount: 62 },
  { id: "verbs", name: "Verbs", description: "Động từ và cách chia động từ", questionCount: 70 },
  { id: "adjectives", name: "Adjectives", description: "Tính từ và cách sử dụng", questionCount: 55 },
  { id: "prepositions", name: "Prepositions", description: "Giới từ thường gặp trong Aptis", questionCount: 48 },
  { id: "vocabulary", name: "Vocabulary", description: "Từ vựng theo chủ đề thi Aptis", questionCount: 90 },
  { id: "phrasal-verbs", name: "Phrasal Verbs", description: "Cụm động từ thường gặp", questionCount: 65 },
  { id: "common-collocations", name: "Common Collocations", description: "Các cụm từ kết hợp phổ biến", questionCount: 58 },
];

type ExamState = {
  active: boolean;
  questions: Question[];
  title: string;
  showResults: boolean;
  answers: (number | null)[];
  fillAnswers: string[];
};

const GrammarVocabulary = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState<ExamState>({
    active: false,
    questions: [],
    title: "",
    showResults: false,
    answers: [],
    fillAnswers: [],
  });

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return TOPICS;
    const q = searchQuery.toLowerCase();
    return TOPICS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const startExam = async (title: string) => {
    setLoading(true);
    try {
      const qs = await fetchQuestionsBySkill("grammar");
      const shuffled = qs.sort(() => Math.random() - 0.5).slice(0, 10);
      setExam({
        active: true,
        questions: shuffled,
        title,
        showResults: false,
        answers: new Array(shuffled.length).fill(null),
        fillAnswers: new Array(shuffled.length).fill(""),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (correct: number, total: number) => {
    setExam((prev) => ({ ...prev, showResults: true }));
  };

  const handleExit = () => {
    setExam({
      active: false,
      questions: [],
      title: "",
      showResults: false,
      answers: [],
      fillAnswers: [],
    });
  };

  const handleRetry = () => {
    setExam((prev) => ({
      ...prev,
      showResults: false,
      answers: new Array(prev.questions.length).fill(null),
      fillAnswers: new Array(prev.questions.length).fill(""),
    }));
  };

  // Exam mode
  if (exam.active) {
    if (exam.showResults) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pt-24 pb-20">
            <div className="section-container">
              <GrammarResults
                questions={exam.questions}
                answers={exam.answers}
                fillAnswers={exam.fillAnswers}
                onExit={handleExit}
                onRetry={handleRetry}
              />
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <GrammarExamEngine
              questions={exam.questions}
              testTitle={exam.title}
              timeLimit={600}
              onExit={handleExit}
              onComplete={handleComplete}
              onAnswersChange={(answers, fillAnswers) => {
                setExam((prev) => ({ ...prev, answers, fillAnswers }));
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // Topic listing (unchanged layout)
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <BookA className="w-6 h-6 text-violet-500" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
                Grammar & Vocabulary
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện ngữ pháp và từ vựng thường gặp trong bài thi Aptis. Hệ thống bài luyện từ cơ bản đến nâng cao.
              </p>
            </div>
          </div>
        </section>

        {/* Random practice block */}
        <section className="border-b border-border">
          <div className="section-container py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-500/5 to-violet-500/10 dark:from-violet-500/10 dark:to-violet-500/5 border border-violet-500/20 rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                  <Shuffle className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground text-base">
                    Luyện Grammar & Vocabulary ngẫu nhiên
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Luyện 10 câu hỏi ngẫu nhiên từ ngân hàng câu hỏi.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => startExam("Luyện tập ngẫu nhiên")}
                disabled={loading}
                className="bg-violet-500 hover:bg-violet-600 text-white shrink-0"
              >
                {loading ? "Đang tải..." : "Bắt đầu"}
                {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </section>

        {/* Search + Cards */}
        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm chủ đề ngữ pháp hoặc từ vựng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card"
            />
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Chủ đề luyện tập
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredTopics.length} chủ đề
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredTopics.map((topic, index) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                  <Badge
                    variant="secondary"
                    className="w-fit text-[11px] font-medium mb-3 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-0"
                  >
                    Grammar & Vocab
                  </Badge>

                  <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                    {topic.name}
                  </h3>

                  <p className="text-sm text-muted-foreground mb-3">
                    {topic.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1.5">
                      📝 {topic.questionCount} câu hỏi
                    </span>
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
                      onClick={() => startExam(topic.name)}
                      disabled={loading}
                      className="text-violet-500 hover:text-violet-600 hover:bg-violet-500/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                    >
                      Luyện tập
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredTopics.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Không tìm thấy chủ đề nào phù hợp.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default GrammarVocabulary;
