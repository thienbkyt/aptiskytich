import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Crown, Loader2, Sparkles, X, Zap } from "lucide-react";

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

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const ALL_INCLUDED = [
  "Toàn bộ 596+ đề",
  "Key Dự Đoán hằng ngày",
  "Full Part + Thi thử",
  "Marathon không giới hạn",
  "Chấm AI có band điểm",
  "Dịch câu · tra từ · bài mẫu",
];

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
  { label: "Hỗ trợ", free: "Cộng đồng", paid: "Zalo/FB ưu tiên" },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<PricingPlan | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [shortKey, setShortKey] = useState<"day" | "week">("day");
  const { user } = useAuth();
  const { isPro, isPremium, refetch } = useIsPro();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

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

  const savingOf = (p: PricingPlan): number | null => {
    if (!dayPlan || !p.duration_days || p.key === "day") return null;
    const pct = Math.round((1 - p.price_vnd / (dayPlan.price_vnd * p.duration_days)) * 100);
    return pct > 0 ? pct : null;
  };

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

  const SavingBadge = ({ p }: { p: PricingPlan }) => {
    const s = savingOf(p);
    if (s == null) return null;
    return (
      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
        Tiết kiệm {s}%
      </span>
    );
  };

  const PlanCard = ({ plan, order }: { plan: PricingPlan; order: string }) => (
    <div className={cn("rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col h-full", order)}>
      <p className="text-sm font-semibold text-muted-foreground">{plan.label}</p>
      <div className="mt-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">{formatVnd(plan.price_vnd)}</span>
      </div>
      {perDay(plan) != null && (
        <p className="text-sm font-semibold text-[#CC1C01] mt-1.5">
          {formatVnd(perDay(plan)!)}/ngày
        </p>
      )}
      <div className="mt-2 min-h-[22px]"><SavingBadge p={plan} /></div>
      {plan.ai_daily_cap != null && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-[#FEAD5F]" /> {plan.ai_daily_cap} lượt AI/ngày
        </p>
      )}
      <Button
        variant="outline"
        className="mt-auto w-full border-border text-foreground hover:bg-muted"

        onClick={() => onPick(plan)}
      >
        {buying === plan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Chọn gói
      </Button>
    </div>
  );


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[144px] md:pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <Badge className="bg-[#FEAD5F]/20 text-[#CC1C01] border-0 mb-3">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Bảng giá
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground">
              Càng ôn dài, mỗi ngày càng rẻ — lượt chấm AI càng nhiều
            </h1>
            <p className="text-muted-foreground mt-2">
              Mọi gói đều mở toàn bộ tính năng. Gói dài hơn: rẻ hơn mỗi ngày, nhiều lượt chấm AI hơn.
            </p>
            {(isPro || isPremium) && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-semibold">
                <Crown className="w-4 h-4" /> Bạn đang là thành viên {tierLabel}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.22fr_1fr] gap-5 lg:items-end">
              {/* Card 1 — Ngắn hạn */}
              {shortPlan && (
                <div className="order-4 lg:order-none rounded-2xl border border-border bg-card p-5 flex flex-col">
                  <p className="text-sm font-heading font-bold text-foreground">Ngắn hạn</p>
                  <div className="mt-2 inline-flex rounded-full bg-muted p-0.5 self-start">
                    {(["day", "week"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setShortKey(k)}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                          shortKey === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                        )}
                      >
                        {k === "day" ? "1 ngày" : "1 tuần"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-extrabold text-foreground">{formatVnd(shortPlan.price_vnd)}</span>
                  </div>
                  {perDay(shortPlan) != null && (
                    <p className="text-sm font-semibold text-[#CC1C01] mt-1">
                      {formatVnd(perDay(shortPlan)!)}/ngày
                    </p>
                  )}
                  <div className="mt-2 min-h-[22px]"><SavingBadge p={shortPlan} /></div>
                  {shortPlan.ai_daily_cap != null && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#FEAD5F]" /> {shortPlan.ai_daily_cap} lượt AI/ngày
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    disabled={buying === shortPlan.key}
                    onClick={() => onPick(shortPlan)}
                  >
                    {buying === shortPlan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Chọn gói
                  </Button>
                </div>
              )}

              {/* Card 2 — 1 tháng */}
              {monthPlan && <PlanCard plan={monthPlan} order="order-2 lg:order-none" />}

              {/* Card 3 — hero */}
              {heroPlan && (
                <div className="order-1 lg:order-none relative rounded-2xl bg-card p-6 lg:p-7 flex flex-col border-2 border-[#CC1C01] shadow-lg">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CC1C01] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Được lựa chọn nhiều nhất
                  </span>
                  <p className="text-base font-heading font-bold text-foreground">{heroPlan.label}</p>
                  <div className="mt-3">
                    <span className="text-4xl font-extrabold text-foreground">{formatVnd(heroPlan.price_vnd)}</span>
                  </div>
                  {perDay(heroPlan) != null && (
                    <p className="text-base font-bold text-[#CC1C01] mt-1">
                      {formatVnd(perDay(heroPlan)!)}/ngày
                    </p>
                  )}
                  <div className="mt-2 min-h-[22px]"><SavingBadge p={heroPlan} /></div>
                  {heroPlan.ai_daily_cap != null && (
                    <p className="text-xs text-foreground font-medium mt-2 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#FEAD5F]" /> {heroPlan.ai_daily_cap} lượt AI/ngày — cao nhất
                    </p>
                  )}
                  <Button
                    className="mt-5 w-full bg-[#CC1C01] hover:bg-[#4D0D0D] text-white"
                    disabled={buying === heroPlan.key}
                    onClick={() => onPick(heroPlan)}
                  >
                    {buying === heroPlan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Bắt đầu {heroPlan.label}
                  </Button>
                </div>
              )}

              {/* Card 4 — 6 tháng */}
              {halfYearPlan && halfYearPlan.key !== heroPlan?.key && (
                <PlanCard plan={halfYearPlan} order="order-3 lg:order-none" />
              )}
            </div>
          )}

          {/* All plans include */}
          <div className="mt-12 rounded-2xl bg-muted/40 border border-border p-6">
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">Tất cả các gói đều có</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_INCLUDED.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>PayOS — kích hoạt tự động ~1 phút</span>
            <span>1.300+ học viên</span>
            <span>Key cập nhật mỗi sáng</span>
          </div>

          {/* Compare table */}
          <div className="mt-12">
            <h2 className="text-xl font-heading font-bold text-foreground mb-4 text-center">So sánh chi tiết</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-3 font-semibold text-foreground">Tính năng</th>
                    <th className="p-3 font-semibold text-center text-muted-foreground">Miễn phí</th>
                    <th
                      className="p-3 font-semibold text-center text-[#CC1C01] rounded-t-xl"
                      style={{ backgroundColor: "rgba(204,28,1,0.06)" }}
                    >
                      Gói luyện thi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row.label}>
                      <td className="p-3 text-foreground border-t border-border text-[12px] md:text-sm">{row.label}</td>
                      <td className="p-3 text-center border-t border-border">
                        <Cell v={row.free} />
                      </td>
                      <td
                        className={cn(
                          "p-3 text-center border-t border-border",
                          i === COMPARE_ROWS.length - 1 && "rounded-b-xl",
                        )}
                        style={{ backgroundColor: "rgba(204,28,1,0.06)" }}
                      >
                        <Cell v={row.paid} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-10">
            Cần tư vấn chọn gói? Admin trả lời trong ít phút.
          </p>
          <div className="max-w-md mx-auto mt-3">
            <ContactAdminLinks />
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
