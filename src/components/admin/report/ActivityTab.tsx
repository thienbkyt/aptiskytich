import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, UserPlus, Flame, TrendingUp, TrendingDown, Eye, Wallet, CreditCard, BadgePercent, ShoppingCart, Clock } from "lucide-react";
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
import { parseDateSafe } from "@/lib/safeDate";

type ProfileRow = { user_id: string; created_at: string };
type TestResultRow = { user_id: string; created_at: string };
type StreakRow = { current_streak: number | null; last_activity_date: string | null };
type PaymentRow = { user_id: string; plan_key: string | null; tier: string | null; amount_vnd: number | null; status: string; paid_at: string | null; created_at: string };
type SubRow = { user_id: string; tier: string; pro_until: string | null };

const RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
  { value: "custom", label: "Tùy chọn (từ - đến)" },
];

const COLOR_PRIMARY = "#CC1C01";
const COLOR_ACCENT = "#FEAD5F";

const fmtDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ActivityTab = () => {
  const [range, setRange] = useState<string>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [results, setResults] = useState<TestResultRow[]>([]);
  const [streaks, setStreaks] = useState<StreakRow[]>([]);
  const [visitsToday, setVisitsToday] = useState<number>(0);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const [p, t, s, v, pay, sub] = await Promise.all([
        supabase.from("profiles").select("user_id, created_at"),
        supabase.from("test_results").select("user_id, created_at"),
        supabase.from("learning_streaks").select("current_streak, last_activity_date"),
        supabase.from("site_visits").select("id", { count: "exact", head: true }).gte("created_at", startOfToday.toISOString()),
        supabase.from("payments").select("user_id, plan_key, tier, amount_vnd, status, paid_at, created_at"),
        supabase.from("user_subscriptions").select("user_id, tier, pro_until"),
      ]);
      if (cancelled) return;
      setProfiles((p.data as ProfileRow[]) || []);
      setResults((t.data as TestResultRow[]) || []);
      setStreaks((s.data as StreakRow[]) || []);
      setVisitsToday(v.count ?? 0);
      setPayments((pay.data as PaymentRow[]) || []);
      setSubs((sub.data as SubRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const now = useMemo(() => new Date(), []);

  const { fromDate, toDate, windowDays } = useMemo(() => {
    if (range === "custom") {
      if (!customFrom || !customTo) return { fromDate: null as Date | null, toDate: null as Date | null, windowDays: null as number | null };
      const f = new Date(`${customFrom}T00:00:00`);
      const t = new Date(`${customTo}T23:59:59.999`);
      const wd = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400_000) + 1);
      return { fromDate: f, toDate: t, windowDays: wd };
    }
    if (range === "all") return { fromDate: null as Date | null, toDate: null as Date | null, windowDays: null as number | null };
    if (range === "today") {
      const f = new Date(now); f.setHours(0, 0, 0, 0);
      return { fromDate: f, toDate: null as Date | null, windowDays: 1 };
    }
    const n = Number(range);
    const f = new Date(now);
    f.setDate(f.getDate() - n);
    return { fromDate: f, toDate: null as Date | null, windowDays: n };
  }, [range, customFrom, customTo, now]);

  const { prevFrom, prevTo } = useMemo(() => {
    if (!fromDate || !windowDays) return { prevFrom: null as Date | null, prevTo: null as Date | null };
    const pf = new Date(fromDate);
    pf.setDate(pf.getDate() - windowDays);
    return { prevFrom: pf, prevTo: fromDate };
  }, [fromDate, windowDays]);

  const totalUsers = profiles.length;

  const newUsersInPeriod = useMemo(() => {
    if (!fromDate && !toDate) return profiles.length;
    return profiles.filter((p) => {
      const d = parseDateSafe(p.created_at);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    }).length;
  }, [profiles, fromDate, toDate]);

  const newUsersPrevPeriod = useMemo(() => {
    if (!prevFrom || !prevTo) return 0;
    return profiles.filter((p) => {
      const d = parseDateSafe(p.created_at);
      if (!d) return false;
      return d >= prevFrom && d < prevTo;
    }).length;
  }, [profiles, prevFrom, prevTo]);

  const newUsersDiffPct = useMemo(() => {
    if (!fromDate) return null;
    if (newUsersPrevPeriod === 0) return newUsersInPeriod > 0 ? 100 : 0;
    return ((newUsersInPeriod - newUsersPrevPeriod) / newUsersPrevPeriod) * 100;
  }, [newUsersInPeriod, newUsersPrevPeriod, fromDate]);

  const consistentUsers = useMemo(
    () => streaks.filter((s) => (s.current_streak ?? 0) >= 7).length,
    [streaks]
  );
  const consistentPct = totalUsers > 0 ? (consistentUsers / totalUsers) * 100 : 0;

  // Fixed windows for DAU/WAU/MAU
  const distinctActive = (windowDays: number) => {
    const c = new Date(now);
    c.setDate(c.getDate() - windowDays);
    const set = new Set<string>();
    for (const r of results) {
      const d = parseDateSafe(r.created_at);
      if (d && d >= c) set.add(r.user_id);
    }
    return set.size;
  };
  const dau = useMemo(() => distinctActive(1), [results, now]);
  const wau = useMemo(() => distinctActive(7), [results, now]);
  const mau = useMemo(() => distinctActive(30), [results, now]);

  // Daily series for the chosen period
  const dailySeries = useMemo(() => {
    const arr: { day: string; label: string; new: number; learners: number }[] = [];
    const learnerSets: Record<string, Set<string>> = {};
    if (range === "custom" && fromDate && toDate) {
      const cur = new Date(fromDate);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(toDate);
      end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        const key = dayKey(cur);
        arr.push({ day: key, label: fmtDay(cur), new: 0, learners: 0 });
        learnerSets[key] = new Set();
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const span = windowDays ?? 90;
      for (let i = span - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = dayKey(d);
        arr.push({ day: key, label: fmtDay(d), new: 0, learners: 0 });
        learnerSets[key] = new Set();
      }
    }
    const map = new Map(arr.map((x, i) => [x.day, i]));
    for (const p of profiles) {
      const d = parseDateSafe(p.created_at);
      if (!d) continue;
      const k = dayKey(d);
      const idx = map.get(k);
      if (idx != null) arr[idx].new += 1;
    }
    for (const r of results) {
      const d = parseDateSafe(r.created_at);
      if (!d) continue;
      const k = dayKey(d);
      if (learnerSets[k]) learnerSets[k].add(r.user_id);
    }
    for (const x of arr) x.learners = learnerSets[x.day].size;
    return arr;
  }, [profiles, results, windowDays, now, range, fromDate, toDate]);

  // Streak distribution
  const streakDist = useMemo(() => {
    const buckets = [
      { label: "0", min: 0, max: 0, count: 0 },
      { label: "1–2", min: 1, max: 2, count: 0 },
      { label: "3–6", min: 3, max: 6, count: 0 },
      { label: "7–13", min: 7, max: 13, count: 0 },
      { label: "14+", min: 14, max: Infinity, count: 0 },
    ];
    for (const s of streaks) {
      const v = s.current_streak ?? 0;
      const b = buckets.find((x) => v >= x.min && v <= x.max);
      if (b) b.count += 1;
    }
    return buckets.map((b) => ({ bucket: b.label, count: b.count }));
  }, [streaks]);

  // ===== Payments / Revenue =====
  const paidAll = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);
  const paidInPeriod = useMemo(() => {
    const upperMs = toDate ? toDate.getTime() : now.getTime();
    return paidAll.filter((p) => {
      const d = parseDateSafe(p.paid_at);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (d.getTime() > upperMs) return false;
      return true;
    });
  }, [paidAll, fromDate, toDate, now]);

  const revenuePeriod = useMemo(
    () => paidInPeriod.reduce((s, p) => s + (Number(p.amount_vnd) || 0), 0),
    [paidInPeriod]
  );
  const revenueAllTime = useMemo(
    () => paidAll.reduce((s, p) => s + (Number(p.amount_vnd) || 0), 0),
    [paidAll]
  );

  const activeSubs = useMemo(
    () => subs.filter((s) => (s.tier === "pro" || s.tier === "premium")
      && (!s.pro_until || new Date(s.pro_until).getTime() > now.getTime())),
    [subs, now]
  );
  const proCount = activeSubs.filter((s) => s.tier === "pro").length;
  const premiumCount = activeSubs.filter((s) => s.tier === "premium").length;
  const payingCount = activeSubs.length;
  const conversionPct = profiles.length > 0 ? (payingCount / profiles.length) * 100 : 0;

  const expiringSoonCount = useMemo(() => {
    const limit = now.getTime() + 7 * 86400_000;
    return subs.filter((s) => s.tier === "pro" && s.pro_until
      && new Date(s.pro_until).getTime() > now.getTime()
      && new Date(s.pro_until).getTime() <= limit).length;
  }, [subs, now]);

  const revenueDailySeries = useMemo(() => {
    const arr: { day: string; label: string; revenue: number }[] = [];
    if (range === "custom" && fromDate && toDate) {
      const cur = new Date(fromDate); cur.setHours(0, 0, 0, 0);
      const end = new Date(toDate); end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        arr.push({ day: dayKey(cur), label: fmtDay(cur), revenue: 0 });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const span = windowDays ?? 30;
      for (let i = span - 1; i >= 0; i--) {
        const d = new Date(now); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        arr.push({ day: dayKey(d), label: fmtDay(d), revenue: 0 });
      }
    }
    const map = new Map(arr.map((x, i) => [x.day, i]));
    for (const p of paidInPeriod) {
      const d = parseDateSafe(p.paid_at);
      if (!d) continue;
      const idx = map.get(dayKey(d));
      if (idx != null) arr[idx].revenue += Number(p.amount_vnd) || 0;
    }
    return arr;
  }, [paidInPeriod, windowDays, now, range, fromDate, toDate]);

  const topPlans = useMemo(() => {
    const m = new Map<string, { plan_key: string; orders: number; revenue: number }>();
    for (const p of paidInPeriod) {
      const k = p.plan_key || "(không rõ)";
      const e = m.get(k) || { plan_key: k, orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(p.amount_vnd) || 0;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }, [paidInPeriod]);

  const fmtVND = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const periodLabel =
    range === "custom"
      ? customFrom && customTo
        ? `${customFrom} → ${customTo}`
        : "Tùy chọn"
      : windowDays == null
      ? "Tất cả"
      : `${windowDays} ngày qua`;

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
            {visitsToday.toLocaleString("vi-VN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Số phiên truy cập web trong hôm nay</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <Users className="w-4 h-4" /> Tổng user
          </div>
          <p className="text-3xl font-heading font-extrabold text-foreground">{totalUsers.toLocaleString("vi-VN")}</p>
          <p className="text-xs text-muted-foreground mt-1">Toàn bộ người đã đăng ký</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <UserPlus className="w-4 h-4" /> User mới ({periodLabel})
          </div>
          <div className="flex items-center gap-3">
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {newUsersInPeriod.toLocaleString("vi-VN")}
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
            {newUsersDiffPct != null ? `Kỳ trước: ${newUsersPrevPeriod.toLocaleString("vi-VN")}` : "Tính từ trước đến nay"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
            <Flame className="w-4 h-4" /> Học đều (streak ≥ 7)
          </div>
          <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_ACCENT }}>
            {consistentUsers.toLocaleString("vi-VN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{consistentPct.toFixed(1)}% trên tổng user</p>
        </Card>
      </div>

      {/* DAU / WAU / MAU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "DAU", desc: "hôm nay", val: dau },
          { label: "WAU", desc: "7 ngày", val: wau },
          { label: "MAU", desc: "30 ngày", val: mau },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-3xl font-heading font-extrabold text-foreground">{c.val.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground mt-1">User khác nhau làm bài trong {c.desc}</p>
          </Card>
        ))}
      </div>

      {/* New users per day */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">User mới theo ngày ({periodLabel})</h3>
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
                <Line type="monotone" dataKey="new" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} name="User mới" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Learners per day */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Người học theo ngày ({periodLabel})</h3>
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
              <Wallet className="w-4 h-4" /> Doanh thu ({periodLabel})
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {fmtVND(revenuePeriod)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tổng: {fmtVND(revenueAllTime)}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <CreditCard className="w-4 h-4" /> User đang trả phí
            </div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {payingCount.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pro: {proCount} · Premium: {premiumCount}</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <BadgePercent className="w-4 h-4" /> Tỉ lệ chuyển đổi
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_ACCENT }}>
              {conversionPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">{payingCount}/{totalUsers} user</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <ShoppingCart className="w-4 h-4" /> Số đơn ({periodLabel})
            </div>
            <p className="text-3xl font-heading font-extrabold text-foreground">
              {paidInPeriod.length.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tổng đơn đã thanh toán trong kỳ</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
              <Clock className="w-4 h-4" /> Pro sắp hết hạn
            </div>
            <p className="text-3xl font-heading font-extrabold" style={{ color: COLOR_PRIMARY }}>
              {expiringSoonCount.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Trong vòng 7 ngày tới</p>
          </Card>
        </div>

        <Card className="p-6 mt-4">
          <h3 className="text-lg font-heading font-bold mb-4">Doanh thu theo ngày ({periodLabel})</h3>
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
          <h3 className="text-lg font-heading font-bold mb-4">Gói bán chạy ({periodLabel})</h3>
          {topPlans.length === 0 ? (
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
                  {topPlans.map((p) => (
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
