import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle2, XCircle, ArrowRight, ArrowLeft,
  RotateCcw, Trophy, BookOpen, MessageCircle
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getMockTestQuestions, getLevel, getLevelColor, type Question } from "@/data/questions";

type Phase = "intro" | "test" | "result";

const MockTest = () => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions] = useState<Question[]>(getMockTestQuestions());
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 min
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (phase !== "test" || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((p) => {
      if (p <= 1) { clearInterval(t); handleSubmit(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const startTest = () => {
    setPhase("test");
    setAnswers(new Array(questions.length).fill(null));
    setCurrent(0);
    setTimeLeft(600);
  };

  const selectAnswer = (idx: number) => {
    const newAnswers = [...answers];
    newAnswers[current] = idx;
    setAnswers(newAnswers);
  };

  const handleSubmit = useCallback(() => {
    setPhase("result");
  }, []);

  const score = answers.reduce((acc, a, i) => acc + (a === questions[i]?.correct_answer ? 1 : 0), 0);
  const total = questions.length;
  const level = getLevel(score, total);
  const pct = Math.round((score / total) * 100);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const q = questions[current];

  const skillLabels: Record<string, string> = { grammar: "Grammar", reading: "Reading", listening: "Listening" };

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
                Bài thi thử Aptis Mini
              </h1>
              <p className="text-muted-foreground mb-8">
                20 câu hỏi · 10 phút · Grammar + Reading + Listening
              </p>
              <div className="glass-card p-6 mb-8 text-left space-y-3">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-secondary" /><span className="text-sm text-foreground">Grammar & Vocabulary: 10 câu</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-secondary" /><span className="text-sm text-foreground">Reading: 5 câu</span></div>
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-secondary" /><span className="text-sm text-foreground">Listening: 5 câu</span></div>
                <div className="flex items-center gap-3"><Clock className="w-5 h-5 text-accent" /><span className="text-sm text-foreground">Thời gian: 10 phút</span></div>
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
          <div className="container mx-auto px-4 max-w-2xl">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2">Kết quả bài thi</h1>
              <p className="text-muted-foreground mb-8">Bạn đã hoàn thành bài thi thử Aptis!</p>

              <div className="glass-card p-8 mb-6">
                <div className="text-6xl font-heading font-extrabold text-primary mb-2">{score}/{total}</div>
                <div className="text-muted-foreground mb-4">Đúng {pct}%</div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                  <span className="text-sm text-muted-foreground">Trình độ dự kiến:</span>
                  <span className={`text-lg font-heading font-extrabold ${getLevelColor(level)}`}>{level}</span>
                </div>
              </div>

              {/* Score breakdown by skill */}
              <div className="glass-card p-6 mb-6">
                <h3 className="font-heading font-bold text-foreground mb-4">Chi tiết theo kỹ năng</h3>
                {(["grammar", "reading", "listening"] as const).map((skill) => {
                  const skillQs = questions.filter((q) => q.skill === skill);
                  const skillScore = skillQs.reduce((acc, q, i) => {
                    const qIdx = questions.indexOf(q);
                    return acc + (answers[qIdx] === q.correct_answer ? 1 : 0);
                  }, 0);
                  const skillPct = Math.round((skillScore / skillQs.length) * 100);
                  return (
                    <div key={skill} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground font-medium">{skillLabels[skill]}</span>
                        <span className="text-muted-foreground">{skillScore}/{skillQs.length} ({skillPct}%)</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${skillPct}%` }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Review answers */}
              <div className="glass-card p-6 mb-6 text-left">
                <h3 className="font-heading font-bold text-foreground mb-4">Xem lại đáp án</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {questions.map((q, i) => {
                    const isCorrect = answers[i] === q.correct_answer;
                    return (
                      <div key={q.id} className={`p-4 rounded-lg border ${isCorrect ? "border-secondary/30 bg-secondary/5" : "border-destructive/30 bg-destructive/5"}`}>
                        <div className="flex items-start gap-2 mb-2">
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                          <span className="text-sm text-foreground font-medium">Câu {i + 1}: {q.question_text}</span>
                        </div>
                        <div className="ml-6 text-xs text-muted-foreground">
                          {!isCorrect && <p>Bạn chọn: <span className="text-destructive font-medium">{answers[i] !== null ? q.options[answers[i]!] : "Chưa trả lời"}</span></p>}
                          <p>Đáp án đúng: <span className="text-secondary font-medium">{q.options[q.correct_answer]}</span></p>
                          <p className="mt-1 text-muted-foreground">{q.explanation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {level !== "B2" && level !== "C1" && level !== "C2" && (
                <div className="glass-card p-6 mb-6 border-accent/30 bg-accent/5">
                  <p className="text-sm text-foreground mb-3">
                    Trình độ của bạn chưa đạt B2. Tham gia khóa <strong>Aptis Kỳ Tích – 7 Ngày</strong> để nâng cấp nhanh!
                  </p>
                  <Link to="/course">
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
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

  // Test phase
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Timer & Progress */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-muted">
                {skillLabels[q.skill]}
              </span>
              <span className="text-sm text-muted-foreground">Câu {current + 1}/{total}</span>
            </div>
            <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
              <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${((current + 1) / total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="glass-card p-6 md:p-8 mb-6">
                <h2 className="text-lg font-heading font-bold text-foreground mb-6 leading-relaxed">
                  {q.question_text}
                </h2>
                <div className="space-y-3">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => selectAnswer(i)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium ${
                        answers[current] === i
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mr-3">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCurrent((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Trước
            </Button>

            {/* Question dots */}
            <div className="hidden md:flex gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === current ? "bg-primary" : answers[i] !== null ? "bg-secondary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {current < total - 1 ? (
              <Button
                onClick={() => setCurrent((p) => p + 1)}
                className="bg-primary text-primary-foreground gap-1"
              >
                Tiếp <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="bg-secondary text-secondary-foreground gap-1"
              >
                Nộp bài <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockTest;
