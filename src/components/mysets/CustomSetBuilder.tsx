import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Loader2, Lock, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useIsPro } from "@/hooks/useIsPro";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useExamPriorityLabels } from "@/hooks/useExamPriorityLabels";
import {
  createCustomSet,
  updateCustomSet,
  CUSTOM_SET_ERROR_MESSAGES,
  fetchCustomSetMemberIds,
  REQUIRED_PARTS,
  SKILL_EST_SECONDS,
  SKILL_LABELS_VI,
  type CustomSetMode,
  type CustomSetRow,
} from "@/hooks/useCustomSets";

interface ExamSetOption {
  id: string;
  title: string;
  skill: string;
  part: string;
  key_date: string | null;
  access_tier: string | null;
}

type GroupFilter = "all" | "key" | "high" | "undone";

const SKILLS = ["reading", "listening", "writing", "speaking", "grammar_vocab"];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtMinutes = (sec: number) => `${Math.round(sec / 60)} phút`;

interface Props {
  editing?: CustomSetRow | null;
  onDone: () => void;
  onCancel: () => void;
}

const CustomSetBuilder = ({ editing, onDone, onCancel }: Props) => {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [mode, setMode] = useState<CustomSetMode>(editing?.mode ?? "full_test");
  const [skill, setSkill] = useState<string>(editing?.skill ?? "reading");
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { isPro } = useIsPro();
  const { progress } = useUserExamProgress();
  const { labels } = useExamPriorityLabels();

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["customSetBuilderOptions"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ExamSetOption[]> => {
      const { data } = await supabase
        .from("exam_sets")
        .select("id, title, skill, part, key_date, access_tier")
        .eq("is_published", true)
        .is("clone_of", null)
        .order("skill", { ascending: true })
        .order("part", { ascending: true })
        .order("title", { ascending: true });
      return (data || []) as ExamSetOption[];
    },
  });

  // Prefill selection when editing
  useEffect(() => {
    if (!editing) return;
    fetchCustomSetMemberIds(editing.id).then(setSelected);
  }, [editing?.id]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  /** Tài khoản miễn phí không được đưa đề Pro vào bộ đề. */
  const isLocked = (o: ExamSetOption) => !isPro && (o.access_tier ?? "pro") !== "free";

  const relevantSkills = mode === "full_part" ? [skill] : SKILLS;

  const visible = useMemo(() => {
    const t = todayStr();
    return options.filter((o) => {
      if (mode === "full_part" && o.skill !== skill) return false;
      if (skillFilter !== "all" && o.skill !== skillFilter) return false;
      if (groupFilter === "key" && !o.key_date) return false;
      if (groupFilter === "high" && labels.get(o.id)?.label !== "high") return false;
      if (groupFilter === "undone" && progress.has(o.id)) return false;
      if (search.trim() && !o.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [options, mode, skill, skillFilter, groupFilter, search, labels, progress]);

  const selectedSets = selected.map((id) => byId.get(id)).filter(Boolean) as ExamSetOption[];

  const partsBySkill = useMemo(() => {
    const m = new Map<string, Set<string>>();
    selectedSets.forEach((s) => {
      if (!m.has(s.skill)) m.set(s.skill, new Set());
      m.get(s.skill)!.add(s.part);
    });
    return m;
  }, [selectedSets]);

  const duplicatePart = selectedSets.length !== Array.from(partsBySkill.values()).reduce((n, s) => n + s.size, 0);

  const missingSkills = relevantSkills.filter(
    (s) => (partsBySkill.get(s)?.size ?? 0) < (REQUIRED_PARTS[s] ?? 4),
  );

  const estSeconds = relevantSkills.reduce(
    (sum, s) => sum + ((partsBySkill.get(s)?.size ?? 0) > 0 ? SKILL_EST_SECONDS[s] ?? 0 : 0),
    0,
  );

  const toggle = (id: string) => {
    const o = byId.get(id);
    if (o && isLocked(o)) {
      toast.error("Nâng cấp để dùng đề này");
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const quickPickToday = () => {
    const t = todayStr();
    const picked: string[] = [];
    const seen = new Set<string>();
    options
      .filter((o) => o.key_date === t && !isLocked(o) && (mode !== "full_part" || o.skill === skill))
      .forEach((o) => {
        const key = `${o.skill}|${o.part}`;
        if (seen.has(key)) return;
        seen.add(key);
        picked.push(o.id);
      });
    if (!picked.length) {
      toast.error("Hôm nay chưa có đề key nào");
      return;
    }
    setSelected(picked);
    toast.success(`Đã chọn ${picked.length} đề key hôm nay`);
  };

  const canSave = !!title.trim() && missingSkills.length === 0 && !duplicatePart && !saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateCustomSet({ id: editing.id, title: title.trim(), examSetIds: selected });
        toast.success("Đã cập nhật bộ đề");
        onDone();
      } else {
        const res = await createCustomSet({
          title: title.trim(),
          mode,
          skill: mode === "full_part" ? skill : null,
          examSetIds: selected,
        });
        if (!res.ok) {
          if (res.reason === "tier_locked") {
            toast.error("Bộ này có đề dành cho tài khoản Pro", {
              description: "Nâng cấp để dùng các đề Pro trong bộ đề tự tạo.",
              action: { label: "Nâng cấp", onClick: () => { window.location.href = "/pricing"; } },
            });
          } else if (res.reason === "free_limit") {
            toast.error(CUSTOM_SET_ERROR_MESSAGES.free_limit);
          } else if (res.reason === "missing_parts") {
            toast.error(`Chưa đủ part: ${(res.missing || []).map((s) => SKILL_LABELS_VI[s] ?? s).join(", ")}`);
          } else if (res.reason === "duplicate_part") {
            toast.error("Mỗi part chỉ được chọn 1 đề");
          } else {
            toast.error(CUSTOM_SET_ERROR_MESSAGES[res.reason || ""] || "Không tạo được bộ đề");
          }
          return;
        }
        toast.success("Đã tạo bộ đề");
        onDone();
      }
    } catch (e: any) {
      toast.error(e?.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Tên bộ đề</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bộ luyện key 10/08" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Loại</label>
            <Select
              value={mode}
              onValueChange={(v) => { setMode(v as CustomSetMode); setSelected([]); }}
              disabled={!!editing}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_test">Full test (5 kỹ năng)</SelectItem>
                <SelectItem value="full_part">Full part (1 kỹ năng)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "full_part" && (
          <div className="max-w-xs">
            <label className="text-xs font-medium text-muted-foreground">Kỹ năng</label>
            <Select value={skill} onValueChange={(v) => { setSkill(v); setSelected([]); }} disabled={!!editing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILLS.map((s) => (
                  <SelectItem key={s} value={s}>{SKILL_LABELS_VI[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {mode === "full_test" && (
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground">Kỹ năng</label>
              <Select value={skillFilter} onValueChange={setSkillFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {SKILLS.map((s) => (
                    <SelectItem key={s} value={s}>{SKILL_LABELS_VI[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-44">
            <label className="text-xs font-medium text-muted-foreground">Nhóm đề</label>
            <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v as GroupFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="key">Chỉ đề key</SelectItem>
                <SelectItem value="high">Ưu tiên cao</SelectItem>
                <SelectItem value="undone">Chưa làm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Tìm đề</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên đề..." />
          </div>
          <Button type="button" variant="secondary" onClick={quickPickToday} className="gap-2">
            <Sparkles className="w-4 h-4" /> Bốc nhanh theo key hôm nay
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected([])} className="gap-2">
            <XCircle className="w-4 h-4" /> Bỏ chọn hết
          </Button>
        </div>

        <div className="border border-border rounded-xl divide-y divide-border max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách đề...
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Không có đề nào khớp bộ lọc.</div>
          ) : (
            visible.map((o) => {
              const checked = selected.includes(o.id);
              const locked = isLocked(o);
              return (
                <label
                  key={o.id}
                  className={`flex items-start gap-3 p-3 transition-colors ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={() => toggle(o.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{o.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{SKILL_LABELS_VI[o.skill] ?? o.skill}</Badge>
                      <Badge variant="outline" className="text-[10px]">{o.part}</Badge>
                      {o.key_date && (
                        <Badge className="text-[10px] bg-accent text-accent-foreground">key {o.key_date}</Badge>
                      )}
                      {labels.get(o.id)?.label === "high" && (
                        <Badge className="text-[10px]">Ưu tiên cao</Badge>
                      )}
                      {progress.has(o.id) && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">đã làm</Badge>
                      )}
                      {locked && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[10px] gap-1 border-primary text-primary">
                                <Lock className="w-3 h-3" /> Pro
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Nâng cấp để dùng đề này</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:sticky lg:top-24 h-fit space-y-3 border border-border rounded-xl p-4 bg-card">
        <h3 className="font-heading font-semibold text-foreground">Tiến độ chọn đề</h3>
        <div className="space-y-2">
          {relevantSkills.map((s) => {
            const have = partsBySkill.get(s)?.size ?? 0;
            const need = REQUIRED_PARTS[s] ?? 4;
            const ok = have >= need;
            return (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  {ok ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  {SKILL_LABELS_VI[s] ?? s}
                </span>
                <span className={ok ? "text-green-600 font-medium" : "text-muted-foreground"}>
                  {have}/{need}
                </span>
              </div>
            );
          })}
        </div>
        <div className="pt-2 border-t border-border text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tổng số đề</span>
            <span className="font-medium">{selected.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thời lượng ước tính</span>
            <span className="font-medium">{fmtMinutes(estSeconds)}</span>
          </div>
        </div>

        {!isPro && (
          <p className="text-xs text-muted-foreground">
            Tài khoản miễn phí chỉ ghép được đề miễn phí.{" "}
            <Link to="/pricing" className="text-primary underline">Nâng cấp</Link> để dùng toàn bộ kho đề.
          </p>
        )}
        {duplicatePart && (
          <p className="text-xs text-destructive">Mỗi part chỉ được chọn 1 đề — bạn đang chọn trùng part.</p>
        )}
        {missingSkills.length > 0 && (
          <p className="text-xs text-destructive">
            Còn thiếu part của: {missingSkills.map((s) => SKILL_LABELS_VI[s] ?? s).join(", ")}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={!canSave} className="flex-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editing ? "Lưu thay đổi" : "Lưu bộ đề"}
          </Button>
          <Button variant="outline" onClick={onCancel}>Huỷ</Button>
        </div>
      </div>
    </div>
  );
};

export default CustomSetBuilder;
