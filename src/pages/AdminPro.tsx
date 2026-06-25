import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Crown, Loader2, Search, Save, Trash2, AlertTriangle, Calendar as CalendarIcon, Sparkles,
} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { parseDateSafe, toTimeSafe } from "@/lib/safeDate";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type AppSettings = {
  id: number;
  promo_free_all: boolean;
  promo_label: string | null;
  promo_from: string | null;
  promo_until: string | null;
};

type FeatureFlag = {
  key: string;
  label: string | null;
  required_tier: "free" | "pro" | "premium";
  free_quota: number | null;
  pro_quota: number | null;
  quota_period: "day" | "month" | null;
  enabled: boolean;
  note: string | null;
  sort_order: number | null;
};

type Subscription = {
  user_id: string;
  tier: "free" | "pro" | "premium";
  pro_until: string | null;
  updated_at: string;
};

type Student = {
  user_id: string;
  email: string;
  display_name: string | null;
};

type GrantTier = "pro" | "premium";
type GrantDuration = "lifetime" | "1d" | "7d" | "30d" | "custom";

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
const AdminPro = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {authLoading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-6xl space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-extrabold text-foreground">
                Quản lý Pro
              </h1>
              <p className="text-sm text-muted-foreground">
                Công tắc Free toàn web · Cấu hình tính năng · Cấp / gỡ Pro thủ công
              </p>
            </div>
          </div>

          <PromoSection />
          <FeatureFlagsSection />
          <PricingPlansSection />
          <ProUsersSection />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminPro;

// ─────────────────────────────────────────────────────────────
// 1. Promo / Mở Free toàn bộ
// ─────────────────────────────────────────────────────────────
const PromoSection = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error("Không tải được cấu hình");
      setSettings((data as any) ?? {
        id: 1, promo_free_all: false, promo_label: null, promo_from: null, promo_until: null,
      });
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSettings((s) => (s ? { ...s, [k]: v } : s));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        promo_free_all: settings.promo_free_all,
        promo_label: settings.promo_label,
        promo_from: settings.promo_from,
        promo_until: settings.promo_until,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error("Lưu thất bại: " + error.message);
    else toast.success("Đã lưu cấu hình khuyến mãi");
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle>Mở Free toàn bộ</CardTitle>
        </div>
        <CardDescription>
          Bật để mọi user trở thành Pro tạm thời (đợt sale / cho dùng thử). Tắt để quay lại bình thường.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading || !settings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  settings.promo_free_all ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {settings.promo_free_all ? "ĐANG mở Free toàn bộ" : "Đang ở chế độ bình thường"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {settings.promo_free_all
                      ? "Mọi user trên web đều thành Pro."
                      : "Chỉ user có gói Pro hoặc trong khoảng thời gian Pro mới có quyền Pro."}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.promo_free_all}
                onCheckedChange={(v) => update("promo_free_all", v)}
              />
            </div>

            {settings.promo_free_all && (
              <div className="rounded-lg border border-[#FEAD5F]/50 bg-[#FEAD5F]/10 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#CC1C01] shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  <b>Cảnh báo:</b> ĐANG mở Free toàn bộ — mọi user thành Pro. Nhớ tắt khi kết thúc đợt khuyến mãi.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label htmlFor="promo_label">Nhãn hiển thị (tuỳ chọn)</Label>
                <Input
                  id="promo_label"
                  placeholder="VD: Black Friday 2026"
                  value={settings.promo_label ?? ""}
                  onChange={(e) => update("promo_label", e.target.value || null)}
                />
              </div>
              <DatePickerField
                label="Bắt đầu (tuỳ chọn)"
                value={settings.promo_from}
                onChange={(v) => update("promo_from", v)}
              />
              <DatePickerField
                label="Kết thúc (tuỳ chọn)"
                value={settings.promo_until}
                onChange={(v) => update("promo_until", v)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu cấu hình
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const DatePickerField = ({
  label, value, onChange,
}: { label: string; value: string | null; onChange: (v: string | null) => void }) => {
  const dateVal = value ? new Date(value) : undefined;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !dateVal && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 w-4 h-4" />
              {dateVal ? format(dateVal, "dd/MM/yyyy") : <span>Chọn ngày</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateVal}
              onSelect={(d) => onChange(d ? d.toISOString() : null)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {value && (
          <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Xoá ngày">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// 2. Feature flags
// ─────────────────────────────────────────────────────────────
const FeatureFlagsSection = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) toast.error("Không tải được feature flags");
      setFlags((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const updateRow = (key: string, patch: Partial<FeatureFlag>) => {
    setFlags((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty((d) => new Set(d).add(key));
  };

  const saveRow = async (key: string) => {
    const row = flags.find((r) => r.key === key);
    if (!row) return;
    setSavingKey(key);
    const { error } = await supabase
      .from("feature_flags")
      .update({
        required_tier: row.required_tier,
        free_quota: row.free_quota,
        pro_quota: row.pro_quota,
        quota_period: row.quota_period,
        enabled: row.enabled,
      } as any)
      .eq("key", key);
    setSavingKey(null);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    setDirty((d) => {
      const next = new Set(d);
      next.delete(key);
      return next;
    });
    toast.success(`Đã lưu "${row.label || row.key}"`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình tính năng</CardTitle>
        <CardDescription>
          Đổi tier yêu cầu, hạn mức Free/Pro và bật/tắt từng tính năng. Premium = không giới hạn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tính năng</TableHead>
                  <TableHead className="w-[130px]">Tier</TableHead>
                  <TableHead className="w-[90px]">Free</TableHead>
                  <TableHead className="w-[90px]">Pro</TableHead>
                  <TableHead className="w-[130px]">Chu kỳ</TableHead>
                  <TableHead className="w-[80px] text-center">Bật</TableHead>
                  <TableHead className="w-[100px] text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((f) => {
                  const isDirty = dirty.has(f.key);
                  return (
                    <TableRow key={f.key} className={cn(isDirty && "bg-[#FEAD5F]/5")}>
                      <TableCell>
                        <div className="font-medium text-foreground">{f.label || f.key}</div>
                        <div className="text-xs text-muted-foreground font-mono">{f.key}</div>
                        {f.note && (
                          <div className="text-xs text-muted-foreground mt-1 italic">{f.note}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={f.required_tier}
                          onValueChange={(v) => updateRow(f.key, { required_tier: v as FeatureFlag["required_tier"] })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-9"
                          value={f.free_quota ?? ""}
                          onChange={(e) => updateRow(f.key, {
                            free_quota: e.target.value === "" ? null : Number(e.target.value),
                          })}
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          className="h-9"
                          value={f.pro_quota ?? ""}
                          onChange={(e) => updateRow(f.key, {
                            pro_quota: e.target.value === "" ? null : Number(e.target.value),
                          })}
                          placeholder="∞"
                          title="Để trống = Pro không giới hạn"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={f.quota_period ?? "none"}
                          onValueChange={(v) => updateRow(f.key, {
                            quota_period: v === "none" ? null : (v as "day" | "month"),
                          })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Không</SelectItem>
                            <SelectItem value="day">Ngày</SelectItem>
                            <SelectItem value="month">Tháng</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={(v) => updateRow(f.key, { enabled: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isDirty ? "default" : "outline"}
                          disabled={!isDirty || savingKey === f.key}
                          onClick={() => saveRow(f.key)}
                          className="gap-1.5"
                        >
                          {savingKey === f.key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Lưu
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
// 3. Pro users (grant / revoke)
// ─────────────────────────────────────────────────────────────
const ProUsersSection = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [grantTier, setGrantTier] = useState<GrantTier>("pro");
  const [duration, setDuration] = useState<GrantDuration>("30d");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [granting, setGranting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Subscription | null>(null);
  const [revoking, setRevoking] = useState(false);

  const reloadSubs = async () => {
    setSubsLoading(true);
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .in("tier", ["pro", "premium"])
      .order("updated_at", { ascending: false });
    if (error) toast.error("Không tải được danh sách Pro");
    setSubs((data as any) ?? []);
    setSubsLoading(false);
  };

  useEffect(() => {
    (async () => {
      setStudentsLoading(true);
      const { data, error } = await supabase.functions.invoke("list-students");
      if (error) toast.error("Không tải được danh sách user");
      setStudents(((data as any)?.students ?? []).map((s: any) => ({
        user_id: s.user_id, email: s.email, display_name: s.display_name,
      })));
      setStudentsLoading(false);
    })();
    reloadSubs();
  }, []);

  const emailById = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => m.set(s.user_id, s));
    return m;
  }, [students]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Student[];
    return students
      .filter((s) =>
        s.email.toLowerCase().includes(q) ||
        (s.display_name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, students]);

  const computePromoUntil = (): string | null => {
    const now = new Date();
    switch (duration) {
      case "lifetime": return null;
      case "1d":
        return new Date(now.getTime() + 1 * 24 * 3600 * 1000).toISOString();
      case "7d":
        return new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      case "30d":
        return new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
      case "custom":
        return customDate ? customDate.toISOString() : null;
    }
  };

  const handleGrant = async () => {
    if (!selected) return;
    if (duration === "custom" && !customDate) {
      toast.error("Chọn ngày tuỳ chọn");
      return;
    }
    setGranting(true);
    const proUntil = computePromoUntil();
    const { error } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: selected.user_id,
        tier: grantTier,
        pro_until: proUntil,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    setGranting(false);
    if (error) {
      toast.error("Cấp gói thất bại: " + error.message);
      return;
    }
    toast.success(`Đã cấp ${grantTier === "premium" ? "Premium" : "Pro"} cho ${selected.email}`);
    setSelected(null);
    setSearch("");
    setCustomDate(undefined);
    reloadSubs();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase
      .from("user_subscriptions")
      .update({ tier: "free", pro_until: null } as any)
      .eq("user_id", revokeTarget.user_id);
    setRevoking(false);
    if (error) {
      toast.error("Gỡ gói thất bại: " + error.message);
      return;
    }
    toast.success("Đã gỡ gói");
    setRevokeTarget(null);
    reloadSubs();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấp / gỡ gói thủ công</CardTitle>
        <CardDescription>
          Tìm user theo email, chọn tier (Pro / Premium) và thời hạn. Bảng dưới hiển thị các user đang trả phí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grant form */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_140px_1fr_auto]">
            <div className="space-y-1.5 relative">
              <Label>Tìm user theo email / tên</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={studentsLoading ? "Đang tải danh sách user..." : "VD: nguyen@gmail.com"}
                  value={selected ? selected.email : search}
                  onChange={(e) => { setSelected(null); setSearch(e.target.value); }}
                  className="pl-9"
                  disabled={studentsLoading}
                />
              </div>
              {!selected && matches.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-72 overflow-auto">
                  {matches.map((s) => (
                    <button
                      key={s.user_id}
                      onClick={() => { setSelected(s); setSearch(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <div className="text-sm font-medium">{s.display_name || s.email.split("@")[0]}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select
                value={grantTier}
                onValueChange={(v) => {
                  const t = v as GrantTier;
                  setGrantTier(t);
                  setDuration(t === "premium" ? "lifetime" : "30d");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Thời hạn</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as GrantDuration)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {grantTier === "pro" ? (
                    <>
                      <SelectItem value="1d">1 ngày (+1)</SelectItem>
                      <SelectItem value="7d">1 tuần (+7)</SelectItem>
                      <SelectItem value="30d">1 tháng (+30)</SelectItem>
                      <SelectItem value="custom">Tuỳ chọn ngày</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="lifetime">Trọn đời</SelectItem>
                      <SelectItem value="custom">Tuỳ chọn ngày</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="opacity-0 hidden md:block">.</Label>
              <Button
                onClick={handleGrant}
                disabled={!selected || granting || (duration === "custom" && !customDate)}
                className={cn("gap-2 md:mt-0", grantTier === "premium" && "bg-[#FEAD5F] text-[#4D0D0D] hover:bg-[#FEAD5F]/90")}
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                Cấp {grantTier === "premium" ? "Premium" : "Pro"}
              </Button>
            </div>
          </div>

          {duration === "custom" && (
            <div className="md:max-w-xs">
              <Label>Ngày hết hạn</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full mt-1.5 justify-start text-left font-normal",
                      !customDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 w-4 h-4" />
                    {customDate ? format(customDate, "dd/MM/yyyy") : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {selected && (
            <div className="text-xs text-muted-foreground">
              Đã chọn: <b className="text-foreground">{selected.email}</b>
              <button
                onClick={() => { setSelected(null); setSearch(""); }}
                className="ml-2 text-primary hover:underline"
              >
                đổi
              </button>
            </div>
          )}
        </div>

        {/* Active pro list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Đang trả phí</h3>
            <Badge variant="secondary" className="text-xs">
              {subsLoading ? "..." : `${subs.length} user`}
            </Badge>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="w-[110px]">Tier</TableHead>
                  <TableHead className="w-[200px]">Hạn</TableHead>
                  <TableHead className="w-[180px]">Cập nhật</TableHead>
                  <TableHead className="w-[110px] text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Đang tải...
                    </TableCell>
                  </TableRow>
                ) : subs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                      Chưa có user nào trả phí.
                    </TableCell>
                  </TableRow>
                ) : (
                  subs.map((s) => {
                    const stu = emailById.get(s.user_id);
                    const expired = s.pro_until && toTimeSafe(s.pro_until) < Date.now();
                    const isPremium = s.tier === "premium";
                    return (
                      <TableRow key={s.user_id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {stu?.display_name || stu?.email?.split("@")[0] || "(không rõ)"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stu?.email || s.user_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "border-0 font-semibold",
                              isPremium
                                ? "bg-[#FEAD5F]/20 text-[#4D0D0D] hover:bg-[#FEAD5F]/30"
                                : "bg-primary/15 text-primary hover:bg-primary/20",
                            )}
                          >
                            {isPremium ? "Premium" : "Pro"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.pro_until ? (
                            <span className={cn(
                              "text-sm",
                              expired ? "text-destructive" : "text-foreground",
                            )}>
                              {format(parseDateSafe(s.pro_until) ?? new Date(0), "dd/MM/yyyy HH:mm")}
                              {expired && " (đã hết)"}
                            </span>
                          ) : (
                            <Badge className="bg-[#FEAD5F]/20 text-[#4D0D0D] hover:bg-[#FEAD5F]/30 border-0">
                              Trọn đời
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(parseDateSafe(s.updated_at) ?? new Date(0), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setRevokeTarget(s)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Gỡ
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gỡ gói?</AlertDialogTitle>
              <AlertDialogDescription>
                User sẽ trở về Free ngay lập tức.
                {revokeTarget && (
                  <>
                    <br />
                    <b className="text-foreground">
                      {emailById.get(revokeTarget.user_id)?.email || revokeTarget.user_id}
                    </b>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Gỡ gói
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────
// 4. Pricing plans
// ─────────────────────────────────────────────────────────────
type PricingPlan = {
  key: string;
  label: string;
  duration_days: number | null;
  price_vnd: number;
  active: boolean;
  highlight: boolean;
  sort_order: number;
  note: string | null;
  tier: "pro" | "premium" | null;
};

const PricingPlansSection = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("pricing_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) toast.error("Không tải được bảng giá");
      setPlans((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const updateRow = (key: string, patch: Partial<PricingPlan>) => {
    setPlans((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty((d) => new Set(d).add(key));
  };

  const saveRow = async (key: string) => {
    const row = plans.find((r) => r.key === key);
    if (!row) return;
    setSavingKey(key);
    const { error } = await (supabase as any)
      .from("pricing_plans")
      .update({
        label: row.label,
        price_vnd: row.price_vnd,
        active: row.active,
        highlight: row.highlight,
        tier: row.tier,
      })
      .eq("key", key);
    setSavingKey(null);
    if (error) { toast.error("Lưu thất bại: " + error.message); return; }
    setDirty((d) => { const next = new Set(d); next.delete(key); return next; });
    toast.success(`Đã lưu gói "${row.label}"`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gói & giá</CardTitle>
        <CardDescription>
          Sửa giá, bật/tắt gói, đánh dấu gói nổi bật. Trang /pricing sẽ cập nhật ngay.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gói</TableHead>
                  <TableHead className="w-[120px]">Tier</TableHead>
                  <TableHead className="w-[110px]">Thời hạn</TableHead>
                  <TableHead className="w-[160px]">Giá (VND)</TableHead>
                  <TableHead className="w-[100px] text-center">Nổi bật</TableHead>
                  <TableHead className="w-[90px] text-center">Bật</TableHead>
                  <TableHead className="w-[110px] text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => {
                  const isDirty = dirty.has(p.key);
                  return (
                    <TableRow key={p.key} className={cn(isDirty && "bg-[#FEAD5F]/5")}>
                      <TableCell>
                        <Input
                          className="h-9"
                          value={p.label}
                          onChange={(e) => updateRow(p.key, { label: e.target.value })}
                        />
                        <div className="text-xs text-muted-foreground font-mono mt-1">{p.key}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.tier ?? "pro"}
                          onValueChange={(v) => updateRow(p.key, { tier: v as "pro" | "premium" })}
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.duration_days == null ? "Trọn đời" : `${p.duration_days} ngày`}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          className="h-9"
                          value={p.price_vnd}
                          onChange={(e) => updateRow(p.key, { price_vnd: Number(e.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.highlight}
                          onCheckedChange={(v) => updateRow(p.key, { highlight: v })}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.active}
                          onCheckedChange={(v) => updateRow(p.key, { active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isDirty ? "default" : "outline"}
                          disabled={!isDirty || savingKey === p.key}
                          onClick={() => saveRow(p.key)}
                          className="gap-1.5"
                        >
                          {savingKey === p.key
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Save className="w-3.5 h-3.5" />}
                          Lưu
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

