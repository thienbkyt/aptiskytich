import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import HistoryReviewRenderer from "@/components/history/HistoryReviewRenderer";
import ReviewErrorBoundary from "@/components/history/ReviewErrorBoundary";

type QResult = { exam_question_id: string; user_answer: string | null; is_correct: boolean };
type PerSetEntry = {
  examSetId: string;
  part: string;
  correct: number;
  total: number;
  qResults: QResult[];
  answers?: any;
};

const MarathonHistoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [skill, setSkill] = useState<"listening" | "reading" | null>(null);
  const [perSet, setPerSet] = useState<PerSetEntry[] | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("test_results")
        .select("skill_scores,review_snapshot")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const ss: any = (data as any)?.skill_scores || {};
      const sk = ss.skill === "reading" || ss.skill === "listening" ? ss.skill : null;
      const raw: any = (data as any)?.review_snapshot?.raw;
      const ps: PerSetEntry[] | null = Array.isArray(raw?.perSet) ? raw.perSet : null;
      setSkill(sk);
      setPerSet(ps);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, id]);

  useEffect(() => {
    document.body.classList.add("history-review-mode");
    return () => { document.body.classList.remove("history-review-mode"); };
  }, []);

  const pages = useMemo(() => {
    if (!perSet || !skill) return [] as { entry: PerSetEntry; ri: number; section: number; priorPages: number }[];
    const out: { entry: PerSetEntry; ri: number; section: number; priorPages: number }[] = [];
    let prior = 0;
    perSet.forEach((entry, ri) => {
      if (skill === "listening") {
        const count = entry.qResults?.length || 0;
        for (let q = 0; q < count; q++) {
          out.push({ entry, ri, section: q, priorPages: prior });
        }
        prior += count;
      } else {
        const pagesPerSet = entry.part === "part2" ? 2 : 1;
        for (let s = 0; s < pagesPerSet; s++) {
          out.push({ entry, ri, section: s, priorPages: prior });
        }
        prior += pagesPerSet;
      }
    });
    return out;
  }, [perSet, skill]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!skill || !perSet || perSet.length === 0 || pages.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center glass-card p-8">
          <p className="text-base text-foreground mb-4">Lượt này không có dữ liệu xem lại</p>
          <Link to="/history">
            <Button variant="outline">Quay lại Lịch sử</Button>
          </Link>
        </div>
      </div>
    );
  }

  const page = pages[reviewIndex];
  const r = page.entry;
  const isFirst = reviewIndex === 0;
  const isLast = reviewIndex === pages.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button size="sm" variant="outline" onClick={() => navigate("/history")}>
              Đóng
            </Button>
            <span className="text-xs text-muted-foreground truncate">
              Trang <span className="font-bold text-foreground">{reviewIndex + 1}</span>/{pages.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReviewIndex((i) => (i > 0 ? i - 1 : i))}
              disabled={isFirst}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Trước</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReviewIndex((i) => (i < pages.length - 1 ? i + 1 : i))}
              disabled={isLast}
              className="gap-1"
            >
              <span className="hidden sm:inline">Sau</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      <ReviewErrorBoundary label="Không xem lại được trang marathon này">
        <HistoryReviewRenderer
          key={reviewIndex}
          examSetId={r.examSetId}
          skill={skill}
          part={r.part}
          testTitle={`Đề ${page.ri + 1}`}
          qResults={r.qResults || []}
          onExit={() => navigate("/history")}
          pageBase={page.priorPages}
          pageTotal={pages.length}
          initialSection={page.section}
        />
      </ReviewErrorBoundary>

    </div>
  );
};

export default MarathonHistoryDetail;
