import { useState, useEffect, useMemo } from "react";
import { Plus, BookOpen, Trash2, Eye, EyeOff, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExamType, Skill, SKILL_LABELS, ExamSetRow } from "./types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

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

  if (loading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-bold text-foreground">
          {SKILL_LABELS[skill]} — {examType === "general" ? "General" : "Advanced"}
        </h2>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="w-4 h-4" /> Thêm đề thi mới
        </Button>
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
                </div>
                <p className="text-xs text-muted-foreground">
                  {set.part} · {set.time_limit} phút · {new Date(set.created_at).toLocaleDateString("vi-VN")}
                  {(set as any).full_test_title && <span className="ml-1">· 📦 {(set as any).full_test_title}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3">
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
    </div>
  );
};

export default ExamSetList;
