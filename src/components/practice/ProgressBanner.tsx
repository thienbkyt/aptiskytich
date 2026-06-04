import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  skill: string;
  skillLabel: string;
}

const ProgressBanner = ({ skill, skillLabel }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setCount(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: results } = await supabase
          .from("test_results")
          .select("exam_set_id,skill_scores")
          .eq("user_id", user.id);
        if (!results || results.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }
        const setIds = Array.from(new Set(results.map((r: any) => r.exam_set_id).filter(Boolean)));
        let matchedSetIds = new Set<string>();
        if (setIds.length > 0) {
          const { data: sets } = await supabase
            .from("exam_sets")
            .select("id,skill")
            .in("id", setIds);
          (sets || []).forEach((s: any) => { if (s.skill === skill) matchedSetIds.add(s.id); });
        }
        // Count unique exam sets completed for this skill; fall back to skill_scores when no set linked
        const uniq = new Set<string>();
        let fallback = 0;
        results.forEach((r: any) => {
          if (r.exam_set_id && matchedSetIds.has(r.exam_set_id)) uniq.add(r.exam_set_id);
          else if (!r.exam_set_id && r.skill_scores?.skill === skill) fallback += 1;
        });
        if (!cancelled) setCount(uniq.size + fallback);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [user, skill]);

  const isLoading = authLoading || (user && count === null);

  let subtitle = "";
  if (!user) subtitle = "Đăng nhập để theo dõi tiến độ của bạn";
  else if (isLoading) subtitle = "Đang tải tiến độ...";
  else if (count === 0) subtitle = "Chưa có bài nào — hãy bắt đầu luyện tập!";
  else subtitle = `Đã hoàn thành ${count} bộ đề ${skillLabel}`;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card/60 px-4 py-3.5 md:px-5 md:py-4 flex items-center gap-3 md:gap-4">
      <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <HistoryIcon className="w-5 h-5 text-foreground/70" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-heading font-semibold text-foreground text-sm md:text-base leading-tight">
          Tiến độ học tập của bạn
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </div>
      {user ? (
        <Link to={`/history?skill=${skill}`} className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <span className="hidden sm:inline">Xem lịch sử</span>
            <span className="sm:hidden">Lịch sử</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      ) : (
        <Link to="/auth" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập</span>
          </Button>
        </Link>
      )}
    </div>
  );
};

export default ProgressBanner;
