import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import HistoryReviewPager, { type ReviewPage } from "@/components/history/HistoryReviewPager";

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};

const partNum = (p: string) => {
  const m = (p || "").match(/(\d)/);
  return m ? parseInt(m[1], 10) : 99;
};

const FullPartHistoryDetail = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState<ReviewPage[] | null>(null);

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    (async () => {
      let rows: any[] = [];
      const { data: rs } = await supabase
        .from("test_results")
        .select("id,created_at,exam_set_id,skill_scores")
        .eq("user_id", user.id)
        .eq("skill_scores->>fullPartSession", sessionId)
        .order("created_at", { ascending: true });
      rows = (rs || []) as any[];
      if (rows.length === 0) {
        // Fallback: filter client-side
        const { data: all } = await supabase
          .from("test_results")
          .select("id,created_at,exam_set_id,skill_scores")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        rows = ((all || []) as any[]).filter(
          (r) => (r.skill_scores as any)?.fullPartSession === sessionId,
        );
      }

      const setIds = Array.from(new Set(rows.map((r) => r.exam_set_id).filter(Boolean)));
      const setsMap: Record<string, any> = {};
      if (setIds.length) {
        const { data: sets } = await supabase
          .from("exam_sets")
          .select("id,title,skill,part")
          .in("id", setIds);
        (sets || []).forEach((s: any) => {
          setsMap[s.id] = s;
        });
      }

      const built: ReviewPage[] = rows
        .filter((r) => r.exam_set_id)
        .map((r) => {
          const s = setsMap[r.exam_set_id];
          let skill = s?.skill || (r.skill_scores as any)?.skill || "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
          const label = (r.skill_scores as any)?.label || "";
          return {
            testResultId: r.id,
            examSetId: r.exam_set_id,
            skill,
            part: s?.part || "",
            testTitle: `${SKILL_LABELS[skill] || skill}${label ? " – " + label : ""}`,
            attemptCreatedAt: r.created_at,
          };
        })
        .sort((a, b) => partNum(a.part) - partNum(b.part));

      if (!cancelled) setPages(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sessionId]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!pages) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (pages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Không tìm thấy lượt làm này.</p>
      </div>
    );
  }

  return (
    <HistoryReviewPager
      pages={pages}
      userId={user.id}
      onExit={() => navigate("/history")}
    />
  );
};

export default FullPartHistoryDetail;
