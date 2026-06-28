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

type AccessTier = "free" | "pro" | "premium";

interface PartRow {
  id: string;
  title: string;
  part: string;
  skill: string;
  is_published: boolean;
  full_test_id: string;
  full_test_title: string | null;
  access_tier?: AccessTier;
}

interface MergedGroup {
  kind: "full_part" | "full_test";
  groupId: string; // full_tests.id OR full_test_id (full part)
  title: string;
  category?: string | null;
  is_published?: boolean;
  skills: Set<string>;
  parts: PartRow[];
}

const MergedExamsList = () => {
  const [loading, setLoading] = useState(false);
  const [fullPartRows, setFullPartRows] = useState<PartRow[]>([]);
  const [fullTestGroups, setFullTestGroups] = useState<MergedGroup[]>([]);
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<MergedGroup | null>(null);
  const [unlinkPart, setUnlinkPart] = useState<{ part: PartRow; group: MergedGroup } | null>(null);

  const load = async () => {
    setLoading(true);

    // 1) Full Part groups → exam_sets with full_test_id but category IS NULL
    const { data: fpData, error: fpErr } = await supabase
      .from("exam_sets")
      .select("id, title, part, skill, is_published, full_test_id, full_test_title, access_tier")
      .not("full_test_id", "is", null)
      .is("full_test_category", null)
      .order("created_at", { ascending: true });

    if (fpErr) {
      toast({ title: "Lỗi tải Full Part", description: fpErr.message, variant: "destructive" });
      setFullPartRows([]);
    } else {
      setFullPartRows((fpData || []) as PartRow[]);
    }

    // 2) Full Test groups → full_tests + members
    const { data: ftRows } = await supabase
      .from("full_tests")
      .select("id, title, category, is_published, created_at")
      .order("created_at", { ascending: true });

    if (ftRows && ftRows.length > 0) {
      const ftIds = ftRows.map((r) => r.id);
      const { data: members } = await supabase
        .from("full_test_members")
        .select("full_test_id, exam_set_id, position")
        .in("full_test_id", ftIds);

      const memberSetIds = Array.from(new Set((members || []).map((m) => m.exam_set_id)));
      const { data: sets } = memberSetIds.length
        ? await supabase
            .from("exam_sets")
            .select("id, title, part, skill, is_published, access_tier")
            .in("id", memberSetIds)
        : { data: [] as any[] };

      const setById = new Map<string, any>();
      for (const s of sets || []) setById.set(s.id, s);

      const groups: MergedGroup[] = ftRows.map((ft) => {
        const mine = (members || []).filter((m) => m.full_test_id === ft.id);
        const parts: PartRow[] = mine
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((m) => {
            const s = setById.get(m.exam_set_id);
            if (!s) return null;
            return {
              id: s.id,
              title: s.title,
              part: s.part,
              skill: s.skill,
              is_published: s.is_published,
              full_test_id: ft.id,
              full_test_title: ft.title,
              access_tier: (s.access_tier as AccessTier) || "pro",
            } as PartRow;
          })
          .filter(Boolean) as PartRow[];
        return {
          kind: "full_test",
          groupId: ft.id,
          title: ft.title,
          category: ft.category,
          is_published: ft.is_published,
          skills: new Set(parts.map((p) => p.skill)),
          parts,
        };
      });
      setFullTestGroups(groups);
    } else {
      setFullTestGroups([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo<MergedGroup[]>(() => {
    if (skillFilter === "full_test") {
      return [...fullTestGroups].sort((a, b) => a.title.localeCompare(b.title, "vi"));
    }
    const filtered =
      skillFilter === "all"
        ? fullPartRows
        : fullPartRows.filter((r) => r.skill === skillFilter);
    const map = new Map<string, MergedGroup>();
    for (const r of filtered) {
      if (!map.has(r.full_test_id)) {
        map.set(r.full_test_id, {
          kind: "full_part",
          groupId: r.full_test_id,
          title: r.full_test_title || "(Không tên)",
          skills: new Set(),
          parts: [],
        });
      }
      const g = map.get(r.full_test_id)!;
      g.skills.add(r.skill);
      g.parts.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "vi"));
  }, [fullPartRows, fullTestGroups, skillFilter]);

  const togglePublish = async (group: MergedGroup, publish: boolean) => {
    setBusyId(group.groupId);
    if (group.kind === "full_test") {
      const { error } = await supabase
        .from("full_tests")
        .update({ is_published: publish })
        .eq("id", group.groupId);
      setBusyId(null);
      if (error) {
        toast({ title: "Cập nhật thất bại", description: error.message, variant: "destructive" });
        return;
      }
      setFullTestGroups((prev) =>
        prev.map((g) => (g.groupId === group.groupId ? { ...g, is_published: publish } : g)),
      );
      toast({ title: publish ? "Đã xuất bản Full Test" : "Đã ẩn Full Test" });
      return;
    }
    const ids = group.parts.map((p) => p.id);
    const { error } = await supabase.from("exam_sets").update({ is_published: publish }).in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Cập nhật thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setFullPartRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, is_published: publish } : r)),
    );
    toast({ title: publish ? "Đã xuất bản" : "Đã ẩn", description: `${ids.length} bộ đề` });
  };

  const togglePublishOne = async (part: PartRow) => {
    setBusyId(part.id);
    const next = !part.is_published;
    const { error } = await supabase.from("exam_sets").update({ is_published: next }).eq("id", part.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Cập nhật thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setFullPartRows((prev) => prev.map((r) => (r.id === part.id ? { ...r, is_published: next } : r)));
    setFullTestGroups((prev) =>
      prev.map((g) => ({
        ...g,
        parts: g.parts.map((p) => (p.id === part.id ? { ...p, is_published: next } : p)),
      })),
    );
  };

  const changeGroupTier = async (group: MergedGroup, tier: AccessTier) => {
    const ids = group.parts.map((p) => p.id);
    if (ids.length === 0) return;
    setBusyId(group.groupId);
    const { error } = await supabase
      .from("exam_sets")
      .update({ access_tier: tier } as any)
      .in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Cập nhật tier thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setFullPartRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, access_tier: tier } : r)),
    );
    setFullTestGroups((prev) =>
      prev.map((g) =>
        g.groupId === group.groupId
          ? { ...g, parts: g.parts.map((p) => ({ ...p, access_tier: tier })) }
          : g,
      ),
    );
    toast({ title: `Đã đặt tier: ${tier.toUpperCase()}` });
  };


  const startEdit = (group: MergedGroup) => {
    setEditingId(group.groupId);
    setEditTitle(group.title);
  };

  const saveEdit = async (group: MergedGroup) => {
    const title = editTitle.trim();
    if (!title) {
      toast({ title: "Tên không được để trống", variant: "destructive" });
      return;
    }
    setBusyId(group.groupId);
    if (group.kind === "full_test") {
      const { error } = await supabase.from("full_tests").update({ title }).eq("id", group.groupId);
      setBusyId(null);
      if (error) {
        toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
        return;
      }
      setFullTestGroups((prev) =>
        prev.map((g) => (g.groupId === group.groupId ? { ...g, title } : g)),
      );
      setEditingId(null);
      toast({ title: "Đã đổi tên Full Test" });
      return;
    }
    const ids = group.parts.map((p) => p.id);
    const { error } = await supabase.from("exam_sets").update({ full_test_title: title }).in("id", ids);
    setBusyId(null);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
      return;
    }
    setFullPartRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, full_test_title: title } : r)),
    );
    setEditingId(null);
    toast({ title: "Đã đổi tên đề" });
  };

  const doUnlink = async () => {
    if (!unlinkPart) return;
    const { part, group } = unlinkPart;
    setBusyId(part.id);
    if (group.kind === "full_test") {
      const { error } = await supabase
        .from("full_test_members")
        .delete()
        .eq("full_test_id", group.groupId)
        .eq("exam_set_id", part.id);
      setBusyId(null);
      if (error) {
        toast({ title: "Gỡ thất bại", description: error.message, variant: "destructive" });
        return;
      }
      setFullTestGroups((prev) =>
        prev.map((g) =>
          g.groupId === group.groupId ? { ...g, parts: g.parts.filter((p) => p.id !== part.id) } : g,
        ),
      );
    } else {
      const { error } = await supabase
        .from("exam_sets")
        .update({ full_test_id: null, full_test_title: null })
        .eq("id", part.id);
      setBusyId(null);
      if (error) {
        toast({ title: "Gỡ thất bại", description: error.message, variant: "destructive" });
        return;
      }
      setFullPartRows((prev) => prev.filter((r) => r.id !== part.id));
    }
    setUnlinkPart(null);
    toast({ title: "Đã gỡ bộ đề khỏi nhóm ghép" });
  };

  const doDeleteGroup = async () => {
    if (!deleteGroup) return;
    setBusyId(deleteGroup.groupId);
    if (deleteGroup.kind === "full_test") {
      const { error } = await supabase.from("full_tests").delete().eq("id", deleteGroup.groupId);
      setBusyId(null);
      if (error) {
        toast({ title: "Xóa thất bại", description: error.message, variant: "destructive" });
        return;
      }
      setFullTestGroups((prev) => prev.filter((g) => g.groupId !== deleteGroup.groupId));
      setDeleteGroup(null);
      toast({ title: "Đã xóa Full Test", description: "Các bộ đề gốc vẫn được giữ nguyên ở phần luyện tập theo kỹ năng." });
      return;
    }
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
    setFullPartRows((prev) => prev.filter((r) => !ids.includes(r.id)));
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
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả Full Part</SelectItem>
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
            const isOpen = !!expanded[g.groupId];
            const publishedCount = g.parts.filter((p) => p.is_published).length;
            const groupPublished = g.kind === "full_test"
              ? !!g.is_published
              : publishedCount === g.parts.length && g.parts.length > 0;
            const allPublished = g.kind === "full_part"
              ? publishedCount === g.parts.length
              : !!g.is_published;
            const nonePublished = g.kind === "full_part" ? publishedCount === 0 : !g.is_published;
            const isEditing = editingId === g.groupId;
            const isBusy = busyId === g.groupId;
            const tiers = Array.from(new Set(g.parts.map((p) => p.access_tier || "pro")));
            const mixedTier = tiers.length > 1;
            const groupTier: AccessTier = mixedTier ? "pro" : (tiers[0] as AccessTier) || "pro";
            const tierBadgeClass: Record<string, string> = {
              free: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
              pro: "bg-amber-500/15 text-amber-700 border-amber-500/30",
              premium: "bg-violet-500/15 text-violet-700 border-violet-500/30",
              mixed: "bg-muted text-muted-foreground border-border",
            };

            return (
              <div key={g.groupId} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((s) => ({ ...s, [g.groupId]: !isOpen }))}
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
                          <h3 className="font-semibold text-foreground truncate">{g.title}</h3>
                          {g.kind === "full_test" && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                              Full Test
                            </Badge>
                          )}
                          <Badge
                            variant={groupPublished ? "default" : nonePublished ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {groupPublished
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
                        title={allPublished ? "Ẩn" : "Xuất bản"}
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
                        title={g.kind === "full_test" ? "Xóa Full Test" : "Hủy ghép cả nhóm"}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteGroup(g)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpanded((s) => ({ ...s, [g.groupId]: !isOpen }))}
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
                          {g.kind === "full_part" && (
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
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gỡ khỏi nhóm ghép"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setUnlinkPart({ part: p, group: g })}
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
            <AlertDialogTitle>
              {deleteGroup?.kind === "full_test" ? "Xóa Full Test?" : "Hủy ghép cả nhóm?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroup?.kind === "full_test"
                ? <>Full Test "<b>{deleteGroup?.title}</b>" sẽ bị xóa. Các bộ đề gốc và câu hỏi <b>không bị xóa</b> và vẫn hiển thị ở phần luyện tập theo kỹ năng.</>
                : <>{deleteGroup?.parts.length} bộ đề trong nhóm "<b>{deleteGroup?.title}</b>" sẽ được tách ra. Các bộ đề gốc và câu hỏi <b>không bị xóa</b>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroup?.kind === "full_test" ? "Xóa" : "Hủy ghép"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unlinkPart} onOpenChange={(o) => !o && setUnlinkPart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ bộ đề khỏi nhóm?</AlertDialogTitle>
            <AlertDialogDescription>
              "<b>{unlinkPart?.part.title}</b>" sẽ được tách ra khỏi nhóm ghép. Bộ đề và câu hỏi <b>không bị xóa</b>.
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
