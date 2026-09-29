import InlineErrorText from "./InlineErrorText";
import TextStats from "./TextStats";
import RepeatedWords from "./RepeatedWords";
import ErrorTrendsCard from "./ErrorTrendsCard";
import { asArray, type InsightError } from "./errorCategories";

interface Props {
  text?: string;
  grammarErrors?: InsightError[] | null;
  spellingErrors?: InsightError[] | null;
}

const WritingInsights = ({ text, grammarErrors, spellingErrors }: Props) => {
  const errors = [
    ...asArray<InsightError>(grammarErrors).map((e) => ({ ...e, kind: "grammar" as const })),
    ...asArray<InsightError>(spellingErrors).map((e) => ({ ...e, kind: "spelling" as const })),
  ];
  const body = String(text ?? "").trim();
  return (
    <div className="space-y-4">
      <h3 className="text-base font-heading font-bold text-foreground">🔍 Phân tích chi tiết</h3>
      {body && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-heading font-bold text-foreground mb-3">✍️ Bài làm của bạn</h3>
          <InlineErrorText text={body} errors={errors} />
        </div>
      )}
      {body && <TextStats text={body} />}
      {body && <RepeatedWords text={body} />}
      <ErrorTrendsCard skill="writing" />
    </div>
  );
};

export default WritingInsights;
