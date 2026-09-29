import { useState } from "react";
import type { WritingGradingResult } from "@/hooks/useExamGrading";
import WritingInsights from "@/components/insights/WritingInsights";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WritingGradingReviewProps {
  grading: WritingGradingResult;
  /** Student's answer text (for the "Phân tích chi tiết" block). */
  answerText?: string;
}

const SECTIONS: { label: string; icon: string; cls: string }[] = [
  { label: "Hoàn thành nhiệm vụ", icon: "🎯", cls: "border-blue-500" },
  { label: "Ngữ pháp & chính tả", icon: "📝", cls: "border-rose-500" },
  { label: "Từ vựng", icon: "📚", cls: "border-emerald-500" },
  { label: "Mạch lạc", icon: "🔗", cls: "border-violet-500" },
  { label: "Gợi ý nâng cao", icon: "🚀", cls: "border-amber-500" },
];

type FeedbackChunk = { label: string; content: string };

const parseFeedback = (feedback: string): FeedbackChunk[] => {
  const pattern = new RegExp(
    `\\*\\*\\s*(${SECTIONS.map((section) => section.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*\\*\\*[\\s:：]*`,
    "gi",
  );
  const matches = Array.from(feedback.matchAll(pattern));
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? feedback.length) : feedback.length;
    return { label: match[1], content: feedback.slice(start, end).trim() };
  });
};

const FeedbackGroup = ({ chunks, errorCount }: { chunks: FeedbackChunk[]; errorCount: number }) => (
  <div className="space-y-3">
    {chunks.map((chunk, index) => {
      const meta = SECTIONS.find(
        (section) => section.label.toLowerCase() === chunk.label.toLowerCase(),
      ) ?? SECTIONS[0];
      return (
        <div key={`${chunk.label}-${index}`} className={`border-l-4 pl-3 py-1.5 ${meta.cls}`}>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span aria-hidden>{meta.icon}</span>
            <span>{meta.label}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
          {meta.label === "Ngữ pháp & chính tả" && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1.5 text-xs text-primary"
              onClick={() => document.getElementById("writing-error-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Xem {errorCount} lỗi cụ thể ↓
            </Button>
          )}
        </div>
      );
    })}
  </div>
);

const FeedbackDisplay = ({ feedback, errorCounts }: { feedback: string; errorCounts: [number, number] }) => {
  const chunks = parseFeedback(feedback);
  if (chunks.length === 0) {
    return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{feedback}</p>;
  }

  const upgrades = chunks.filter((chunk) => chunk.label.toLowerCase() === "gợi ý nâng cao");
  const criteria = chunks.filter((chunk) => chunk.label.toLowerCase() !== "gợi ý nâng cao");
  const seen = new Set<string>();
  const splitAt = criteria.findIndex((chunk) => {
    const key = chunk.label.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  const groups = splitAt > 0 ? [criteria.slice(0, splitAt), criteria.slice(splitAt)] : [criteria];

  return (
    <div className="space-y-3">
      {groups.length === 2 ? (
        <Tabs defaultValue="informal">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="informal">✉️ Email thân mật</TabsTrigger>
            <TabsTrigger value="formal">📨 Email trang trọng</TabsTrigger>
          </TabsList>
          <TabsContent value="informal" className="pt-2">
            <FeedbackGroup chunks={groups[0]} errorCount={errorCounts[0]} />
          </TabsContent>
          <TabsContent value="formal" className="pt-2">
            <FeedbackGroup chunks={groups[1]} errorCount={errorCounts[1]} />
          </TabsContent>
        </Tabs>
      ) : (
        <FeedbackGroup chunks={groups[0]} errorCount={errorCounts[0]} />
      )}
      {upgrades.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span aria-hidden>🚀</span>
            <span>Gợi ý nâng cao</span>
          </p>
          {upgrades.map((chunk, index) => (
            <p key={index} className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
          ))}
        </div>
      )}
    </div>
  );
};

const WritingGradingReview = ({ grading, answerText }: WritingGradingReviewProps) => {
  const [showAllErrors, setShowAllErrors] = useState(false);
  const allErrors = [
    ...(grading.grammarErrors || []).map((error) => ({ ...error, kind: "Ngữ pháp" })),
    ...(grading.spellingErrors || []).map((error) => ({ ...error, kind: "Chính tả" })),
  ];
  const hasEmailIndexes = allErrors.some((error) => Number.isInteger(Number((error as { emailIndex?: unknown }).emailIndex)));
  const errorCounts: [number, number] = hasEmailIndexes
    ? [0, 1].map((emailIndex) => allErrors.filter((error) => Number((error as { emailIndex?: unknown }).emailIndex) === emailIndex).length) as [number, number]
    : [allErrors.length, allErrors.length];
  const visibleErrors = showAllErrors ? allErrors : allErrors.slice(0, 3);
  const hiddenErrorCount = Math.max(0, allErrors.length - 3);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-heading font-bold text-foreground">Nhận xét của AI Kỳ Tích</h3>
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
            {grading.partScore}/{grading.maxPoints}
          </span>
        </div>
        {grading.feedback && <FeedbackDisplay feedback={String(grading.feedback)} errorCounts={errorCounts} />}
      </div>

      <div id="writing-error-list" className="bg-card border border-border rounded-2xl p-6 scroll-mt-4">
        <h3 className="text-sm font-heading font-bold text-foreground mb-4">❌ Lỗi cần sửa</h3>
        {allErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Không phát hiện lỗi ngữ pháp/chính tả.</p>
        ) : (
          <div className="space-y-3">
            {visibleErrors.map((error, index) => (
              <div key={index} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{error.kind}</p>
                <p className="text-sm text-red-600 dark:text-red-400 line-through mb-1">&ldquo;{error.original}&rdquo;</p>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">→ &ldquo;{error.corrected}&rdquo;</p>
                <p className="text-xs text-muted-foreground">{error.explanation}</p>
              </div>
            ))}
            {hiddenErrorCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAllErrors((current) => !current)}
              >
                {showAllErrors ? "Thu gọn" : `Xem thêm ${hiddenErrorCount} lỗi`}
              </Button>
            )}
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

      <WritingInsights text={answerText} grammarErrors={grading.grammarErrors} spellingErrors={grading.spellingErrors} />
    </div>
  );
};

export default WritingGradingReview;