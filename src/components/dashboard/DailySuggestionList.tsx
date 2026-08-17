import { Link } from "react-router-dom";
import { ArrowRight, Crown, Sparkles } from "lucide-react";
import { useDailySuggestions } from "@/hooks/useDailySuggestions";

interface Props {
  dailyTarget: number;
  done: boolean;
}

const Skeleton2 = () => (
  <div className="space-y-2">
    <div className="h-11 rounded-lg bg-muted/50 animate-pulse" />
    <div className="h-11 rounded-lg bg-muted/50 animate-pulse" />
  </div>
);

const DailySuggestionList = ({ dailyTarget, done }: Props) => {
  const { suggestions, loading, isPro, libraryCleared, freeExhausted } = useDailySuggestions(done ? 1 : dailyTarget);

  if (loading) return <Skeleton2 />;

  if (libraryCleared || suggestions.length === 0) {
    if (isPro && libraryCleared) {
      return (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Crown className="w-4 h-4 text-accent shrink-0" />
          Bạn đã cày sạch kho đề 👑
        </div>
      );
    }
    if (!isPro) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            {freeExhausted
              ? "Bạn đã làm hết đề miễn phí — còn 600+ đề trong gói Pro"
              : "Chưa có gợi ý phù hợp hôm nay"}
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Nâng cấp <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Crown className="w-4 h-4 text-accent shrink-0" />
        Bạn đã cày sạch kho đề 👑
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {done && (
        <p className="text-sm font-semibold text-success">
          Xong chỉ tiêu hôm nay 🎉 — làm thêm cũng không ai cấm
        </p>
      )}
      {!done && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Gợi ý bài hôm nay
        </p>
      )}
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.examSetId}>
            <Link
              to={s.route}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">
                  {s.skillLabel}
                  {s.partLabel ? ` · ${s.partLabel}` : ""}
                </div>
                <div className="text-sm font-semibold truncate">{s.title}</div>
                <div className="text-xs text-primary mt-0.5">{s.reason}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {!isPro && (
        <Link to="/pricing" className="block text-xs text-muted-foreground hover:text-primary underline">
          Nâng cấp để được gợi ý theo Đề Key Dự Đoán hằng ngày
        </Link>
      )}
    </div>
  );
};

export default DailySuggestionList;
