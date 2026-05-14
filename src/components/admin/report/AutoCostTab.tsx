import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, RefreshCw, Settings, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type UsageEvent = {
  id: string;
  service: string;
  event_type: string;
  model: string | null;
  units: number;
  unit_type: string;
  estimated_cost_vnd: number;
  source_function: string | null;
  created_at: string;
};

const SERVICE_LABEL: Record<string, string> = {
  lovable_ai: "Lovable AI (Gemini)",
  google_tts: "Google TTS",
  supabase_storage: "Supabase Storage",
  supabase_db: "Supabase Database",
  edge_function: "Edge Functions",
  gemini_direct: "Gemini Direct",
};
const SERVICE_COLORS: Record<string, string> = {
  lovable_ai: "#CC1C01",
  google_tts: "#FEAD5F",
  supabase_storage: "#4D0D0D",
  supabase_db: "#24085a",
  edge_function: "#94a3b8",
  gemini_direct: "#0F0F10",
};

const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

const VN_MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

export default function AutoCostTab() {
  const { toast } = useToast();
  const today = new Date();
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today));
  const [selectedYear, setSelectedYear] = useState(today.getUTCFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("usage_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) {
      toast({ title: "Lỗi tải usage", description: error.message, variant: "destructive" });
    } else {
      setEvents((data || []) as UsageEvent[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    const { data, error } = await supabase.functions.invoke("snapshot-usage");
    setSnapshotting(false);
    if (error) {
      toast({ title: "Lỗi snapshot", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Đã chụp snapshot",
        description: `DB ${(data?.db_size_mb || 0).toFixed(1)} MB · Storage ${(data?.storage_mb || 0).toFixed(1)} MB`,
      });
      load();
    }
  };

  const monthEvents = useMemo(() => {
    const d = new Date(selectedMonth);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    return events.filter(e => {
      const ed = new Date(e.created_at);
      return ed.getUTCFullYear() === y && ed.getUTCMonth() === m;
    });
  }, [events, selectedMonth]);

  const monthTotal = useMemo(
    () => monthEvents.reduce((s, e) => s + Number(e.estimated_cost_vnd), 0),
    [monthEvents]
  );

  const prevMonthTotal = useMemo(() => {
    const d = new Date(selectedMonth);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    return events
      .filter(e => {
        const ed = new Date(e.created_at);
        return ed.getUTCFullYear() === y && ed.getUTCMonth() === m;
      })
      .reduce((s, e) => s + Number(e.estimated_cost_vnd), 0);
  }, [events, selectedMonth]);

  const diffPct = useMemo(() => {
    if (prevMonthTotal === 0) return monthTotal > 0 ? 100 : 0;
    return ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100;
  }, [monthTotal, prevMonthTotal]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { cost: number; units: number; unitTypes: Set<string> }>();
    for (const e of monthEvents) {
      const cur = map.get(e.service) || { cost: 0, units: 0, unitTypes: new Set() };
      cur.cost += Number(e.estimated_cost_vnd);
      cur.units += Number(e.units);
      cur.unitTypes.add(e.unit_type);
      map.set(e.service, cur);
    }
    return Array.from(map.entries())
      .map(([service, v]) => ({ service, ...v, unitTypes: Array.from(v.unitTypes).join(", ") }))
      .sort((a, b) => b.cost - a.cost);
  }, [monthEvents]);

  const yearChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const row: Record<string, string | number> = { month: VN_MONTHS[i] };
      const services = new Set<string>();
      events.forEach(e => {
        const ed = new Date(e.created_at);
        if (ed.getUTCFullYear() !== selectedYear || ed.getUTCMonth() !== i) return;
        services.add(e.service);
        row[e.service] = (Number(row[e.service] || 0)) + Number(e.estimated_cost_vnd);
      });
      Object.keys(SERVICE_LABEL).forEach(s => { if (!(s in row)) row[s] = 0; });
      return row;
    });
  }, [events, selectedYear]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([monthKey(today)]);
    events.forEach(e => {
      const d = new Date(e.created_at);
      set.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    });
    return Array.from(set).sort().reverse();
  }, [events]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([today.getUTCFullYear()]);
    events.forEach(e => set.add(new Date(e.created_at).getUTCFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const monthLabel = (key: string) => {
    const d = new Date(key);
    return `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-heading font-bold text-foreground">Chi phí ước lượng (tự động)</h2>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableMonths.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSnapshot} disabled={snapshotting} className="gap-2">
            {snapshotting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Snapshot Storage/DB
          </Button>
          <Link to="/admin/report/pricing">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="w-4 h-4" />
              Đơn giá
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tổng ước lượng</p>
          <p className="text-3xl font-heading font-extrabold text-primary">{fmtVND(monthTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{monthLabel(selectedMonth)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">So với tháng trước</p>
          <div className="flex items-center gap-2">
            {diffPct > 0 ? <TrendingUp className="w-6 h-6 text-destructive" /> :
             diffPct < 0 ? <TrendingDown className="w-6 h-6 text-emerald-600" /> :
             <Minus className="w-6 h-6 text-muted-foreground" />}
            <p className={`text-3xl font-heading font-extrabold ${
              diffPct > 0 ? "text-destructive" : diffPct < 0 ? "text-emerald-600" : "text-muted-foreground"
            }`}>{diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Tháng trước: {fmtVND(prevMonthTotal)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dịch vụ</TableHead>
              <TableHead className="text-right">Đơn vị</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Cost ước lượng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin inline" />
              </TableCell></TableRow>
            ) : breakdown.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Chưa có usage trong tháng này
              </TableCell></TableRow>
            ) : breakdown.map(b => (
              <TableRow key={b.service}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
                    style={{ backgroundColor: `${SERVICE_COLORS[b.service] || "#94a3b8"}20`, color: SERVICE_COLORS[b.service] || "#94a3b8" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SERVICE_COLORS[b.service] || "#94a3b8" }} />
                    {SERVICE_LABEL[b.service] || b.service}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{Math.round(b.units).toLocaleString("vi-VN")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{b.unitTypes}</TableCell>
                <TableCell className="text-right font-semibold">{fmtVND(b.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-bold text-foreground">Biểu đồ năm theo dịch vụ</h3>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableYears.map(y => <SelectItem key={y} value={String(y)}>Năm {y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={yearChart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => fmtVND(v)}
              contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => SERVICE_LABEL[v] || v} />
            {Object.keys(SERVICE_LABEL).map(s => (
              <Bar key={s} dataKey={s} stackId="a" fill={SERVICE_COLORS[s] || "#94a3b8"} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
