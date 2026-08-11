import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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

/** Thứ tự các bước theo đúng bài thi thật. */
const SKILL_STEP_ORDER = ["speaking", "listening", "grammar_vocab", "reading", "writing"];

interface WizStep {
  id: string;
  skill: string;
  kind: "part" | "grammar";
  part?: string;
  label: string;
}

interface StepItem {
  key: string;
  title: string;
  ids: string[];
  locked: boolean;
  done: boolean;
  priority: PriorityFilter;
}

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
  { key: "backup", label: "Back up" },
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
  backup: { label: "Back up", className: "bg-muted text-muted-foreground border-0" },
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

  /* ---------- Các bước của wizard ---------- */
  const steps = useMemo<WizStep[]>(() => {
    const out: WizStep[] = [];
    SKILL_STEP_ORDER.filter((sk) => relevantSkills.includes(sk)).forEach((sk) => {
      const skillSets = options.filter((o) => o.skill === sk);
      if (!skillSets.length) return;
      if (sk === "grammar_vocab") {
        out.push({ id: "grammar_vocab", skill: sk, kind: "grammar", label: "Đề full (6 part)" });
        return;
      }
      Array.from(new Set(skillSets.map((o) => o.part)))
        .sort((a, b) => partSortKey(a) - partSortKey(b))
        .forEach((part) => out.push({ id: `${sk}-${part}`, skill: sk, kind: "part", part, label: part }));
    });
    return out;
  }, [options, relevantSkills.join("|")]);

  const [wizardIdx, setWizardIdx] = useState(0);
  const stepIdx = Math.min(wizardIdx, Math.max(steps.length - 1, 0));

  /** Nhóm Grammar & Vocabulary theo tiền tố trước dấu " - " đầu tiên (VD "Đề 01"). */
  const grammarGroups = useMemo(() => {
    const m = new Map<string, ExamSetOption[]>();
    options
      .filter((o) => o.skill === "grammar_vocab")
      .forEach((o) => {
        const key = (o.title.split(" - ")[0] || o.title).trim();
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(o);
      });
    return Array.from(m.entries())
      .map(([key, items]) => ({
        key,
        items: [...items].sort((a, b) => partSortKey(a.part) - partSortKey(b.part)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key, "vi"));
  }, [options]);

  const priorityRank = (p: PriorityFilter) => ["high", "medium", "low", "backup"].indexOf(p);

  const itemsForStep = (s: WizStep): StepItem[] => {
    if (s.kind === "grammar") {
      return grammarGroups
        .map((g) => {
          const priority = g.items
            .map((o) => priorityOf(o.id))
            .sort((a, b) => priorityRank(a) - priorityRank(b))[0] ?? "backup";
          const done = g.items.some((o) => progress.has(o.id));
          return {
            key: g.key,
            title: `${g.key} · ${g.items.length} part`,
            ids: g.items.map((o) => o.id),
            locked: g.items.some((o) => isLocked(o)),
            done,
            priority,
          } as StepItem;
        })
        .filter((it) => {
          if (priorityFilter !== "all" && it.priority !== priorityFilter) return false;
          if (doneFilter === "undone" && it.done) return false;
          if (doneFilter === "done" && !it.done) return false;
          return true;
        });
    }
    return options
      .filter((o) => o.skill === s.skill && o.part === s.part && matchesFilters(o))
      .map((o) => ({
        key: o.id,
        title: o.title,
        ids: [o.id],
        locked: isLocked(o),
        done: progress.has(o.id),
        priority: priorityOf(o.id),
      }));
  };

  const chosenOfStep = (s: WizStep): string | null => {
    if (s.kind === "grammar") {
      const g = grammarGroups.find((gr) => gr.items.some((o) => selected.includes(o.id)));
      return g ? g.key : null;
    }
    const id = selected.find((x) => {
      const o = byId.get(x);
      return o?.skill === s.skill && o.part === s.part;
    });
    return id ?? null;
  };

  const clearStep = (s: WizStep) => {
    setSelected((prev) =>
      prev.filter((id) => {
        const o = byId.get(id);
        if (!o) return false;
        if (s.kind === "grammar") return o.skill !== "grammar_vocab";
        return !(o.skill === s.skill && o.part === s.part);
      }),
    );
  };

  /** Chọn một dòng ở bước hiện tại. Trả về true nếu chọn thành công. */
  const pickItem = (it: StepItem, s: WizStep = steps[stepIdx]): boolean => {
    if (it.locked) {
      toast.error("Nâng cấp để dùng đề này");
      return false;
    }
    setSelected((prev) => {
      const kept = prev.filter((id) => {
        const o = byId.get(id);
        if (!o) return false;
        if (s.kind === "grammar") return o.skill !== "grammar_vocab";
        return !(o.skill === s.skill && o.part === s.part);
      });
      return [...kept, ...it.ids];
    });
    return true;
  };

  const randomOf = (s: WizStep) => {
    const pool = itemsForStep(s).filter((it) => !it.locked);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const randomCurrent = () => {
    const s = steps[stepIdx];
    if (!s) return;
    const it = randomOf(s);
    if (!it) {
      toast.error("Không có đề nào khớp bộ lọc ở part này");
      return;
    }
    pickItem(it, s);
    const next = steps.findIndex((x, i) => i > stepIdx && !chosenOfStep(x));
    setWizardIdx(next >= 0 ? next : Math.min(stepIdx + 1, steps.length - 1));
  };

  const randomAll = () => {
    const additions: string[] = [];
    const usedGrammar = !!chosenOfStep({ id: "g", skill: "grammar_vocab", kind: "grammar", label: "" });
    steps.forEach((s) => {
      if (chosenOfStep(s)) return;
      if (s.kind === "grammar" && usedGrammar) return;
      const it = randomOf(s);
      if (!it) return;
      additions.push(...it.ids);
    });
    if (!additions.length) {
      toast.error("Không còn part trống nào có đề khớp bộ lọc");
      return;
    }
    setSelected((prev) => [...prev, ...additions]);
    toast.success("Đã bốc ngẫu nhiên các part còn trống");
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
          } else if (res.reason === "pro_only") {
            toast.error("Tạo bộ đề là tính năng dành cho tài khoản Pro", {
              action: { label: "Nâng cấp", onClick: () => { window.location.href = "/pricing"; } },
            });
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

  /* ---------- Bước 3: wizard chọn đề theo từng part ---------- */
  const current = steps[stepIdx];
  const currentItems = current ? itemsForStep(current) : [];
  const currentChosen = current ? chosenOfStep(current) : null;

  const goto = (i: number) => setWizardIdx(Math.max(0, Math.min(steps.length - 1, i)));
  const advance = () => {
    const next = steps.findIndex((s, i) => i > stepIdx && !chosenOfStep(s));
    goto(next >= 0 ? next : stepIdx + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {!editing && !initialMode && (
            <Button variant="outline" size="sm" onClick={() => { setStep("type"); setSelected([]); setWizardIdx(0); }}>
              Đổi loại
            </Button>
          )}
          <Badge variant="secondary" className="text-[11px]">
            {mode === "full_test" ? "Full test · 5 kỹ năng" : `Full part · ${SKILL_LABELS_VI[skill] ?? skill}`}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground border border-border rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách đề...
          </div>
        ) : !current ? (
          <div className="p-6 text-sm text-muted-foreground border border-border rounded-xl">
            Không tìm thấy đề nào cho kỹ năng này.
          </div>
        ) : (
          <>
            {/* Thanh tiến trình */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                {steps.map((s, i) => {
                  const done = !!chosenOfStep(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={`${SKILL_LABELS_VI[s.skill] ?? s.skill} · ${s.label}`}
                      onClick={() => goto(i)}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i === stepIdx
                          ? "bg-primary h-2.5"
                          : done
                            ? "bg-emerald-500"
                            : "bg-muted"
                      }`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {relevantSkills
                  .filter((sk) => steps.some((s) => s.skill === sk))
                  .map((sk) => (
                    <span
                      key={sk}
                      className={`text-[11px] ${
                        current.skill === sk ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {SKILL_LABELS_VI[sk] ?? sk}
                    </span>
                  ))}
              </div>
            </div>

            {/* Tiêu đề bước */}
            <div>
              <h3 className="text-base font-heading font-bold text-foreground">
                {SKILL_LABELS_VI[current.skill] ?? current.skill} · {current.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {current.kind === "grammar"
                  ? "Chọn một đề full (gồm 6 part) cho Grammar & Vocabulary"
                  : "Chọn một đề cho part này"}{" "}
                — bước {stepIdx + 1}/{steps.length}
              </p>
            </div>

            {/* Điều hướng + bốc ngẫu nhiên */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={stepIdx === 0} onClick={() => goto(stepIdx - 1)} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Part trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={stepIdx >= steps.length - 1}
                onClick={() => goto(stepIdx + 1)}
                className="gap-1"
              >
                Part sau <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={randomCurrent} className="gap-1.5">
                <Dices className="w-4 h-4" /> Bốc ngẫu nhiên part này
              </Button>
              <Button variant="secondary" size="sm" onClick={randomAll} className="gap-1.5">
                <Dices className="w-4 h-4" /> Bốc ngẫu nhiên tất cả các part
              </Button>
              {currentChosen && (
                <Button variant="ghost" size="sm" onClick={() => clearStep(current)} className="gap-1">
                  <XCircle className="w-4 h-4" /> Bỏ chọn part này
                </Button>
              )}
            </div>

            {/* Bộ lọc */}
            <div className="space-y-2">
              <ChipRow label="Ưu tiên:" chips={PRIORITY_CHIPS} value={priorityFilter} onChange={setPriorityFilter} />
              <ChipRow label="Trạng thái:" chips={DONE_CHIPS} value={doneFilter} onChange={setDoneFilter} />
            </div>

            {/* Danh sách đề của bước hiện tại */}
            {currentItems.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                Không có đề nào khớp bộ lọc. Nới bộ lọc để chọn part này.
              </div>
            ) : (
              <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                {currentItems.map((it) => {
                  const active = currentChosen === it.key;
                  const pr = PRIORITY_BADGE[it.priority];
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => { if (pickItem(it)) advance(); }}
                      className={`w-full text-left px-3 py-3 flex flex-wrap items-center gap-2 transition-colors ${
                        it.locked ? "opacity-60" : "hover:bg-muted/50"
                      } ${active ? "bg-primary/5" : ""}`}
                    >
                      {active ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground truncate max-w-full">{it.title}</span>
                      <Badge className={`text-[10px] ${pr.className}`}>{pr.label}</Badge>
                      {it.done && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">đã làm</Badge>
                      )}
                      {it.locked && (
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

          </>
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
            <span className="text-muted-foreground">Số bước đã chọn</span>
            <span className="font-medium">
              {steps.filter((s) => !!chosenOfStep(s)).length}/{steps.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thời lượng ước tính</span>
            <span className="font-medium">{fmtMinutes(estSeconds)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Tên bộ đề</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Bộ luyện key 10/08" />
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
        {steps.length > 0 && steps.filter((s) => !!chosenOfStep(s)).length < steps.length && (
          <p className="text-xs text-destructive">
            Còn thiếu {steps.length - steps.filter((s) => !!chosenOfStep(s)).length} part
            {missingSkills.length > 0 && <> ({missingSkills.map((s) => SKILL_LABELS_VI[s] ?? s).join(", ")})</>}
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
