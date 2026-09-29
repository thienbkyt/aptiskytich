import { CATEGORY_LABEL, categorize, type ErrorCategory, type InsightError } from "./errorCategories";

interface Props {
  errors: (InsightError & { kind?: "grammar" | "spelling" })[];
}

const ErrorCategorySummary = ({ errors }: Props) => {
  const counts = new Map<ErrorCategory, number>();
  for (const e of errors || []) {
    const c = categorize(e, e.kind);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">📊 Nhóm lỗi</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không phát hiện lỗi 🎉</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(([cat, n]) => (
            <div key={cat}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-foreground">{CATEGORY_LABEL[cat]}</span>
                <span className="text-muted-foreground">{n} lỗi</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ErrorCategorySummary;
