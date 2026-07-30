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

const FREE_PERKS = [
  "3 lượt chấm AI Writing + Speaking (trọn đời)",
  "3 đề part lẻ mỗi kỹ năng",
  "3 đề Luyện Full Part · 1 đề Thi thử Full Test",
  "2 lượt Marathon",
  "Bài mẫu, dịch cả câu, tra từ, Dictation, sổ từ vựng",
];

const PAID_PERKS = [
  "Toàn bộ kho đề — part lẻ, Full Part, Thi thử",
  "Đề Key Dự Đoán cập nhật hằng ngày",
  "Chấm AI Speaking & Writing theo trần ngày của gói",
  "Marathon không giới hạn",
  "Đầy đủ tiện ích học tập",
];

type CompareRow = { label: string; free: string | boolean; paid: string | boolean };
const COMPARE_ROWS: CompareRow[] = [
  { label: "Đề Key Dự Đoán", free: false, paid: true },
  { label: "Kho đề part lẻ", free: "3 đề/kỹ năng", paid: "Toàn bộ" },
  { label: "Luyện Full Part", free: "3 đề", paid: "Toàn bộ" },
  { label: "Thi thử Full Test", free: "1 đề", paid: "Toàn bộ" },
  { label: "Marathon", free: "2 lượt", paid: "Không giới hạn" },
  { label: "Chấm AI Writing + Speaking", free: "3 lượt trọn đời", paid: "10-30 lượt/ngày theo gói" },
  { label: "Bài mẫu B1-C", free: true, paid: true },
  { label: "Dịch cả câu & tra từ", free: true, paid: true },
  { label: "Hỗ trợ", free: "Cộng đồng", paid: "Zalo/FB ưu tiên" },
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

  const paidPlans = useMemo(
    () => plans.filter((p) => p.duration_days != null),
    [plans],
  );
  const dayPlan = useMemo(() => plans.find((p) => p.key === "day"), [plans]);

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
    return <span className="text-xs md:text-sm text-foreground">{v}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[144px] md:pt-24 pb-20">
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
              Miễn phí để khởi động. Gói luyện thi theo thời hạn — từ 1 ngày đến 6 tháng, thời hạn càng dài càng tiết kiệm.
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
                  <h3 className="text-lg font-heading font-bold text-foreground">Miễn phí</h3>
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

              {/* PAID */}
              <div className={cn(
                "lg:col-span-2 rounded-2xl border bg-card p-6 flex flex-col relative",
                "border-[#CC1C01] ring-2 ring-[#CC1C01]/20 shadow-md",
              )}>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CC1C01] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  Mở toàn bộ kho đề
                </span>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-lg bg-[#CC1C01]/10 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-[#CC1C01]" />
                  </span>
                  <h3 className="text-lg font-heading font-bold text-foreground">Gói luyện thi</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Chọn thời hạn phù hợp</p>
                <div className="space-y-2 mb-4">
                  {paidPlans.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có gói nào.</p>
                  )}
                  {paidPlans.map((p) => {
                    const saving = savingOf(p);
                    return (
                      <button
                        key={p.key}
                        onClick={() => onPick(p)}
                        disabled={buying === p.key}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-[#CC1C01] hover:bg-[#CC1C01]/5 disabled:opacity-60",
                          p.highlight ? "border-[#CC1C01] bg-[#CC1C01]/5" : "border-border",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground truncate">{p.label}</p>
                            {p.highlight && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#CC1C01] text-white">Phổ biến</span>
                            )}
                            {saving != null && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Tiết kiệm {saving}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.duration_days} ngày sử dụng
                          </p>
                          {p.ai_daily_cap != null && (
                            <p className="text-xs text-[#CC1C01] font-medium flex items-center gap-1 mt-0.5">
                              <Zap className="w-3 h-3" /> {p.ai_daily_cap} lượt chấm AI/ngày
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-extrabold text-[#CC1C01] shrink-0 flex items-center gap-1">
                          {buying === p.key && <Loader2 className="w-4 h-4 animate-spin" />}
                          {formatVnd(p.price_vnd)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ul className="space-y-2 mb-5">
                  {PAID_PERKS.map((p) => (
                    <li key={p} className="flex gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-auto">Bấm 1 gói để thanh toán qua payOS (chuyển khoản tự động). Hoặc <button onClick={() => paidPlans[0] && setPicked(paidPlans[0])} className="underline hover:text-[#CC1C01]">liên hệ admin thủ công</button>.</p>
              </div>
            </div>
          )}

          {/* Compare table */}
          <div className="mt-14 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-xl font-heading font-bold text-foreground">So sánh nhanh</h2>
              <p className="text-sm text-muted-foreground">Miễn phí · Gói trả phí</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-semibold text-foreground">Tính năng</th>
                    <th className="p-3 font-semibold text-center">Free</th>
                    <th className="p-3 font-semibold text-center text-[#CC1C01]">Gói trả phí</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 text-foreground">{row.label}</td>
                      <td className="p-3 text-center"><Cell v={row.free} /></td>
                      <td className="p-3 text-center"><Cell v={row.paid} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Cần hỗ trợ chọn gói? Nhắn Zalo / Facebook bên dưới — admin trả lời trong ngay.
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
