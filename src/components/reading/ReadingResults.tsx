import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLevel, getLevelColor } from "@/data/questions";

interface ReadingResultsProps {
  correct: number;
  total: number;
  partLabel: string;
  onExit: () => void;
  onRetry: () => void;
}

const ReadingResults = ({ correct, total, partLabel, onExit, onRetry }: ReadingResultsProps) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const level = getLevel(correct, total);

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-8 text-center"
      >
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
          Kết quả Reading
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{partLabel}</p>

        <div className="flex items-center justify-center gap-8 mt-4">
          <div>
            <p className="text-4xl font-heading font-extrabold text-primary">{correct}/{total}</p>
            <p className="text-sm text-muted-foreground mt-1">Câu đúng</p>
          </div>
          <div>
            <p className="text-4xl font-heading font-extrabold text-foreground">{pct}%</p>
            <p className="text-sm text-muted-foreground mt-1">Tỉ lệ đúng</p>
          </div>
          <div>
            <p className={`text-4xl font-heading font-extrabold ${getLevelColor(level)}`}>{level}</p>
            <p className="text-sm text-muted-foreground mt-1">Trình độ ước tính</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8">
          <Button variant="outline" onClick={onExit} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Button>
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw className="w-4 h-4" /> Làm lại
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ReadingResults;
