import { useState, useEffect, useMemo, useCallback } from "react";
import { Shield, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, Loader2, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AutoCostTab from "@/components/admin/report/AutoCostTab";
import OutcomesTab from "@/components/admin/report/OutcomesTab";
import ActivityTab from "@/components/admin/report/ActivityTab";
import ContentQualityTab from "@/components/admin/report/ContentQualityTab";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type CostRecord = {
  id: string;
  month: string;
  category: string;
  label: string;
  amount: number;
  currency: string;
  note: string;
};

const CATEGORIES = ["Lovable Cloud", "Supabase", "Gemini API", "Khác"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  "Lovable Cloud": "#CC1C01",
  "Supabase": "#FEAD5F",
  "Gemini API": "#4D0D0D",
  "Khác": "#94a3b8",
};

const VN_MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

const monthKey = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

const AdminReport = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey(today));
  const [selectedYear, setSelectedYear] = useState<number>(today.getUTCFullYear());

  const [records, setRecords] = useState<CostRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostRecord | null>(null);
  const [form, setForm] = useState({
    month: monthKey(today),
    category: "Lovable Cloud",
    label: "",
    amount: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cost_records")
      .select("*")
      .order("month", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Lỗi tải dữ liệu", description: error.message, variant: "destructive" });
    } else {
      setRecords((data || []) as CostRecord[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user && isAdmin) loadRecords();
  }, [user, isAdmin, loadRecords]);

  // Available months for dropdown (all months that have records + current)
  const availableMonths = useMemo(() => {
    const set = new Set<string>([monthKey(today)]);
    records.forEach(r => set.add(monthKey(r.month)));
    return Array.from(set).sort().reverse();
  }, [records]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([today.getUTCFullYear()]);
    records.forEach(r => set.add(new Date(r.month).getUTCFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  const monthRecords = useMemo(
    () => records.filter(r => monthKey(r.month) === selectedMonth),
    [records, selectedMonth]
  );

  const monthTotal = useMemo(
    () => monthRecords.reduce((sum, r) => sum + Number(r.amount), 0),
    [monthRecords]
  );

  const prevMonthTotal = useMemo(() => {
    const d = new Date(selectedMonth);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const prevKey = monthKey(d);
    return records
      .filter(r => monthKey(r.month) === prevKey)
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }, [records, selectedMonth]);

  const diffPct = useMemo(() => {
    if (prevMonthTotal === 0) return monthTotal > 0 ? 100 : 0;
    return ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100;
  }, [monthTotal, prevMonthTotal]);

  // Yearly chart data
  const yearChartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${selectedYear}-${String(i + 1).padStart(2, "0")}-01`;
      const monthRecs = records.filter(r => monthKey(r.month) === m);
      const row: Record<string, string | number> = { month: VN_MONTHS[i] };
      CATEGORIES.forEach(cat => {
        row[cat] = monthRecs.filter(r => r.category === cat).reduce((s, r) => s + Number(r.amount), 0);
      });
      row.total = monthRecs.reduce((s, r) => s + Number(r.amount), 0);
      return row;
    });
  }, [records, selectedYear]);

  const openAdd = () => {
    setEditing(null);
    setForm({ month: selectedMonth, category: "Lovable Cloud", label: "", amount: "", note: "" });
    setDialogOpen(true);
  };

  const openEdit = (r: CostRecord) => {
    setEditing(r);
    setForm({
      month: monthKey(r.month),
      category: r.category,
      label: r.label,
      amount: String(r.amount),
      note: r.note,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const amountNum = Number(form.amount);
    if (!form.label.trim() || isNaN(amountNum) || amountNum < 0) {
      toast({ title: "Vui lòng điền đầy đủ thông tin hợp lệ", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      month: form.month,
      category: form.category,
      label: form.label.trim(),
      amount: amountNum,
      currency: "VND",
      note: form.note.trim(),
    };
    const { error } = editing
      ? await supabase.from("cost_records").update(payload).eq("id", editing.id)
      : await supabase.from("cost_records").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Lỗi lưu", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Đã cập nhật khoản chi" : "Đã thêm khoản chi" });
    setDialogOpen(false);
    loadRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("cost_records").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã xóa khoản chi" });
      loadRecords();
    }
    setDeleteId(null);
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {authLoading ? <p>Đang tải...</p> : null}
      </div>
    );
  }

  const monthLabel = (key: string) => {
    const d = new Date(key);
    return `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Admin Report</h1>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/report/pricing">
                <Settings className="w-4 h-4" />
                Quản lý đơn giá
              </Link>
            </Button>
          </div>

          <Tabs defaultValue="outcomes" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="outcomes">Học tập</TabsTrigger>
              <TabsTrigger value="activity">Người dùng</TabsTrigger>
              <TabsTrigger value="content">Nội dung</TabsTrigger>
              <TabsTrigger value="manual">Chi phí nhập tay</TabsTrigger>
              <TabsTrigger value="auto">Chi phí ước lượng (tự động)</TabsTrigger>
            </TabsList>

            <TabsContent value="outcomes" className="mt-0">
              <OutcomesTab />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityTab />
            </TabsContent>

            <TabsContent value="content" className="mt-0">
              <ContentQualityTab />
            </TabsContent>

            <TabsContent value="manual" className="space-y-8 mt-0">
          {/* PHẦN 1 — TỔNG QUAN THÁNG */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-heading font-bold text-foreground">Tổng quan tháng</h2>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map(m => (
                      <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={openAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                Thêm khoản chi
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tổng chi phí</p>
                <p className="text-3xl font-heading font-extrabold text-primary">{fmtVND(monthTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">{monthLabel(selectedMonth)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">So với tháng trước</p>
                <div className="flex items-center gap-2">
                  {diffPct > 0 ? (
                    <TrendingUp className="w-6 h-6 text-destructive" />
                  ) : diffPct < 0 ? (
                    <TrendingDown className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Minus className="w-6 h-6 text-muted-foreground" />
                  )}
                  <p className={`text-3xl font-heading font-extrabold ${
                    diffPct > 0 ? "text-destructive" : diffPct < 0 ? "text-emerald-600" : "text-muted-foreground"
                  }`}>
                    {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tháng trước: {fmtVND(prevMonthTotal)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    <TableHead className="text-right w-[100px]">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin inline" />
                    </TableCell></TableRow>
                  ) : monthRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Chưa có khoản chi nào trong tháng này
                    </TableCell></TableRow>
                  ) : monthRecords.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
                          style={{ backgroundColor: `${CATEGORY_COLORS[r.category] || "#94a3b8"}20`, color: CATEGORY_COLORS[r.category] || "#94a3b8" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[r.category] || "#94a3b8" }} />
                          {r.category}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtVND(Number(r.amount))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.note}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="h-8 w-8">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* PHẦN 2 — BIỂU ĐỒ NĂM */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-heading font-bold text-foreground">Biểu đồ chi phí theo năm</h2>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>Năm {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtVND(v)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {CATEGORIES.map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
            </TabsContent>

            <TabsContent value="auto" className="mt-0">
              <AutoCostTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khoản chi" : "Thêm khoản chi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tháng</Label>
              <Input
                type="month"
                value={form.month.slice(0, 7)}
                onChange={e => setForm({ ...form, month: `${e.target.value}-01` })}
              />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả khoản chi</Label>
              <Input
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="VD: Gói Pro tháng 5"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tiền (VND)</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="600000"
              />
            </div>
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Tùy chọn"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khoản chi?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default AdminReport;
