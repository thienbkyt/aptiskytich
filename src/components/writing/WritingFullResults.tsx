import type { WritingGradingResult } from "@/hooks/useExamGrading";

interface WritingFullResultsProps {
  results: WritingGradingResult[];
  score50: number;
  onExit: () => void;
}

const partLabel = (pt: string) => {
  const m: Record<string, string> = { task1: "Part 1", task2: "Part 2", task3: "Part 3", task4: "Part 4" };
  return m[pt] || pt;
};

const WritingFullResults = ({ results, score50, onExit }: WritingFullResultsProps) => {
  const total100 = results.reduce((s, r) => s + (r.partScore || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-8">
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl">✍️</span>
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Kết quả Writing Full Practice</h2>
        <div className="inline-block px-6 py-3 rounded-full text-2xl font-bold mt-2 bg-primary/10 text-primary">
          Điểm Writing: {score50}/50
        </div>
        <p className="text-sm text-muted-foreground mt-3">Tổng {total100}/100</p>
      </div>

      {results.map((r, idx) => {
        const allErrors = [
          ...(r.grammarErrors || []).map((e) => ({ ...e, kind: "Ngữ pháp" })),
          ...(r.spellingErrors || []).map((e) => ({ ...e, kind: "Chính tả" })),
        ];
        return (
          <div key={idx} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-heading font-bold text-foreground">{partLabel(r.partType)}</h3>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary">
                {r.partScore}/{r.maxPoints}
              </span>
            </div>
            {r.feedback && <p className="text-sm text-muted-foreground leading-relaxed">{r.feedback}</p>}

            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Lỗi cần sửa</p>
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
          </div>
        );
      })}

      <div className="flex items-center justify-center pt-2">
        <button
          onClick={onExit}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          Thoát
        </button>
      </div>
    </div>
  );
};

export default WritingFullResults;
