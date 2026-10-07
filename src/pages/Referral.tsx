import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Copy, Loader2 } from "lucide-react";
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const [termsOpen, setTermsOpen] = useState(false);

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
  // Hoa hồng dự kiến: các khoản đang chờ 7 ngày, chưa rút được.
  const pendingRows = (history ?? []).filter((r) => r.status === "pending");
  const pendingTotal = pendingRows.length
    ? pendingRows.reduce((sum, r) => sum + Number(r.commission_vnd || 0), 0)
    : Number(info?.pending_vnd ?? 0);
  const nextReleaseAt = pendingRows
    .map((r) => r.available_at)
    .filter(Boolean)
    .sort()[0] ?? null;
  const referred = Number(info?.referred_count ?? 0);
  const tierKey = discount < 10 ? "free" : referred < 5 ? "t1" : referred < 20 ? "t2" : "t3";
  const tierIdx = TIERS.findIndex((t) => t.key === tierKey);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${what}`);
    } catch {
      toast.error("Không sao chép được, bạn chọn và copy tay nhé.");
    }
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
        <div className="mx-auto w-full max-w-5xl px-4 space-y-5">
          <section
            className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[0_20px_50px_-20px_rgba(204,28,1,0.55)] md:p-8"
            style={{ background: "radial-gradient(120% 140% at 100% 0%, #FF8A3D 0%, #E2451A 38%, #B81600 72%, #8A1000 100%)" }}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary-foreground/10 blur-2xl" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row">
              <div>
                <span className="inline-flex rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                  <span className="[font-family:system-ui]">🎁</span> Giới thiệu bạn
                </span>
                <h1 className="mt-3 max-w-lg font-heading text-2xl font-extrabold leading-tight md:text-3xl">
                  Web xịn ôn hay – Rủ bạn cùng ôn Aptis
                </h1>
                <p className="mt-2 text-base font-bold">Bạn rủ – bạn được giảm, mình rủ – mình có quà.</p>
                <p className="mt-2 max-w-md text-sm text-primary-foreground/90">
                  Giới thiệu Aptis Kỳ Tích cho bạn bè cùng ôn: bạn mới được giảm {discount}%, bạn nhận {referrerPct}% cho mỗi lượt giới thiệu thành công.
                </p>
                {discount < 10 && (
                  <p className="mt-1.5 text-xs text-primary-foreground/85">
                    <Link to="/pricing" className="font-semibold underline underline-offset-2">Mua gói bất kỳ</Link>{" "}
                    để nâng lên 10% / 10%
                  </p>
                )}
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-3 md:self-start">
                {["Bạn bè được giảm", "Quà cảm ơn cho bạn"].map((label, index) => (
                  <div key={label} className="min-w-[120px] rounded-2xl border border-primary-foreground/25 bg-primary-foreground/15 px-4 py-3 text-center backdrop-blur-sm">
                    {isLoading ? <Skeleton className="mx-auto h-9 w-16 bg-primary-foreground/20" /> : (
                      <p className="text-3xl font-extrabold">{index === 0 ? `-${discount}%` : `${referrerPct}%`}</p>
                    )}
                    <p className="mt-1 text-[11px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-card p-2.5 pl-4 text-foreground">
              <div className="mr-1">
                <p className="text-[11px] font-semibold text-muted-foreground">Mã của bạn</p>
                {isLoading ? <Skeleton className="mt-1 h-8 w-36" /> : (
                  <p className="whitespace-nowrap font-mono text-2xl font-extrabold tracking-[0.12em] text-primary">{code || "—"}</p>
                )}
              </div>
              <p className="min-w-[180px] flex-1 truncate text-[13px] text-muted-foreground">
                {code ? `aptiskytich.vn/?ref=${code}` : ""}
              </p>
              <Button size="sm" variant="outline" className="gap-1.5 border-0 bg-primary/10 text-primary hover:bg-primary/15" onClick={() => copy(code, "mã")}>
                <Copy className="h-3.5 w-3.5" /> Sao chép mã
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => copy(link, "link")}>
                <Copy className="h-3.5 w-3.5" /> Sao chép link
              </Button>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] text-muted-foreground"><span className="[font-family:system-ui]">👥</span> Bạn đã mua</p>
              <p className="mt-1.5 text-2xl font-extrabold text-foreground">{referred}</p>
              <p className="text-[11px] text-muted-foreground">tính vào bậc hoa hồng</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-card p-4 dark:border-emerald-900 dark:from-emerald-950/30">
              <p className="text-[12px] text-muted-foreground"><span className="[font-family:system-ui]">💰</span> Rút được</p>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{vnd(available)}</p>
              <p className="text-[11px] text-muted-foreground">tối thiểu 50.000đ</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[12px] text-muted-foreground"><span className="[font-family:system-ui]">🏦</span> Đã rút</p>
              <p className="mt-1.5 text-2xl font-extrabold text-foreground">{vnd(info?.paid_vnd)}</p>
              <p className="text-[11px] text-muted-foreground">admin đã chuyển</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-card p-4 dark:border-amber-900 dark:from-amber-950/30">
              <p className="text-[12px] text-muted-foreground"><span className="[font-family:system-ui]">⏳</span> Đang chờ</p>
              <p className="mt-1.5 text-2xl font-extrabold text-amber-600 dark:text-amber-400">{vnd(info?.requested_vnd)}</p>
              <p className="text-[11px] text-muted-foreground">admin sẽ chuyển trong 3 ngày</p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-3xl" />
          ) : (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-heading text-base font-bold text-foreground"><span className="[font-family:system-ui]">📈</span> Mức hoa hồng của bạn</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Càng nhiều bạn mua gói qua mã của bạn, mức hoa hồng càng tăng.</p>
              <div className="relative mt-5 grid grid-cols-4">
                <div className="absolute left-[12.5%] right-[12.5%] top-[21px] h-1 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#FEAD5F]" style={{ width: `${(tierIdx / 3) * 100}%` }} />
                </div>
                {TIERS.map((t, tIdx) => {
                  const isCurrent = t.key === tierKey;
                  const isLower = tIdx < tierIdx;
                  return (
                    <div key={t.key} className="relative z-10 flex min-w-0 flex-col items-center px-2 text-center">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] text-sm font-extrabold ${
                        isCurrent
                          ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                          : isLower
                            ? "border-primary/30 bg-card text-primary shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.1)]"
                            : "border-muted bg-card text-muted-foreground"
                      }`}>{t.pct}%</div>
                      <p className={`mt-2 text-xs font-bold ${isCurrent ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                      <p className="mt-1 hidden max-w-[180px] text-[11px] leading-snug text-muted-foreground sm:block">{t.cond} · bạn bè giảm {t.friend}%</p>
                      {isCurrent && <span className="mt-2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Bạn đang ở đây</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3.5 text-sm">
                {tierKey === "free" && (
                  <p className="text-muted-foreground"><Link to="/pricing" className="font-semibold text-primary underline underline-offset-2">Mua gói bất kỳ</Link>{" "}
                    để lên 10% hoa hồng và bạn bè được giảm 10%.
                  </p>
                )}
                {tierKey === "t1" && (
                  <><p className="shrink-0 text-muted-foreground"><span className="[font-family:system-ui]">🎯</span> Còn <strong className="text-foreground">{Math.max(0, 5 - referred)} bạn</strong> nữa để lên <strong className="text-foreground">12%</strong></p><div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (referred / 5) * 100)}%` }} /></div><span className="ml-auto shrink-0 text-xs font-bold text-primary">{referred}/5</span></>
                )}
                {tierKey === "t2" && (
                  <><p className="shrink-0 text-muted-foreground"><span className="[font-family:system-ui]">🎯</span> Còn <strong className="text-foreground">{Math.max(0, 20 - referred)} bạn</strong> nữa để lên <strong className="text-foreground">15%</strong></p><div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((referred - 5) / 15) * 100)}%` }} /></div><span className="ml-auto shrink-0 text-xs font-bold text-primary">{referred}/20</span></>
                )}
                {tierKey === "t3" && <p className="text-muted-foreground">Bạn đang ở mức cao nhất <span className="[font-family:system-ui]">🎉</span></p>}
              </div>
              <p className="mt-3 text-[12.5px] text-muted-foreground"><span className="[font-family:system-ui]">💡</span> Ví dụ: bạn bè mua gói 3 tháng 349k → bạn ấy trả {vnd(Math.round(349000 * (100 - discount) / 100))}, bạn nhận {vnd(Math.round(349000 * (100 - discount) / 100 * referrerPct / 100))}.</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Mức % áp dụng cho đơn mới tại thời điểm bạn của bạn thanh toán. Chỉ tính bạn mua gói từ 1 tuần trở lên.
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-heading text-base font-bold text-foreground"><span className="[font-family:system-ui]">🧭</span> Cách hoạt động</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">3 bước, không cần đăng ký thêm gì.</p>
            <div className="mt-7 grid gap-6 md:grid-cols-3 md:gap-4">
              {[
                { icon: "🔗", title: "Gửi mã hoặc link", desc: "Sao chép mã hay link ở trên, gửi cho bạn bè đang ôn Aptis qua Zalo, Messenger, nhóm lớp.", pill: "Bấm link là tự điền mã" },
                { icon: "🛒", title: "Bạn bè mua gói lần đầu", desc: `Nhập mã lúc thanh toán, được giảm ngay ${discount}%. Áp dụng gói từ 1 tuần trở lên.`, pill: "Giảm ngay khi thanh toán" },
                { icon: "💸", title: "Nhận tiền về tài khoản", desc: "Hoa hồng chờ 7 ngày rồi chuyển sang \"Rút được\". Từ 50.000đ bấm Rút tiền, nhận trong 3 ngày làm việc.", pill: "Chuyển khoản ngân hàng" },
              ].map((step, index) => (
                <div key={step.title} className="relative rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-card p-5 pt-6">
                  <span className="absolute -top-3.5 left-5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary font-extrabold text-primary-foreground shadow-md">{index + 1}</span>
                  <span className="text-3xl [font-family:system-ui]" aria-hidden="true">{step.icon}</span>
                  <h3 className="mt-2 text-[15px] font-extrabold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.desc}</p>
                  <span className="mt-3 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{step.pill}</span>
                  {index < 2 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/50 md:block" />}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-bold text-foreground"><span className="[font-family:system-ui]">💰</span> Rút hoa hồng</h2>
            {pendingPayout ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Yêu cầu {vnd(pendingPayout.amount_vnd)} đang được xử lý, admin sẽ chuyển trong 3 ngày làm việc.
              </p>
            ) : (
              <>
                <p className="mt-2 text-3xl font-extrabold text-foreground">{vnd(available)}</p>
                <div className="mt-2 h-2 w-80 max-w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, available / 50000 * 100)}%` }} /></div>
                <p className={`mt-1.5 text-[12px] font-medium ${available >= 50000 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {available < 50000 ? `Cần thêm ${vnd(50000 - available)} để rút` : "Đủ điều kiện rút"}
                </p>
              </>
            )}
            {pendingTotal > 0 && (
              <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] dark:border-amber-500/30 dark:bg-amber-500/10">
                <span className="[font-family:system-ui]" aria-hidden="true">⏳</span>
                <span className="text-muted-foreground">Hoa hồng dự kiến:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{vnd(pendingTotal)}</span>
                {nextReleaseAt && (
                  <span className="text-muted-foreground">· khoản sớm nhất rút được từ {vnDate(nextReleaseAt)}</span>
                )}
              </div>
            )}
            {payoutMsg && (
              <p className={`mt-3 text-[13px] font-medium ${payoutMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {payoutMsg.text}
              </p>
            )}
            </div>
            {!pendingPayout && <Button disabled={available < 50000} onClick={() => { setPayoutMsg(null); setPayoutOpen(true); }}>Rút tiền</Button>}
          </section>

          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-heading font-bold text-base text-foreground mb-3">Lịch sử hoa hồng</h2>
            {!history || history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="text-3xl [font-family:system-ui]" aria-hidden="true">🌱</p>
                <p className="mt-2 font-bold text-foreground">Chưa có bạn nào mua qua mã của bạn</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Gửi link cho 1 người bạn đang ôn Aptis để bắt đầu nhé.</p>
                <Button className="mt-4 gap-1.5" onClick={() => copy(link, "link")}><Copy className="h-3.5 w-3.5" /> Sao chép link giới thiệu</Button>
              </div>
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
            <Collapsible open={termsOpen} onOpenChange={setTermsOpen} className="mt-5 border-t border-border pt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto w-full justify-between px-0 py-1 font-bold text-foreground hover:bg-transparent">
                  Điều khoản chương trình
                  <ChevronDown className={`h-4 w-4 transition-transform ${termsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                  {TERMS.map((term) => <li key={term} className="flex gap-2 text-[12.5px] text-muted-foreground"><span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span><span>{term}</span></li>)}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </section>
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
