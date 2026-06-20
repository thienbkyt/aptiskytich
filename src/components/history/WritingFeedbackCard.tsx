import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  userId: string;
  testResultId: string | null | undefined;
}

interface GradingRow {
  part: string | null;
  part_score: number | null;
  max_points: number | null;
  grammar_errors: any;
  spelling_errors: any;
  feedback: string | null;
}

/**
 * Renders AI Writing grading for a specific attempt, linked by test_result_id.
 * Falls back to nothing when no grading is found.
 */
const WritingFeedbackCard = ({ userId, testResultId }: Props) => {
  const [rows, setRows] = useState<GradingRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!testResultId) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("writing_question_gradings")
        .select("part,part_score,max_points,grammar_errors,spelling_errors,feedback")
        .eq("user_id", userId)
        .eq("test_result_id", testResultId);
      if (!cancelled) {
        setRows((data || []) as GradingRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, testResultId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!rows || rows.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
      {rows.map((g, i) => {
        const grammar = (g.grammar_errors as any[]) || [];
        const spelling = (g.spelling_errors as any[]) || [];
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground">
                AI Kỳ Tích đánh giá Writing{g.part ? ` — ${g.part}` : ""}
              </h3>
              <span className="text-sm font-medium text-primary">
                {(g.part_score ?? 0)}/{g.max_points ?? 0}
              </span>
            </div>
            {g.feedback && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{g.feedback}</p>
            )}
            {grammar.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-foreground mb-1">Lỗi ngữ pháp ({grammar.length})</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {grammar.map((e: any, j: number) => (
                    <li key={j}>
                      <span className="line-through text-destructive">{e.original}</span>
                      {" → "}
                      <span className="text-foreground">{e.corrected}</span>
                      {e.explanation ? ` — ${e.explanation}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {spelling.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Lỗi chính tả ({spelling.length})</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {spelling.map((e: any, j: number) => (
                    <li key={j}>
                      <span className="line-through text-destructive">{e.original}</span>
                      {" → "}
                      <span className="text-foreground">{e.corrected}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WritingFeedbackCard;
