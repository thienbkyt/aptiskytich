import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RotateCcw, ArrowLeft, Trophy } from "lucide-react";

interface VocabWord {
  id: string;
  word: string;
  meaning: string | null;
}

interface QuizModeProps {
  words: VocabWord[];
  onBackToList: () => void;
}

interface QuizQuestion {
  word: VocabWord;
  options: string[]; // 4 English words
  correctIndex: number;
}

const MAX_QUESTIONS = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuiz(words: VocabWord[]): QuizQuestion[] {
  const eligible = words.filter((w) => w.meaning && w.meaning.trim().length > 0);
  const pool = eligible.length >= 4 ? eligible : words;
  const picked = shuffle(pool).slice(0, Math.min(MAX_QUESTIONS, pool.length));

  return picked.map((target) => {
    const distractors = shuffle(pool.filter((w) => w.id !== target.id))
      .slice(0, 3)
      .map((w) => w.word);
    const options = shuffle([target.word, ...distractors]);
    return {
      word: target,
      options,
      correctIndex: options.indexOf(target.word),
    };
  });
}

const QuizMode = ({ words, onBackToList }: QuizModeProps) => {
  const [quiz, setQuiz] = useState<QuizQuestion[]>(() => buildQuiz(words));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = quiz.length;
  const current = quiz[currentIdx];

  useEffect(() => {
    if (selected === null) return;
    const t = setTimeout(() => {
      if (currentIdx + 1 >= total) {
        setFinished(true);
      } else {
        setCurrentIdx((i) => i + 1);
        setSelected(null);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [selected, currentIdx, total]);

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === current.correctIndex) setScore((s) => s + 1);
  };

  const restart = () => {
    setQuiz(buildQuiz(words));
    setCurrentIdx(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  const percentage = useMemo(() => (total > 0 ? Math.round((score / total) * 100) : 0), [score, total]);

  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Bộ từ này chưa đủ dữ liệu để làm quiz.</p>
        <Button variant="outline" className="mt-4" onClick={onBackToList}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay về danh sách
        </Button>
      </div>
    );
  }

  if (finished) {
    const verdict =
      percentage >= 80 ? "Xuất sắc! 🎉" : percentage >= 60 ? "Khá tốt! 👍" : "Cần ôn thêm! 💪";
    const verdictColor =
      percentage >= 80
        ? "text-[hsl(142,60%,40%)]"
        : percentage >= 60
          ? "text-[hsl(38,90%,45%)]"
          : "text-[hsl(0,75%,50%)]";

    return (
      <div className="max-w-xl mx-auto">
        <Card className="border border-border overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(45,95%,90%)] dark:bg-[hsl(45,40%,20%)] flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-[hsl(38,90%,45%)]" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Hoàn thành Quiz!</h2>
            <p className={`text-4xl font-bold mt-4 ${verdictColor}`}>
              {score} / {total}
            </p>
            <p className="text-lg text-muted-foreground mt-1">{percentage}% chính xác</p>
            <p className={`text-base font-semibold mt-3 ${verdictColor}`}>{verdict}</p>

            <div className="flex items-center justify-center gap-3 mt-8">
              <Button variant="outline" onClick={onBackToList} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Quay về danh sách
              </Button>
              <Button
                onClick={restart}
                className="bg-[hsl(0,98%,40%)] hover:bg-[hsl(0,98%,34%)] text-white gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Làm lại
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAnswered = selected !== null;
  const isCorrect = selected === current.correctIndex;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="text-sm">
          Câu {currentIdx + 1} / {total}
        </Badge>
        <Badge className="bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,40%)] text-white text-sm">
          Điểm: {score}
        </Badge>
      </div>

      <Card className="border border-border overflow-hidden">
        <CardContent className="p-8">
          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider text-center mb-3">
            Nghĩa tiếng Việt
          </p>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center text-foreground leading-snug">
            {current.word.meaning}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            {current.options.map((opt, idx) => {
              const isThis = selected === idx;
              const isCorrectOpt = idx === current.correctIndex;

              let cls =
                "border-border hover:border-[hsl(0,98%,40%)] hover:bg-[hsl(0,98%,40%)]/5";
              if (isAnswered) {
                if (isCorrectOpt) {
                  cls =
                    "border-[hsl(142,60%,45%)] bg-[hsl(142,60%,95%)] dark:bg-[hsl(142,40%,15%)] text-[hsl(142,60%,30%)] dark:text-[hsl(142,60%,70%)]";
                } else if (isThis) {
                  cls =
                    "border-[hsl(0,75%,50%)] bg-[hsl(0,75%,95%)] dark:bg-[hsl(0,40%,15%)] text-[hsl(0,75%,40%)] dark:text-[hsl(0,75%,70%)]";
                } else {
                  cls = "border-border opacity-60";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={`flex items-center justify-between gap-3 p-4 rounded-lg border-2 text-left font-medium transition-all ${cls} ${!isAnswered ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="text-base">{opt}</span>
                  {isAnswered && isCorrectOpt && <Check className="w-5 h-5 shrink-0" />}
                  {isAnswered && isThis && !isCorrectOpt && <X className="w-5 h-5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div
              className={`mt-6 p-3 rounded-lg text-center font-semibold ${
                isCorrect
                  ? "bg-[hsl(142,60%,95%)] dark:bg-[hsl(142,40%,15%)] text-[hsl(142,60%,30%)] dark:text-[hsl(142,60%,70%)]"
                  : "bg-[hsl(0,75%,95%)] dark:bg-[hsl(0,40%,15%)] text-[hsl(0,75%,40%)] dark:text-[hsl(0,75%,70%)]"
              }`}
            >
              {isCorrect
                ? "Chính xác! ✓"
                : `Sai rồi! Đáp án đúng là: ${current.options[current.correctIndex]}`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizMode;
