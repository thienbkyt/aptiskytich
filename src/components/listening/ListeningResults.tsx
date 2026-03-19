import { ArrowLeft, RotateCcw, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ListeningResultsProps {
  correct: number;
  total: number;
  partLabel: string;
  onExit: () => void;
  onRetry: () => void;
}

const getLevel = (pct: number) => {
  if (pct >= 90) return { label: "C", color: "text-emerald-500" };
  if (pct >= 75) return { label: "B2", color: "text-blue-500" };
  if (pct >= 60) return { label: "B1", color: "text-primary" };
  if (pct >= 40) return { label: "A2", color: "text-amber-500" };
  return { label: "A1", color: "text-destructive" };
};

const ListeningResults = ({ correct, total, partLabel, onExit, onRetry }: ListeningResultsProps) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const level = getLevel(pct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      <div className="flex items-center mb-8">
        <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
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
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Làm lại
          </Button>
          <Button onClick={onExit} className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
            Quay lại danh sách
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ListeningResults;
