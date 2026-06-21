import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, CheckCircle, XCircle, AlertTriangle, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type EmailRow = { status: string; created_at: string; template_name: string | null };
type SpeakingRow = { test_result_id: string | null; created_at: string };
type WritingRow = { test_result_id: string | null; created_at: string };

const RANGE_OPTIONS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tùy chọn (từ - đến)" },
];

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";
const COLOR_SUCCESS = "#10b981";

const fmtDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const OpsTab = () => {
  const [range, setRange] = useState<string>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [speaking, setSpeaking] = useState<SpeakingRow[]>([]);
  const [writing, setWriting] = useState<WritingRow[]>([]);

  const now = useMemo(() => new Date(), []);
  const days = range === "all" || range === "custom" ? null : Number(range);
  const bounds = useMemo<{ gte: string | null; lte: string | null }>(() => {
    if (range === "custom") {
      if (customFrom && customTo) {
        return {
          gte: new Date(`${customFrom}T00:00:00`).toISOString(),
          lte: new Date(`${customTo}T23:59:59.999`).toISOString(),
        };
      }
      return { gte: null, lte: null };
    }
    if (range === "all") return { gte: null, lte: null };
    const d = new Date(now);
    d.setDate(d.getDate() - Number(range));
    return { gte: d.toISOString(), lte: null };
  }, [range, customFrom, customTo, now]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const eq = supabase.from("email_send_log").select("status, created_at, template_name");
      const sq = supabase.from("speaking_question_gradings").select("test_result_id, created_at");
      const wq = supabase.from("writing_question_gradings").select("test_result_id, created_at");

      if (bounds.gte) {
        eq.gte("created_at", bounds.gte);
        sq.gte("created_at", bounds.gte);
        wq.gte("created_at", bounds.gte);
      }
      if (bounds.lte) {
        eq.lte("created_at", bounds.lte);
        sq.lte("created_at", bounds.lte);
        wq.lte("created_at", bounds.lte);
      }

      const [e, s, w] = await Promise.all([eq, sq, wq]);
      if (cancelled) return;
      setEmails((e.data as EmailRow[]) || []);
      setSpeaking((s.data as SpeakingRow[]) || []);
      setWriting((w.data as WritingRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bounds.gte, bounds.lte]);

  const sent = useMemo(() => emails.filter((r) => r.status === "sent").length, [emails]);
  const failed = useMemo(() => emails.filter((r) => r.status === "failed").length, [emails]);
  const dlq = useMemo(() => emails.filter((r) => r.status === "dlq").length, [emails]);
  const successRate = useMemo(() => {
    const total = sent + failed + dlq;
    return total === 0 ? 0 : (sent / total) * 100;
  }, [sent, failed, dlq]);

  const speakingCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of speaking) if (r.test_result_id) set.add(r.test_result_id);
    return set.size;
  }, [speaking]);

  const writingCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of writing) if (r.test_result_id) set.add(r.test_result_id);
    return set.size;
  }, [writing]);

  const totalAiCount = speakingCount + writingCount;

  const emailDaily = useMemo(() => {
    const span = days ?? 90;
    const arr: { day: string; label: string; sent: number; failed: number }[] = [];
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      arr.push({ day: dayKey(d), label: fmtDay(d), sent: 0, failed: 0 });
    }
    const map = new Map(arr.map((x, i) => [x.day, i]));
    for (const r of emails) {
      const d = new Date(r.created_at);
      const k = dayKey(d);
      const idx = map.get(k);
      if (idx == null) continue;
      if (r.status === "sent") arr[idx].sent += 1;
      else if (r.status === "failed" || r.status === "dlq") arr[idx].failed += 1;
    }
    return arr;
  }, [emails, days, now]);

  const hasEmailData = emails.length > 0;
  const hasAiData = speaking.length > 0 || writing.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const periodLabel = days == null ? "Tất cả" : `${days} ngày qua`;

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Khoảng thời gian:</span>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Email health cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold">Email ({periodLabel})</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <CheckCircle className="w-4 h-4" /> Gửi thành công
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_SUCCESS }}>
              {sent.toLocaleString("vi-VN")}
            </p>
          </Card>
          <Card className={`p-5 ${failed > 0 ? "border-destructive" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <XCircle className={`w-4 h-4 ${failed > 0 ? "text-destructive" : ""}`} /> Thất bại
            </div>
            <p className={`text-3xl font-heading font-extrabold ${failed > 0 ? "text-destructive" : "text-foreground"}`}>
              {failed.toLocaleString("vi-VN")}
            </p>
          </Card>
          <Card className={`p-5 ${dlq > 0 ? "border-destructive" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <AlertTriangle className={`w-4 h-4 ${dlq > 0 ? "text-destructive" : ""}`} /> DLQ
            </div>
            <p className={`text-3xl font-heading font-extrabold ${dlq > 0 ? "text-destructive" : "text-foreground"}`}>
              {dlq.toLocaleString("vi-VN")}
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tỷ lệ thành công</div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {successRate.toFixed(1)}%
            </p>
          </Card>
        </div>
      </div>

      {/* Email daily chart */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Email theo ngày</h3>
        <div className="w-full h-[280px]">
          {!hasEmailData ? (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={emailDaily} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="sent" stroke={COLOR_SUCCESS} strokeWidth={2} dot={false} name="Thành công" />
                <Line type="monotone" dataKey="failed" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} name="Thất bại + DLQ" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* AI grading cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold">Chấm AI ({periodLabel})</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Lượt chấm Speaking</div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {speakingCount.toLocaleString("vi-VN")}
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Lượt chấm Writing</div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_ACCENT }}>
              {writingCount.toLocaleString("vi-VN")}
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tổng lượt chấm AI</div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {totalAiCount.toLocaleString("vi-VN")}
            </p>
          </Card>
        </div>
      </div>

      {!hasEmailData && !hasAiData && (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu vận hành trong kỳ này.</p>
      )}
    </div>
  );
};

export default OpsTab;
