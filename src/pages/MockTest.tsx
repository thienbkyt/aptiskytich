import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Clock, CheckCircle2, ArrowRight,
  RotateCcw, Trophy, BookOpen
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getLevel, getLevelColor, sampleGapFillQuestions, type Question, type GapFillQuestion } from "@/data/questions";
import { fetchAllQuestions } from "@/lib/questions";
import ReadingInstructions from "@/components/reading/ReadingInstructions";
import ReadingGapFill from "@/components/reading/ReadingGapFill";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ExamMCQ from "@/components/exam/ExamMCQ";

type Phase = "intro" | "mcq_instructions" | "test" | "reading_instructions" | "reading_test" | "result";

const MockTest = () => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(600);
  const [seenMcq, setSeenMcq] = useState<Set<number>>(new Set());
  const [seenGaps, setSeenGaps] = useState<Set<string>>(new Set());

  // Reading gap-fill state
  const [gapFillQuestions] = useState<GapFillQuestion[]>(sampleGapFillQuestions);
  const [currentGapFill, setCurrentGapFill] = useState(0);
  const [gapFillAnswers, setGapFillAnswers] = useState<(number | null)[][]>([]);

  useEffect(() => {
    fetchAllQuestions().then(setQuestions);
  }, []);

  const mcqQuestions = questions.filter(q => q.skill !== "reading");

  // Mark seen
  useEffect(() => {
    if (phase === "test") setSeenMcq(prev => new Set(prev).add(current));
  }, [phase, current]);

  useEffect(() => {
    if (phase === "reading_test") setSeenGaps(prev => new Set(prev).add(`${currentGapFill}`));
  }, [phase, currentGapFill]);

  useEffect(() => {
    if (phase !== "test" && phase !== "reading_instructions" && phase !== "reading_test") return;
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((p) => {
      if (p <= 1) { clearInterval(t); handleSubmit(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const startTest = () => {
    setPhase("mcq_instructions");
    setAnswers(new Array(mcqQuestions.length).fill(null));
    setCurrent(0);
    setTimeLeft(600);
    setCurrentGapFill(0);
    setGapFillAnswers(gapFillQuestions.map(q => new Array(q.gaps.length).fill(null)));
    setSeenMcq(new Set());
    setSeenGaps(new Set());
  };

  const handleSubmit = useCallback(() => {
    setPhase("result");
  }, []);

  const handleMcqDone = () => {
    setPhase("reading_instructions");
  };

  const handleReadingStart = () => {
    setPhase("reading_test");
    setCurrentGapFill(0);
  };

  const handleReadingSubmit = () => {
    handleSubmit();
  };

  // Scoring
  const mcqScore = answers.reduce((acc, a, i) => acc + (a === mcqQuestions[i]?.correct_answer ? 1 : 0), 0);
  const readingScore = gapFillAnswers.reduce((acc, qAnswers, qi) => {
    const q = gapFillQuestions[qi];
    if (!q) return acc;
    return acc + qAnswers.reduce((s, a, gi) => s + (a === q.gaps[gi]?.correct ? 1 : 0), 0);
  }, 0);
  const totalReadingGaps = gapFillQuestions.reduce((acc, q) => acc + q.gaps.length, 0);
  const totalScore = mcqScore + readingScore;
  const totalQuestions = mcqQuestions.length + totalReadingGaps;
  const level = getLevel(totalScore, totalQuestions);
  const pct = Math.round((totalScore / totalQuestions) * 100);

  // Build MCQ sections
  const mcqSections = [
    {
      title: "Aptis General Test Instructions",
      isCurrent: phase === "mcq_instructions",
      onClick: () => { setPhase("mcq_instructions"); },
    },
    {
      title: "Grammar & Listening",
      questionCount: mcqQuestions.length,
      isCurrent: phase === "test",
      onClick: () => { setPhase("test"); setCurrent(0); },
      questions: mcqQuestions.map((_, qi) => ({
        label: String(qi + 1).padStart(2, "0"),
        seen: seenMcq.has(qi),
        attempted: answers[qi] !== null && answers[qi] !== undefined,
        isCurrent: phase === "test" && current === qi,
        onClick: () => { setPhase("test"); setCurrent(qi); },
      })),
    },
  ];

  // Build reading sections
  const readingSections = [
    {
      title: "Aptis General Reading Instructions",
      isCurrent: phase === "reading_instructions",
      onClick: () => { setPhase("reading_instructions"); },
    },
    ...gapFillQuestions.map((q, qi) => ({
      title: "Reading",
      questionCount: q.gaps.length,
      isCurrent: phase === "reading_test" && currentGapFill === qi,
      onClick: () => { setPhase("reading_test"); setCurrentGapFill(qi); },
      questions: q.gaps.map((_gap, gi) => ({
        label: String(gi + 1).padStart(2, "0"),
        seen: seenGaps.has(`${qi}`),
        attempted: gapFillAnswers[qi]?.[gi] !== null && gapFillAnswers[qi]?.[gi] !== undefined,
        isCurrent: phase === "reading_test" && currentGapFill === qi,
        onClick: () => { setPhase("reading_test"); setCurrentGapFill(qi); },
      })),
    })),
  ];

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
                Bài thi thử Aptis Mini
              </h1>
              <p className="text-muted-foreground mb-8">
                Grammar + Reading (gap-fill) + Listening · 10 phút
              </p>
              <div className="glass-card p-6 mb-8 text-left space-y-3">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-success" /><span className="text-sm text-foreground">Grammar & Vocabulary: trắc nghiệm</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-success" /><span className="text-sm text-foreground">Reading: điền từ vào chỗ trống (gap-fill)</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-success" /><span className="text-sm text-foreground">Listening: trắc nghiệm</span></div>
                <div className="flex items-center gap-3"><Clock className="w-5 h-5 text-primary" /><span className="text-sm text-foreground">Thời gian: 10 phút</span></div>
              </div>
              <Button size="lg" onClick={startTest} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base px-8">
                Bắt đầu thi thử <ArrowRight className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-2xl">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2">Kết quả bài thi</h1>
              <p className="text-muted-foreground mb-8">Bạn đã hoàn thành bài thi thử Aptis!</p>

              <div className="glass-card p-8 mb-6">
                <div className="text-6xl font-heading font-extrabold text-primary mb-2">{totalScore}/{totalQuestions}</div>
                <div className="text-muted-foreground mb-4">Đúng {pct}%</div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                  <span className="text-sm text-muted-foreground">Trình độ dự kiến:</span>
                  <span className={`text-lg font-heading font-extrabold ${getLevelColor(level)}`}>{level}</span>
                </div>
              </div>

              <div className="glass-card p-6 mb-6">
                <h3 className="font-heading font-bold text-foreground mb-5">Chi tiết theo kỹ năng</h3>
                {(() => {
                  const grammarQs = mcqQuestions.filter(q => q.skill === "grammar");
                  const grammarScore = grammarQs.reduce((acc, q) => {
                    const idx = mcqQuestions.indexOf(q);
                    return acc + (answers[idx] === q.correct_answer ? 1 : 0);
                  }, 0);
                  const grammarPct = grammarQs.length > 0 ? Math.round((grammarScore / grammarQs.length) * 100) : 0;
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-foreground font-medium">Grammar</span>
                        <span className="text-muted-foreground">{grammarScore}/{grammarQs.length} ({grammarPct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${grammarPct}%` }} transition={{ duration: 0.8, delay: 0.3 }} className="h-full bg-primary rounded-full" />
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const readingPct = totalReadingGaps > 0 ? Math.round((readingScore / totalReadingGaps) * 100) : 0;
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-foreground font-medium">Reading</span>
                        <span className="text-muted-foreground">{readingScore}/{totalReadingGaps} ({readingPct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${readingPct}%` }} transition={{ duration: 0.8, delay: 0.5 }} className="h-full bg-primary rounded-full" />
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const listenQs = mcqQuestions.filter(q => q.skill === "listening");
                  const listenScore = listenQs.reduce((acc, q) => {
                    const idx = mcqQuestions.indexOf(q);
                    return acc + (answers[idx] === q.correct_answer ? 1 : 0);
                  }, 0);
                  const listenPct = listenQs.length > 0 ? Math.round((listenScore / listenQs.length) * 100) : 0;
                  return (
                    <div className="mb-0">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-foreground font-medium">Listening</span>
                        <span className="text-muted-foreground">{listenScore}/{listenQs.length} ({listenPct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${listenPct}%` }} transition={{ duration: 0.8, delay: 0.7 }} className="h-full bg-primary rounded-full" />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {level !== "B2" && level !== "C1" && level !== "C2" && (
                <div className="glass-card p-6 mb-6 border-primary/20">
                  <p className="text-sm text-foreground mb-3">
                    Trình độ của bạn chưa đạt B2. Tham gia khóa <strong>Aptis Kỳ Tích – 7 Ngày</strong> để nâng cấp nhanh!
                  </p>
                  <Link to="/course">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                      Xem khóa học <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <Button onClick={startTest} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Thi lại
                </Button>
                <Link to="/practice">
                  <Button className="bg-primary text-primary-foreground gap-2">
                    Luyện tập thêm <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // MCQ Instructions
  if (phase === "mcq_instructions") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <ExamInstructions
              skillName="Grammar & Listening"
              timeLeft={timeLeft}
              totalTime={600}
              totalParts={mcqQuestions.length}
              totalMinutes={10}
              onStart={() => setPhase("test")}
              sections={mcqSections}
              description="Answer multiple choice questions for Grammar & Listening sections."
            />
          </div>
        </div>
      </div>
    );
  }

  // Reading instructions
  if (phase === "reading_instructions") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <ReadingInstructions
              timeLeft={timeLeft}
              totalParts={gapFillQuestions.length}
              totalMinutes={5}
              onStart={handleReadingStart}
              sections={readingSections}
            />
          </div>
        </div>
      </div>
    );
  }

  // Reading gap-fill test
  if (phase === "reading_test") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <ReadingGapFill
              question={gapFillQuestions[currentGapFill]}
              questionIndex={currentGapFill}
              totalQuestions={gapFillQuestions.length}
              timeLeft={timeLeft}
              answers={gapFillAnswers[currentGapFill] || []}
              onAnswerChange={(gapIndex, value) => {
                const newAnswers = [...gapFillAnswers];
                const currentAnswers = [...(newAnswers[currentGapFill] || [])];
                currentAnswers[gapIndex] = value;
                newAnswers[currentGapFill] = currentAnswers;
                setGapFillAnswers(newAnswers);
              }}
              onPrevious={currentGapFill > 0 ? () => setCurrentGapFill(p => p - 1) : undefined}
              onNext={currentGapFill < gapFillQuestions.length - 1 ? () => setCurrentGapFill(p => p + 1) : undefined}
              onSubmit={currentGapFill === gapFillQuestions.length - 1 ? handleReadingSubmit : undefined}
              isFirst={currentGapFill === 0}
              isLast={currentGapFill === gapFillQuestions.length - 1}
              sections={readingSections}
            />
          </div>
        </div>
      </div>
    );
  }

  // MCQ test phase with exam interface
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container max-w-3xl">
          <ExamMCQ
            skillName="Grammar & Listening"
            questions={mcqQuestions}
            currentIndex={current}
            answers={answers}
            timeLeft={timeLeft}
            totalTime={600}
            onAnswerSelect={(qi, ai) => {
              const newAnswers = [...answers];
              newAnswers[qi] = ai;
              setAnswers(newAnswers);
            }}
            onPrevious={current > 0 ? () => setCurrent(p => p - 1) : undefined}
            onNext={current < mcqQuestions.length - 1 ? () => setCurrent(p => p + 1) : undefined}
            onSubmit={current === mcqQuestions.length - 1 ? handleMcqDone : undefined}
            isFirst={current === 0}
            isLast={current === mcqQuestions.length - 1}
            sections={mcqSections}
          />
        </div>
      </div>
    </div>
  );
};

export default MockTest;
