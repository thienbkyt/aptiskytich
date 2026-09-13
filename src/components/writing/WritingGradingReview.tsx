import type { WritingGradingResult } from "@/hooks/useExamGrading";

interface WritingGradingReviewProps {
  grading: WritingGradingResult;
}

const SECTIONS: { label: string; icon: string; cls: string }[] = [
  { label: "Hoàn thành nhiệm vụ", icon: "🎯", cls: "bg-blue-500/5 border-blue-500/20" },
  { label: "Ngữ pháp & chính tả", icon: "📝", cls: "bg-rose-500/5 border-rose-500/20" },
  { label: "Từ vựng", icon: "📚", cls: "bg-emerald-500/5 border-emerald-500/20" },
  { label: "Mạch lạc", icon: "🔗", cls: "bg-violet-500/5 border-violet-500/20" },
  { label: "Gợi ý nâng cao", icon: "🚀", cls: "bg-amber-500/5 border-amber-500/20" },
];

const renderFeedback = (feedback: string) => {
  const pattern = new RegExp(
    `\\*\\*\\s*(${SECTIONS.map((section) => section.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*\\*\\*[\\s:：]*`,
    "gi",
  );
  const matches = Array.from(feedback.matchAll(pattern));

  if (matches.length === 0) {
    const parts = feedback.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {parts.map((part, index) => {
          const match = part.match(/^\*\*([^*]+)\*\*$/);
          return match ? (
            <strong key={index} className="text-foreground font-semibold">{match[1]}</strong>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </p>
    );
  }

  const chunks = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? feedback.length) : feedback.length;
    return { label: match[1], content: feedback.slice(start, end).trim() };
  });

  return (
    <div className="space-y-3">
      {chunks.map((chunk, index) => {
        const meta = SECTIONS.find(
          (section) => section.label.toLowerCase() === chunk.label.toLowerCase(),
        ) ?? SECTIONS[0];
        return (
          <div key={index} className={`rounded-xl border p-4 ${meta.cls}`}>
            <p className="text-sm font-heading font-bold text-foreground mb-1.5 flex items-center gap-2">
              <span aria-hidden>{meta.icon}</span>
              <span>{meta.label}</span>
            </p>
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
          </div>
        );
      })}
    </div>
  );
};

const WritingGradingReview = ({ grading }: WritingGradingReviewProps) => {
  const allErrors = [
    ...(grading.grammarErrors || []).map((error) => ({ ...error, kind: "Ngữ pháp" })),
    ...(grading.spellingErrors || []).map((error) => ({ ...error, kind: "Chính tả" })),
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-heading font-bold text-foreground">Nhận xét của AI Kỳ Tích</h3>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
            {grading.partScore}/{grading.maxPoints}
          </span>
        </div>
        {grading.feedback && renderFeedback(String(grading.feedback))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-heading font-bold text-foreground mb-4">❌ Lỗi cần sửa</h3>
        {allErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Không phát hiện lỗi ngữ pháp/chính tả.</p>
        ) : (
          <div className="space-y-3">
            {allErrors.map((error, index) => (
              <div key={index} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{error.kind}</p>
                <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">&ldquo;{error.original}&rdquo;</p>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ &ldquo;{error.corrected}&rdquo;</p>
                <p className="text-xs text-muted-foreground">{error.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(grading.improvedVersion || grading.upgradeTips) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-3">
          {grading.improvedVersion && (
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 mb-1">📝 Bài mẫu Kỳ Tích — viết lại từ bài của bạn</p>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{grading.improvedVersion}</p>
            </div>
          )}
          {grading.upgradeTips && (
            <div>
              <p className="text-xs font-semibold uppercase text-primary mb-1">🎯 Mẹo đạt điểm cao Aptis</p>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{grading.upgradeTips}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WritingGradingReview;