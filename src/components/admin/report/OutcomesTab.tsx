import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts";
import { toScaledScore, getSkillBand } from "@/data/questions";

type SkillKey = "reading" | "listening" | "grammar" | "speaking" | "writing";
type Attempt = { user_id: string; skill: SkillKey; scaled: number; created_at: string };

const SKILL_LABEL: Record<SkillKey, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar",
  speaking: "Speaking",
  writing: "Writing",
};
const SKILL_ORDER: SkillKey[] = ["reading", "listening", "grammar", "speaking", "writing"];
const BAND_ORDER = ["A0", "A1", "A2", "B1", "B2", "C"] as const;
const BAND_RANK: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };
const BAND_COLORS: Record<string, string> = {
  A0: "#94a3b8",
  A1: "#cbd5e1",
  A2: "#FEAD5F",
  B1: "#f97316",
  B2: "#CC1C01",
  C: "#4D0D0D",
};

const RANGES = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
] as const;

const bandable = (s: SkillKey): s is "reading" | "listening" | "speaking" | "writing" =>
  s === "reading" || s === "listening" || s === "speaking" || s === "writing";

export default function OutcomesTab() {
  const [range, setRange] = useState<string>("30");
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const cutoff =
      range === "all"
        ? null
        : new Date(Date.now() - Number(range) * 86400_000).toISOString();

    const trQ = supabase
      .from("test_results")
      .select("user_id, skill_scores, created_at");
    const wQ = supabase
      .from("writing_question_gradings")
      .select("user_id, test_result_id, part_score, max_points, created_at");
    const sQ = supabase
      .from("speaking_question_gradings")
      .select("user_id, test_result_id, part_score, max_points, created_at");

    if (cutoff) {
      trQ.gte("created_at", cutoff);
      wQ.gte("created_at", cutoff);
      sQ.gte("created_at", cutoff);
    }

    const [trRes, wRes, sRes] = await Promise.all([trQ, wQ, sQ]);

    const out: Attempt[] = [];

    (trRes.data || []).forEach((r: any) => {
      const ss = r.skill_scores;
      if (!ss || typeof ss !== "object") return;
      const sk = ss.skill;
      const total = Number(ss.total) || 0;
      const correct = Number(ss.correct) || 0;
      if (total <= 0) return;
      let skill: SkillKey | null = null;
      if (sk === "reading") skill = "reading";
      else if (sk === "listening") skill = "listening";
      else if (sk === "grammar_vocab" || sk === "grammar") skill = "grammar";
      if (!skill || !r.user_id || !r.created_at) return;
      out.push({
        user_id: r.user_id,
        skill,
        scaled: toScaledScore(correct, total),
        created_at: r.created_at,
      });
    });

    const groupByTRId = (
      rows: any[],
      skill: SkillKey
    ): Attempt[] => {
      const m = new Map<string, { user_id: string; ps: number; mp: number; ts: string }>();
      rows.forEach((r) => {
        const key = r.test_result_id || `${r.user_id}-${r.created_at}`;
        if (!r.user_id) return;
        const cur = m.get(key);
        const ps = Number(r.part_score) || 0;
        const mp = Number(r.max_points) || 0;
        if (cur) {
          cur.ps += ps;
          cur.mp += mp;
          if (r.created_at > cur.ts) cur.ts = r.created_at;
        } else {
          m.set(key, { user_id: r.user_id, ps, mp, ts: r.created_at });
        }
      });
      const list: Attempt[] = [];
      m.forEach((v) => {
        if (v.mp > 0) {
          list.push({
            user_id: v.user_id,
            skill,
            scaled: toScaledScore(v.ps, v.mp),
            created_at: v.ts,
          });
        }
      });
      return list;
    };

    out.push(...groupByTRId(wRes.data || [], "writing"));
    out.push(...groupByTRId(sRes.data || [], "speaking"));

    setAttempts(out);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // 1. % học viên lên band
  const bandImprovement = useMemo(() => {
    // group by user+skill (bandable only)
    const map = new Map<string, Attempt[]>();
    attempts.forEach((a) => {
      if (!bandable(a.skill)) return;
      const k = `${a.user_id}__${a.skill}`;
      const arr = map.get(k) || [];
      arr.push(a);
      map.set(k, arr);
    });
    const usersWithEligible = new Set<string>();
    const usersImproved = new Set<string>();
    map.forEach((arr, k) => {
      if (arr.length < 2) return;
      const user = k.split("__")[0];
      const skill = k.split("__")[1] as SkillKey;
      if (!bandable(skill)) return;
      usersWithEligible.add(user);
      const sorted = [...arr].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const b1 = getSkillBand(first.scaled, skill);
      const b2 = getSkillBand(last.scaled, skill);
      if ((BAND_RANK[b2] ?? 0) > (BAND_RANK[b1] ?? 0)) usersImproved.add(user);
    });
    const total = usersWithEligible.size;
    const improved = usersImproved.size;
    const pct = total > 0 ? Math.round((improved / total) * 100) : 0;
    return { total, improved, pct };
  }, [attempts]);

  // 2. Avg scaled per skill
  const avgBySkill = useMemo(() => {
    const data = SKILL_ORDER.map((sk) => {
      const list = attempts.filter((a) => a.skill === sk);
      const avg = list.length > 0
        ? list.reduce((s, a) => s + a.scaled, 0) / list.length
        : 0;
      return { skill: SKILL_LABEL[sk], avg: Math.round(avg * 10) / 10, count: list.length };
    });
    const withData = data.filter((d) => d.count > 0);
    const min = withData.length > 0
      ? Math.min(...withData.map((d) => d.avg))
      : null;
    return data.map((d) => ({ ...d, isLowest: min !== null && d.count > 0 && d.avg === min }));
  }, [attempts]);

  // 3. Band distribution per skill (latest attempt per user-skill)
  const bandDistribution = useMemo(() => {
    const skills: SkillKey[] = ["reading", "listening", "speaking", "writing"];
    return skills.map((sk) => {
      const byUser = new Map<string, Attempt>();
      attempts.filter((a) => a.skill === sk).forEach((a) => {
        const cur = byUser.get(a.user_id);
        if (!cur || a.created_at > cur.created_at) byUser.set(a.user_id, a);
      });
      const row: Record<string, string | number> = { skill: SKILL_LABEL[sk] };
      BAND_ORDER.forEach((b) => (row[b] = 0));
      byUser.forEach((a) => {
        const b = getSkillBand(a.scaled, sk as any);
        row[b] = (row[b] as number) + 1;
      });
      return row;
    });
  }, [attempts]);

  // 4. Avg scaled over time (per day)
  const timeline = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    attempts.forEach((a) => {
      const day = a.created_at.slice(0, 10);
      const cur = byDay.get(day) || { sum: 0, n: 0 };
      cur.sum += a.scaled;
      cur.n += 1;
      byDay.set(day, cur);
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, avg: Math.round((v.sum / v.n) * 10) / 10 }));
  }, [attempts]);

  const isEmpty = !loading && attempts.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-heading font-bold text-foreground">Kết quả học tập</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </Card>
      ) : isEmpty ? (
        <Card className="p-12 text-center text-muted-foreground">Chưa đủ dữ liệu</Card>
      ) : (
        <>
          {/* North-star */}
          <Card className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              % học viên lên band (so lượt đầu vs lượt gần nhất)
            </p>
            <p className="text-4xl font-heading font-extrabold text-primary">
              {bandImprovement.pct}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {bandImprovement.improved}/{bandImprovement.total} học viên có ≥2 lượt cùng kỹ năng
            </p>
          </Card>

          {/* Avg by skill */}
          <Card className="p-6">
            <h3 className="text-base font-heading font-bold text-foreground mb-4">
              Điểm trung bình theo kỹ năng (0–50)
            </h3>
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgBySkill} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 50]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    {avgBySkill.map((d, i) => (
                      <Cell key={i} fill={d.isLowest ? "#CC1C01" : "#FEAD5F"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Band distribution */}
          <Card className="p-6">
            <h3 className="text-base font-heading font-bold text-foreground mb-4">
              Phân bố band theo kỹ năng (lượt gần nhất / học viên)
            </h3>
            <div className="w-full h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bandDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="skill" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {BAND_ORDER.map((b) => (
                    <Bar key={b} dataKey={b} stackId="bands" fill={BAND_COLORS[b]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <h3 className="text-base font-heading font-bold text-foreground mb-4">
              Điểm trung bình theo thời gian (mọi kỹ năng)
            </h3>
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 50]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="avg" stroke="#CC1C01" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
