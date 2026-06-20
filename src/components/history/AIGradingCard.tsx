import { Sparkles, AlertCircle, Lightbulb } from "lucide-react";

interface Mistake {
  type?: string;
  original?: string;
  correction?: string;
  explanation?: string;
}

interface Criteria {
  [key: string]: { level?: string; comment?: string } | string;
}

interface Grading {
  overall_level: string | null;
  suggestions: any;
  mistakes: any;
  criteria?: any;
}

interface Props {
  grading: Grading;
  title?: string;
}

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-emerald-100 text-emerald-700",
  B2: "bg-amber-100 text-amber-700",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-pink-100 text-pink-700",
};

const CRITERIA_LABEL_VI: Record<string, string> = {
  task_response: "Đáp ứng yêu cầu",
  task_fulfillment: "Đáp ứng yêu cầu",
  task: "Đáp ứng yêu cầu",
  grammar: "Ngữ pháp",
  vocabulary: "Từ vựng",
  coherence: "Mạch lạc",
  cohesion: "Liên kết",
  fluency: "Trôi chảy",
  pronunciation: "Phát âm",
  organization: "Tổ chức ý",
};

const labelize = (k: string) =>
  CRITERIA_LABEL_VI[k.toLowerCase()] || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AIGradingCard = ({ grading, title = "AI Kỳ Tích đánh giá tổng quan" }: Props) => {
  const suggestions: string[] = (() => {
    const arr = Array.isArray(grading.suggestions) ? grading.suggestions : [];
    return arr
      .map((s: any) => (typeof s === "string" ? s : s?.text || s?.suggestion || ""))
      .filter(Boolean);
  })();

  const mistakes: Mistake[] = Array.isArray(grading.mistakes) ? grading.mistakes : [];

  const criteriaEntries: Array<[string, { level?: string; comment?: string }]> = (() => {
    const c = grading.criteria;
    if (!c || typeof c !== "object") return [];
    return Object.entries(c).map(([k, v]) => {
      if (typeof v === "string") return [k, { level: v }] as [string, any];
      return [k, v] as [string, any];
    });
  })();

  const overall = grading.overall_level || "—";
  const writingCriteria: any = grading.criteria && typeof grading.criteria === "object" && !Array.isArray(grading.criteria) ? grading.criteria : null;
  const isWriting = !!(writingCriteria && typeof writingCriteria.maxPoints === "number" && typeof writingCriteria.partScore === "number");
  const writingDisplay = isWriting
    ? `${Number((Number(writingCriteria.partScore) / 2).toFixed(1))}/${Number(writingCriteria.maxPoints) / 2}`
    : null;
  const overallColor = isWriting
    ? "bg-primary/10 text-primary"
    : (CEFR_COLORS[overall] || "bg-[#24085a]/10 text-[#24085a]");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#24085a]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#24085a]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground mb-1">{title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-2xl font-heading font-extrabold px-3 py-0.5 rounded-md ${overallColor}`}>
                {isWriting ? writingDisplay : overall}
              </span>
              <span className="text-xs text-muted-foreground">{isWriting ? "Điểm Writing" : "Band CEFR"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CEFR criteria breakdown */}
      {!isWriting && criteriaEntries.length > 0 && (
        <div className="p-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Điểm theo tiêu chí
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {criteriaEntries.map(([k, v]) => {
              const lvl = v.level || "—";
              const col = CEFR_COLORS[lvl] || "bg-muted text-muted-foreground";
              return (
                <div key={k} className="rounded-lg border border-border p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1 truncate">{labelize(k)}</div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${col}`}>{lvl}</span>
                  </div>
                  {v.comment && (
                    <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{v.comment}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> Gợi ý cải thiện
          </p>
          <ul className="space-y-1.5">
            {suggestions.slice(0, 6).map((s, i) => (
              <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                <span className="text-[#FEAD5F] flex-shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mistakes */}
      {mistakes.length > 0 && (
        <div className="p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Lỗi cần sửa ({mistakes.length})
          </p>
          <div className="space-y-2.5">
            {mistakes.slice(0, 8).map((m, i) => (
              <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
                {m.type && (
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">{m.type}</div>
                )}
                {m.original && (
                  <div className="text-destructive line-through decoration-destructive/50 mb-0.5">{m.original}</div>
                )}
                {m.correction && (
                  <div className="text-emerald-600 font-medium">→ {m.correction}</div>
                )}
                {m.explanation && (
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{m.explanation}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGradingCard;
