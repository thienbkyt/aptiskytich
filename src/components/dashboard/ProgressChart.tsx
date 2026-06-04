import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LineChart as LineIcon, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
}

const SKILL_META: { key: string; label: string; color: string }[] = [
  { key: "grammar",   label: "Grammar",   color: "hsl(var(--primary))" },
  { key: "reading",   label: "Reading",   color: "hsl(var(--info))" },
  { key: "listening", label: "Listening", color: "hsl(var(--warning))" },
  { key: "speaking",  label: "Speaking",  color: "hsl(var(--accent))" },
  { key: "writing",   label: "Writing",   color: "hsl(var(--success))" },
];

interface ChartPoint {
  date: string; // dd/mm
  ts: number;
  [skill: string]: number | string;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const ProgressChart = ({ userId }: Props) => {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: results } = await supabase
        .from("test_results")
        .select("score,total,created_at,exam_set_id,skill_scores")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const rows = results || [];
      if (rows.length === 0) {
        if (!cancelled) { setHasData(false); setLoading(false); }
        return;
      }

      // Resolve skill per row via exam_sets if needed
      const setIds = Array.from(new Set(rows.map((r: any) => r.exam_set_id).filter(Boolean)));
      const skillMap = new Map<string, string>();
      if (setIds.length > 0) {
        const { data: sets } = await supabase
          .from("exam_sets")
          .select("id,skill")
          .in("id", setIds);
        (sets || []).forEach((s: any) => skillMap.set(s.id, s.skill));
      }

      // Group by (yyyy-mm-dd, skill) -> avg pct
      const buckets = new Map<string, Map<string, { sum: number; n: number; ts: number }>>();
      rows.forEach((r: any) => {
        const skill = r.exam_set_id ? skillMap.get(r.exam_set_id) : r.skill_scores?.skill;
        if (!skill) return;
        if (r.total <= 0) return;
        const pct = Math.round((r.score / r.total) * 100);
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!buckets.has(key)) buckets.set(key, new Map());
        const inner = buckets.get(key)!;
        const cur = inner.get(skill) || { sum: 0, n: 0, ts: d.getTime() };
        cur.sum += pct;
        cur.n += 1;
        inner.set(skill, cur);
      });

      const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
        const ta = buckets.get(a)!.values().next().value!.ts;
        const tb = buckets.get(b)!.values().next().value!.ts;
        return ta - tb;
      });

      const chartPoints: ChartPoint[] = sortedKeys.map((key) => {
        const inner = buckets.get(key)!;
        const ts = inner.values().next().value!.ts;
        const point: ChartPoint = { date: fmtDate(new Date(ts).toISOString()), ts };
        SKILL_META.forEach((s) => {
          const v = inner.get(s.key);
          if (v) point[s.key] = Math.round(v.sum / v.n);
        });
        return point;
      });

      if (!cancelled) {
        setPoints(chartPoints);
        setHasData(chartPoints.length > 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading || !hasData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <LineIcon className="w-5 h-5 text-primary" /> Tiến bộ theo thời gian
        </h3>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: any) => `${v}%`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SKILL_META.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-end">
        <Link to="/progress">
          <Button variant="ghost" size="sm" className="text-primary gap-1.5">
            Xem tiến độ đầy đủ <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};

export default ProgressChart;
