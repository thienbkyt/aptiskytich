import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type Overview = {
  days: number;
  clicks: number;
  orders: number;
  revenue_vnd: number;
  commission_vnd: number;
  paid_vnd: number;
  owed_vnd: number;
  top: Array<{ user_id: string; name: string; n: number; commission_vnd: number; percent: number; last_at: string }>;
  burst: Array<{ user_id: string; name: string; n: number }>;
  bank_dup: Array<{ referrer_name: string; referred_name: string; bank_account: string }>;
};

type Payout = {
  id: string;
  user_id: string;
  amount_vnd: number;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  status: string;
  admin_note: string | null;
  requested_at: string;
  paid_at: string | null;
};

type Earning = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  plan_key: string | null;
  order_amount_vnd: number;
  commission_percent: number;
  commission_vnd: number;
  status: string;
  available_at: string;
  payout_id: string | null;
  created_at: string;
};

const vnd = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString("vi-VN")}đ`;
const dt = (s: string | null) => (s ? new Date(s).toLocaleString("vi-VN") : "—");

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "Đang chờ", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  available: { label: "Rút được", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  paid: { label: "Đã trả", cls: "bg-primary/10 text-primary" },
  reversed: { label: "Đã huỷ", cls: "bg-muted text-muted-foreground" },
  requested: { label: "Chờ xử lý", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  rejected: { label: "Từ chối", cls: "bg-destructive/10 text-destructive" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_BADGE[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={`border-0 ${m.cls}`}>{m.label}</Badge>;
}

function CopyBtn({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[12px]">{value}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast.success("Đã copy");
        }}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export default function ReferralAdminManager() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [payoutStatus, setPayoutStatus] = useState("requested");
  const [earnStatus, setEarnStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState<{ payout: Payout; mode: "paid" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const ov = useQuery({
    queryKey: ["ref-admin-overview", days],
    queryFn: async (): Promise<Overview> => {
      const { data, error } = await db.rpc("admin_referral_overview", { p_days: days });
      if (error) throw error;
      return data as Overview;
    },
  });

  const payouts = useQuery({
    queryKey: ["ref-admin-payouts", payoutStatus],
    queryFn: async (): Promise<Payout[]> => {
      const { data, error } = await db
        .from("referral_payouts")
        .select("*")
        .eq("status", payoutStatus)
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Payout[];
    },
  });

  const earnings = useQuery({
    queryKey: ["ref-admin-earnings"],
    queryFn: async (): Promise<Earning[]> => {
      const { data, error } = await db
        .from("referral_earnings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Earning[];
    },
  });

  // Tên hiển thị cho mọi user liên quan
  const userIds = useMemo(() => {
    const s = new Set<string>();
    (payouts.data || []).forEach((p) => s.add(p.user_id));
    (earnings.data || []).forEach((e) => {
      s.add(e.referrer_user_id);
      s.add(e.referred_user_id);
    });
    return Array.from(s);
  }, [payouts.data, earnings.data]);

  const names = useQuery({
    queryKey: ["ref-admin-names", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await db
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        map[r.user_id] = r.display_name || "Học viên";
      });
      return map;
    },
  });

  const emails = useQuery({
    queryKey: ["ref-admin-emails", (payouts.data || []).map((p) => p.user_id).join(",")],
    enabled: (payouts.data || []).length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = (payouts.data || []).map((p) => p.user_id);
      const { data } = await db.rpc("admin_emails_by_ids", { p_user_ids: ids });
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => {
        if (r.user_id && r.email) map[r.user_id] = r.email;
      });
      return map;
    },
  });

  const nameOf = (id: string) => names.data?.[id] || "Học viên";

  const markPayout = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: "paid" | "rejected"; note: string }) => {
      const { error } = await db.rpc("admin_mark_referral_payout", {
        p_payout_id: id,
        p_status: status,
        p_note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật yêu cầu rút");
      setDialog(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["ref-admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["ref-admin-earnings"] });
      qc.invalidateQueries({ queryKey: ["ref-admin-overview"] });
    },
    onError: (e: any) => toast.error(e?.message || "Không cập nhật được"),
  });

  const reverse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("referral_earnings").update({ status: "reversed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã huỷ hoa hồng");
      qc.invalidateQueries({ queryKey: ["ref-admin-earnings"] });
      qc.invalidateQueries({ queryKey: ["ref-admin-overview"] });
    },
    onError: (e: any) => toast.error(e?.message || "Không huỷ được"),
  });

  const filteredEarnings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (earnings.data || []).filter((e) => {
      if (earnStatus !== "all" && e.status !== earnStatus) return false;
      if (!q) return true;
      return (
        nameOf(e.referrer_user_id).toLowerCase().includes(q) ||
        nameOf(e.referred_user_id).toLowerCase().includes(q)
      );
    });
  }, [earnings.data, earnStatus, search, names.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const o = ov.data;
  const ratio =
    o && o.revenue_vnd > 0 ? ((o.commission_vnd / o.revenue_vnd) * 100).toFixed(1) : "0";
  const alerts = (o?.burst?.length ?? 0) + (o?.bank_dup?.length ?? 0);

  const stats = [
    { label: "Lượt bấm link", value: (o?.clicks ?? 0).toLocaleString("vi-VN") },
    { label: "Đơn qua mã", value: (o?.orders ?? 0).toLocaleString("vi-VN") },
    { label: "Doanh thu qua mã", value: vnd(o?.revenue_vnd) },
    { label: "Hoa hồng phát sinh", value: vnd(o?.commission_vnd) },
    { label: "Đã trả", value: vnd(o?.paid_vnd) },
    { label: "Đang chờ + rút được", value: vnd(o?.owed_vnd) },
  ];

  return (
    <div className="space-y-8">
      {/* Cảnh báo */}
      {alerts > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 font-heading font-bold text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Cảnh báo gian lận ({alerts})
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-foreground">
            {(o?.burst || []).map((b) => (
              <li key={`b-${b.user_id}`}>
                {b.name}: {b.n} lượt trong 24h gần nhất.
              </li>
            ))}
            {(o?.bank_dup || []).map((d, i) => (
              <li key={`d-${i}`}>
                Trùng số tài khoản {d.bank_account}: {d.referrer_name} — {d.referred_name}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* (a) Tổng quan */}
      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="font-heading font-bold text-foreground">Tổng quan {days} ngày</h3>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={d === days ? "default" : "outline"}
                onClick={() => setDays(d)}
              >
                {d} ngày
              </Button>
            ))}
          </div>
        </div>
        {ov.isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[12px] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-heading font-extrabold text-lg text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Hoa hồng / doanh thu qua mã = {ratio}%
            </p>
          </>
        )}
      </section>

      {/* (b) Yêu cầu rút */}
      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="font-heading font-bold text-foreground">Yêu cầu rút</h3>
          <Select value={payoutStatus} onValueChange={setPayoutStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requested">Chờ xử lý</SelectItem>
              <SelectItem value="paid">Đã trả</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày yêu cầu</TableHead>
                <TableHead>Người rút</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Ngân hàng</TableHead>
                <TableHead>Số TK</TableHead>
                <TableHead>Chủ TK</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payouts.data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Không có yêu cầu nào
                  </TableCell>
                </TableRow>
              )}
              {(payouts.data || []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{dt(p.requested_at)}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-foreground">{nameOf(p.user_id)}</span>
                    {emails.data?.[p.user_id] && (
                      <span className="block text-[12px] text-muted-foreground">
                        {emails.data[p.user_id]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold">{vnd(p.amount_vnd)}</TableCell>
                  <TableCell>{p.bank_name || "—"}</TableCell>
                  <TableCell><CopyBtn value={p.bank_account} /></TableCell>
                  <TableCell><CopyBtn value={p.account_holder} /></TableCell>
                  <TableCell className="text-right">
                    {p.status === "requested" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => { setNote(""); setDialog({ payout: p, mode: "paid" }); }}>
                          Đã chuyển
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setNote(""); setDialog({ payout: p, mode: "rejected" }); }}
                        >
                          Từ chối
                        </Button>
                      </div>
                    ) : (
                      <StatusPill status={p.status} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* (c) Luồng hoa hồng */}
      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="font-heading font-bold text-foreground">Luồng hoa hồng</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Tìm theo tên"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[200px]"
            />
            <Select value={earnStatus} onValueChange={setEarnStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Đang chờ</SelectItem>
                <SelectItem value="available">Rút được</SelectItem>
                <SelectItem value="paid">Đã trả</SelectItem>
                <SelectItem value="reversed">Đã huỷ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Người giới thiệu</TableHead>
                <TableHead>Người mua</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead>Đơn (đ)</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Hoa hồng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Rút được từ</TableHead>
                <TableHead>Mã payout</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEarnings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    Chưa có hoa hồng nào
                  </TableCell>
                </TableRow>
              )}
              {filteredEarnings.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{dt(e.created_at)}</TableCell>
                  <TableCell>{nameOf(e.referrer_user_id)}</TableCell>
                  <TableCell>{nameOf(e.referred_user_id)}</TableCell>
                  <TableCell>{e.plan_key || "—"}</TableCell>
                  <TableCell>{vnd(e.order_amount_vnd)}</TableCell>
                  <TableCell>{e.commission_percent}%</TableCell>
                  <TableCell className="font-semibold">{vnd(e.commission_vnd)}</TableCell>
                  <TableCell><StatusPill status={e.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{dt(e.available_at)}</TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {e.payout_id ? e.payout_id.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(e.status === "pending" || e.status === "available") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm("Huỷ hoa hồng của dòng này?")) reverse.mutate(e.id);
                        }}
                      >
                        Huỷ hoa hồng
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* (d) Top người giới thiệu */}
      <section>
        <h3 className="font-heading font-bold text-foreground mb-3">Top người giới thiệu</h3>
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Số lượt</TableHead>
                <TableHead>Tổng hoa hồng</TableHead>
                <TableHead>% hiện tại</TableHead>
                <TableHead>Lần gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(o?.top || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Chưa có dữ liệu
                  </TableCell>
                </TableRow>
              )}
              {(o?.top || []).map((t) => (
                <TableRow key={t.user_id}>
                  <TableCell className="font-semibold text-foreground">{t.name}</TableCell>
                  <TableCell>{t.n}</TableCell>
                  <TableCell>{vnd(t.commission_vnd)}</TableCell>
                  <TableCell>{t.percent}%</TableCell>
                  <TableCell className="whitespace-nowrap">{dt(t.last_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Dialog xử lý yêu cầu rút */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "paid" ? "Xác nhận đã chuyển tiền" : "Từ chối yêu cầu rút"}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {nameOf(dialog.payout.user_id)} · {vnd(dialog.payout.amount_vnd)} ·{" "}
                {dialog.payout.bank_name || "—"} {dialog.payout.bank_account || ""}
              </p>
              <div>
                <Label htmlFor="ref-note">
                  {dialog.mode === "paid" ? "Ghi chú (không bắt buộc)" : "Lý do từ chối"}
                </Label>
                <Textarea
                  id="ref-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={dialog.mode === "paid" ? "Mã giao dịch, thời gian..." : "Nêu rõ lý do"}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Đóng</Button>
            <Button
              disabled={markPayout.isPending || (dialog?.mode === "rejected" && !note.trim())}
              onClick={() =>
                dialog &&
                markPayout.mutate({ id: dialog.payout.id, status: dialog.mode, note: note.trim() })
              }
            >
              {markPayout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialog?.mode === "paid" ? "Đã chuyển" : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
