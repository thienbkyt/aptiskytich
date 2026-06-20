import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ArrowRight, Eye, RotateCcw, History as HistoryIcon, Calendar, Trophy,
  BookOpen, Headphones, Mic, Pencil, GraduationCap, ListChecks, CalendarDays,

} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HistorySkeleton, TechSkeletonRow } from "@/components/ui/tech-skeleton";
import { getSkillBand } from "@/data/questions";
import { computeHistoryDisplay } from "@/lib/historyDisplay";

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
  isMarathon: boolean;
  // computed display
  displayScore: string;     // e.g. "12/25" or "8/10" or "—"
  displayBand: string;      // e.g. "B1" or "—"
  scorePct: number | null;  // for sorting/optional pct
}

interface FullTestGroup {
  sessionId: string;
  fullTestId: string | null;
  title: string;
  created_at: string;
  rows: HistoryRow[];
  totalScaled: number;     // sum of scaled50 per skill (max 250 = 5x50)
  hasScaled: boolean;
  skillCount: number;
  gvScaled: number | null;
  skillAgg: Record<string, { num: number; den: number }>;
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

const SKILL_ICON: Record<string, any> = {
  grammar: GraduationCap,
  reading: BookOpen,
  listening: Headphones,
  speaking: Mic,
  writing: Pencil,
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay() || 7; // Mon=1..Sun=7
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (day - 1));
  return d;
};

const computeDisplay = computeHistoryDisplay;

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
          .select("id,created_at,score,total,level,time_spent,exam_set_id,skill_scores,full_test_session_id,full_test_id,review_snapshot")
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

        // AI gradings aggregated per test_result_id
        const [{ data: wg }, { data: sg }] = await Promise.all([
          supabase
            .from("writing_question_gradings")
            .select("test_result_id,part_score,max_points")
            .eq("user_id", user.id),
          (supabase as any)
            .from("speaking_question_gradings")
            .select("test_result_id,part_score,max_points")
            .eq("user_id", user.id),
        ]);
        const writingAggMap: Record<string, { sum: number; max: number }> = {};
        (wg || []).forEach((g: any) => {
          if (!g.test_result_id) return;
          const a = writingAggMap[g.test_result_id] || { sum: 0, max: 0 };
          a.sum += Number(g.part_score || 0);
          a.max += Number(g.max_points || 0);
          writingAggMap[g.test_result_id] = a;
        });
        const speakingAggMap: Record<string, { sum: number; max: number }> = {};
        (sg || []).forEach((g: any) => {
          if (!g.test_result_id) return;
          const a = speakingAggMap[g.test_result_id] || { sum: 0, max: 0 };
          a.sum += Number(g.part_score || 0);
          a.max += Number(g.max_points || 0);
          speakingAggMap[g.test_result_id] = a;
        });

        const merged: HistoryRow[] = (results || []).map((r: any) => {
          const setInfo = r.exam_set_id ? setsMap[r.exam_set_id] : undefined;
          const ss = (r.skill_scores || {}) as any;
          let skill = setInfo?.skill || ss.skill || "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
          const isMarathon = ss.mode === "marathon" || (!r.exam_set_id && !r.full_test_session_id && !!ss.label);
          const title = isMarathon
            ? (ss.label || "Luyện nhanh (Marathon)")
            : (setInfo?.title || "Đề mẫu");
          const disp = computeDisplay(
            { skill, score: r.score, total: r.total, level: r.level },
            r.review_snapshot,
            writingAggMap[r.id],
            speakingAggMap[r.id],
          );
          return {
            id: r.id,
            created_at: r.created_at,
            score: r.score,
            total: r.total,
            level: r.level,
            time_spent: r.time_spent,
            exam_set_id: r.exam_set_id,
            skill,
            title,
            part: setInfo?.part || "",
            full_test_session_id: r.full_test_session_id ?? null,
            full_test_id: r.full_test_id ?? null,
            isMarathon,
            ...disp,
          };
        });

        // Full Test grouping
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
              totalScaled: 0,
              hasScaled: false,
              skillCount: 0,
              gvScaled: null,
              skillAgg: {},
            };
            sessionMap.set(r.full_test_session_id, g);
          }
          g.rows.push(r);
          // Gộp theo kỹ năng (mỗi kỹ năng nhiều part = nhiều row).
          // MCQ dùng score/total; AI dùng tổng gradings (sum/max).
          {
            let num = 0, den = 0;
            if (r.skill === "speaking") { const a = speakingAggMap[r.id]; num = a?.sum || 0; den = a?.max || 0; }
            else if (r.skill === "writing") { const a = writingAggMap[r.id]; num = a?.sum || 0; den = a?.max || 0; }
            else { num = r.score; den = r.total; }
            if (den > 0) {
              const cur = g.skillAgg[r.skill] || { num: 0, den: 0 };
              cur.num += num; cur.den += den;
              g.skillAgg[r.skill] = cur;
            }
          }
          if (new Date(r.created_at).getTime() < new Date(g.created_at).getTime()) {
            g.created_at = r.created_at;
          }
        }
        const FOUR_SKILLS = ["reading", "listening", "speaking", "writing"];
        const groups = Array.from(sessionMap.values()).map((g) => {
          g.skillCount = new Set(g.rows.map((r) => r.skill)).size;
          let total = 0, has = false, gv: number | null = null;
          for (const sk of Object.keys(g.skillAgg)) {
            const { num, den } = g.skillAgg[sk];
            if (den <= 0) continue;
            const scaled = Math.min(50, Math.round((num / den) * 50));
            if (sk === "grammar") gv = scaled;
            else if (FOUR_SKILLS.includes(sk)) { total += scaled; has = true; }
          }
          g.totalScaled = total; g.gvScaled = gv; g.hasScaled = has;
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

  const perSkillRows = useMemo(() => rows.filter((r) => !r.full_test_session_id), [rows]);

  const filtered = useMemo(() => {
    if (skillFilter === "all") return perSkillRows;
    if (skillFilter === "fulltest") return perSkillRows; // unused
    return perSkillRows.filter((r) => r.skill === skillFilter);
  }, [perSkillRows, skillFilter]);

  // Top stats
  const stats = useMemo(() => {
    const totalAttempts = perSkillRows.length + fullTestGroups.length;
    const weekStart = startOfWeek().getTime();
    const thisWeek =
      perSkillRows.filter((r) => new Date(r.created_at).getTime() >= weekStart).length +
      fullTestGroups.filter((g) => new Date(g.created_at).getTime() >= weekStart).length;
    return { totalAttempts, thisWeek };
  }, [perSkillRows, fullTestGroups]);


  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <HistorySkeleton />
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

          {/* Stats strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <StatCard
              icon={ListChecks}
              label="Tổng lượt làm"
              value={loading ? "…" : String(stats.totalAttempts)}
            />
            <StatCard
              icon={CalendarDays}
              label="Số bài tuần này"
              value={loading ? "…" : String(stats.thisWeek)}
            />
          </div>


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
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <TechSkeletonRow key={i} />
              ))}
            </div>
          ) : isFullTestTab ? (
            fullTestGroups.length === 0 ? (
              <EmptyState
                title="Chưa có lần thi thử Full Test nào"
                desc="Hãy thử sức với bài thi thử Aptis 162 phút để xem kết quả tại đây."
                ctaTo="/thi-thu"
                ctaLabel="Đi đến trang thi thử"
              />
            ) : (
              <div className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày giờ</TableHead>
                      <TableHead>Bài thi</TableHead>
                      <TableHead>Kỹ năng</TableHead>
                      <TableHead className="text-right">Điểm</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullTestGroups.map((g) => (
                      <TableRow key={g.sessionId}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(g.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary border-0 gap-1"><Trophy className="w-3 h-3" />Full Test</Badge>
                            <span className="font-medium text-foreground truncate">{g.title}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[11px]">{g.skillCount}/5 kỹ năng</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-foreground">{g.hasScaled ? `${g.totalScaled}/200` : "—"}</div>
                          {g.gvScaled != null && (
                            <div className="text-[11px] text-muted-foreground">G&V {g.gvScaled}/50</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Link to={`/history/full-test/${g.sessionId}`}>
                              <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                            </Link>
                            <Link to="/thi-thu">
                              <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày giờ</TableHead>
                    <TableHead>Kỹ năng</TableHead>
                    <TableHead>Phần</TableHead>
                    <TableHead className="text-right">Điểm</TableHead>
                    <TableHead className="text-right">Band</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const Icon = SKILL_ICON[r.skill] || ListChecks;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDateTime(r.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{SKILL_LABELS[r.skill] || r.skill}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {r.title}{r.isMarathon ? " · Marathon" : ""}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.part ? <Badge variant="outline" className="text-[11px]">{r.part}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">{r.displayScore}</TableCell>
                        <TableCell className="text-right">
                          {r.displayBand && r.displayBand !== "—" ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 font-bold">{r.displayBand}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            {!r.isMarathon && (
                              <Link to={`/history/${r.id}?review=1`}>
                                <Button variant="outline" size="sm" className="gap-1.5"><Eye className="w-3.5 h-3.5" />Xem lại</Button>
                              </Link>
                            )}
                            <Link
                              to={
                                r.exam_set_id
                                  ? `${SKILL_ROUTES[r.skill] || "/practice"}?set=${r.exam_set_id}`
                                  : SKILL_ROUTES[r.skill] || "/practice"
                              }
                            >
                              <Button size="sm" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Làm lại</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

const StatCard = ({
  icon: Icon, label, value,
}: { icon: any; label: string; value: string }) => (
  <div className="glass-card p-4 flex items-center gap-3">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-muted text-foreground">
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold text-foreground">{value}</div>
    </div>
  </div>
);

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
