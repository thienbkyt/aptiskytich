import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AIGradingCard from "@/components/history/AIGradingCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  userId: string;
  attemptCreatedAt: string;
}

interface Grading {
  overall_level: string | null;
  suggestions: any;
  mistakes: any;
  criteria?: any;
}

/**
 * Fetches and renders the AI Writing grading for the matching attempt window.
 * Renders nothing if no grading is found (graceful for old attempts).
 */
const WritingFeedbackCard = ({ userId, attemptCreatedAt }: Props) => {
  const [grading, setGrading] = useState<Grading | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const target = new Date(attemptCreatedAt).getTime();
      const { data } = await supabase
        .from("exam_gradings")
        .select("overall_level,suggestions,mistakes,criteria,created_at")
        .eq("user_id", userId)
        .eq("skill", "writing")
        .order("created_at", { ascending: false })
        .limit(20);
      const g = (data || []).find(
        (x: any) => Math.abs(new Date(x.created_at).getTime() - target) < 2 * 60 * 60 * 1000,
      ) as Grading | undefined;
      if (!cancelled) {
        setGrading(g || null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, attemptCreatedAt]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!grading) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4">
      <AIGradingCard grading={grading} title="AI đánh giá Writing" />
    </div>
  );
};

export default WritingFeedbackCard;
