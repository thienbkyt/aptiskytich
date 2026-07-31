import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Check, ChevronDown, Crown, Loader2, Sparkles, Users, Wand2, X } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import ContactAdminLinks from "@/components/ContactAdminLinks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PricingPlan = {
  key: string;
  label: string;
  duration_days: number | null;
  price_vnd: number;
  active: boolean;
  highlight: boolean;
  sort_order: number;
  note: string | null;
  tier?: "pro" | "premium" | null;
  ai_daily_cap?: number | null;
};

type PublicStats = { hoc_vien: number; bai_cham_ai: number; de_thi: number };

const BASE_DAY_PRICE = 25000;

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

type CompareRow = { label: string; free: string | boolean; paid: string | boolean };
const COMPARE_ROWS: CompareRow[] = [
  { label: "Đề Key Dự Đoán", free: false, paid: true },
  { label: "Kho đề part lẻ", free: "3 đề/part", paid: "Toàn bộ" },
  { label: "Luyện Full Part", free: "3 đề", paid: "Toàn bộ" },
  { label: "Thi thử Full Test", free: "1 đề", paid: "Toàn bộ" },
  { label: "Marathon", free: "2 lượt", paid: "Không giới hạn" },
  { label: "Chấm AI Writing + Speaking", free: "3 lượt trọn đời", paid: "10-30 lượt/ngày theo gói" },
  { label: "Bài mẫu chuẩn band B1-C", free: true, paid: true },
  { label: "Học từ vựng & flashcard", free: true, paid: true },
  { label: "Dịch cả câu & tra từ inline", free: true, paid: true },
  { label: "Dictation & sổ từ vựng", free: true, paid: true },
  { label: "Theo dõi tiến độ", free: "Cơ bản", paid: "Chi tiết" },
  { label: "Hỗ trợ", free: "Cộng đồng", paid: "Admin hỗ trợ trực tiếp" },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<PricingPlan | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [shortKey, setShortKey] = useState<"day" | "week">("day");
  const [showCompare, setShowCompare] = useState(false);
  const { user } = useAuth();
  const { isPro, isPremium, refetch } = useIsPro();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const { data: stats } = useQuery<PublicStats>({
    queryKey: ["public-stats"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("public_stats");
      if (error) throw error;
      return data as PublicStats;
    },
  });

  useEffect(() => {
    if (params.get("paid") === "1") {
      toast.success("Đang xác nhận thanh toán...", { description: "Trạng thái gói sẽ tự cập nhật trong giây lát." });
      // Poll tier a few times
      let n = 0;
      const t = setInterval(() => {
        refetch?.();
        n += 1;
        if (n >= 6) clearInterval(t);
      }, 2500);
      params.delete("paid");
      setParams(params, { replace: true });
      return () => clearInterval(t);
    }
    if (params.get("cancel") === "1") {
      toast.info("Bạn đã hủy thanh toán");
      params.delete("cancel");
      setParams(params, { replace: true });
    }
  }, [params, refetch, setParams]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("pricing_plans")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) toast.error("Không tải được bảng giá");
      setPlans((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const paidPlans = useMemo(
    () => plans.filter((p) => p.duration_days != null),
    [plans],
  );
  const dayPlan = useMemo(() => plans.find((p) => p.key === "day"), [plans]);
  const weekPlan = useMemo(() => plans.find((p) => p.key === "week"), [plans]);
  const monthPlan = useMemo(() => plans.find((p) => p.key === "month"), [plans]);
  const halfYearPlan = useMemo(() => plans.find((p) => p.key === "half_year"), [plans]);
  const heroPlan = useMemo(
    () => paidPlans.find((p) => p.highlight) ?? paidPlans.find((p) => p.key === "quarter") ?? null,
    [paidPlans],
  );
  const shortPlan = shortKey === "day" ? dayPlan : weekPlan;

  const onPick = async (p: PricingPlan) => {
    if (!user) { navigate("/auth"); return; }
    setBuying(p.key);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { plan_key: p.key },
      });
      if (error || !data?.checkoutUrl) {
        toast.error("Không tạo được link thanh toán", {
          description: "Vui lòng thử lại hoặc liên hệ admin qua Zalo/Facebook.",
        });
        setPicked(p); // fallback to manual
        return;
      }
      window.location.href = data.checkoutUrl as string;
    } catch (e) {
      toast.error("Lỗi kết nối", { description: "Thử lại hoặc liên hệ admin." });
      setPicked(p);
    } finally {
      setBuying(null);
    }
  };

  const bankInfo = useMemo(() => ({
    bank: "Ngân hàng TMCP Kiên Long",
    number: "10142607300684752",
    name: "NGUYEN TRONG GIANG",
  }), []);

  const tierLabel = isPremium ? "Premium" : isPro ? "Pro" : "Free";

  const Cell = ({ v }: { v: string | boolean }) => {
    if (v === true) return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
    if (v === false) return <X className="w-4 h-4 text-muted-foreground/60 mx-auto" />;
    return <span className="text-[11px] md:text-sm text-foreground">{v}</span>;
  };

  const perDay = (p: PricingPlan) =>
    p.duration_days ? Math.round(p.price_vnd / p.duration_days) : null;

  const listPrice = (p: PricingPlan) =>
    p.duration_days && p.duration_days > 1 ? BASE_DAY_PRICE * p.duration_days : null;

  const discountPct = (p: PricingPlan) => {
    const lp = listPrice(p);
    if (!lp) return null;
    const pct = Math.round((1 - p.price_vnd / lp) * 100);
    return pct > 0 ? pct : null;
  };

  // Rẻ hơn bao nhiêu %/ngày so với gói 1 tháng
  const cheaperThanMonthPct = (p: PricingPlan) => {
    const base = monthPlan ? perDay(monthPlan) : null;
    const cur = perDay(p);
    if (!base || !cur || p.key === "month") return null;
    const pct = Math.round((1 - cur / base) * 100);
    return pct > 0 ? pct : null;
  };

  // 3 điểm khác biệt riêng của từng gói
  const planDiffs = (p: PricingPlan) => {
    const out: string[] = [`${p.ai_daily_cap ?? 10} lượt chấm AI Writing + Speaking mỗi ngày`];
    if (p.duration_days) out.push(`Dùng trọn ${p.duration_days} ngày`);
    const d = discountPct(p);
    if (d != null) out.push(`Tiết kiệm ${d}% so với mua theo ngày`);
    return out;
  };

  const allIncluded = [
    `Toàn bộ ${stats?.de_thi ? stats.de_thi.toLocaleString("vi-VN") : "600+"} đề part lẻ`,
    "Luyện Full Part + Thi thử Full Test",
    "Đề Key Dự Đoán cập nhật hằng ngày",
    "Marathon không giới hạn",
    "Bài mẫu chuẩn band B1-C · dịch câu & tra từ inline",
    "Dictation, sổ từ vựng, tiến độ chi tiết, hỗ trợ admin",
  ];

  const PlanCard = ({
    plan,
    hero,
    label,
    headerExtra,
    order,
    topLabel,
  }: {
    plan: PricingPlan;
    hero?: boolean;
    label?: string;
    headerExtra?: React.ReactNode;
    order?: string;
    topLabel?: string;
  }) => {
    const pd = perDay(plan);
    const lp = listPrice(plan);
    const d = discountPct(plan);
    const cheaper = hero ? cheaperThanMonthPct(plan) : null;

    return (
      <div className={cn("h-full flex flex-col", order)}>
        <div className="h-8 flex items-end justify-center pb-1">
          {topLabel && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-white shadow-md"
              style={{
                background: "linear-gradient(135deg, #CC1C01 0%, #F0532F 100%)",
                boxShadow: "0 6px 16px -6px rgba(204,28,1,0.6)",
              }}
            >
              <Crown className="w-3.5 h-3.5" strokeWidth={2.5} />
              {topLabel}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex-1 rounded-xl bg-card p-5 flex flex-col text-center",
            hero ? "border-2 border-[#CC1C01]" : "border-[0.5px] border-border",
          )}
        >
          <div className="flex flex-col items-center gap-2 min-h-[52px] justify-center">
            <p className="text-[15px] font-semibold text-foreground">{label ?? plan.label}</p>
            {headerExtra ??
              (d != null && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
                >
                  -{d}%
                </span>
              ))}
          </div>

          {/* Giá theo ngày — thông tin chính */}
          <div className="mt-3 flex items-baseline gap-1.5 justify-center">
            <span
              className={cn(
                "font-extrabold tracking-tight leading-none",
                hero ? "text-[34px] text-[#CC1C01]" : "text-[30px] text-foreground",
              )}
            >
              {pd != null ? formatVnd(pd) : formatVnd(plan.price_vnd)}
            </span>
            <span className="text-[13px] text-muted-foreground">/ngày</span>
          </div>

          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap justify-center">
            <span className="text-[13px] font-medium text-foreground">
              {formatVnd(plan.price_vnd)}
              {plan.duration_days ? ` cho ${plan.duration_days} ngày` : ""}
            </span>
            {lp && <span className="text-[12px] text-muted-foreground line-through">{formatVnd(lp)}</span>}
          </div>

          {hero && cheaper != null && (
            <p
              className="mt-3 rounded-[var(--radius)] px-2.5 py-1.5 text-[12px] font-medium text-[#CC1C01]"
              style={{ backgroundColor: "rgba(204,28,1,0.08)" }}
            >
              Rẻ hơn ~{cheaper}%/ngày so với gói 1 tháng — lượt chấm AI cao nhất
            </p>
          )}

          <div className="mt-4">
            <Button
              variant={hero ? "default" : "outline"}
              className={cn(
                "w-full",
                hero
                  ? "bg-[#CC1C01] hover:bg-[#4D0D0D] text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted",
              )}
              disabled={buying === plan.key}
              onClick={() => onPick(plan)}
            >
              {buying === plan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hero ? "Bắt đầu ngay" : "Chọn gói"}
            </Button>
          </div>

          <ul className="mt-4 pt-4 border-t border-border space-y-2 flex-1 text-left">
            {planDiffs(plan).map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-foreground">
                <Check
                  className={cn("mt-[3px] flex-shrink-0 w-[14px] h-[14px]", hero ? "text-[#CC1C01]" : "text-foreground")}
                  strokeWidth={3}
                />
                <span className="flex-1">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };




  const statChips = stats
    ? [
        { icon: Users, text: `${stats.hoc_vien.toLocaleString("vi-VN")} học viên đã đăng ký` },
        { icon: Wand2, text: `${stats.bai_cham_ai.toLocaleString("vi-VN")} bài đã chấm AI` },
        { icon: BookOpenCheck, text: `${stats.de_thi.toLocaleString("vi-VN")} đề thi` },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[144px] md:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero */}
          <div className="text-center">
            <Badge className="bg-[#FEAD5F]/20 text-[#CC1C01] border-0 mb-3">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Bảng giá
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground">
              Mọi thứ ôn tập trong một tài khoản
            </h1>
            <p className="text-muted-foreground mt-2">
              Mở khóa toàn bộ tính năng. Tối ưu thời gian ôn tập và đạt AIM cùng AI và bộ Key chuẩn
            </p>
            {(isPro || isPremium) && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-semibold">
                <Crown className="w-4 h-4" /> Bạn đang là thành viên {tierLabel}
              </div>
            )}
          </div>

          {/* Stats strip */}
          {statChips.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {statChips.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-[12px] text-foreground"
                >
                  <Icon className="w-3.5 h-3.5 text-[#CC1C01]" />
                  <span className="font-semibold">{text}</span>
                </span>
              ))}
            </div>
          )}

          {/* Plans */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              {/* Card 1 — Ngắn hạn */}
              {shortPlan && (
                <PlanCard
                  plan={shortPlan}
                  label="Ngắn hạn"
                  order="order-3 lg:order-none"
                  headerExtra={
                    <div className="inline-flex rounded-full bg-muted p-1 border border-border">
                      {(["day", "week"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => setShortKey(k)}
                          className={cn(
                            "px-3.5 py-1 text-[12px] font-semibold rounded-full transition-colors",
                            shortKey === k
                              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {k === "day" ? "1 ngày" : "1 tuần"}
                        </button>
                      ))}
                    </div>
                  }
                />
              )}

              {/* Card 2 — 1 tháng */}
              {monthPlan && <PlanCard plan={monthPlan} order="order-2 lg:order-none" />}

              {/* Card 3 — hero (3 tháng) */}
              {heroPlan && (
                <PlanCard
                  plan={heroPlan}
                  hero
                  order="order-1 lg:order-none"
                  topLabel="★ Được lựa chọn nhiều nhất"
                />
              )}
            </div>
          )}

          {/* Gói 6 tháng — dòng nổi bật */}
          {!loading && halfYearPlan && halfYearPlan.key !== heroPlan?.key && (
            <div
              className="mt-5 rounded-xl border border-[#CC1C01]/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ backgroundColor: "rgba(254,173,95,0.12)" }}
            >
              <div className="text-center sm:text-left">
                <p className="text-[13px] font-bold text-foreground">
                  Ôn dài hơi hơn? <span className="text-[#CC1C01]">{halfYearPlan.label}</span> — chỉ{" "}
                  <span className="text-[#CC1C01]">{formatVnd(perDay(halfYearPlan) ?? 0)}/ngày</span>
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {formatVnd(halfYearPlan.price_vnd)} cho {halfYearPlan.duration_days} ngày
                  {discountPct(halfYearPlan) != null && ` · tiết kiệm ${discountPct(halfYearPlan)}%`}
                </p>
              </div>
              <Button
                className="bg-[#CC1C01] hover:bg-[#4D0D0D] text-primary-foreground shrink-0"
                disabled={buying === halfYearPlan.key}
                onClick={() => onPick(halfYearPlan)}
              >
                {buying === halfYearPlan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Chọn gói 6 tháng
              </Button>
            </div>
          )}


          {/* Mọi gói đều có */}
          <div className="mt-6 rounded-xl bg-muted px-6 py-5">
            <p className="text-center text-sm font-semibold text-foreground">Mọi gói đều có đầy đủ</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              {allIncluded.map((f) => (
                <div key={f} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  <Check className="mt-[3px] flex-shrink-0 w-[14px] h-[14px] text-[#CC1C01]" strokeWidth={3} />
                  <span className="flex-1">{f}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-muted-foreground">
              Thanh toán — kích hoạt tự động trong ~1 phút.
            </p>
          </div>

          {/* Compare table (thu gọn) */}
          <div className="mt-10">
            <div className="text-center">
              <button
                onClick={() => setShowCompare((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[#CC1C01] transition-colors"
              >
                So sánh chi tiết Miễn phí vs Trả phí
                <ChevronDown className={cn("w-4 h-4 transition-transform", showCompare && "rotate-180")} />
              </button>
            </div>
            {showCompare && (
            <div className="mt-5">

            <div className="max-w-3xl mx-auto overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 160 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-foreground">Tính năng</th>
                    <th className="p-3 text-sm font-semibold text-center text-muted-foreground">Miễn phí</th>
                    <th
                      className="p-3 text-sm font-semibold text-center text-[#CC1C01] rounded-t-xl"
                      style={{
                        backgroundColor: "rgba(204,28,1,0.06)",
                        borderTop: "1px solid rgba(204,28,1,0.2)",
                        borderLeft: "1px solid rgba(204,28,1,0.2)",
                        borderRight: "1px solid rgba(204,28,1,0.2)",
                      }}
                    >
                      Gói luyện thi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => {
                    const last = i === COMPARE_ROWS.length - 1;
                    return (
                      <tr key={row.label}>
                        <td className="p-3 text-sm text-foreground border-t border-border text-left">{row.label}</td>
                        <td className="p-3 text-center border-t border-border">
                          <Cell v={row.free} />
                        </td>
                        <td
                          className={cn("p-3 text-center", last && "rounded-b-xl")}
                          style={{
                            backgroundColor: "rgba(204,28,1,0.06)",
                            borderTop: "1px solid hsl(var(--border))",
                            borderLeft: "1px solid rgba(204,28,1,0.2)",
                            borderRight: "1px solid rgba(204,28,1,0.2)",
                            borderBottom: last ? "1px solid rgba(204,28,1,0.2)" : undefined,
                          }}
                        >
                          <Cell v={row.paid} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
            )}
          </div>


          <div className="mt-12 text-center">
            <p className="text-xs text-muted-foreground">
              Cần tư vấn chọn gói? Admin trả lời trong ít phút.
            </p>
            <div className="max-w-md mx-auto mt-3">
              <ContactAdminLinks />
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Payment Modal */}
      <Dialog open={!!picked} onOpenChange={(v) => !v && setPicked(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#CC1C01]" />
              Thanh toán gói {picked?.label}
            </DialogTitle>
            <DialogDescription>
              Chuyển khoản theo thông tin dưới đây, sau đó nhắn Zalo / Facebook kèm email tài khoản để admin kích hoạt.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border-2 border-dashed border-[#CC1C01]/40 bg-[#CC1C01]/5 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ngân hàng</span>
              <span className="font-semibold text-foreground">{bankInfo.bank}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Số tài khoản</span>
              <span className="font-mono font-bold text-foreground">{bankInfo.number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Chủ tài khoản</span>
              <span className="font-semibold text-foreground">{bankInfo.name}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#CC1C01]/20">
              <span className="text-muted-foreground">Số tiền</span>
              <span className="font-extrabold text-[#CC1C01]">
                {picked ? formatVnd(picked.price_vnd) : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nội dung CK</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                PRO {picked?.key.toUpperCase()} {user?.email ?? ""}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Sau khi chuyển khoản, nhắn Zalo kèm email <b>{user?.email}</b> để được kích hoạt trong ít phút.
          </p>

          <ContactAdminLinks />
        </DialogContent>
      </Dialog>
    </div>
  );
}
