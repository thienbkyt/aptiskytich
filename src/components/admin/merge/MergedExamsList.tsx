import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Layers,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SkillFilter = "all" | "full_test" | "speaking" | "listening" | "reading" | "writing" | "grammar_vocab";

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  grammar_vocab: "Grammar & Vocab",
};

interface PartRow {
  id: string;
  title: string;
  part: string;
  skill: string;
  is_published: boolean;
  full_test_id: string;
  full_test_title: string | null;
  full_test_category: string | null;
}

interface MergedGroup {
  full_test_id: string;
  full_test_title: string;
  skills: Set<string>;
  parts: PartRow[];
}

const MergedExamsList = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PartRow[]>([]);
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<MergedGroup | null>(null);
  const [unlinkPart, setUnlinkPart] = useState<PartRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exam_sets")
      .select("id, title, part, skill, is_published, full_test_id, full_test_title, full_test_category")
      .not("full_test_id", "is", null)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Lỗi tải dữ liệu", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data || []) as PartRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo<MergedGroup[]>(() => {
    const filtered =
      skillFilter === "all"
        ? rows
        : skillFilter === "full_test"
          ? rows.filter((r) => r.full_test_category != null)
          : rows.filter((r) => r.skill === skillFilter && r.full_test_category == null);
    const map = new Map<string, MergedGroup>();
    for (const r of filtered) {
      if (!map.has(r.full_test_id)) {
        map.set(r.full_test_id, {
          full_test_id: r.full_test_id,
          full_test_title: r.full_test_title || "(Không tên)",
          skills: new Set(),
          parts: [],
        });
      }
      const g = map.get(r.full_test_id)!;
      g.skills.add(r.skill);
      g.parts.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.full_test_title.localeCompare(b.full_test_title, "vi"),
    );
  }, [rows, skillFilter]);

  const togglePublish = async (group: MergedGroup, publish: boolean) => {
    setBusyId(group.full_test_id);
    const ids = group.parts.map((p) => p.id);
    const { error } = await supabase
      .from("exam_sets")
      .update({ is_published: publish })
      .in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Cập nhật thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, is_published: publish } : r)),
    );
    toast({ title: publish ? "Đã xuất bản" : "Đã ẩn", description: `${ids.length} bộ đề` });
  };

  const togglePublishOne = async (part: PartRow) => {
    setBusyId(part.id);
    const next = !part.is_published;
    const { error } = await supabase
      .from("exam_sets")
      .update({ is_published: next })
      .eq("id", part.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Cập nhật thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === part.id ? { ...r, is_published: next } : r)));
  };

  const startEdit = (group: MergedGroup) => {
    setEditingId(group.full_test_id);
    setEditTitle(group.full_test_title);
  };

  const saveEdit = async (group: MergedGroup) => {
    const title = editTitle.trim();
    if (!title) {
      toast({ title: "Tên không được để trống", variant: "destructive" });
      return;
    }
    setBusyId(group.full_test_id);
    const ids = group.parts.map((p) => p.id);
    const { error } = await supabase
      .from("exam_sets")
      .update({ full_test_title: title })
      .in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, full_test_title: title } : r)),
    );
    setEditingId(null);
    toast({ title: "Đã đổi tên đề" });
  };

  const doUnlink = async () => {
    if (!unlinkPart) return;
    setBusyId(unlinkPart.id);
    const { error } = await supabase
      .from("exam_sets")
      .update({ full_test_id: null, full_test_title: null })
      .eq("id", unlinkPart.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Gỡ thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== unlinkPart.id));
    setUnlinkPart(null);
    toast({ title: "Đã gỡ bộ đề khỏi nhóm ghép" });
  };

  const doDeleteGroup = async () => {
    if (!deleteGroup) return;
    setBusyId(deleteGroup.full_test_id);
    const ids = deleteGroup.parts.map((p) => p.id);
    const { error } = await supabase
      .from("exam_sets")
      .update({ full_test_id: null, full_test_title: null })
      .in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Hủy ghép thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    setDeleteGroup(null);
    toast({ title: "Đã hủy ghép", description: `${ids.length} bộ đề được tách ra` });
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-bold text-foreground">Đề đã ghép</h3>
            <Badge variant="outline" className="text-xs">
              {groups.length} nhóm
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={skillFilter} onValueChange={(v) => setSkillFilter(v as SkillFilter)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả kỹ năng</SelectItem>
                <SelectItem value="full_test">Đề ghép Full Test</SelectItem>
                <SelectItem value="speaking">Speaking</SelectItem>
                <SelectItem value="listening">Listening</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="grammar_vocab">Grammar & Vocab</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tải lại
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Quản lý các nhóm đề đã ghép: xuất bản / ẩn, đổi tên, gỡ phần lẻ hoặc hủy ghép cả nhóm.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card">
          <p className="text-muted-foreground">Chưa có đề nào được ghép.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = !!expanded[g.full_test_id];
            const publishedCount = g.parts.filter((p) => p.is_published).length;
            const allPublished = publishedCount === g.parts.length;
            const nonePublished = publishedCount === 0;
            const isEditing = editingId === g.full_test_id;
            const isBusy = busyId === g.full_test_id;

            return (
              <div key={g.full_test_id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((s) => ({ ...s, [g.full_test_id]: !isOpen }))}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80"
                  >
                    <Layers className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-8 w-64"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" onClick={() => saveEdit(g)} disabled={isBusy}>
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-primary" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">{g.full_test_title}</h3>
                          <Badge
                            variant={allPublished ? "default" : nonePublished ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {allPublished
                              ? "Đã xuất bản"
                              : nonePublished
                                ? "Nháp"
                                : `${publishedCount}/${g.parts.length} xuất bản`}
                          </Badge>
                          {Array.from(g.skills)
                            .sort()
                            .map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {SKILL_LABELS[s] || s}
                              </Badge>
                            ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{g.parts.length} bộ đề</p>
                    </div>
                  </button>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={allPublished ? "Ẩn tất cả" : "Xuất bản tất cả"}
                        onClick={() => togglePublish(g, !allPublished)}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : allPublished ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" title="Đổi tên" onClick={() => startEdit(g)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Hủy ghép cả nhóm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteGroup(g)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpanded((s) => ({ ...s, [g.full_test_id]: !isOpen }))}
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">
                    {g.parts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {SKILL_LABELS[p.skill] || p.skill}
                          </Badge>
                          <span className="text-xs text-muted-foreground shrink-0">{p.part}</span>
                          <span className="text-sm text-foreground truncate">{p.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={p.is_published ? "default" : "secondary"} className="text-xs">
                            {p.is_published ? "✓ Xuất bản" : "Nháp"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={p.is_published ? "Ẩn" : "Xuất bản"}
                            onClick={() => togglePublishOne(p)}
                            disabled={busyId === p.id}
                          >
                            {busyId === p.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : p.is_published ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gỡ khỏi nhóm ghép"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setUnlinkPart(p)}
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteGroup} onOpenChange={(o) => !o && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy ghép cả nhóm?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroup?.parts.length} bộ đề trong nhóm "<b>{deleteGroup?.full_test_title}</b>" sẽ được tách ra
              (xóa <code>full_test_id</code>). Các bộ đề gốc và câu hỏi <b>không bị xóa</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hủy ghép
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unlinkPart} onOpenChange={(o) => !o && setUnlinkPart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ bộ đề khỏi nhóm?</AlertDialogTitle>
            <AlertDialogDescription>
              "<b>{unlinkPart?.title}</b>" sẽ được tách ra khỏi nhóm ghép. Bộ đề và câu hỏi <b>không bị xóa</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={doUnlink}>Gỡ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MergedExamsList;
