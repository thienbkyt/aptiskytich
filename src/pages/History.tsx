import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Eye, RotateCcw, History as HistoryIcon, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface HistoryRow {
  id: string;
  created_at: string;
  score: number;
  total: number;
  level: string;
  time_spent: number | null;
  exam_set_id: string | null;
  skill: string;
  title: string;
  part: string;
}

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

const SKILL_ROUTES: Record<string, string> = {
  grammar: "/grammar",
  reading: "/reading",
  listening: "/listening",
  speaking: "/speaking",
  writing: "/writing",
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const skillFilter = params.get("skill") || "all";
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: results } = await supabase
          .from("test_results")
          .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const setIds = Array.from(
          new Set((results || []).map((r: any) => r.exam_set_id).filter(Boolean))
        );
        const setsMap: Record<string, { title: string; skill: string; part: string }> = {};
        if (setIds.length > 0) {
          const { data: sets } = await supabase
            .from("exam_sets")
            .select("id,title,skill,part")
            .in("id", setIds);
          (sets || []).forEach((s: any) => {
            setsMap[s.id] = { title: s.title, skill: s.skill, part: s.part };
          });
        }

        const merged: HistoryRow[] = (results || []).map((r: any) => {
          const setInfo = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
          const skill =
            setInfo?.skill ||
            (r.skill_scores && (r.skill_scores as any).skill) ||
            "unknown";
          return {
            id: r.id,
            created_at: r.created_at,
            score: r.score,
            total: r.total,
            level: r.level,
            time_spent: r.time_spent,
            exam_set_id: r.exam_set_id,
            skill,
            title: setInfo?.title || "Đề mẫu",
            part: setInfo?.part || "",
          };
        });

        if (!cancelled) setRows(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    if (skillFilter === "all") return rows;
    return rows.filter((r) => r.skill === skillFilter);
  }, [rows, skillFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20 section-container">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const setSkill = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("skill"); else next.set("skill", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="section-container">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground">Lịch sử làm bài</h1>
          </div>
          <p className="text-muted-foreground mb-6">Toàn bộ kết quả các bài bạn đã hoàn thành.</p>

          <Tabs value={skillFilter} onValueChange={setSkill} className="mb-6">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
              <TabsTrigger value="all" className="flex-1 min-w-[80px]">Tất cả</TabsTrigger>
              {Object.entries(SKILL_LABELS).map(([k, label]) => (
                <TabsTrigger key={k} value={k} className="flex-1 min-w-[80px]">{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <HistoryIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-heading font-bold text-foreground mb-1">Chưa có lịch sử làm bài</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Hãy bắt đầu luyện tập để theo dõi tiến trình của bạn nhé!
              </p>
              <Link to="/practice">
                <Button className="gap-2">Đi đến trang luyện tập <ArrowRight className="w-4 h-4" /></Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
                return (
                  <div key={r.id} className="glass-card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge variant="secondary" className="text-[11px]">{SKILL_LABELS[r.skill] || r.skill}</Badge>
                        {r.part && <Badge variant="outline" className="text-[11px]">{r.part}</Badge>}
                      </div>
                      <h3 className="font-heading font-semibold text-foreground truncate">{r.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">{r.score}/{r.total}</div>
                        <div className="text-xs text-muted-foreground">{pct}%</div>
                      </div>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 font-bold">{r.level}</Badge>
                    </div>
                    <div className="flex gap-2 md:flex-col lg:flex-row">
                      <Link to={`/history/${r.id}`} className="flex-1 md:flex-none">
                        <Button variant="outline" size="sm" className="gap-1.5 w-full"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                      </Link>
                      <Link to={SKILL_ROUTES[r.skill] || "/practice"} className="flex-1 md:flex-none">
                        <Button size="sm" className="gap-1.5 w-full"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default History;
