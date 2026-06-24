import type { GradingResult } from "@/hooks/useExamGrading";
import { Loader2 } from "lucide-react";
import UpgradeLock from "@/components/pro/UpgradeLock";

interface SpeakingResultsProps {
  isGrading: boolean;
  grading: GradingResult | null;
  onExit: () => void;
  quotaExceeded?: { freeQuota: number; used: number; remaining: number } | null;
}

const levelColors: Record<string, string> = {
  A1: "bg-red-500/10 text-red-600 dark:text-red-400",
  A2: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  B1: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  B2: "bg-green-500/10 text-green-600 dark:text-green-400",
  C1: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const SpeakingResults = ({ isGrading, grading, onExit, quotaExceeded }: SpeakingResultsProps) => {
  if (quotaExceeded) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <UpgradeLock
          reason="quota"
          featureLabel="Chấm AI Speaking"
          freeQuota={quotaExceeded.freeQuota}
          remaining={quotaExceeded.remaining}
        />
        <div className="text-center">
          <button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors">
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }
  if (isGrading) {
    return (
      <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-8 text-center">
        <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
        <h2 className="text-xl font-heading font-bold text-foreground mb-2">Đang chấm điểm...</h2>
        <p className="text-sm text-muted-foreground">AI Kỳ Tích đang phân tích bài nói của bạn. Vui lòng đợi trong giây lát.</p>
      </div>
    );
  }

  if (!grading) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Overall Score */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl">🎤</span>
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground mb-1">Kết quả Speaking</h2>
        <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold mt-2 ${levelColors[grading.overallLevel] || "bg-muted text-foreground"}`}>
          Overall: {grading.overallLevel}
        </div>
        <div className="mt-4 mx-auto max-w-md rounded-lg border border-[#24085a]/20 bg-[#24085a]/5 px-3 py-2 text-left">
          <p className="text-[11px] font-semibold text-[#24085a] mb-0.5">📐 Tiêu chí chấm</p>
          <p className="text-[11px] text-foreground/80 leading-snug">
            AI Kỳ Tích chấm dựa trên: trả lời đúng & đủ ý đề · ngữ pháp · từ vựng · phát âm · độ trôi chảy.
          </p>
        </div>
      </div>

      {/* Transcript */}
      {grading.transcript && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-heading font-bold text-foreground mb-3">📝 Nội dung đã nói (Transcript)</h3>
          <p className="text-sm text-muted-foreground italic leading-relaxed">"{grading.transcript}"</p>
        </div>
      )}

      {/* Criteria Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-heading font-bold text-foreground mb-4">📊 Điểm theo tiêu chí</h3>
        <div className="grid grid-cols-2 gap-3">
          {grading.criteria.map((c) => (
            <div key={c.name} className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">{c.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelColors[c.level] || "bg-muted"}`}>
                  {c.level}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.feedback}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mistakes */}
      {grading.mistakes.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-heading font-bold text-foreground mb-4">❌ Phân tích lỗi</h3>
          <div className="space-y-3">
            {grading.mistakes.map((m, i) => (
              <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">"{m.original}"</p>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ "{m.corrected}"</p>
                <p className="text-xs text-muted-foreground">{m.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {grading.suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-heading font-bold text-foreground mb-4">💡 Gợi ý cải thiện</h3>
          <ul className="space-y-2">
            {grading.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-center pt-2">
        <button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors">
          Quay lại danh sách
        </button>
      </div>
    </div>
  );
};

export default SpeakingResults;
