import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, RefreshCw, Settings, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { parseDateSafe } from "@/lib/safeDate";

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

const RANGES = [
  { value: "today", label: "Hôm nay" },
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tùy chọn (từ - đến)" },
] as const;

const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

const VN_MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

export default function AutoCostTab() {
  const { toast } = useToast();
  const today = new Date();
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [prevEvents, setPrevEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [range, setRange] = useState<string>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState(today.getUTCFullYear());
  const [allEvents, setAllEvents] = useState<UsageEvent[]>([]);

  // Resolve range -> {gte, lte, prevGte, prevLte}
  const rangeBounds = useMemo(() => {
    let gte: Date | null = null;
    let lte: Date | null = null;
    if (range === "custom") {
      if (customFrom && customTo) {
        gte = new Date(`${customFrom}T00:00:00`);
        lte = new Date(`${customTo}T23:59:59.999`);
      }
    } else if (range !== "all") {
      const days = Number(range);
      lte = new Date();
      gte = new Date(Date.now() - days * 86400_000);
    }
    let prevGte: Date | null = null;
    let prevLte: Date | null = null;
    if (gte && lte) {
      const spanMs = lte.getTime() - gte.getTime();
      prevLte = new Date(gte.getTime() - 1);
      prevGte = new Date(prevLte.getTime() - spanMs);
    }
    return { gte, lte, prevGte, prevLte };
  }, [range, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    const { gte, lte, prevGte, prevLte } = rangeBounds;

    let q = supabase.from("usage_events").select("*").order("created_at", { ascending: false }).limit(20000);
    if (gte) q = q.gte("created_at", gte.toISOString());
    if (lte) q = q.lte("created_at", lte.toISOString());
    const { data, error } = await q;
    if (error) {
      toast({ title: "Lỗi tải usage", description: error.message, variant: "destructive" });
      setEvents([]);
    } else {
      setEvents((data || []) as UsageEvent[]);
    }

    if (prevGte && prevLte) {
      const { data: prev } = await supabase
        .from("usage_events").select("*")
        .gte("created_at", prevGte.toISOString())
        .lte("created_at", prevLte.toISOString())
        .limit(20000);
      setPrevEvents((prev || []) as UsageEvent[]);
    } else {
      setPrevEvents([]);
    }

    // For yearly chart, load all events of selected year
    const yStart = new Date(Date.UTC(selectedYear, 0, 1)).toISOString();
    const yEnd = new Date(Date.UTC(selectedYear + 1, 0, 1)).toISOString();
    const { data: yearData } = await supabase
      .from("usage_events").select("service,estimated_cost_vnd,created_at")
      .gte("created_at", yStart).lt("created_at", yEnd).limit(50000);
    setAllEvents((yearData || []) as UsageEvent[]);

    setLoading(false);
  }, [rangeBounds, selectedYear, toast]);

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

  const total = useMemo(
    () => events.reduce((s, e) => s + Number(e.estimated_cost_vnd), 0),
    [events]
  );
  const prevTotal = useMemo(
    () => prevEvents.reduce((s, e) => s + Number(e.estimated_cost_vnd), 0),
    [prevEvents]
  );
  const hasCompare = rangeBounds.prevGte !== null;
  const diffPct = useMemo(() => {
    if (!hasCompare) return 0;
    if (prevTotal === 0) return total > 0 ? 100 : 0;
    return ((total - prevTotal) / prevTotal) * 100;
  }, [total, prevTotal, hasCompare]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { cost: number; units: number; unitTypes: Set<string> }>();
    for (const e of events) {
      const cur = map.get(e.service) || { cost: 0, units: 0, unitTypes: new Set() };
      cur.cost += Number(e.estimated_cost_vnd);
      cur.units += Number(e.units);
      cur.unitTypes.add(e.unit_type);
      map.set(e.service, cur);
    }
    return Array.from(map.entries())
      .map(([service, v]) => ({ service, ...v, unitTypes: Array.from(v.unitTypes).join(", ") }))
      .sort((a, b) => b.cost - a.cost);
  }, [events]);

  // By-day breakdown
  const dailyServices = useMemo(
    () => ["lovable_ai", "supabase_db", "google_tts", "supabase_storage", "edge_function"],
    []
  );
  const byDay = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const e of events) {
      const day = e.created_at.slice(0, 10);
      const row = map.get(day) || {};
      row[e.service] = (row[e.service] || 0) + Number(e.estimated_cost_vnd);
      row.__total = (row.__total || 0) + Number(e.estimated_cost_vnd);
      map.set(day, row);
    }
    return Array.from(map.entries())
      .filter(([, r]) => (r.__total || 0) > 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, r]) => ({ day, ...r }));
  }, [events]);

  const yearChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const row: Record<string, string | number> = { month: VN_MONTHS[i] };
      allEvents.forEach(e => {
        const ed = parseDateSafe(e.created_at);
        if (!ed) return;
        if (ed.getUTCFullYear() !== selectedYear || ed.getUTCMonth() !== i) return;
        row[e.service] = (Number(row[e.service] || 0)) + Number(e.estimated_cost_vnd);
      });
      Object.keys(SERVICE_LABEL).forEach(s => { if (!(s in row)) row[s] = 0; });
      return row;
    });
  }, [allEvents, selectedYear]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([today.getUTCFullYear()]);
    events.forEach(e => {
      const d = parseDateSafe(e.created_at);
      if (d) set.add(d.getUTCFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const fmtDay = (d: string) => {
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-heading font-bold text-foreground">Chi phí</h2>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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

      <div className={`grid grid-cols-1 ${hasCompare ? "md:grid-cols-2" : ""} gap-4 mb-6`}>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tổng chi phí</p>
          <p className="text-3xl font-heading font-extrabold text-primary">{fmtVND(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {range === "all" ? "Tất cả thời gian" : range === "custom" ? `${customFrom || "?"} → ${customTo || "?"}` : `${range} ngày gần nhất`}
          </p>
        </div>
        {hasCompare && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">So với kỳ trước cùng độ dài</p>
            <div className="flex items-center gap-2">
              {diffPct > 0 ? <TrendingUp className="w-6 h-6 text-destructive" /> :
               diffPct < 0 ? <TrendingDown className="w-6 h-6 text-emerald-600" /> :
               <Minus className="w-6 h-6 text-muted-foreground" />}
              <p className={`text-3xl font-heading font-extrabold ${
                diffPct > 0 ? "text-destructive" : diffPct < 0 ? "text-emerald-600" : "text-muted-foreground"
              }`}>{diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Kỳ trước: {fmtVND(prevTotal)}</p>
          </div>
        )}
      </div>

      {/* By-day */}
      <h3 className="text-sm font-heading font-bold text-foreground mb-2">Chi phí theo ngày</h3>
      <div className="rounded-xl border border-border overflow-hidden mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              {dailyServices.map(s => (
                <TableHead key={s} className="text-right">{SERVICE_LABEL[s]}</TableHead>
              ))}
              <TableHead className="text-right">Tổng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={dailyServices.length + 2} className="text-center py-8">
                <Loader2 className="w-5 h-5 animate-spin inline" />
              </TableCell></TableRow>
            ) : byDay.length === 0 ? (
              <TableRow><TableCell colSpan={dailyServices.length + 2} className="text-center py-8 text-muted-foreground">
                Không có chi phí trong khoảng này
              </TableCell></TableRow>
            ) : byDay.map((r: any) => (
              <TableRow key={r.day}>
                <TableCell className="font-medium">{fmtDay(r.day)}</TableCell>
                {dailyServices.map(s => (
                  <TableCell key={s} className="text-right font-mono text-sm">
                    {r[s] ? fmtVND(Math.round(r[s])) : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold">{fmtVND(Math.round(r.__total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Total by service */}
      <h3 className="text-sm font-heading font-bold text-foreground mb-2">Tổng theo dịch vụ</h3>
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
                Chưa có usage trong khoảng này
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
