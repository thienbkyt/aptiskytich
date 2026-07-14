import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell,
} from "recharts";
import { RANGE_OPTIONS, resolveBounds } from "./rangeHelpers";

type SkillKey = "reading" | "listening" | "grammar" | "speaking" | "writing";

const SKILL_LABEL: Record<SkillKey, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar",
  speaking: "Speaking",
  writing: "Writing",
};
const SKILL_ORDER: SkillKey[] = ["reading", "listening", "grammar", "speaking", "writing"];
const BAND_ORDER = ["A0", "A1", "A2", "B1", "B2", "C"] as const;
const BAND_COLORS: Record<string, string> = {
  A0: "#94a3b8",
  A1: "#cbd5e1",
  A2: "#FEAD5F",
  B1: "#f97316",
  B2: "#CC1C01",
  C: "#4D0D0D",
};

interface OutcomesPayload {
  avg_by_skill: { skill: SkillKey; avg_scaled: number; n: number }[];
  band_dist: { skill: SkillKey; band: string; n: number }[];
  improvement: { total: number; improved: number } | null;
  timeline: { day: string; avg: number }[];
  total_attempts: number;
}

export default function OutcomesTab() {
  const [range, setRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OutcomesPayload | null>(null);

  const bounds = useMemo(
    () => resolveBounds(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { data: res } = await supabase.rpc("admin_outcomes", {
      p_from: bounds.gte,
      p_to: bounds.lte,
    });
    setData((res as any) ?? null);
    setLoading(false);
  }, [bounds.gte, bounds.lte]);

  useEffect(() => { load(); }, [load]);

  const avgBySkill = useMemo(() => {
    const map = new Map<string, number>();
    const cntMap = new Map<string, number>();
    (data?.avg_by_skill || []).forEach((r) => {
      map.set(r.skill, r.avg_scaled);
      cntMap.set(r.skill, r.n);
    });
    const arr = SKILL_ORDER.map((sk) => ({
      skill: SKILL_LABEL[sk],
      avg: map.get(sk) ?? 0,
      count: cntMap.get(sk) ?? 0,
    }));
    const withData = arr.filter((d) => d.count > 0);
    const min = withData.length ? Math.min(...withData.map((d) => d.avg)) : null;
    return arr.map((d) => ({ ...d, isLowest: min !== null && d.count > 0 && d.avg === min }));
  }, [data]);

  const bandDistribution = useMemo(() => {
    const skills: SkillKey[] = ["reading", "listening", "speaking", "writing"];
    return skills.map((sk) => {
      const row: Record<string, string | number> = { skill: SKILL_LABEL[sk] };
      BAND_ORDER.forEach((b) => (row[b] = 0));
      (data?.band_dist || []).filter((x) => x.skill === sk).forEach((x) => {
        row[x.band] = (row[x.band] as number) + x.n;
      });
      return row;
    });
  }, [data]);

  const timeline = useMemo(
    () => (data?.timeline || []).map((r) => ({ day: r.day, avg: r.avg })),
    [data],
  );

  const improvementPct = data?.improvement
    ? (data.improvement.total > 0
        ? Math.round((data.improvement.improved / data.improvement.total) * 100)
        : 0)
    : 0;

  const isEmpty = !loading && (data?.total_attempts ?? 0) === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-heading font-bold text-foreground">Kết quả học tập</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" aria-label="Từ ngày" />
              <span className="text-sm text-muted-foreground">→</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" aria-label="Đến ngày" />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </Card>
      ) : isEmpty ? (
        <Card className="p-12 text-center text-muted-foreground">Chưa đủ dữ liệu</Card>
      ) : (
        <>
          <Card className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              % học viên lên band (so lượt đầu vs lượt gần nhất)
            </p>
            <p className="text-4xl font-heading font-extrabold text-primary">{improvementPct}%</p>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.improvement?.improved ?? 0}/{data?.improvement?.total ?? 0} học viên có ≥2 lượt cùng kỹ năng
            </p>
          </Card>

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
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    {avgBySkill.map((d, i) => (
                      <Cell key={i} fill={d.isLowest ? "#CC1C01" : "#FEAD5F"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

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
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {BAND_ORDER.map((b) => (
                    <Bar key={b} dataKey={b} stackId="bands" fill={BAND_COLORS[b]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

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
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
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
