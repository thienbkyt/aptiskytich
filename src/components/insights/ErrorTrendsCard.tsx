import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORY_LABEL, categorize } from "./errorCategories";

type Trend = { cat: string; recent: number; previous: number; tests: number; example?: { original?: string; corrected?: string } | null };

const ErrorTrendsCard = ({ skill }: { skill: "writing" | "speaking" }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Trend[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.rpc("get_my_error_trends", { p_skill: skill, p_n: 5 }).then(({ data }) => {
      if (!cancelled) setRows(Array.isArray(data) ? (data as unknown as Trend[]) : []);
    });
    return () => { cancelled = true; };
  }, [user, skill]);

  if (!user || rows.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">📈 Lỗi bạn hay lặp lại (5 bài gần nhất)</h3>
      <div className="space-y-3">
        {rows.slice(0, 5).map((r) => {
          const diff = r.recent - r.previous;
          return (
            <div key={r.cat} className="border-b border-border last:border-0 pb-2.5 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[categorize({ category: r.cat })]}</span>
                <span className="text-xs text-muted-foreground">
                  {r.recent} lỗi · xuất hiện ở {r.tests}/5 bài
                  {r.previous > 0 && diff !== 0 && (
                    <span className={diff > 0 ? "text-red-600 dark:text-red-400 ml-1" : "text-green-600 dark:text-green-400 ml-1"}>
                      {diff > 0 ? `↑${diff}` : `↓${-diff}`}
                    </span>
                  )}
                </span>
              </div>
              {r.example?.original && (
                <p className="text-xs mt-1">
                  <span className="line-through text-red-600 dark:text-red-400">{r.example.original}</span>
                  {" → "}
                  <span className="text-green-600 dark:text-green-400">{r.example.corrected}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ErrorTrendsCard;
