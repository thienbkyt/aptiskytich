import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Loader2, Users, UserPlus, Flame, TrendingUp, TrendingDown, Eye,
  Wallet, CreditCard, BadgePercent, ShoppingCart, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RANGE_OPTIONS, resolveBounds, periodLabel, dayLabel } from "./rangeHelpers";

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";

interface Summary {
  total_users: number;
  new_users: number;
  new_users_prev: number;
  dau: number;
  wau: number;
  mau: number;
  visits_today: number;
  consistent_users: number;
  revenue_period: number;
  revenue_all_time: number;
  paying_count: number;
  pro_count: number;
  premium_count: number;
  orders_period: number;
  expiring_soon: number;
  top_plans: { plan_key: string; orders: number; revenue: number }[];
}

interface DailyRow { day: string; new_users: number; learners: number; revenue: number }
interface StreakBucket { bucket: string; count: number }

const ActivityTab = () => {
  const [range, setRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [streakDist, setStreakDist] = useState<StreakBucket[]>([]);

  const bounds = useMemo(
    () => resolveBounds(range, customFrom, customTo),
    [range, customFrom, customTo],
  );
  const label = periodLabel(range, customFrom, customTo, bounds.windowDays);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, d, sd] = await Promise.all([
      supabase.rpc("admin_activity_summary", { p_from: bounds.gte, p_to: bounds.lte }),
      supabase.rpc("admin_activity_daily",   { p_from: bounds.gte, p_to: bounds.lte }),
      supabase.rpc("admin_streak_distribution"),
    ]);
    setSummary((s.data as any) ?? null);
    setDaily(((d.data as any[]) ?? []).map((r) => ({
      day: r.day,
      new_users: Number(r.new_users) || 0,
      learners: Number(r.learners) || 0,
      revenue: Number(r.revenue) || 0,
    })));
    setStreakDist(((sd.data as any[]) ?? []) as StreakBucket[]);
    setLoading(false);
  }, [bounds.gte, bounds.lte]);

  useEffect(() => { load(); }, [load]);

  const dailySeries = useMemo(
    () => daily.map((r) => ({ ...r, label: dayLabel(r.day) })),
    [daily],
  );

  const revenueDailySeries = useMemo(
    () => daily.map((r) => ({ ...r, label: dayLabel(r.day) })),
    [daily],
  );

  const newUsersDiffPct = useMemo(() => {
    if (!summary || !bounds.gte) return null;
    if (summary.new_users_prev === 0) return summary.new_users > 0 ? 100 : 0;
    return ((summary.new_users - summary.new_users_prev) / summary.new_users_prev) * 100;
  }, [summary, bounds.gte]);

  const conversionPct = summary && summary.total_users > 0
    ? (summary.paying_count / summary.total_users) * 100
    : 0;

  const consistentPct = summary && summary.total_users > 0
    ? (summary.consistent_users / summary.total_users) * 100
    : 0;

  const fmtVND = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
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

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <Eye className="w-4 h-4" /> Truy cập hôm nay
          </div>
          <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
            {summary.visits_today.toLocaleString("vi-VN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Số phiên truy cập web trong hôm nay</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <Users className="w-4 h-4" /> Tổng user
          </div>
          <p className="text-3xl font-heading font-extrabold text-foreground">{summary.total_users.toLocaleString("vi-VN")}</p>
          <p className="text-xs text-muted-foreground mt-1">Toàn bộ người đã đăng ký</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <UserPlus className="w-4 h-4" /> User mới ({label})
          </div>
          <div className="flex items-center gap-3">
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {summary.new_users.toLocaleString("vi-VN")}
            </p>
            {newUsersDiffPct != null && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                newUsersDiffPct > 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950"
                : newUsersDiffPct < 0 ? "text-destructive bg-destructive/10"
                : "text-muted-foreground bg-muted"
              }`}>
                {newUsersDiffPct > 0 ? <TrendingUp className="w-3 h-3" /> : newUsersDiffPct < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {newUsersDiffPct > 0 ? "+" : ""}{newUsersDiffPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {newUsersDiffPct != null ? `Kỳ trước: ${summary.new_users_prev.toLocaleString("vi-VN")}` : "Tính từ trước đến nay"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <Flame className="w-4 h-4" /> Học đều (streak ≥ 7)
          </div>
          <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_ACCENT }}>
            {summary.consistent_users.toLocaleString("vi-VN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{consistentPct.toFixed(1)}% trên tổng user</p>
        </Card>
      </div>

      {/* DAU / WAU / MAU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "DAU", desc: "từ 00:00 hôm nay", val: summary.dau },
          { label: "WAU", desc: "7 ngày gần nhất", val: summary.wau },
          { label: "MAU", desc: "30 ngày gần nhất", val: summary.mau },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-3xl font-heading font-extrabold text-foreground">{c.val.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground mt-1">User khác nhau làm bài {c.desc}</p>
          </Card>
        ))}
      </div>

      {/* New users per day */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">User mới theo ngày ({label})</h3>
        <div className="w-full h-[280px]">
          {dailySeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="new_users" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} name="User mới" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Learners per day */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Người học theo ngày ({label})</h3>
        <div className="w-full h-[280px]">
          {dailySeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="learners" stroke={COLOR_ACCENT} strokeWidth={2} dot={false} name="Người học" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Streak distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Phân bố streak (current_streak)</h3>
        <div className="w-full h-[280px]">
          {streakDist.every((b) => b.count === 0) ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streakDist} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill={COLOR_PRIMARY} name="Số user" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ===== Trả phí & Doanh thu ===== */}
      <div className="pt-2">
        <h2 className="text-xl font-heading font-bold mb-4">Trả phí & Doanh thu</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <Wallet className="w-4 h-4" /> Doanh thu ({label})
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {fmtVND(summary.revenue_period)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tổng: {fmtVND(summary.revenue_all_time)}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <CreditCard className="w-4 h-4" /> User đang trả phí
            </div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {summary.paying_count.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pro: {summary.pro_count} · Premium: {summary.premium_count}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <BadgePercent className="w-4 h-4" /> Tỉ lệ chuyển đổi
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_ACCENT }}>
              {conversionPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">{summary.paying_count}/{summary.total_users} user</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <ShoppingCart className="w-4 h-4" /> Số đơn ({label})
            </div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {summary.orders_period.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tổng đơn đã thanh toán trong kỳ</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <Clock className="w-4 h-4" /> Pro sắp hết hạn
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {summary.expiring_soon.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Trong vòng 7 ngày tới</p>
          </Card>
        </div>

        <Card className="p-6 mt-4">
          <h3 className="text-lg font-heading font-bold mb-4">Doanh thu theo ngày ({label})</h3>
          <div className="w-full h-[280px]">
            {revenueDailySeries.length === 0 || revenueDailySeries.every((d) => d.revenue === 0) ? (
              <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueDailySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => fmtVND(Number(v))}
                  />
                  <Line type="monotone" dataKey="revenue" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} name="Doanh thu" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 mt-4">
          <h3 className="text-lg font-heading font-bold mb-4">Gói bán chạy ({label})</h3>
          {summary.top_plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có đơn thanh toán trong kỳ.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b">
                    <th className="py-2 pr-4">Gói</th>
                    <th className="py-2 pr-4 text-right">Số đơn</th>
                    <th className="py-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_plans.map((p) => (
                    <tr key={p.plan_key} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{p.plan_key}</td>
                      <td className="py-2 pr-4 text-right">{p.orders.toLocaleString("vi-VN")}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: COLOR_PRIMARY }}>
                        {fmtVND(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ActivityTab;
