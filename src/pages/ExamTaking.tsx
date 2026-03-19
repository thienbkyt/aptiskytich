import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, ChevronLeft, ChevronRight, Send, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
}

interface TestInfo {
  id: string;
  title: string;
  skill: string;
  part: string;
  time_limit: number;
}

const ExamTaking = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [test, setTest] = useState<TestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; correct: number; details: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) return;
    const load = async () => {
      const { data: testData } = await supabase.from("tests").select("*").eq("id", testId).single();
      if (!testData) { navigate("/"); return; }
      setTest(testData as TestInfo);
      setTimeLeft(testData.time_limit * 60);

      const { data: qData } = await supabase
        .from("questions")
        .select("*")
        .eq("test_id", testId)
        .order("order_index");
      if (qData) setQuestions(qData.map((q: any) => ({ ...q, options: q.options as string[] })));
      setLoading(false);
    };
    load();
  }, [testId, navigate]);

  // Timer
  useEffect(() => {
    if (submitted || timeLeft <= 0 || loading) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted, loading]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const selectAnswer = (questionId: string, answer: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);

    let correct = 0;
    const details = questions.map(q => {
      const userAnswer = answers[q.id];
      let isCorrect = false;
      if (q.question_type === "multiple_choice") {
        isCorrect = userAnswer === String(q.correct_answer);
      }
      if (isCorrect) correct++;
      return { question: q, userAnswer, isCorrect };
    });

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    setResults({ score, total, correct, details });

    // Save to database if logged in
    if (user && testId) {
      const { data: resultData } = await supabase.from("test_results").insert({
        user_id: user.id,
        test_id: testId,
        score,
        total,
        correct_answers: correct,
        level: score >= 80 ? "B2" : score >= 60 ? "B1" : score >= 40 ? "A2" : "A1",
      }).select("id").single();

      if (resultData) {
        const userAnswersData = questions.map(q => ({
          user_id: user.id,
          question_id: q.id,
          test_result_id: resultData.id,
          selected_answer: answers[q.id] || null,
          is_correct: q.question_type === "multiple_choice" ? answers[q.id] === String(q.correct_answer) : false,
        }));
        await supabase.from("user_answers").insert(userAnswersData);
      }
    }
  }, [submitted, questions, answers, user, testId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Đang tải đề thi...</p></div>;
  if (!test || questions.length === 0) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Không tìm thấy đề thi.</p></div>;

  const currentQ = questions[currentIndex];

  // Results view
  if (submitted && results) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Kết quả</h1>
            <p className="text-lg text-muted-foreground">{test.title} – {test.part}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border border-border rounded-xl p-4 text-center bg-card">
              <p className="text-3xl font-bold text-primary">{results.score}%</p>
              <p className="text-sm text-muted-foreground">Điểm số</p>
            </div>
            <div className="border border-border rounded-xl p-4 text-center bg-card">
              <p className="text-3xl font-bold text-foreground">{results.correct}/{results.total}</p>
              <p className="text-sm text-muted-foreground">Câu đúng</p>
            </div>
            <div className="border border-border rounded-xl p-4 text-center bg-card">
              <p className="text-3xl font-bold text-foreground">{results.score >= 80 ? "B2" : results.score >= 60 ? "B1" : results.score >= 40 ? "A2" : "A1"}</p>
              <p className="text-sm text-muted-foreground">Trình độ</p>
            </div>
          </div>

          <h2 className="text-xl font-heading font-semibold mb-4">Chi tiết</h2>
          <div className="space-y-4">
            {results.details.map((d, i) => (
              <div key={d.question.id} className={`border rounded-xl p-4 ${d.isCorrect ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}`}>
                <div className="flex items-start gap-3">
                  {d.isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-2">Câu {i + 1}: {d.question.question_text}</p>
                    {d.question.question_type === "multiple_choice" && (
                      <div className="space-y-1 mb-2">
                        {d.question.options.map((opt: string, idx: number) => (
                          <p key={idx} className={`text-sm px-2 py-1 rounded ${
                            idx === d.question.correct_answer ? 'bg-green-200/50 dark:bg-green-800/30 font-semibold' : ''
                          } ${d.userAnswer === String(idx) && idx !== d.question.correct_answer ? 'bg-red-200/50 dark:bg-red-800/30 line-through' : ''}`}>
                            {String.fromCharCode(65 + idx)}. {opt}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Đáp án bạn chọn:</span> {d.userAnswer != null ? String.fromCharCode(65 + parseInt(d.userAnswer)) : "Chưa chọn"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Đáp án đúng:</span> {String.fromCharCode(65 + d.question.correct_answer)}
                    </p>
                    {d.question.explanation && (
                      <p className="text-sm text-muted-foreground mt-2 italic">💡 {d.question.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Exam view
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Bạn có chắc muốn thoát?")) navigate(-1); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Thoát
        </Button>
        <div className="flex-1 text-center">
          <span className="font-heading font-semibold text-sm text-foreground">{test.title}</span>
          <span className="text-xs text-muted-foreground ml-2">{test.part}</span>
        </div>
        <Badge variant="secondary" className="gap-1.5 font-mono text-sm">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(timeLeft)}
        </Badge>
      </div>

      {/* Question navigation */}
      <div className="border-b border-border bg-card px-4 py-2 flex gap-1.5 overflow-x-auto">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(i)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : answers[q.id]
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <p className="text-sm text-muted-foreground mb-2">Câu {currentIndex + 1} / {questions.length}</p>

            {/* Audio player */}
            {currentQ.audio_url && (
              <div className="mb-4">
                <audio controls src={currentQ.audio_url} className="w-full" />
              </div>
            )}

            {/* Image */}
            {currentQ.image_url && (
              <div className="mb-4">
                <img src={currentQ.image_url} alt="Question" className="max-w-full rounded-lg border border-border" />
              </div>
            )}

            <h2 className="text-lg font-heading font-semibold text-foreground mb-6">{currentQ.question_text}</h2>

            {/* Multiple choice */}
            {currentQ.question_type === "multiple_choice" && (
              <div className="space-y-3">
                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(currentQ.id, String(idx))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                      answers[currentQ.id] === String(idx)
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Writing */}
            {currentQ.question_type === "writing" && (
              <div className="space-y-2">
                <Textarea
                  value={answers[currentQ.id] || ""}
                  onChange={(e) => selectAnswer(currentQ.id, e.target.value)}
                  rows={8}
                  placeholder="Nhập câu trả lời..."
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(answers[currentQ.id] || "").split(/\s+/).filter(Boolean).length} từ
                </p>
              </div>
            )}

            {/* Speaking - display question only */}
            {currentQ.question_type === "speaking" && (
              <div className="bg-muted/50 rounded-xl p-6 text-center">
                <p className="text-muted-foreground text-sm">Đọc câu hỏi và luyện trả lời miệng.</p>
              </div>
            )}

            {/* Fill blank */}
            {currentQ.question_type === "fill_blank" && (
              <div className="space-y-3">
                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(currentQ.id, String(idx))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                      answers[currentQ.id] === String(idx)
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="h-16 border-t border-border bg-card flex items-center justify-between px-4 shrink-0">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex(prev => prev - 1)} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Trước
        </Button>
        <p className="text-sm text-muted-foreground">
          {Object.keys(answers).length}/{questions.length} đã trả lời
        </p>
        {currentIndex === questions.length - 1 ? (
          <Button onClick={handleSubmit} className="gap-1 bg-primary text-primary-foreground">
            <Send className="w-4 h-4" /> Nộp bài
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setCurrentIndex(prev => prev + 1)} className="gap-1">
            Tiếp <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ExamTaking;
