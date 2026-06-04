import { ArrowLeft, RotateCcw, Trophy, Target, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { resolveAudioUrl } from "@/lib/audioUrl";
import type {
  ListeningPart1Question,
  ListeningPart2Question,
  ListeningPart3Question,
  ListeningPart4Clip,
} from "@/data/listeningQuestions";
import type { ListeningPartType } from "./ListeningExamEngine";

interface ListeningResultsProps {
  correct: number;
  total: number;
  partLabel: string;
  onExit: () => void;
  onRetry: () => void;
  mode?: "fresh" | "history";
  partType?: ListeningPartType;
  part1Questions?: ListeningPart1Question[];
  part2Questions?: ListeningPart2Question[];
  part3Questions?: ListeningPart3Question[];
  part4Questions?: ListeningPart4Clip[];
  userAnswers?: any[];
}

const getLevel = (pct: number) => {
  if (pct >= 90) return { label: "C", color: "text-emerald-500" };
  if (pct >= 75) return { label: "B2", color: "text-blue-500" };
  if (pct >= 60) return { label: "B1", color: "text-primary" };
  if (pct >= 40) return { label: "A2", color: "text-amber-500" };
  return { label: "A1", color: "text-destructive" };
};

const ListeningResults = (props: ListeningResultsProps) => {
  const { correct, total, partLabel, onExit, onRetry, mode = "fresh" } = props;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const level = getLevel(pct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto pb-10 space-y-6"
    >
      <div className="flex items-center">
        <button
          onClick={onExit}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-blue-500" />
        </div>

        <h1 className="text-2xl font-heading font-bold text-foreground mb-1">Kết quả Listening</h1>
        <p className="text-sm text-muted-foreground mb-6">{partLabel}</p>

        <div className="flex justify-center gap-8 mb-6">
          <div>
            <p className="text-4xl font-heading font-extrabold text-foreground">{correct}/{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Câu đúng</p>
          </div>
          <div>
            <p className="text-4xl font-heading font-extrabold text-foreground">{pct}%</p>
            <p className="text-xs text-muted-foreground mt-1">Tỉ lệ</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 bg-muted rounded-xl px-5 py-3 mb-8">
          <Target className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Trình độ ước tính:</span>
          <span className={`text-lg font-heading font-extrabold ${level.color}`}>{level.label}</span>
        </div>

        <div className="flex gap-3 justify-center">
          {mode === "fresh" && (
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Làm lại
            </Button>
          )}
          <Button onClick={onExit} className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
            Quay lại danh sách
          </Button>
        </div>
      </div>

      <ListeningReview {...props} />
    </motion.div>
  );
};

const ListeningReview = (props: ListeningResultsProps) => {
  const { partType, part1Questions, part2Questions, part3Questions, part4Questions, userAnswers = [] } = props;
  if (!partType) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-base font-heading font-bold text-foreground mb-4">
        Chi tiết bài làm
      </h3>
      {partType === "part1" && part1Questions && (
        <Part1Review questions={part1Questions} answers={userAnswers} />
      )}
      {partType === "part2" && part2Questions && (
        <Part2Review questions={part2Questions} answers={userAnswers} />
      )}
      {partType === "part3" && part3Questions && (
        <Part3Review questions={part3Questions} answers={userAnswers} />
      )}
      {partType === "part4" && part4Questions && (
        <Part4Review questions={part4Questions} answers={userAnswers} />
      )}
    </div>
  );
};

const AudioRow = ({ url }: { url?: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    resolveAudioUrl(url).then(setSrc).catch(() => setSrc(url));
  }, [url]);
  if (!url) return null;
  return <audio controls src={src || url} className="w-full h-9 mt-2" />;
};

const StatusIcon = ({ ok }: { ok: boolean }) =>
  ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />;

const Part1Review = ({ questions, answers }: { questions: ListeningPart1Question[]; answers: any[] }) => (
  <div className="space-y-3">
    {questions.map((q, i) => {
      const userIdx = answers[i];
      const ok = userIdx === q.correct;
      return (
        <div
          key={q.id}
          className={`text-sm rounded-md p-3 border ${
            ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon ok={ok} />
            <span className="font-medium text-foreground">Câu {i + 1}</span>
          </div>
          {q.questionText && <p className="text-xs text-muted-foreground mb-2">{q.questionText}</p>}
          <AudioRow url={q.audioUrl} />
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {q.options.map((opt, oi) => {
              const isCorrect = oi === q.correct;
              const isUser = oi === userIdx;
              return (
                <div
                  key={oi}
                  className={`text-xs px-2 py-1.5 rounded border ${
                    isCorrect
                      ? "border-success/40 bg-success/10 text-foreground"
                      : isUser
                      ? "border-destructive/40 bg-destructive/10 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="font-medium mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

const Part2Review = ({ questions, answers }: { questions: ListeningPart2Question[]; answers: any[] }) => (
  <div className="space-y-4">
    {questions.map((q, i) => {
      const ans = (answers[i] || {}) as Record<string, string>;
      return (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{q.questionText}</p>
          {q.persons.map((p) => {
            const correctItem = q.infoItems.find((it) => it.correctPerson === p.name);
            const userText = ans[p.name];
            const ok = correctItem && userText === correctItem.text;
            return (
              <div
                key={p.name}
                className={`text-sm rounded-md p-3 border ${
                  ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <StatusIcon ok={!!ok} />
                  <span className="font-medium text-foreground">Người {p.name}</span>
                </div>
                <AudioRow url={p.audioUrl} />
                <p className="text-xs mt-2">
                  <span className="text-muted-foreground">Bạn chọn: </span>
                  <span className={ok ? "text-success" : "text-destructive"}>
                    {userText || "(trống)"}
                  </span>
                </p>
                {!ok && correctItem && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Đáp án: </span>
                    <span className="text-success">{correctItem.text}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

const Part3Review = ({ questions, answers }: { questions: ListeningPart3Question[]; answers: any[] }) => (
  <div className="space-y-4">
    {questions.map((q, i) => {
      const ans = (answers[i] || {}) as Record<number, string>;
      return (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{q.questionText}</p>
          <AudioRow url={q.audioUrl} />
          {q.statements.map((s, si) => {
            const userVal = ans[si];
            const ok = userVal === s.correctAnswer;
            return (
              <div
                key={si}
                className={`text-sm rounded-md p-3 border ${
                  ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <StatusIcon ok={ok} />
                  <div className="flex-1">
                    <p className="text-foreground">{s.text}</p>
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Bạn chọn: </span>
                      <span className={ok ? "text-success" : "text-destructive"}>{userVal || "(trống)"}</span>
                      {!ok && (
                        <>
                          {" • "}
                          <span className="text-muted-foreground">Đáp án: </span>
                          <span className="text-success">{s.correctAnswer}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

const Part4Review = ({ questions, answers }: { questions: ListeningPart4Clip[]; answers: any[] }) => (
  <div className="space-y-4">
    {questions.map((clip, ci) => {
      const ans = (answers[ci] || {}) as Record<number, number>;
      return (
        <div key={clip.id} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Đoạn {ci + 1}</p>
          <AudioRow url={clip.audioUrl} />
          {clip.questions.map((qq, qi) => {
            const userIdx = ans[qi];
            const ok = userIdx === qq.correct;
            return (
              <div
                key={qi}
                className={`text-sm rounded-md p-3 border ${
                  ok ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <StatusIcon ok={ok} />
                  <div className="flex-1">
                    <p className="text-foreground mb-2 font-medium">{qq.text}</p>
                    <div className="space-y-1">
                      {qq.options.map((opt, oi) => {
                        const isCorrect = oi === qq.correct;
                        const isUser = oi === userIdx;
                        return (
                          <div
                            key={oi}
                            className={`text-xs px-2 py-1 rounded border ${
                              isCorrect
                                ? "border-success/40 bg-success/10 text-foreground"
                                : isUser
                                ? "border-destructive/40 bg-destructive/10 text-foreground"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            <span className="font-medium mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

export default ListeningResults;
