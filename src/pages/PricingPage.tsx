import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";

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
};

const PRO_PERKS = [
  "Mở khoá TOÀN BỘ kho đề (Reading, Listening, Writing, Speaking, Grammar & Vocab, Thi thử)",
  "Chấm AI Speaking & Writing KHÔNG GIỚI HẠN",
  "AI Coach trả lời thắc mắc 24/7",
  "Bài mẫu chuẩn band B1–C1",
  "Dịch câu & tra từ chuyên sâu trong khi làm bài",
  "Theo dõi tiến độ chi tiết, gợi ý lộ trình",
];

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function planBadge(p: PricingPlan) {
  if (!p.highlight) return null;
  // simple heuristic
  if (p.duration_days == null) return "Hời nhất";
  return "Phổ biến";
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<PricingPlan | null>(null);
  const { user } = useAuth();
  const { isPro } = useIsPro();
  const navigate = useNavigate();

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

  const onPick = (p: PricingPlan) => {
    if (!user) { navigate("/auth"); return; }
    setPicked(p);
  };

  const bankInfo = useMemo(() => ({
    bank: "Vietcombank",
    number: "0123456789",
    name: "APTIS KỲ TÍCH",
  }), []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-[#FEAD5F]/20 text-[#CC1C01] border-0 mb-3">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Nâng cấp Pro
            </Badge>
            <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground">
              Mở khoá toàn bộ Aptis Kỳ Tích
            </h1>
            <p className="text-muted-foreground mt-2">
              Một lần đầu tư, học không giới hạn. Chọn gói phù hợp với bạn — đổi gói bất cứ lúc nào.
            </p>
            {isPro && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-1.5 text-sm font-semibold">
                <Crown className="w-4 h-4" /> Bạn đang là thành viên Pro
              </div>
            )}
          </div>

          {/* Plans */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((p) => {
                const badge = planBadge(p);
                return (
                  <div
                    key={p.key}
                    className={cn(
                      "relative rounded-2xl border bg-card p-6 flex flex-col transition-all hover:shadow-lg",
                      p.highlight
                        ? "border-[#CC1C01] ring-2 ring-[#CC1C01]/20 shadow-md"
                        : "border-border",
                    )}
                  >
                    {badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#CC1C01] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                        {badge}
                      </span>
                    )}
                    <h3 className="text-lg font-heading font-bold text-foreground">{p.label}</h3>
                    <div className="mt-3 mb-1">
                      <span className="text-3xl font-extrabold text-[#CC1C01]">
                        {formatVnd(p.price_vnd)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-5">
                      {p.duration_days == null
                        ? "Dùng mãi mãi, không gia hạn"
                        : `Trọn ${p.duration_days} ngày sử dụng`}
                    </p>
                    <Button
                      onClick={() => onPick(p)}
                      className={cn(
                        "mt-auto w-full gap-2 font-semibold",
                        p.highlight
                          ? "bg-[#CC1C01] hover:bg-[#4D0D0D] text-white"
                          : "",
                      )}
                      variant={p.highlight ? "default" : "outline"}
                    >
                      <Crown className="w-4 h-4" /> Nâng cấp
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Perks */}
          <div className="mt-14 rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 className="text-xl font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#CC1C01]" /> Pro mở khoá gì?
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRO_PERKS.map((perk) => (
                <li key={perk} className="flex gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
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
              <Crown className="w-5 h-5 text-[#CC1C01]" />
              Thanh toán gói {picked?.label}
            </DialogTitle>
            <DialogDescription>
              Chuyển khoản theo thông tin dưới đây, sau đó nhắn Zalo / Facebook kèm email tài khoản để admin cấp Pro.
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
            Sau khi chuyển khoản, nhắn Zalo kèm email <b>{user?.email}</b> để được cấp Pro trong ít phút.
          </p>

          <ContactAdminLinks />
        </DialogContent>
      </Dialog>
    </div>
  );
}
