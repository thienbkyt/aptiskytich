import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";

interface PrepTimerProps {
  prepTime: number;
  onPrepEnd: () => void;
  children?: React.ReactNode;
}

const PrepTimer = ({ prepTime, onPrepEnd, children }: PrepTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(prepTime);

  useEffect(() => {
    if (timeLeft <= 0) {
      onPrepEnd();
      return;
    }
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, onPrepEnd]);

  const progress = prepTime > 0 ? ((prepTime - timeLeft) / prepTime) * 100 : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Prep header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <Eye className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-bold text-blue-600">
            Preparation Time
          </span>
        </div>
        <p className="text-4xl font-mono font-extrabold text-gray-800 tabular-nums mb-3">
          {formatTime(timeLeft)}
        </p>
        <div className="h-2 w-full max-w-xs mx-auto bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-blue-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Hãy đọc câu hỏi và chuẩn bị câu trả lời. Phần ghi âm sẽ bắt đầu tự động.
        </p>
      </motion.div>

      {/* Content below (question/images) */}
      {children}
    </div>
  );
};

export default PrepTimer;
