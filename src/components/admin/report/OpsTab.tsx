import { useEffect, useMemo, useState, useCallback } from "react";
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
import { RANGE_OPTIONS, resolveBounds, periodLabel, dayLabel } from "./rangeHelpers";

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";
const COLOR_SUCCESS = "#10b981";

interface OpsPayload {
  email_sent: number;
  email_failed: number;
  email_dlq: number;
  speaking_count: number;
  writing_count: number;
  email_daily: { day: string; sent: number; failed: number }[];
}

const OpsTab = () => {
  const [range, setRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OpsPayload | null>(null);

  const bounds = useMemo(
    () => resolveBounds(range, customFrom, customTo),
    [range, customFrom, customTo],
  );
  const label = periodLabel(range, customFrom, customTo, bounds.windowDays);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: res } = await supabase.rpc("admin_ops_summary", {
      p_from: bounds.gte,
      p_to: bounds.lte,
    });
    setData((res as any) ?? null);
    setLoading(false);
  }, [bounds.gte, bounds.lte]);

  useEffect(() => { load(); }, [load]);

  const sent = data?.email_sent ?? 0;
  const failed = data?.email_failed ?? 0;
  const dlq = data?.email_dlq ?? 0;
  const successRate = useMemo(() => {
    const total = sent + failed + dlq;
    return total === 0 ? 0 : (sent / total) * 100;
  }, [sent, failed, dlq]);

  const speakingCount = data?.speaking_count ?? 0;
  const writingCount = data?.writing_count ?? 0;
  const totalAiCount = speakingCount + writingCount;

  const emailDaily = useMemo(
    () => (data?.email_daily || []).map((r) => ({ ...r, label: dayLabel(r.day) })),
    [data],
  );

  const hasEmailData = sent + failed + dlq > 0;
  const hasAiData = totalAiCount > 0;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Khoảng thời gian:</span>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold">Email ({label})</h3>
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

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold">Chấm AI ({label})</h3>
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
