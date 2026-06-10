import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Calendar as CalendarIcon, LineChart as LineIcon, BarChart3, ArrowUp, ArrowDown, Minus } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TechSkeleton } from "@/components/ui/tech-skeleton";

const SKILL_META = [
  { key: "grammar",   label: "Grammar",   color: "hsl(var(--primary))" },
  { key: "reading",   label: "Reading",   color: "hsl(var(--info))" },
  { key: "listening", label: "Listening", color: "hsl(var(--warning))" },
  { key: "speaking",  label: "Speaking",  color: "hsl(var(--accent))" },
  { key: "writing",   label: "Writing",   color: "hsl(var(--success))" },
] as const;

type SkillKey = typeof SKILL_META[number]["key"];

interface Row {
  created_at: string;
  score: number;
  total: number;
  skill: SkillKey;
}

const RANGE_OPTIONS = [
  { key: "7",   label: "7 ngày",   days: 7 },
  { key: "30",  label: "30 ngày",  days: 30 },
  { key: "90",  label: "3 tháng",  days: 90 },
  { key: "all", label: "Tất cả",   days: 0 },
] as const;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmtDM = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;

const ProgressPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState<"all" | SkillKey>("all");
  const [rangeKey, setRangeKey] = useState<typeof RANGE_OPTIONS[number]["key"]>("30");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: results } = await supabase
        .from("test_results")
        .select("score,total,created_at,exam_set_id,skill_scores")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const r = results || [];
      const setIds = Array.from(new Set(r.map((x: any) => x.exam_set_id).filter(Boolean)));
      const skillMap = new Map<string, SkillKey>();
      if (setIds.length > 0) {
        const { data: sets } = await supabase.from("exam_sets").select("id,skill").in("id", setIds);
        (sets || []).forEach((s: any) => skillMap.set(s.id, s.skill));
      }
      const mapped: Row[] = r
        .map((x: any) => {
          const skill = x.exam_set_id ? skillMap.get(x.exam_set_id) : x.skill_scores?.skill;
          if (!skill) return null;
          return { created_at: x.created_at, score: x.score, total: x.total, skill } as Row;
        })
        .filter(Boolean) as Row[];
      if (!cancelled) { setRows(mapped); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Filtered rows by range & skill (for line chart)
  const filtered = useMemo(() => {
    const opt = RANGE_OPTIONS.find(o => o.key === rangeKey)!;
    const cutoff = opt.days > 0 ? Date.now() - opt.days * 86400000 : 0;
    return rows.filter(r =>
      (skillFilter === "all" || r.skill === skillFilter) &&
      (cutoff === 0 || new Date(r.created_at).getTime() >= cutoff)
    );
  }, [rows, skillFilter, rangeKey]);

  const linePoints = useMemo(() => {
    const buckets = new Map<string, { ts: number; per: Map<SkillKey, { sum: number; n: number }> }>();
    filtered.forEach(r => {
      if (r.total <= 0) return;
      const pct = Math.round((r.score / r.total) * 100);
      const d = new Date(r.created_at);
      const k = dayKey(d);
      if (!buckets.has(k)) buckets.set(k, { ts: d.getTime(), per: new Map() });
      const b = buckets.get(k)!;
      const cur = b.per.get(r.skill) || { sum: 0, n: 0 };
      cur.sum += pct; cur.n += 1;
      b.per.set(r.skill, cur);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[1].ts - b[1].ts)
      .map(([, v]) => {
        const point: any = { date: fmtDM(new Date(v.ts)) };
        SKILL_META.forEach(s => {
          const c = v.per.get(s.key);
          if (c) point[s.key] = Math.round(c.sum / c.n);
        });
        return point;
      });
  }, [filtered]);

  const visibleSkills = skillFilter === "all" ? SKILL_META : SKILL_META.filter(s => s.key === skillFilter);

  // Heatmap (last 90 days, all rows regardless of filters)
  const heatmap = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach(r => {
      const k = dayKey(new Date(r.created_at));
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const today = new Date();
    const days: { date: Date; key: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      days.push({ date: d, key: k, count: counts.get(k) || 0 });
    }
    // Pad start so first column aligns to Monday
    const firstDow = (days[0].date.getDay() + 6) % 7; // Mon=0
    const pad: (typeof days[number] | null)[] = Array.from({ length: firstDow }, () => null);
    const cells = [...pad, ...days];
    // Build column-major (weeks) so rendering is grid of 7 rows
    const weeks: ((typeof days[number]) | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const max = Math.max(1, ...days.map(d => d.count));
    return { weeks, max };
  }, [rows]);

  const heatColor = (count: number, max: number) => {
    if (count === 0) return "bg-muted/40";
    const ratio = count / max;
    if (ratio > 0.75) return "bg-primary";
    if (ratio > 0.5)  return "bg-primary/75";
    if (ratio > 0.25) return "bg-primary/50";
    return "bg-primary/30";
  };

  // Monthly comparison
  const monthly = useMemo(() => {
    const now = new Date();
    const curM = now.getMonth(); const curY = now.getFullYear();
    const prev = new Date(curY, curM - 1, 1);
    const prevM = prev.getMonth(); const prevY = prev.getFullYear();
    const acc = (m: number, y: number) => {
      const per = new Map<SkillKey, { sum: number; n: number }>();
      rows.forEach(r => {
        const d = new Date(r.created_at);
        if (d.getMonth() === m && d.getFullYear() === y && r.total > 0) {
          const pct = (r.score / r.total) * 100;
          const cur = per.get(r.skill) || { sum: 0, n: 0 };
          cur.sum += pct; cur.n += 1; per.set(r.skill, cur);
        }
      });
      return per;
    };
    const a = acc(curM, curY); const b = acc(prevM, prevY);
    return SKILL_META.map(s => {
      const cur = a.get(s.key); const pr = b.get(s.key);
      const curAvg = cur ? Math.round(cur.sum / cur.n) : 0;
      const prAvg = pr ? Math.round(pr.sum / pr.n) : 0;
      return { skill: s.label, key: s.key, color: s.color, current: curAvg, previous: prAvg, delta: curAvg - prAvg };
    });
  }, [rows]);

  if (authLoading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-heading font-bold text-foreground">Tiến độ học tập</h1>
          <p className="text-muted-foreground mt-1">Theo dõi sự tiến bộ của bạn qua thời gian</p>
        </motion.div>

        {/* Section 1: Line chart */}
        <section className="glass-card p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
              <LineIcon className="w-5 h-5 text-primary" /> Điểm theo thời gian
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant={skillFilter === "all" ? "default" : "outline"} onClick={() => setSkillFilter("all")}>Tất cả</Button>
                {SKILL_META.map(s => (
                  <Button key={s.key} size="sm" variant={skillFilter === s.key ? "default" : "outline"} onClick={() => setSkillFilter(s.key)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mb-4">
            {RANGE_OPTIONS.map(o => (
              <Button key={o.key} size="sm" variant={rangeKey === o.key ? "secondary" : "ghost"} onClick={() => setRangeKey(o.key)}>
                {o.label}
              </Button>
            ))}
          </div>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : linePoints.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Chưa có dữ liệu trong khoảng thời gian này
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={linePoints} margin={{ top: 5, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {visibleSkills.map(s => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Section 2: Heatmap */}
        <section className="glass-card p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" /> Hoạt động 3 tháng gần nhất
            </h2>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Ít</span>
              <div className="w-3 h-3 rounded-sm bg-muted/40" />
              <div className="w-3 h-3 rounded-sm bg-primary/30" />
              <div className="w-3 h-3 rounded-sm bg-primary/50" />
              <div className="w-3 h-3 rounded-sm bg-primary/75" />
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>Nhiều</span>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <TooltipProvider delayDuration={100}>
              <div className="overflow-x-auto">
                <div className="inline-flex gap-1">
                  {heatmap.weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {Array.from({ length: 7 }).map((_, di) => {
                        const cell = week[di];
                        if (!cell) return <div key={di} className="w-3.5 h-3.5" />;
                        return (
                          <UiTooltip key={di}>
                            <TooltipTrigger asChild>
                              <div className={`w-3.5 h-3.5 rounded-sm ${heatColor(cell.count, heatmap.max)} hover:ring-2 hover:ring-primary/40 transition`} />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="text-xs">
                                <div className="font-medium">{cell.date.toLocaleDateString("vi-VN")}</div>
                                <div className="text-muted-foreground">{cell.count} bài đã làm</div>
                              </div>
                            </TooltipContent>
                          </UiTooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </TooltipProvider>
          )}
        </section>

        {/* Section 3: Monthly comparison */}
        <section className="glass-card p-5 md:p-6">
          <h2 className="font-heading font-bold text-foreground flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" /> So sánh tháng này với tháng trước
          </h2>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="h-64 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 5, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="previous" name="Tháng trước" fill="hsl(var(--muted-foreground))" radius={[4,4,0,0]} />
                    <Bar dataKey="current"  name="Tháng này"  fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {monthly.map(m => {
                  const up = m.delta > 0; const down = m.delta < 0;
                  return (
                    <div key={m.key} className="rounded-lg border border-border p-3 bg-card">
                      <div className="text-xs text-muted-foreground">{m.skill}</div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-foreground">{m.current}%</span>
                      </div>
                      <div className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${up ? "text-success" : down ? "text-destructive" : "text-muted-foreground"}`}>
                        {up ? <ArrowUp className="w-3 h-3" /> : down ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {up ? "+" : ""}{m.delta}% so với tháng trước
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ProgressPage;
