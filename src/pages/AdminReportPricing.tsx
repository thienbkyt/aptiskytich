import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type PricingRow = {
  id: string;
  service: string;
  model: string | null;
  unit_type: string;
  price_per_unit: number;
  unit_scale: number;
  usd_to_vnd_rate: number;
  is_active: boolean;
  effective_from: string;
  description: string;
};

const SERVICES = ["lovable_ai", "gemini_direct", "google_tts", "supabase_storage", "supabase_db", "edge_function"];

const emptyForm: Omit<PricingRow, "id"> = {
  service: "lovable_ai",
  model: "",
  unit_type: "input_token",
  price_per_unit: 0,
  unit_scale: 1_000_000,
  usd_to_vnd_rate: 25500,
  is_active: true,
  effective_from: new Date().toISOString().slice(0, 10),
  description: "",
};

export default function AdminReportPricing() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_config")
      .select("*")
      .order("service")
      .order("model");
    if (error) toast({ title: "Lỗi tải dữ liệu", description: error.message, variant: "destructive" });
    else setRows((data || []) as PricingRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user && isAdmin) load();
  }, [user, isAdmin, load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (r: PricingRow) => {
    setEditing(r);
    setForm({
      service: r.service,
      model: r.model || "",
      unit_type: r.unit_type,
      price_per_unit: Number(r.price_per_unit),
      unit_scale: Number(r.unit_scale),
      usd_to_vnd_rate: Number(r.usd_to_vnd_rate),
      is_active: r.is_active,
      effective_from: r.effective_from,
      description: r.description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      model: form.model.trim() || null,
      price_per_unit: Number(form.price_per_unit),
      unit_scale: Number(form.unit_scale) || 1,
      usd_to_vnd_rate: Number(form.usd_to_vnd_rate),
    };
    const { error } = editing
      ? await supabase.from("pricing_config").update(payload).eq("id", editing.id)
      : await supabase.from("pricing_config").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Lỗi lưu", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Đã cập nhật đơn giá" : "Đã thêm đơn giá" });
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("pricing_config").delete().eq("id", deleteId);
    if (error) toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
    else { toast({ title: "Đã xóa đơn giá" }); load(); }
    setDeleteId(null);
  };

  const toggleActive = async (r: PricingRow) => {
    const { error } = await supabase
      .from("pricing_config")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else load();
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {authLoading ? <p>Đang tải...</p> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/report"><ArrowLeft className="w-4 h-4 mr-1" /> Quay lại</Link>
              </Button>
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Quản lý đơn giá</h1>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Thêm đơn giá
            </Button>
          </div>

          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Quản lý đơn giá dùng để ước lượng chi phí tự động (Gemini, TTS, Storage, DB, Edge Functions).
              Hệ thống chọn dòng có <code>is_active = true</code> theo service + model.
            </p>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Unit type</TableHead>
                    <TableHead className="text-right">Giá (USD)</TableHead>
                    <TableHead className="text-right">Per</TableHead>
                    <TableHead className="text-right">USD→VND</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right w-[100px]">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin inline" />
                    </TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Chưa có đơn giá nào
                    </TableCell></TableRow>
                  ) : rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.service}</TableCell>
                      <TableCell className="font-mono text-xs">{r.model || "—"}</TableCell>
                      <TableCell className="text-xs">{r.unit_type}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.price_per_unit).toFixed(6)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Number(r.unit_scale).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{Number(r.usd_to_vnd_rate).toLocaleString()}</TableCell>
                      <TableCell>
                        <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      </TableCell>
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
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa đơn giá" : "Thêm đơn giá"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={form.service} onValueChange={v => setForm({ ...form, service: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model (tùy chọn)</Label>
                <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="google/gemini-2.5-flash" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unit type</Label>
                <Input value={form.unit_type} onChange={e => setForm({ ...form, unit_type: e.target.value })} placeholder="input_token / output_token / character / gb_month / invocation" />
              </div>
              <div className="space-y-2">
                <Label>Per (unit_scale)</Label>
                <Input type="number" value={form.unit_scale} onChange={e => setForm({ ...form, unit_scale: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Giá (USD per scale)</Label>
                <Input type="number" step="0.000001" value={form.price_per_unit} onChange={e => setForm({ ...form, price_per_unit: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>USD → VND</Label>
                <Input type="number" value={form.usd_to_vnd_rate} onChange={e => setForm({ ...form, usd_to_vnd_rate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective from</Label>
                <Input type="date" value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Active</Label>
                <div className="flex items-center h-10">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><X className="w-4 h-4 mr-1" />Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đơn giá?</AlertDialogTitle>
            <AlertDialogDescription>Hành động không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
