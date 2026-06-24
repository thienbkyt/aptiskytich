import type { WritingGradingResult } from "@/hooks/useExamGrading";
import { Eye, Loader2 } from "lucide-react";
import UpgradeLock from "@/components/pro/UpgradeLock";

interface SubmissionPart {
  prompt: string;
  answer: string;
  sampleAnswer?: string;
}

interface WritingResultsProps {
  isGrading: boolean;
  grading: WritingGradingResult | null;
  onExit: () => void;
  submission?: SubmissionPart[];
  /** When provided, render a "Xem lại từng câu →" button. */
  onReview?: () => void;
  /** When set, show UpgradeLock instead of grading details. */
  quotaExceeded?: { freeQuota: number; used: number; remaining: number } | null;
}

const WritingResults = ({ isGrading, grading, onExit, submission, onReview, quotaExceeded }: WritingResultsProps) => {
  if (quotaExceeded) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <UpgradeLock
          reason="quota"
          featureLabel="Chấm AI Writing"
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
        <p className="text-sm text-muted-foreground">AI Kỳ Tích đang phân tích bài viết của bạn. Vui lòng đợi trong giây lát.</p>
      </div>
    );
  }

  if (!grading) return null;

  const allErrors = [
    ...(grading.grammarErrors || []).map((e) => ({ ...e, kind: "Ngữ pháp" })),
    ...(grading.spellingErrors || []).map((e) => ({ ...e, kind: "Chính tả" })),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Overall Score */}
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl">✍️</span>
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground mb-1">Kết quả Writing</h2>
        <div className="inline-block px-6 py-3 rounded-full text-2xl font-bold mt-2 bg-primary/10 text-primary">
          Điểm: {Number((grading.partScore / 2).toFixed(1))}/{grading.maxPoints / 2}
        </div>
        {grading.coherencePenaltyPercent > 0 && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-3">
            Trừ mạch lạc: −{grading.coherencePenaltyPercent}%
          </p>
        )}
        {grading.feedback && (
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{grading.feedback}</p>
        )}
      </div>

      {/* Submission display */}
      {submission && submission.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-heading font-bold text-foreground mb-4">📝 Đề bài, bài làm & bài viết mẫu</h3>
          <div className="space-y-4">
            {submission.map((s, i) => (
              <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Đề {i + 1}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{s.prompt}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Bài làm của bạn</p>
                  <div className="bg-muted/40 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {s.answer || <span className="text-muted-foreground italic">(không có nội dung)</span>}
                    </p>
                  </div>
                </div>
                {s.sampleAnswer && (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-success mb-1">💡 Bài viết mẫu</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{s.sampleAnswer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-heading font-bold text-foreground mb-4">❌ Lỗi cần sửa</h3>
        {allErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Không phát hiện lỗi ngữ pháp/chính tả.</p>
        ) : (
          <div className="space-y-3">
            {allErrors.map((m, i) => (
              <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{m.kind}</p>
                <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">"{m.original}"</p>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ "{m.corrected}"</p>
                <p className="text-xs text-muted-foreground">{m.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
        {onReview && (
          <button
            onClick={onReview}
            className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem lại từng câu →
          </button>
        )}
        <button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors">
          Quay lại danh sách
        </button>
      </div>
    </div>
  );
};

export default WritingResults;
