import InlineErrorText from "./InlineErrorText";
import ErrorCategorySummary from "./ErrorCategorySummary";
import VocabProfile from "./VocabProfile";
import TextStats from "./TextStats";
import PronunciationPractice from "./PronunciationPractice";
import ErrorTrendsCard from "./ErrorTrendsCard";
import { asArray, type InsightError } from "./errorCategories";

export interface SpeakingInsightItem {
  questionText?: string;
  transcript?: string;
  onTopic?: boolean | null;
  grammarErrors?: unknown;
  pronunciationWords?: unknown;
}

export const OnTopicBadge = ({ onTopic, transcript }: { onTopic?: boolean | null; transcript?: string }) => {
  if (typeof onTopic !== "boolean" || !String(transcript ?? "").trim()) return null;
  return onTopic ? (
    <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 bg-green-500/10 text-green-700 dark:text-green-400">Đúng trọng tâm</span>
  ) : (
    <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 bg-orange-500/10 text-orange-700 dark:text-orange-400">Chưa đúng trọng tâm</span>
  );
};

export const normPron = (v: unknown) =>
  asArray<any>(v).map((p) => (typeof p === "string" ? { word: p, issue: "" } : { word: String(p?.word ?? ""), issue: String(p?.issue ?? p?.note ?? "") }));

interface Props {
  items: SpeakingInsightItem[];
  /** Render the per-question inline transcripts too. */
  showPerQuestion?: boolean;
}

const SpeakingInsights = ({ items, showPerQuestion = true }: Props) => {
  const safe = items || [];
  const allErrors = safe.flatMap((it) => asArray<InsightError>(it.grammarErrors).map((e) => ({ ...e, kind: "grammar" as const })));
  const fullText = safe.map((it) => String(it.transcript ?? "").trim()).filter(Boolean).join("\n");
  const pron = safe.flatMap((it) => normPron(it.pronunciationWords));

  return (
    <div className="space-y-4">
      <h3 className="text-base font-heading font-bold text-foreground">🔍 Phân tích chi tiết</h3>
      {showPerQuestion && safe.map((it, i) => {
        const t = String(it.transcript ?? "").trim();
        return (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-heading font-bold text-foreground">Câu {i + 1}</p>
              <OnTopicBadge onTopic={it.onTopic} transcript={t} />
            </div>
            {it.questionText && <p className="text-xs text-muted-foreground">{it.questionText}</p>}
            {t ? (
              asArray(it.grammarErrors).length > 0 ? (
                <InlineErrorText text={t} errors={asArray<InsightError>(it.grammarErrors)} />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{t}</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground italic">(Không có lời nói)</p>
            )}
          </div>
        );
      })}
      <ErrorCategorySummary errors={allErrors} />
      {fullText && <VocabProfile text={fullText} />}
      {fullText && <TextStats text={fullText} />}
      <PronunciationPractice words={pron} />
      <ErrorTrendsCard skill="speaking" />
    </div>
  );
};

export default SpeakingInsights;
