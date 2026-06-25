import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Crown, Gem, Loader2, Sparkles, X } from "lucide-react";

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
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function planBadge(p: PricingPlan) {
  if (!p.highlight) return null;
  if (p.duration_days == null) return "Hời nhất";
  return "Phổ biến";
}

const FREE_PERKS = [
  "Một số đề luyện cơ bản (Free)",
  "Học từ vựng & flashcard giới hạn",
  "Tra từ inline trong bài",
  "Theo dõi tiến độ cơ bản",
];

const PRO_PERKS = [
  "Mở khóa kho đề Pro (Reading, Listening, Writing, Speaking, G&V, Thi thử)",
  "Chấm AI Speaking & Writing — số lượt cao theo tháng",
  "Bài mẫu chuẩn band B1–C1",
  "Dịch câu & tra từ chuyên sâu",
  "Theo dõi tiến độ chi tiết",
];

const PREMIUM_PERKS = [
  "TẤT CẢ quyền lợi của Pro",
  "Mở khóa kho đề Premium (cao cấp / mới nhất)",
  "Chấm AI Speaking & Writing — KHÔNG GIỚI HẠN",
  "AI Coach hỗ trợ học tập ưu tiên",
  "Trọn đời — đầu tư một lần, dùng mãi mãi",
];

type CompareRow = { label: string; free: string | boolean; pro: string | boolean; premium: string | boolean };
const COMPARE_ROWS: CompareRow[] = [
  { label: "Kho đề Free", free: true, pro: true, premium: true },
  { label: "Kho đề Pro", free: false, pro: true, premium: true },
  { label: "Kho đề Premium", free: false, pro: false, premium: true },
  { label: "Chấm AI Writing", free: "3 lượt / tháng", pro: "10 lượt / tháng", premium: "Không giới hạn" },
  { label: "Chấm AI Speaking", free: "3 lượt / tháng", pro: "10 lượt / tháng", premium: "Không giới hạn" },
  { label: "AI Coach", free: false, pro: "Giới hạn", premium: "Ưu tiên" },
  { label: "Tra từ inline", free: true, pro: true, premium: true },
  { label: "Bài mẫu B1–C1", free: false, pro: true, premium: true },
  { label: "Hỗ trợ", free: "Cộng đồng", pro: "Zalo/FB", premium: "Ưu tiên" },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<PricingPlan | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const { user } = useAuth();
  const { isPro, isPremium, tier, refetch } = useIsPro();
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

  const proPlans = useMemo(
    () => plans.filter((p) => (p.tier ?? (p.duration_days == null ? "premium" : "pro")) === "pro"),
    [plans],
  );
  const premiumPlans = useMemo(
    () => plans.filter((p) => (p.tier ?? (p.duration_days == null ? "premium" : "pro")) === "premium"),
    [plans],
  );

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
    bank: "Vietcombank",
    number: "0123456789",
    name: "APTIS KỲ TÍCH",
  }), []);

  const tierLabel = isPremium ? "Premium" : isPro ? "Pro" : "Free";

  const Cell = ({ v }: { v: string | boolean }) => {
    if (v === true) return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
    if (v === false) return <X className="w-4 h-4 text-muted-foreground/60 mx-auto" />;
    return <span className="text-xs md:text-sm text-foreground">{v}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-[#FEAD5F]/20 text-[#CC1C01] border-0 mb-3">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Bảng giá
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground">
              Chọn gói phù hợp với bạn
            </h1>
            <p className="text-muted-foreground mt-2">
              Free để khởi động. Pro để học nghiêm túc. Premium để mở toàn bộ trọn đời.
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* FREE */}
              <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                  </span>
                  <h3 className="text-lg font-heading font-bold text-foreground">Free</h3>
                </div>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-extrabold text-foreground">0đ</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Dùng thử các đề và tính năng cơ bản</p>
                <ul className="space-y-2 mb-5">
                  {FREE_PERKS.map((p) => (
                    <li key={p} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" disabled className="mt-auto w-full">
                  {tier === "free" ? "Đang dùng" : "Gói cơ bản"}
                </Button>
              </div>

              {/* PRO */}
              <div className={cn(
                "rounded-2xl border bg-card p-6 flex flex-col relative",
                "border-[#CC1C01] ring-2 ring-[#CC1C01]/20 shadow-md",
              )}>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CC1C01] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Phổ biến
                </span>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-lg bg-[#CC1C01]/10 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-[#CC1C01]" />
                  </span>
                  <h3 className="text-lg font-heading font-bold text-foreground">Pro</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Chọn thời hạn phù hợp</p>
                <div className="space-y-2 mb-4">
                  {proPlans.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có gói Pro.</p>
                  )}
                  {proPlans.map((p) => {
                    const badge = planBadge(p);
                    return (
                      <button
                        key={p.key}
                        onClick={() => onPick(p)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-[#CC1C01] hover:bg-[#CC1C01]/5",
                          p.highlight ? "border-[#CC1C01] bg-[#CC1C01]/5" : "border-border",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground truncate">{p.label}</p>
                            {badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#CC1C01] text-white">{badge}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.duration_days == null ? "Không thời hạn" : `${p.duration_days} ngày sử dụng`}
                          </p>
                        </div>
                        <span className="text-lg font-extrabold text-[#CC1C01] shrink-0">
                          {formatVnd(p.price_vnd)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ul className="space-y-2 mb-5">
                  {PRO_PERKS.map((p) => (
                    <li key={p} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-auto">Bấm 1 gói ở trên để xem hướng dẫn thanh toán.</p>
              </div>

              {/* PREMIUM */}
              <div className="rounded-2xl border-2 border-[#FEAD5F]/60 bg-gradient-to-b from-[#FEAD5F]/10 to-card p-6 flex flex-col relative shadow-md">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Hời nhất · Trọn đời
                </span>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
                    <Gem className="w-4 h-4 text-white" />
                  </span>
                  <h3 className="text-lg font-heading font-bold text-foreground">Premium</h3>
                </div>
                {premiumPlans[0] && (
                  <>
                    <div className="mt-2 mb-1">
                      <span className="text-3xl font-extrabold text-[#CC1C01]">
                        {formatVnd(premiumPlans[0].price_vnd)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">Trọn đời — không gia hạn</p>
                  </>
                )}
                {!premiumPlans[0] && (
                  <p className="text-sm text-muted-foreground mb-4">Sắp ra mắt.</p>
                )}
                <ul className="space-y-2 mb-5">
                  {PREMIUM_PERKS.map((p) => (
                    <li key={p} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> <span>{p}</span>
                    </li>
                  ))}
                </ul>
                {premiumPlans[0] && (
                  <Button
                    onClick={() => onPick(premiumPlans[0])}
                    className="mt-auto w-full gap-2 font-semibold bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110"
                  >
                    <Gem className="w-4 h-4" /> Mua Premium
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Compare table */}
          <div className="mt-14 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-xl font-heading font-bold text-foreground">So sánh nhanh</h2>
              <p className="text-sm text-muted-foreground">Free · Pro · Premium</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-semibold text-foreground">Tính năng</th>
                    <th className="p-3 font-semibold text-center">Free</th>
                    <th className="p-3 font-semibold text-center text-[#CC1C01]">Pro</th>
                    <th className="p-3 font-semibold text-center">
                      <span className="inline-flex items-center gap-1 text-[#CC1C01]">
                        <Gem className="w-3.5 h-3.5" /> Premium
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 text-foreground">{row.label}</td>
                      <td className="p-3 text-center"><Cell v={row.free} /></td>
                      <td className="p-3 text-center"><Cell v={row.pro} /></td>
                      <td className="p-3 text-center"><Cell v={row.premium} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Cần hỗ trợ chọn gói? Nhắn Zalo / Facebook bên dưới — admin trả lời trong ngày.
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
              {picked?.tier === "premium" ? <Gem className="w-5 h-5 text-[#CC1C01]" /> : <Crown className="w-5 h-5 text-[#CC1C01]" />}
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
                {(picked?.tier === "premium" ? "PREMIUM " : "PRO ")}
                {picked?.key.toUpperCase()} {user?.email ?? ""}
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
