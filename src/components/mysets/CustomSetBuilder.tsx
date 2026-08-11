import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Dices,
  Headphones,
  Layers,
  Loader2,
  Lock,
  Mic,
  Pencil,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useIsPro } from "@/hooks/useIsPro";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import { useExamPriorityLabels } from "@/hooks/useExamPriorityLabels";
import { normalizePart } from "@/hooks/useExamSets";
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

type PriorityFilter = "all" | "high" | "medium" | "low" | "backup";
type DoneFilter = "all" | "undone" | "done";
type Step = "type" | "skill" | "form";

const SKILLS = ["reading", "listening", "writing", "speaking", "grammar_vocab"];

const SKILL_ICON: Record<string, any> = {
  reading: BookOpen,
  listening: Headphones,
  writing: Pencil,
  speaking: Mic,
  grammar_vocab: Layers,
};

const PRIORITY_CHIPS: { key: PriorityFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "high", label: "Cao" },
  { key: "medium", label: "Vừa" },
  { key: "low", label: "Thấp" },
  { key: "backup", label: "Dự phòng" },
];

const DONE_CHIPS: { key: DoneFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "undone", label: "Chưa làm" },
  { key: "done", label: "Đã làm" },
];

const fmtMinutes = (sec: number) => `${Math.round(sec / 60)} phút`;

const partSortKey = (part: string) => {
  const m = normalizePart(part).match(/part(\d+)/);
  return m ? Number(m[1]) : 99;
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: "Cao", className: "bg-[#CC1C01] text-white border-0" },
  medium: { label: "Vừa", className: "bg-[#FEAD5F] text-[#4D0D0D] border-0" },
  low: { label: "Thấp", className: "bg-emerald-600 text-white border-0" },
  backup: { label: "Dự phòng", className: "bg-muted text-muted-foreground border-0" },
};

const ChipRow = ({
  label,
  chips,
  value,
  onChange,
}: {
  label: string;
  chips: { key: string; label: string }[];
  value: string;
  onChange: (v: any) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs font-medium text-muted-foreground mr-1">{label}</span>
    {chips.map((c) => (
      <button
        key={c.key}
        type="button"
        onClick={() => onChange(c.key)}
        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          value === c.key
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:bg-muted"
        }`}
      >
        {c.label}
      </button>
    ))}
  </div>
);

interface Props {
  editing?: CustomSetRow | null;
  onDone: () => void;
  onCancel: () => void;
  /** Loại cố định (khi mở từ lưới đề của một kỹ năng). */
  initialMode?: CustomSetMode;
  initialSkill?: string;
}

const CustomSetBuilder = ({ editing, onDone, onCancel, initialMode, initialSkill }: Props) => {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [mode, setMode] = useState<CustomSetMode>(editing?.mode ?? initialMode ?? "full_test");
  const [skill, setSkill] = useState<string>(editing?.skill ?? initialSkill ?? "reading");
  const [step, setStep] = useState<Step>(() => {
    if (editing) return "form";
    if (initialMode === "full_test") return "form";
    if (initialMode === "full_part" && initialSkill) return "form";
    return "type";
  });
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all");
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

  const priorityOf = (id: string): PriorityFilter =>
    (labels.get(id)?.label as PriorityFilter | undefined) ?? "backup";

  const relevantSkills = mode === "full_part" ? [skill] : SKILLS;

  const matchesFilters = (o: ExamSetOption) => {
    if (priorityFilter !== "all" && priorityOf(o.id) !== priorityFilter) return false;
    if (doneFilter === "undone" && progress.has(o.id)) return false;
    if (doneFilter === "done" && !progress.has(o.id)) return false;
    if (search.trim() && !o.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  };

  /** Cấu trúc: kỹ năng > part > danh sách đề khớp lọc */
  const grouped = useMemo(() => {
    return relevantSkills.map((sk) => {
      const skillSets = options.filter((o) => o.skill === sk);
      const parts = Array.from(new Set(skillSets.map((o) => o.part))).sort(
        (a, b) => partSortKey(a) - partSortKey(b),
      );
      return {
        skill: sk,
        parts: parts.map((part) => ({
          part,
          items: skillSets.filter((o) => o.part === part && matchesFilters(o)),
        })),
      };
    });
  }, [options, relevantSkills.join("|"), priorityFilter, doneFilter, search, labels, progress, isPro]);

  const selectedSets = selected.map((id) => byId.get(id)).filter(Boolean) as ExamSetOption[];

  const partsBySkill = useMemo(() => {
    const m = new Map<string, Set<string>>();
    selectedSets.forEach((s) => {
      if (!m.has(s.skill)) m.set(s.skill, new Set());
      m.get(s.skill)!.add(s.part);
    });
    return m;
  }, [selectedSets]);

  const duplicatePart =
    selectedSets.length !== Array.from(partsBySkill.values()).reduce((n, s) => n + s.size, 0);

  const missingSkills = relevantSkills.filter(
    (s) => (partsBySkill.get(s)?.size ?? 0) < (REQUIRED_PARTS[s] ?? 4),
  );

  const estSeconds = relevantSkills.reduce(
    (sum, s) => sum + ((partsBySkill.get(s)?.size ?? 0) > 0 ? SKILL_EST_SECONDS[s] ?? 0 : 0),
    0,
  );

  const selectedIdFor = (sk: string, part: string) =>
    selected.find((id) => {
      const o = byId.get(id);
      return o?.skill === sk && o.part === part;
    });

  const pick = (o: ExamSetOption) => {
    if (isLocked(o)) {
      toast.error("Nâng cấp để dùng đề này");
      return;
    }
    setSelected((prev) => [
      ...prev.filter((id) => {
        const x = byId.get(id);
        return !(x && x.skill === o.skill && x.part === o.part);
      }),
      o.id,
    ]);
  };

  const clearPart = (sk: string, part: string) => {
    setSelected((prev) =>
      prev.filter((id) => {
        const x = byId.get(id);
        return !(x && x.skill === sk && x.part === part);
      }),
    );
  };

  /** Số đề đang khớp lọc và dùng được (dùng cho dòng "bốc trong N đề"). */
  const poolCount = useMemo(
    () =>
      grouped.reduce(
        (n, g) => n + g.parts.reduce((m, p) => m + p.items.filter((o) => !isLocked(o)).length, 0),
        0,
      ),
    [grouped, isPro],
  );

  const randomPick = () => {
    const additions: string[] = [];
    grouped.forEach((g) => {
      g.parts.forEach((p) => {
        if (selectedIdFor(g.skill, p.part)) return;
        const pool = p.items.filter((o) => !isLocked(o));
        if (!pool.length) return;
        additions.push(pool[Math.floor(Math.random() * pool.length)].id);
      });
    });
    if (!additions.length) {
      toast.error("Không còn part trống nào có đề khớp bộ lọc");
      return;
    }
    setSelected((prev) => [...prev, ...additions]);
    toast.success(`Đã bốc ${additions.length} đề`);
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

  /* ---------- Bước 1: chọn loại ---------- */
  if (step === "type") {
    return (
      <div className="max-w-3xl">
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Chọn loại bộ đề</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Bạn muốn ghép một bài thi đầy đủ 5 kỹ năng, hay luyện trọn một kỹ năng?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => { setMode("full_test"); setSelected([]); setStep("form"); }}
            className="text-left border-2 border-border hover:border-primary rounded-xl p-6 bg-card transition-colors"
          >
            <ClipboardCheck className="w-8 h-8 text-primary mb-3" />
            <div className="text-lg font-heading font-bold text-foreground">Full test</div>
            <div className="text-sm text-muted-foreground mt-1">5 kỹ năng · 22 đề · khoảng 162 phút</div>
          </button>
          <button
            type="button"
            onClick={() => { setMode("full_part"); setSelected([]); setStep("skill"); }}
            className="text-left border-2 border-border hover:border-primary rounded-xl p-6 bg-card transition-colors"
          >
            <Layers className="w-8 h-8 text-primary mb-3" />
            <div className="text-lg font-heading font-bold text-foreground">Full part</div>
            <div className="text-sm text-muted-foreground mt-1">1 kỹ năng · 4 đề</div>
          </button>
        </div>
        <Button variant="ghost" className="mt-5" onClick={onCancel}>Huỷ</Button>
      </div>
    );
  }

  /* ---------- Bước 2: chọn kỹ năng ---------- */
  if (step === "skill") {
    return (
      <div className="max-w-3xl">
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Chọn kỹ năng</h2>
        <p className="text-sm text-muted-foreground mb-5">Bộ full part gồm toàn bộ part của một kỹ năng.</p>
        <div className="flex flex-wrap gap-3">
          {SKILLS.map((s) => {
            const Icon = SKILL_ICON[s] ?? Layers;
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setSkill(s); setSelected([]); setStep("form"); }}
                className="flex items-center gap-2 border-2 border-border hover:border-primary rounded-xl px-4 py-3 bg-card transition-colors"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{SKILL_LABELS_VI[s]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={() => setStep("type")}>Quay lại</Button>
          <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
        </div>
      </div>
    );
  }

  /* ---------- Bước 3: form chọn đề ---------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {!editing && !initialMode && (
            <Button variant="outline" size="sm" onClick={() => { setStep("type"); setSelected([]); }}>
              Đổi loại
            </Button>
          )}
          <Badge variant="secondary" className="text-[11px]">
            {mode === "full_test" ? "Full test · 5 kỹ năng" : `Full part · ${SKILL_LABELS_VI[skill] ?? skill}`}
          </Badge>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Tên bộ đề</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bộ luyện key 10/08" />
        </div>

        <div className="space-y-2">
          <ChipRow label="Ưu tiên:" chips={PRIORITY_CHIPS} value={priorityFilter} onChange={setPriorityFilter} />
          <ChipRow label="Trạng thái:" chips={DONE_CHIPS} value={doneFilter} onChange={setDoneFilter} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Tìm đề</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên đề..." />
          </div>
          <div>
            <Button type="button" variant="secondary" onClick={randomPick} className="gap-2">
              <Dices className="w-4 h-4" /> Bốc ngẫu nhiên
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1">bốc trong {poolCount} đề đang lọc</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setSelected([])} className="gap-2">
            <XCircle className="w-4 h-4" /> Bỏ chọn hết
          </Button>
        </div>

        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách đề...
          </div>
        ) : (
          <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1">
            {grouped.map((g) => (
              <div key={g.skill} className="space-y-3">
                {mode === "full_test" && (
                  <h3 className="text-sm font-heading font-bold text-foreground">
                    {SKILL_LABELS_VI[g.skill] ?? g.skill}
                  </h3>
                )}
                {g.parts.map((p) => {
                  const chosenId = selectedIdFor(g.skill, p.part);
                  const chosen = chosenId ? byId.get(chosenId) : undefined;
                  return (
                    <div
                      key={`${g.skill}-${p.part}`}
                      className={`border rounded-xl overflow-hidden ${chosen ? "border-primary" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40">
                        <div className="flex items-center gap-2 min-w-0">
                          {chosen ? (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-foreground truncate">{p.part}</span>
                          <span className="text-xs text-muted-foreground">({p.items.length} đề)</span>
                        </div>
                        {chosen && (
                          <Button size="sm" variant="outline" onClick={() => clearPart(g.skill, p.part)}>
                            Đổi
                          </Button>
                        )}
                      </div>

                      {chosen ? (
                        <div className="px-3 py-2.5 text-sm font-medium text-foreground truncate">
                          {chosen.title}
                        </div>
                      ) : p.items.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground">
                          Không có đề nào khớp bộ lọc. Nới bộ lọc để chọn part này.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {p.items.map((o) => {
                            const locked = isLocked(o);
                            const pr = PRIORITY_BADGE[priorityOf(o.id)];
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => pick(o)}
                                className={`w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-2 transition-colors ${
                                  locked ? "opacity-60" : "hover:bg-muted/50"
                                }`}
                              >
                                <span className="text-sm font-medium text-foreground truncate max-w-full">
                                  {o.title}
                                </span>
                                <Badge className={`text-[10px] ${pr.className}`}>{pr.label}</Badge>
                                {progress.has(o.id) && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    đã làm
                                  </Badge>
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
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
