import { useState, useEffect, useMemo } from "react";
import { Plus, BookOpen, Trash2, Eye, EyeOff, Pencil, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExamType, Skill, SKILL_LABELS, ExamSetRow } from "./types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { parseDateSafe } from "@/lib/safeDate";
import { NEW_TAG_DAYS, isNewSet } from "@/hooks/useExamSets";

type AccessTier = "free" | "pro" | "premium";

const TIER_LABEL: Record<AccessTier, string> = {
  free: "FREE",
  pro: "PRO",
  premium: "PREMIUM",
};

const TIER_BADGE_CLASS: Record<AccessTier, string> = {
  free: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pro: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  premium: "bg-[#FEAD5F]/25 text-[#4D0D0D] dark:text-[#FEAD5F]",
};

interface Props {
  examType: ExamType;
  skill: Skill;
  onSelect: (set: ExamSetRow) => void;
  onCreateNew: () => void;
  refreshKey: number;
}

const ExamSetList = ({ examType, skill, onSelect, onCreateNew, refreshKey }: Props) => {
  const [sets, setSets] = useState<ExamSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    const { error } = await supabase
      .from("exam_sets")
      .delete()
      .eq("exam_type", examType)
      .eq("skill", skill);
    if (error) {
      toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Đã xóa ${sets.length} đề thi` });
      setSets([]);
    }
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("exam_sets")
        .select("*")
        .eq("exam_type", examType)
        .eq("skill", skill)
        .order("created_at", { ascending: false });
      if (!error && data) setSets(data as unknown as ExamSetRow[]);
      setLoading(false);
    };
    load();
  }, [examType, skill, refreshKey]);

  const filteredSets = useMemo(() => {
    if (!searchQuery.trim()) return sets;
    const q = searchQuery.toLowerCase();
    return sets.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.part.toLowerCase().includes(q) ||
      ((s as any).full_test_title || "").toLowerCase().includes(q)
    );
  }, [sets, searchQuery]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("exam_sets").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Lỗi xóa đề", description: error.message, variant: "destructive" });
    } else {
      setSets((s) => s.filter((x) => x.id !== deleteId));
      toast({ title: "Đã xóa đề thi" });
    }
    setDeleteId(null);
  };

  const togglePublish = async (set: ExamSetRow) => {
    const { error } = await supabase.from("exam_sets").update({ is_published: !set.is_published }).eq("id", set.id);
    if (!error) setSets((s) => s.map((x) => x.id === set.id ? { ...x, is_published: !x.is_published } : x));
  };

  const toggleNewTag = async (set: ExamSetRow) => {
    const hasTag = isNewSet(set as any);
    const next = hasTag ? null : new Date(Date.now() + NEW_TAG_DAYS * 86400000).toISOString();
    const { error } = await supabase.from("exam_sets").update({ new_until: next } as any).eq("id", set.id);
    if (error) {
      toast({ title: "Lỗi cập nhật", description: error.message, variant: "destructive" });
      return;
    }
    setSets((s) => s.map((x) => x.id === set.id ? ({ ...x, new_until: next } as any) : x));
    toast({ title: hasTag ? "Đã bỏ nhãn MỚI" : "Đã gắn nhãn MỚI" });
  };

  const handleClearAllNew = async () => {
    const tagged = sets.filter((s) => isNewSet(s as any));
    if (tagged.length === 0) return;
    const ids = tagged.map((s) => s.id);
    const { error } = await supabase.from("exam_sets").update({ new_until: null } as any).in("id", ids);
    if (error) {
      toast({ title: "Lỗi cập nhật", description: error.message, variant: "destructive" });
      return;
    }
    setSets((s) => s.map((x) => ids.includes(x.id) ? ({ ...x, new_until: null } as any) : x));
    toast({ title: `Đã bỏ nhãn MỚI cho ${tagged.length} đề` });
  };

  const setAccessTier = async (set: ExamSetRow, next: AccessTier) => {
    const current = ((set as any).access_tier ?? "pro") as AccessTier;
    if (current === next) return;
    const { error } = await supabase.from("exam_sets").update({ access_tier: next } as any).eq("id", set.id);
    if (error) {
      toast({ title: "Lỗi cập nhật", description: error.message, variant: "destructive" });
      return;
    }
    setSets((s) => s.map((x) => x.id === set.id ? ({ ...x, access_tier: next } as any) : x));
    toast({ title: `Đề chuyển sang ${TIER_LABEL[next]}` });
  };

  const handlePublishAll = async () => {
    const drafts = sets.filter((s) => !s.is_published);
    if (drafts.length === 0) return;
    const { data, error } = await supabase
      .from("exam_sets")
      .update({ is_published: true })
      .eq("skill", skill)
      .eq("exam_type", examType)
      .eq("is_published", false)
      .select();
    if (error) {
      toast({ title: "Lỗi xuất bản", description: error.message, variant: "destructive" });
      return;
    }
    const updatedCount = data?.length ?? 0;
    const updatedIds = new Set((data ?? []).map((d: any) => d.id));
    setSets((s) => s.map((x) => updatedIds.has(x.id) ? { ...x, is_published: true } : x));
    toast({ title: `✓ Đã xuất bản ${updatedCount} đề` });
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-bold text-foreground">
          {SKILL_LABELS[skill]} — {examType === "general" ? "General" : "Advanced"}
        </h2>
        <div className="flex items-center gap-2">
          {sets.some((s) => !s.is_published) && (
            <Button variant="outline" onClick={handlePublishAll} className="gap-2">
              <Eye className="w-4 h-4" /> Xuất bản tất cả
            </Button>
          )}
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="w-4 h-4" /> Thêm đề thi mới
          </Button>
          {sets.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={deletingAll}
              className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" /> Xóa toàn bộ
            </Button>
          )}
        </div>
      </div>

      {sets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm đề thi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {filteredSets.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {sets.length === 0 ? "Chưa có đề thi nào" : "Không tìm thấy đề thi phù hợp"}
          </p>
          {sets.length === 0 && (
            <Button onClick={onCreateNew} variant="outline" className="mt-3 gap-2">
              <Plus className="w-4 h-4" /> Tạo đề đầu tiên
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSets.map((set) => (
            <div
              key={set.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelect(set)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">{set.title}</h3>
                  {(set as any).full_test_id && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                      Full Test
                    </Badge>
                  )}
                  <Badge variant={set.is_published ? "default" : "secondary"} className="text-xs">
                    {set.is_published ? "Đã xuất bản" : "Nháp"}
                  </Badge>
                  {(() => {
                    const t = (((set as any).access_tier ?? "pro") as AccessTier);
                    return (
                      <Badge variant="secondary" className={`text-[10px] font-semibold border-0 ${TIER_BADGE_CLASS[t]}`}>
                        {TIER_LABEL[t]}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {set.part} · {set.time_limit} phút · {(parseDateSafe(set.created_at) ?? new Date(0)).toLocaleDateString("vi-VN")}
                  {(set as any).full_test_title && <span className="ml-1">· 📦 {(set as any).full_test_title}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={(((set as any).access_tier ?? "pro") as AccessTier)}
                  onValueChange={(v) => setAccessTier(set, v as AccessTier)}
                >
                  <SelectTrigger className="h-8 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon"
                  onClick={(e) => { e.stopPropagation(); togglePublish(set); }}
                  title={set.is_published ? "Ẩn" : "Xuất bản"}
                >
                  {set.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSelect(set); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(set.id); }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đề thi?</AlertDialogTitle>
            <AlertDialogDescription>Tất cả câu hỏi trong đề sẽ bị xóa. Không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ {sets.length} đề thi?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ đề thi {SKILL_LABELS[skill]} — {examType === "general" ? "General" : "Advanced"} cùng với câu hỏi sẽ bị xóa vĩnh viễn. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground">
              Xóa tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamSetList;
