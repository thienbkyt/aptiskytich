import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight, BookOpen, Headphones, FileText, Mic, PenLine } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getQuestionsBySkill, sampleGapFillQuestions, type Question, type GapFillQuestion } from "@/data/questions";
import { fetchQuestionsBySkill } from "@/lib/questions";
import ReadingInstructions from "@/components/reading/ReadingInstructions";
import ReadingGapFill from "@/components/reading/ReadingGapFill";

const skills = [
  { key: "grammar" as const, label: "Grammar & Vocabulary", icon: BookOpen, color: "bg-primary", iconColor: "text-primary-foreground" },
  { key: "reading" as const, label: "Reading", icon: FileText, color: "bg-info", iconColor: "text-info-foreground" },
  { key: "listening" as const, label: "Listening", icon: Headphones, color: "bg-warning", iconColor: "text-warning-foreground" },
  { key: "speaking" as const, label: "Speaking", icon: Mic, color: "bg-success", iconColor: "text-success-foreground" },
  { key: "writing" as const, label: "Writing", icon: PenLine, color: "bg-destructive", iconColor: "text-destructive-foreground" },
];

type ReadingPhase = "instructions" | "practice" | "review";

const Practice = () => {
  const [selectedSkill, setSelectedSkill] = useState<Question["skill"] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [stats, setStats] = useState({ total: 0, correct: 0 });

  // Reading gap-fill state
  const [readingPhase, setReadingPhase] = useState<ReadingPhase>("instructions");
  const [gapFillQuestions] = useState<GapFillQuestion[]>(sampleGapFillQuestions);
  const [currentGapFill, setCurrentGapFill] = useState(0);
  const [gapFillAnswers, setGapFillAnswers] = useState<(number | null)[][]>([]);
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [readingTimeLeft, setReadingTimeLeft] = useState(600); // 10 minutes
  const READING_TOTAL_TIME = 600;

  // Reading timer
  useEffect(() => {
    if (selectedSkill !== "reading" || readingPhase !== "practice" || readingSubmitted || readingTimeLeft <= 0) return;
    const t = setInterval(() => setReadingTimeLeft(p => {
      if (p <= 1) { clearInterval(t); setReadingSubmitted(true); setReadingPhase("review"); setCurrentGapFill(0); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [selectedSkill, readingPhase, readingSubmitted, readingTimeLeft]);

  const startPractice = async (skill: Question["skill"]) => {
    if (skill === "reading") {
      setSelectedSkill("reading");
      setReadingPhase("instructions");
      setCurrentGapFill(0);
      setGapFillAnswers(gapFillQuestions.map(q => new Array(q.gaps.length).fill(null)));
      setReadingSubmitted(false);
      return;
    }
    const qs = (await fetchQuestionsBySkill(skill)).sort(() => Math.random() - 0.5);
    setQuestions(qs);
    setSelectedSkill(skill);
    setCurrent(0);
    setSelected(null);
    setSubmitted(false);
  };

  const checkAnswer = () => {
    setSubmitted(true);
    setStats((p) => ({
      total: p.total + 1,
      correct: p.correct + (selected === questions[current].correct_answer ? 1 : 0),
    }));
  };

  const nextQuestion = () => {
    if (current < questions.length - 1) {
      setCurrent((p) => p + 1);
    } else {
      setQuestions((qs) => [...qs].sort(() => Math.random() - 0.5));
      setCurrent(0);
    }
    setSelected(null);
    setSubmitted(false);
  };

  // Reading gap-fill: skill selection screen
  if (!selectedSkill) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">Luyện tập theo kỹ năng</h1>
              <p className="text-muted-foreground">Chọn kỹ năng bạn muốn luyện tập</p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {skills.map((skill, i) => (
                <motion.button
                  key={skill.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => startPractice(skill.key)}
                  className="glass-card p-6 md:p-8 text-center hover:shadow-lg transition-all group hover:scale-[1.02]"
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${skill.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <skill.icon className={`w-6 h-6 md:w-7 md:h-7 ${skill.iconColor}`} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-1 text-sm md:text-base">{skill.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {skill.key === "reading"
                      ? `${sampleGapFillQuestions.length} bài đọc`
                      : `${getQuestionsBySkill(skill.key).length} câu hỏi`
                    }
                  </p>
                </motion.button>
              ))}
            </div>

            {stats.total > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 mt-10 text-center">
                <p className="text-sm text-muted-foreground">Phiên luyện tập hôm nay</p>
                <p className="text-2xl font-heading font-extrabold text-foreground mt-1">
                  {stats.correct}/{stats.total} đúng ({Math.round((stats.correct / stats.total) * 100)}%)
                </p>
              </motion.div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Reading gap-fill mode
  if (selectedSkill === "reading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setSelectedSkill(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Chọn kỹ năng khác
              </button>
            </div>

            {readingPhase === "instructions" && (
              <ReadingInstructions
                totalParts={gapFillQuestions.length}
                totalMinutes={10}
                onStart={() => setReadingPhase("practice")}
              />
            )}

            {(readingPhase === "practice" || readingPhase === "review") && (
              <ReadingGapFill
                question={gapFillQuestions[currentGapFill]}
                questionIndex={currentGapFill}
                totalQuestions={gapFillQuestions.length}
                answers={gapFillAnswers[currentGapFill] || []}
                onAnswerChange={(gapIndex, value) => {
                  if (readingSubmitted) return;
                  const newAnswers = [...gapFillAnswers];
                  const currentAnswers = [...(newAnswers[currentGapFill] || [])];
                  currentAnswers[gapIndex] = value;
                  newAnswers[currentGapFill] = currentAnswers;
                  setGapFillAnswers(newAnswers);
                }}
                onPrevious={currentGapFill > 0 ? () => setCurrentGapFill(p => p - 1) : undefined}
                onNext={currentGapFill < gapFillQuestions.length - 1 ? () => setCurrentGapFill(p => p + 1) : undefined}
                onSubmit={currentGapFill === gapFillQuestions.length - 1 ? () => {
                  setReadingSubmitted(true);
                  setReadingPhase("review");
                  setCurrentGapFill(0);
                } : undefined}
                isFirst={currentGapFill === 0}
                isLast={currentGapFill === gapFillQuestions.length - 1}
                showResults={readingSubmitted}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard MCQ mode for other skills
  const q = questions[current];
  const isCorrect = selected === q?.correct_answer;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setSelectedSkill(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Chọn kỹ năng khác
            </button>
            <div className="text-sm text-muted-foreground">
              Đúng: {stats.correct}/{stats.total}
            </div>
          </div>

          <div className="h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="glass-card p-6 md:p-8 mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-3">Câu {current + 1}/{questions.length}</p>
                <h2 className="text-lg font-heading font-bold text-foreground mb-6 leading-relaxed">{q.question_text}</h2>
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    let cls = "border-border hover:border-primary/30 text-foreground";
                    if (submitted) {
                      if (i === q.correct_answer) cls = "border-success bg-success/10 text-success";
                      else if (i === selected) cls = "border-destructive bg-destructive/10 text-destructive";
                    } else if (selected === i) {
                      cls = "border-primary bg-primary/5 text-primary";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => !submitted && setSelected(i)}
                        disabled={submitted}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${cls}`}
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                        {submitted && i === q.correct_answer && <CheckCircle2 className="w-4 h-4 inline ml-2" />}
                        {submitted && i === selected && i !== q.correct_answer && <XCircle className="w-4 h-4 inline ml-2" />}
                      </button>
                    );
                  })}
                </div>

                {submitted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className={`mt-4 p-4 rounded-lg ${isCorrect ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}
                  >
                    <p className={`text-sm font-semibold mb-1 ${isCorrect ? "text-success" : "text-destructive"}`}>
                      {isCorrect ? "✓ Chính xác!" : "✗ Sai rồi!"}
                    </p>
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-end">
            {!submitted ? (
              <Button onClick={checkAnswer} disabled={selected === null} className="bg-primary text-primary-foreground gap-1">
                Kiểm tra <CheckCircle2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={nextQuestion} className="bg-primary text-primary-foreground gap-1">
                Câu tiếp <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Practice;
