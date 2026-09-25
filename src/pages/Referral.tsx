import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gift, Copy, Share2, Loader2, Wallet, MousePointerClick,
  Users, Clock, BadgeCheck, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ReferralCode = {
  ok: boolean;
  code?: string;
  referrer_percent?: number;
  discount_percent?: number;
  clicks?: number;
  referred_count?: number;
  pending_vnd?: number;
  available_vnd?: number;
  paid_vnd?: number;
  requested_vnd?: number;
  next_tier_at?: number | null;
};

const PLAN_LABEL: Record<string, string> = {
  week: "1 tuần",
  month: "1 tháng",
  quarter: "3 tháng",
  half_year: "6 tháng",
};

const TIERS = [
  { key: "free", label: "Chưa mua gói", cond: "Tài khoản chưa từng mua gói", pct: 5, friend: 5 },
  { key: "t1", label: "Bậc 1", cond: "0–4 bạn đã mua", pct: 10, friend: 10 },
  { key: "t2", label: "Bậc 2", cond: "5–19 bạn đã mua", pct: 12, friend: 10 },
  { key: "t3", label: "Bậc 3", cond: "Từ 20 bạn đã mua", pct: 15, friend: 10 },
];

type HistoryRow = {
  created_at: string;
  referred_name: string | null;
  plan_key: string | null;
  order_amount_vnd: number;
  commission_percent: number;
  commission_vnd: number;
  status: string;
  available_at: string;
};

const vnd = (n?: number | null) =>
  `${Number(n ?? 0).toLocaleString("vi-VN")}đ`;
const vnDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("vi-VN") : "—";

const STATUS: Record<string, { label: (r: HistoryRow) => string; cls: string }> = {
  pending: {
    label: (r) => `Chờ đến ${vnDate(r.available_at)}`,
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  available: {
    label: () => "Rút được",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  paid: {
    label: () => "Đã trả",
    cls: "bg-primary/10 text-primary",
  },
  reversed: {
    label: () => "Đã huỷ",
    cls: "bg-muted text-muted-foreground",
  },
};

const TERMS = [
  "Chỉ tài khoản chưa từng mua gói mới dùng được mã, một lần cho đơn đầu tiên.",
  "Phải nhập mã lúc thanh toán (bấm link thì tự điền).",
  "Gói ngày không tính.",
  "Không dùng chung với mã khác.",
  "Hoa hồng tính trên số tiền bạn thực trả, chờ 7 ngày.",
  "Rút từ 50.000đ, chuyển khoản trong 3 ngày làm việc.",
  "Đơn hoàn tiền bị thu hồi.",
  "Không tự dùng mã của mình.",
  "Kỳ Tích có quyền từ chối trả khi phát hiện gian lận và điều chỉnh chương trình có báo trước.",
  "Hoa hồng là thu nhập cá nhân, người nhận tự kê khai thuế nếu thuộc diện.",
];

const STEPS = [
  { title: "1. Lấy mã hoặc link", desc: "Sao chép mã giới thiệu của bạn ở khối phía trên." },
  { title: "2. Bạn bè mua gói", desc: "Bạn bè bấm link hoặc nhập mã khi thanh toán để được giảm giá." },
  { title: "3. Nhận hoa hồng", desc: "Sau 7 ngày chờ, hoa hồng chuyển sang 'Rút được' — rút từ 50.000đ." },
];

export default function Referral() {
  usePageMeta({
    title: "Giới thiệu bạn — Aptis Kỳ Tích",
    description: "Rủ bạn ôn Aptis cùng: bạn của bạn được giảm giá, bạn nhận hoa hồng.",
  });

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [payoutMsg, setPayoutMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const { data: info, isLoading } = useQuery({
    queryKey: ["referral-code", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_referral_code");
      if (error) throw error;
      return data as ReferralCode;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["referral-history", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_referral_history");
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const { data: bank } = useQuery({
    queryKey: ["referral-bank", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("bank_name,bank_account,bank_holder")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as
        | { bank_name: string | null; bank_account: string | null; bank_holder: string | null }
        | null;
    },
  });

  const { data: pendingPayout } = useQuery({
    queryKey: ["referral-payout-pending", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("referral_payouts")
        .select("id,amount_vnd,status,requested_at")
        .eq("user_id", user!.id)
        .eq("status", "requested")
        .order("requested_at", { ascending: false })
        .limit(1);
      const row = Array.isArray(data) ? data[0] : null;
      return (row ?? null) as { id: string; amount_vnd: number } | null;
    },
  });

  useEffect(() => {
    if (!payoutOpen) return;
    setBankName((v) => v || bank?.bank_name || "");
    setBankAccount((v) => v || bank?.bank_account || "");
    setHolder((v) => v || bank?.bank_holder || "");
  }, [payoutOpen, bank]);

  const code = info?.code ?? "";
  const link = code ? `https://aptiskytich.vn/?ref=${code}` : "";
  const discount = Number(info?.discount_percent ?? 0);
  const referrerPct = Number(info?.referrer_percent ?? 0);
  const available = Number(info?.available_vnd ?? 0);
  const referred = Number(info?.referred_count ?? 0);
  const tierKey = discount < 10 ? "free" : referred < 5 ? "t1" : referred < 20 ? "t2" : "t3";
  const tierIdx = TIERS.findIndex((t) => t.key === tierKey);

  const stats = useMemo(
    () => [
      { icon: MousePointerClick, label: "Lượt bấm link", value: String(info?.clicks ?? 0) },
      { icon: Users, label: "Bạn đã mua", value: String(referred) },
      { icon: Clock, label: "Đang chờ", value: vnd(info?.pending_vnd) },
      { icon: Wallet, label: "Rút được", value: vnd(available) },
    ],
    [info, referred, available],
  );

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${what}`);
    } catch {
      toast.error("Không sao chép được, bạn chọn và copy tay nhé.");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Aptis Kỳ Tích",
          text: `Ôn Aptis cùng mình nhé, dùng mã ${code} để được giảm giá.`,
          url: link,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    void copy(link, "link giới thiệu");
  };

  const payout = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("request_referral_payout", {
        p_bank_name: bankName,
        p_bank_account: bankAccount,
        p_holder: holder,
      });
      if (error) throw error;
      return data as { ok: boolean; message?: string; amount_vnd?: number };
    },
    onSuccess: (res) => {
      if (res?.ok) {
        setPayoutMsg({ ok: true, text: `Đã gửi yêu cầu rút ${vnd(res.amount_vnd)}.` });
        toast.success("Đã gửi yêu cầu rút tiền");
        setPayoutOpen(false);
      } else {
        setPayoutMsg({ ok: false, text: res?.message || "Không gửi được yêu cầu." });
      }
      qc.invalidateQueries({ queryKey: ["referral-code", user?.id] });
      qc.invalidateQueries({ queryKey: ["referral-history", user?.id] });
      qc.invalidateQueries({ queryKey: ["referral-payout-pending", user?.id] });
    },
    onError: () => setPayoutMsg({ ok: false, text: "Có lỗi xảy ra, bạn thử lại nhé." }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="mx-auto w-full max-w-3xl px-4 space-y-6">
          {/* Hero */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-3">
              <Gift className="w-6 h-6" />
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground">
              Rủ bạn ôn Aptis cùng
            </h1>
            {isLoading ? (
              <Skeleton className="h-5 w-72 mx-auto mt-2" />
            ) : discount >= 10 ? (
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                Bạn của bạn giảm 10%, bạn nhận {referrerPct}% hoa hồng
              </p>
            ) : (
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                Bạn của bạn giảm 5%, bạn nhận 5% —{" "}
                <Link to="/pricing" className="text-primary font-semibold underline underline-offset-2">
                  mua gói bất kỳ
                </Link>{" "}
                để nâng lên 10%/10%
              </p>
            )}
          </div>

          {/* Code block */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
            {isLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-2xl font-extrabold tracking-wider text-foreground">
                    {code || "—"}
                  </span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(code, "mã")}>
                    <Copy className="w-3.5 h-3.5" /> Sao chép mã
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] text-muted-foreground break-all">{link}</span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(link, "link")}>
                    <Copy className="w-3.5 h-3.5" /> Sao chép link
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={share}>
                    <Share2 className="w-3.5 h-3.5" /> Chia sẻ
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <Icon className="w-4 h-4 text-primary mb-2" />
                <p className="text-[12px] text-muted-foreground">{label}</p>
                <p className="text-lg font-extrabold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {Number(info?.requested_vnd ?? 0) > 0 && (
            <p className="text-[13px] font-medium text-foreground">
              Đang chờ admin chuyển: {vnd(info?.requested_vnd)}
            </p>
          )}
          {/* Mức hoa hồng */}
          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h2 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Mức hoa hồng
              </h2>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {TIERS.map((t, tIdx) => {
                  const isCurrent = t.key === tierKey;
                  const isLower = tIdx < tierIdx;
                  return (
                    <div
                      key={t.key}
                      className={`relative rounded-xl p-3 border ${
                        isCurrent ? "border-primary bg-primary/5" : "border-border"
                      } ${isLower ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-[12px] font-semibold text-foreground">{t.label}</p>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-0.5 whitespace-nowrap">
                            Bạn đang ở đây
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xl font-extrabold text-foreground">{t.pct}%</p>
                      <p className="text-[11px] text-muted-foreground">{t.cond}</p>
                      <p className="text-[11px] text-muted-foreground">Bạn bè giảm {t.friend}%</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                {tierKey === "free" && (
                  <p className="text-[13px] text-muted-foreground">
                    <Link
                      to="/pricing"
                      className="text-primary font-semibold underline underline-offset-2"
                    >
                      Mua gói bất kỳ
                    </Link>{" "}
                    để lên 10% hoa hồng và bạn bè được giảm 10%.
                  </p>
                )}
                {tierKey === "t1" && (
                  <>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (referred / 5) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      Còn {Math.max(0, 5 - referred)} bạn nữa để lên 12%
                    </p>
                  </>
                )}
                {tierKey === "t2" && (
                  <>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, ((referred - 5) / 15) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      Còn {Math.max(0, 20 - referred)} bạn nữa để lên 15%
                    </p>
                  </>
                )}
                {tierKey === "t3" && (
                  <p className="text-[13px] text-muted-foreground">
                    Bạn đang ở mức cao nhất 🎉
                  </p>
                )}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Mức % áp dụng cho đơn mới tại thời điểm bạn của bạn thanh toán. Chỉ tính bạn mua gói từ 1 tuần trở lên.
              </p>
            </div>
          )}

          {/* Payout */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h2 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Rút hoa hồng
            </h2>
            {pendingPayout ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Yêu cầu {vnd(pendingPayout.amount_vnd)} đang được xử lý, admin sẽ chuyển trong 3 ngày làm việc.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Số rút được hiện tại: <span className="font-semibold text-foreground">{vnd(available)}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button disabled={available < 50000} onClick={() => { setPayoutMsg(null); setPayoutOpen(true); }}>
                    Rút tiền
                  </Button>
                  {available < 50000 && (
                    <span className="text-[12px] text-muted-foreground">Cần tối thiểu 50.000đ</span>
                  )}
                </div>
              </>
            )}
            {payoutMsg && (
              <p className={`mt-3 text-[13px] font-medium ${payoutMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {payoutMsg.text}
              </p>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h2 className="font-heading font-bold text-base text-foreground mb-3">Lịch sử hoa hồng</h2>
            {!history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bạn nào mua qua mã của bạn</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-semibold">Ngày</th>
                      <th className="py-2 pr-3 font-semibold">Bạn</th>
                      <th className="py-2 pr-3 font-semibold">Gói</th>
                      <th className="py-2 pr-3 font-semibold">Hoa hồng</th>
                      <th className="py-2 font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => {
                      const st = STATUS[r.status] ?? STATUS.pending;
                      return (
                        <tr key={`${r.created_at}-${i}`} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 pr-3 whitespace-nowrap">{vnDate(r.created_at)}</td>
                          <td className="py-2.5 pr-3">{r.referred_name || "Học viên"}</td>
                          <td className="py-2.5 pr-3">{(r.plan_key && PLAN_LABEL[r.plan_key]) || "—"}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap font-semibold text-foreground">
                            {vnd(r.commission_vnd)} · {r.commission_percent}%
                          </td>
                          <td className="py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                              {st.label(r)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* How it works + terms */}
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h2 className="font-heading font-bold text-base text-foreground mb-3">Cách hoạt động</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.title} className="rounded-xl bg-muted/50 p-4">
                  <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-primary" /> {s.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1">{s.desc}</p>
                </div>
              ))}
            </div>

            <ul className="mt-5 space-y-1.5 text-[12px] text-muted-foreground list-disc pl-5">
              {TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Rút {vnd(available)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ref-bank">Ngân hàng</Label>
              <Input id="ref-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Vietcombank" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-acc">Số tài khoản</Label>
              <Input id="ref-acc" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} inputMode="numeric" placeholder="0123456789" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-holder">Chủ tài khoản</Label>
              <Input id="ref-holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="NGUYEN VAN A" />
            </div>
            {payoutMsg && !payoutMsg.ok && (
              <p className="text-[13px] font-medium text-destructive">{payoutMsg.text}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Đóng</Button>
            <Button
              disabled={payout.isPending || !bankAccount.trim()}
              onClick={() => payout.mutate()}
            >
              {payout.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
