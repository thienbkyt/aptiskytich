import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Eye, RotateCcw, History as HistoryIcon, Calendar, Trophy } from "lucide-react";
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
  full_test_session_id: string | null;
  full_test_id: string | null;
}

interface FullTestGroup {
  sessionId: string;
  fullTestId: string | null;
  title: string;
  created_at: string;
  rows: HistoryRow[];
  totalScore: number;
  totalQuestions: number;
  skillCount: number;
}

const SKILL_LABELS: Record<string, string> = {
  grammar: "Grammar",
  grammar_vocab: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

const SKILL_ROUTES: Record<string, string> = {
  grammar: "/grammar",
  grammar_vocab: "/grammar",
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
  const [fullTestGroups, setFullTestGroups] = useState<FullTestGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: results } = await supabase
          .from("test_results")
          .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores,full_test_session_id,full_test_id")
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

        // Resolve full_test titles
        const ftIds = Array.from(
          new Set((results || []).map((r: any) => r.full_test_id).filter(Boolean))
        );
        const ftMap: Record<string, string> = {};
        if (ftIds.length > 0) {
          const { data: fts } = await supabase
            .from("full_tests")
            .select("id,title")
            .in("id", ftIds);
          (fts || []).forEach((f: any) => { ftMap[f.id] = f.title; });
        }

        const merged: HistoryRow[] = (results || []).map((r: any) => {
          const setInfo = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
          let skill =
            setInfo?.skill ||
            (r.skill_scores && (r.skill_scores as any).skill) ||
            "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
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
            full_test_session_id: r.full_test_session_id ?? null,
            full_test_id: r.full_test_id ?? null,
          };
        });

        // Group Full Test rows by session id
        const sessionMap = new Map<string, FullTestGroup>();
        for (const r of merged) {
          if (!r.full_test_session_id) continue;
          let g = sessionMap.get(r.full_test_session_id);
          if (!g) {
            g = {
              sessionId: r.full_test_session_id,
              fullTestId: r.full_test_id,
              title: (r.full_test_id && ftMap[r.full_test_id]) || "Bài thi thử Aptis",
              created_at: r.created_at,
              rows: [],
              totalScore: 0,
              totalQuestions: 0,
              skillCount: 0,
            };
            sessionMap.set(r.full_test_session_id, g);
          }
          g.rows.push(r);
          g.totalScore += r.score || 0;
          g.totalQuestions += r.total || 0;
          // earliest created_at (rows ordered desc → keep later overwrite)
          if (new Date(r.created_at).getTime() < new Date(g.created_at).getTime()) {
            g.created_at = r.created_at;
          }
        }
        const groups = Array.from(sessionMap.values()).map((g) => {
          g.skillCount = new Set(g.rows.map((r) => r.skill)).size;
          return g;
        });
        groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (!cancelled) {
          setRows(merged);
          setFullTestGroups(groups);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Filter: per-skill view excludes Full Test rows (those live under "fulltest" tab)
  const filtered = useMemo(() => {
    if (skillFilter === "fulltest") return rows; // not used directly
    const base = rows.filter((r) => !r.full_test_session_id);
    if (skillFilter === "all") return base;
    return base.filter((r) => r.skill === skillFilter);
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

  const isFullTestTab = skillFilter === "fulltest";

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
              <TabsTrigger value="fulltest" className="flex-1 min-w-[80px] gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Full Test
              </TabsTrigger>
              {["grammar","reading","listening","speaking","writing"].map((k) => (
                <TabsTrigger key={k} value={k} className="flex-1 min-w-[80px]">{SKILL_LABELS[k]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : isFullTestTab ? (
            fullTestGroups.length === 0 ? (
              <EmptyState
                title="Chưa có lần thi thử Full Test nào"
                desc="Hãy thử sức với bài thi thử Aptis 162 phút để xem kết quả tại đây."
                ctaTo="/thi-thu"
                ctaLabel="Đi đến trang thi thử"
              />
            ) : (
              <div className="space-y-3">
                {fullTestGroups.map((g) => {
                  const pct = g.totalQuestions > 0 ? Math.round((g.totalScore / g.totalQuestions) * 100) : 0;
                  return (
                    <div key={g.sessionId} className="glass-card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <Badge className="bg-primary/10 text-primary border-0 gap-1">
                            <Trophy className="w-3 h-3" /> Full Test
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">{g.skillCount}/5 kỹ năng</Badge>
                        </div>
                        <h3 className="font-heading font-semibold text-foreground truncate">{g.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> {formatDateTime(g.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground">{g.totalScore}/{g.totalQuestions}</div>
                          <div className="text-xs text-muted-foreground">{pct}%</div>
                        </div>
                      </div>
                      <div className="flex gap-2 md:flex-col lg:flex-row">
                        <Link to={`/history/full-test/${g.sessionId}`} className="flex-1 md:flex-none">
                          <Button variant="outline" size="sm" className="gap-1.5 w-full"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                        </Link>
                        <Link to="/thi-thu" className="flex-1 md:flex-none">
                          <Button size="sm" className="gap-1.5 w-full"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử làm bài"
              desc="Hãy bắt đầu luyện tập để theo dõi tiến trình của bạn nhé!"
              ctaTo="/practice"
              ctaLabel="Đi đến trang luyện tập"
            />
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
                      <Link
                        to={
                          r.exam_set_id
                            ? `${SKILL_ROUTES[r.skill] || "/practice"}?set=${r.exam_set_id}`
                            : SKILL_ROUTES[r.skill] || "/practice"
                        }
                        className="flex-1 md:flex-none"
                      >
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

const EmptyState = ({ title, desc, ctaTo, ctaLabel }: { title: string; desc: string; ctaTo: string; ctaLabel: string }) => (
  <div className="glass-card p-10 text-center">
    <HistoryIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
    <h2 className="font-heading font-bold text-foreground mb-1">{title}</h2>
    <p className="text-sm text-muted-foreground mb-5">{desc}</p>
    <Link to={ctaTo}>
      <Button className="gap-2">{ctaLabel} <ArrowRight className="w-4 h-4" /></Button>
    </Link>
  </div>
);

export default History;
