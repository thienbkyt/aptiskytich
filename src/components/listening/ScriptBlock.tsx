import { highlightScript } from "@/lib/listeningReview";

interface Props {
  script: string;
  spans?: string[];
  loading?: boolean;
}

const ScriptBlock = ({ script, spans = [], loading }: Props) => {
  if (!script) return null;
  const parts = highlightScript(script, spans.filter(Boolean));
  return (
    <div className="mt-6 border border-border rounded-md p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-heading font-bold text-foreground">Script</p>
        {loading && (
          <span className="text-xs text-muted-foreground italic">Đang tìm đoạn key...</span>
        )}
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {parts.map((p, i) =>
          p.mark ? (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5"
            >
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    </div>
  );
};

export default ScriptBlock;
