import { motion } from "framer-motion";
import { Mic } from "lucide-react";

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  label: string;
  isRecording?: boolean;
  isPrep?: boolean;
}

const CircularTimer = ({ timeLeft, totalTime, label, isRecording, isPrep }: CircularTimerProps) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? (timeLeft / totalTime) : 1;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor = isRecording ? "#24085a" : "#24085a";
  const bgColor = isRecording ? "bg-white" : "bg-white";

  return (
    <div className={`${bgColor} rounded-2xl shadow-lg p-6 flex flex-col items-center gap-3 min-w-[200px]`}>
      <p className={`text-sm font-bold ${isRecording ? "text-red-600" : "text-[#24085a]"}`}>
        {label}
      </p>

      <div className="relative w-[150px] h-[150px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          <motion.circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isRecording && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="mb-1"
            >
              <Mic className="w-5 h-5 text-red-600" />
            </motion.div>
          )}
          {isPrep && !isRecording && (
            <Mic className="w-5 h-5 text-[#24085a] mb-1 opacity-50" />
          )}
          <span className="text-3xl font-bold text-[#24085a] tabular-nums">{timeLeft}s</span>
        </div>
      </div>

      {/* Volume indicator when recording */}
      {isRecording && (
        <div className="flex items-end gap-0.5 h-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-red-500 rounded-full"
              animate={{
                height: [2, Math.random() * 14 + 2, 2],
              }}
              transition={{
                repeat: Infinity,
                duration: 0.3 + Math.random() * 0.3,
                delay: Math.random() * 0.2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CircularTimer;
