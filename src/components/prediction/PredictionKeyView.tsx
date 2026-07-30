import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizePart, readingPartLabel, type ExamSetRow } from "@/hooks/useExamSets";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Headphones,
  Type,
  PenLine,
  Mic,
  ArrowRight,
  Infinity as InfinityIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { cn } from "@/lib/utils";
import { loadMarathonProgress, loadMarathonLast } from "@/lib/marathonProgress";
import ReadingMarathonEngine from "@/components/practice/ReadingMarathonEngine";
import ListeningMarathonEngine from "@/components/practice/ListeningMarathonEngine";
import WritingMarathonEngine from "@/components/practice/WritingMarathonEngine";

type Priority = "high" | "medium" | "low" | "backup";
type PrioFilter = "all" | "high" | "medium" | "backup";

const PRIORITY_CHIP: Record<Priority, { label: string; style: React.CSSProperties; className: string }> = {
  high: {
    label: "Cao",
    style: { color: "#CC1C01", background: "var(--bg-danger, rgba(204,28,1,0.10))" },
    className: "",
  },
  medium: {
    label: "Vừa",
    style: { color: "#8a5a12", background: "var(--bg-warning, rgba(254,173,95,0.22))" },
    className: "",
  },
  low: { label: "Backup", style: {}, className: "bg-muted text-muted-foreground" },
  backup: { label: "Backup", style: {}, className: "bg-muted text-muted-foreground" },
};

const SKILL_LABEL: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar_vocab: "Grammar & Vocab",
  grammar: "Grammar & Vocab",
  writing: "Writing",
  speaking: "Speaking",
};
const SKILL_ORDER = ["speaking", "listening", "grammar_vocab", "grammar", "reading", "writing"];
const SKILL_ICON: Record<string, any> = {
  reading: BookOpen,
  listening: Headphones,
  grammar_vocab: Type,
  grammar: Type,
  writing: PenLine,
  speaking: Mic,
};
const WEEKDAY_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function skillRoute(skill: string | null | undefined, setId: string): string {
  const s = (skill || "").toLowerCase();
  if (s === "reading") return `/reading?set=${setId}&jump=1&from=key`;
  if (s === "listening") return `/listening?set=${setId}&jump=1&from=key`;
  if (s === "grammar_vocab" || s === "grammar") return `/grammar?set=${setId}&jump=1&from=key`;
  if (s === "writing") return `/writing?set=${setId}&jump=1&from=key`;
  if (s === "speaking") return `/speaking?set=${setId}&jump=1&from=key`;
  return `/?set=${setId}`;
}

const partLabelFor = (skill: string, part: string) =>
  skill === "reading" ? readingPartLabel(part) : part.replace(/^part(\d+)$/i, "Part $1");

interface KeyRow {
  id: string;
  date: string;
  title: string | null;
}

interface ItemRow {
  id: string;
  exam_set_id: string;
  priority: Priority;
  sort_order: number;
  title: string;
  skill: string | null;
  part: string | null;
  set: ExamSetRow | null;
}

type BestScore = { score: number; total: number };

interface MarathonState {
  skill: string;
  part: string;
  sets: ExamSetRow[];
  retry: boolean;
  wrongQuestionIdsBySet?: Record<string, string[]>;
}

export default function PredictionKeyView() {
  const { user } = useAuth();
  const { isPremium, loading: tierLoading } = useIsPro();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [best, setBest] = useState<Map<string, BestScore>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [prioFilter, setPrioFilter] = useState<PrioFilter>("all");
  const [onlyUndone, setOnlyUndone] = useState(false);
  const [marathonPart, setMarathonPart] = useState<string | null>(null);
  const [marathon, setMarathon] = useState<MarathonState | null>(null);

  // Load keys
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKeys(true);
      const { data } = await supabase
        .from("prediction_keys")
        .select("id,date,title,is_published, prediction_items(count)")
        .eq("is_published", true)
        .order("date", { ascending: false });
      if (cancelled) return;
      const rows = (data || []).map((k: any) => ({
        ...k,
        itemCount: k.prediction_items?.[0]?.count ?? 0,
      }));
      setKeys(rows);
      const wantedId = new URLSearchParams(window.location.search).get("keyId");
      const wanted = wantedId ? rows.find((k: any) => k.id === wantedId) : null;
      const firstWithItems = wanted || rows.find((k: any) => k.itemCount > 0) || rows[0];
      if (firstWithItems) setSelectedKeyId(firstWithItems.id);
      setLoadingKeys(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load items for selected key
  useEffect(() => {
    if (!selectedKeyId) { setItems([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingItems(true);
      const { data } = await supabase
        .from("prediction_items")
        .select("id,exam_set_id,priority,sort_order,exam_sets(*)")
        .eq("key_id", selectedKeyId)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      const rows: ItemRow[] = (data || []).map((r: any) => ({
        id: r.id,
        exam_set_id: r.exam_set_id,
        priority: (r.priority as Priority) || "medium",
        sort_order: r.sort_order ?? 0,
        title: r.exam_sets?.title ?? "(không có tiêu đề)",
        skill: r.exam_sets?.skill ?? null,
        part: r.exam_sets?.part ?? null,
        set: (r.exam_sets as ExamSetRow) ?? null,
      }));
      setItems(rows);
      setLoadingItems(false);
    })();
    return () => { cancelled = true; };
  }, [selectedKeyId]);

  // Load best raw score per exam set
  useEffect(() => {
    if (!user || items.length === 0) { setBest(new Map()); return; }
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(items.map((i) => i.exam_set_id)));
      const { data } = await supabase
        .from("test_results")
        .select("exam_set_id,score,total")
        .eq("user_id", user.id)
        .in("exam_set_id", ids);
      if (cancelled) return;
      const skillOf = new Map(items.map((i) => [i.exam_set_id, (i.skill || "").toLowerCase()]));
      const map = new Map<string, BestScore>();
      (data || []).forEach((r: any) => {
        if (!r.exam_set_id || !r.total || r.total <= 0) return;
        const sk = skillOf.get(r.exam_set_id) || "";
        const subjective = sk === "writing" || sk === "speaking";
        if (subjective && (r.total <= 1 || r.total === 50)) return;
        const prev = map.get(r.exam_set_id);
        const ratio = r.score / r.total;
        if (!prev || ratio > prev.score / prev.total) {
          map.set(r.exam_set_id, { score: r.score, total: r.total });
        }
      });
      setBest(map);
    })();
    return () => { cancelled = true; };
  }, [user, items]);

  const availableSkills = useMemo(() => {
    const set = new Set(items.map((it) => (it.skill || "other").toLowerCase()));
    return Array.from(set).sort(
      (a, b) => (SKILL_ORDER.indexOf(a) + 1 || 999) - (SKILL_ORDER.indexOf(b) + 1 || 999)
    );
  }, [items]);

  const matchPrio = (p: Priority) =>
    prioFilter === "all" ||
    (prioFilter === "backup" ? p === "backup" || p === "low" : p === prioFilter);

  const visibleItems = useMemo(() => {
    const rank: Priority[] = ["high", "medium", "low", "backup"];
    return items
      .filter((it) => {
        const sk = (it.skill || "other").toLowerCase();
        if (activeSkill && sk !== activeSkill) return false;
        if (!matchPrio(it.priority)) return false;
        if (onlyUndone && best.has(it.exam_set_id)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const d = rank.indexOf(a.priority) - rank.indexOf(b.priority);
        if (d !== 0) return d;
        return a.sort_order - b.sort_order;
      });
  }, [items, activeSkill, prioFilter, onlyUndone, best]);

  // Parts available for the marathon card (single skill only)
  const marathonParts = useMemo(() => {
    if (!activeSkill) return [] as { part: string; sets: ExamSetRow[] }[];
    const m = new Map<string, ExamSetRow[]>();
    items
      .filter((it) => (it.skill || "").toLowerCase() === activeSkill && matchPrio(it.priority) && it.set)
      .forEach((it) => {
        const p = normalizePart(it.part || "") || "other";
        if (!m.has(p)) m.set(p, []);
        m.get(p)!.push(it.set!);
      });
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([part, sets]) => ({ part, sets }));
  }, [items, activeSkill, prioFilter]);

  useEffect(() => {
    setMarathonPart(marathonParts[0]?.part ?? null);
  }, [activeSkill, prioFilter, marathonParts.length]);

  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  const keyByDate = useMemo(() => {
    const m = new Map<string, KeyRow>();
    keys.forEach((k) => m.set(k.date, k));
    return m;
  }, [keys]);
  const keyDates = useMemo(() => keys.map((k) => new Date(k.date + "T00:00:00")), [keys]);
  const selectedKey = keys.find((k) => k.id === selectedKeyId) || null;
  const selectedDate = selectedKey ? new Date(selectedKey.date + "T00:00:00") : undefined;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // ---- Marathon engine overlay ----
  if (marathon) {
    const label = `${SKILL_LABEL[marathon.skill] || marathon.skill} · Marathon ${partLabelFor(marathon.skill, marathon.part)}`;
    const close = () => setMarathon(null);
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        {marathon.skill === "reading" && (
          <ReadingMarathonEngine
            sets={marathon.sets}
            partType={marathon.part as any}
            skillLabel={label}
            persist={!marathon.retry}
            isRetryMode={marathon.retry}
            onExit={close}
          />
        )}
        {marathon.skill === "listening" && (
          <ListeningMarathonEngine
            sets={marathon.sets}
            partType={marathon.part as any}
            skillLabel={label}
            persist={!marathon.retry}
            wrongQuestionIdsBySet={marathon.wrongQuestionIdsBySet}
            onExit={close}
          />
        )}
        {marathon.skill === "writing" && (
          <WritingMarathonEngine
            sets={marathon.sets}
            partType={marathon.part.replace("part", "task") as any}
            skillLabel={label}
            persist={!marathon.retry}
            onExit={close}
          />
        )}
      </div>
    );
  }

  if (loadingKeys || tierLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
        <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium mb-1">Đăng nhập để xem toàn bộ đề Key dự đoán</p>
        <p className="text-sm text-muted-foreground">Đề Key dự đoán được update hằng ngày</p>
      </div>
    );
  }

  const recentKeys = keys.slice(0, 7);

  return (
    <div className="space-y-5">
      {/* 1. Date strip */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-stretch gap-2 pb-1">
            {recentKeys.map((k) => {
              const d = new Date(k.date + "T00:00:00");
              const on = k.id === selectedKeyId;
              const isToday = k.date === todayStr;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelectedKeyId(k.id)}
                  className={cn(
                    "shrink-0 min-w-[68px] rounded-xl border px-3 py-2 text-center transition-colors",
                    on ? "border-2 font-semibold" : "border-border bg-card hover:bg-muted",
                  )}
                  style={on ? { borderColor: "#CC1C01", color: "#CC1C01", background: "var(--bg-danger, rgba(204,28,1,0.08))" } : undefined}
                >
                  <div className="text-[11px] leading-tight opacity-80">{WEEKDAY_VI[d.getDay()]}</div>
                  <div className="text-sm font-bold leading-tight">{format(d, "dd/MM")}</div>
                  {isToday && <div className="text-[10px] leading-tight opacity-70">hôm nay</div>}
                </button>
              );
            })}
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-auto shrink-0 gap-1.5 self-stretch">
              <CalendarDays className="w-4 h-4" /> Ngày khác
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl border border-border shadow-xl bg-card" align="end" sideOffset={8}>
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={(d) => {
                if (!d) return;
                const k = keyByDate.get(ymd(d));
                if (k) setSelectedKeyId(k.id);
              }}
              disabled={(date) => !keyByDate.has(ymd(date))}
              modifiers={{ hasKey: keyDates }}
              modifiersClassNames={{
                hasKey: "font-bold text-primary underline underline-offset-4 decoration-2 decoration-primary",
              }}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {!isPremium ? (
        <UpgradeLock reason="premium" need="premium" featureLabel="Key Dự Đoán (Update hằng ngày)" />
      ) : loadingItems ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground font-medium">Chưa có key cho ngày này</p>
        </div>
      ) : (
        <>
          {/* 2. Skill tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {availableSkills.map((sk) => {
              const Icon = SKILL_ICON[sk] || Sparkles;
              const all = items.filter((it) => (it.skill || "other").toLowerCase() === sk);
              const done = all.filter((it) => best.has(it.exam_set_id)).length;
              const on = activeSkill === sk;
              return (
                <button
                  key={sk}
                  type="button"
                  onClick={() => setActiveSkill(on ? null : sk)}
                  className={cn(
                    "rounded-xl bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50",
                    on ? "border-2" : "border border-border",
                  )}
                  style={on ? { borderColor: "#CC1C01" } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{SKILL_LABEL[sk] || sk}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground font-medium">{done}/{all.length}</p>
                </button>
              );
            })}
          </div>

          {/* 3. Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Ưu tiên</span>
            {([["all", "Tất cả"], ["high", "Cao"], ["medium", "Vừa"], ["backup", "Backup"]] as const).map(([v, label]) => {
              const on = prioFilter === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPrioFilter(v as PrioFilter)}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                    on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
            <span className="w-px h-5 bg-border mx-1" />
            <button
              type="button"
              onClick={() => setOnlyUndone((v) => !v)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                onlyUndone ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted",
              )}
            >
              Chưa làm
            </button>
          </div>

          {/* 4. Marathon card */}
          <MarathonCard
            activeSkill={activeSkill}
            prioFilter={prioFilter}
            parts={marathonParts}
            marathonPart={marathonPart}
            setMarathonPart={setMarathonPart}
            onStart={(s) => setMarathon(s)}
          />

          {/* 5. Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="flex-1 min-w-0">Tên đề</div>
              <div className="w-[100px] shrink-0">Kỹ năng · part</div>
              <div className="w-[60px] shrink-0">Ưu tiên</div>
              <div className="w-[54px] shrink-0">Điểm</div>
              <div className="w-[72px] shrink-0">Trạng thái</div>
            </div>
            {visibleItems.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">Không có đề phù hợp bộ lọc</p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleItems.map((it) => {
                  const sk = (it.skill || "other").toLowerCase();
                  const chip = PRIORITY_CHIP[it.priority] || PRIORITY_CHIP.medium;
                  const b = best.get(it.exam_set_id);
                  const skillPart = `${SKILL_LABEL[sk] || sk} · ${partLabelFor(sk, normalizePart(it.part || ""))}`;
                  const chipEl = (
                    <span
                      className={cn("inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", chip.className)}
                      style={chip.style}
                    >
                      {chip.label}
                    </span>
                  );
                  const scoreEl = b ? <span className="text-xs font-semibold text-foreground">{b.score}/{b.total}</span> : null;
                  const statusEl = b ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã làm
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Chưa làm</span>
                  );
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => navigate(skillRoute(it.skill, it.exam_set_id))}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        {/* desktop row */}
                        <div className="hidden sm:flex items-center gap-3">
                          <div className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{it.title}</div>
                          <div className="w-[100px] shrink-0 text-xs text-muted-foreground truncate">{skillPart}</div>
                          <div className="w-[60px] shrink-0">{chipEl}</div>
                          <div className="w-[54px] shrink-0">{scoreEl}</div>
                          <div className="w-[72px] shrink-0">{statusEl}</div>
                        </div>
                        {/* mobile 2-tier */}
                        <div className="sm:hidden">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{it.title}</span>
                            {scoreEl}
                            {chipEl}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground truncate">{skillPart}</span>
                            {statusEl}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Hiện {visibleItems.length} đề{selectedDate ? ` · key ${format(selectedDate, "dd/MM")}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

const PRIO_NAME: Record<PrioFilter, string> = {
  all: "",
  high: "ưu tiên cao",
  medium: "ưu tiên vừa",
  backup: "backup",
};

function MarathonCard({
  activeSkill,
  prioFilter,
  parts,
  marathonPart,
  setMarathonPart,
  onStart,
}: {
  activeSkill: string | null;
  prioFilter: PrioFilter;
  parts: { part: string; sets: ExamSetRow[] }[];
  marathonPart: string | null;
  setMarathonPart: (p: string) => void;
  onStart: (s: MarathonState) => void;
}) {
  const supported = !!activeSkill && ["reading", "listening", "writing"].includes(activeSkill);
  const current = parts.find((p) => p.part === marathonPart) || parts[0] || null;
  const sets = current?.sets ?? [];

  const skillKey = activeSkill === "writing" ? "writing" : activeSkill || "";
  const partKey = current?.part ?? "";
  const prog = supported && partKey ? loadMarathonProgress(skillKey, partKey) : null;
  const last = supported && partKey ? loadMarathonLast(skillKey, partKey) : null;
  const progWrongIds = (prog?.results ?? []).filter((r: any) => r && r.correct < r.total).map((r: any) => r.examSetId);
  const wrongSetIds: string[] = progWrongIds.length ? progWrongIds : (last?.wrongSetIds ?? []);
  const wrongCount = wrongSetIds.length;

  const prioName = PRIO_NAME[prioFilter];
  const title = activeSkill
    ? `Luyện ${sets.length} đề ${prioName ? prioName + " " : ""}${SKILL_LABEL[activeSkill] || activeSkill}`
    : "Marathon theo kỹ năng";

  const disabled = !supported || sets.length === 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 bg-gradient-to-br from-primary/10 via-accent/5 to-background",
        disabled && "opacity-60",
      )}
      style={{ borderColor: "#CC1C01" }}
    >
      {last && supported && (
        <span className="absolute top-3 right-3 text-[11px] font-semibold text-muted-foreground">
          Lần trước {last.correct}/{last.total}
        </span>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Badge className="w-fit text-[11px] font-semibold border-0 gap-1 text-white" style={{ background: "#CC1C01" }}>
          <InfinityIcon className="w-3 h-3" /> Marathon
        </Badge>
        <Badge variant="outline" className="text-[10px] font-bold tracking-wide">PRO</Badge>
      </div>
      <h3 className="text-lg font-heading font-extrabold text-foreground">{title}</h3>
      {!activeSkill ? (
        <p className="text-sm text-muted-foreground mt-1">Chọn một kỹ năng để luyện marathon</p>
      ) : !supported ? (
        <p className="text-sm text-muted-foreground mt-1">Kỹ năng này chưa hỗ trợ marathon</p>
      ) : (
        <p className="text-sm text-muted-foreground mt-1">
          Làm liên tục {sets.length} đề {current ? partLabelFor(activeSkill, current.part) : ""} — không giới hạn giờ
        </p>
      )}

      {supported && parts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {parts.map((p) => (
            <button
              key={p.part}
              type="button"
              onClick={() => setMarathonPart(p.part)}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                p.part === current?.part
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted",
              )}
            >
              {partLabelFor(activeSkill!, p.part)} ({p.sets.length})
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => current && onStart({ skill: activeSkill!, part: current.part, sets, retry: false })}
          className="gap-1.5 font-semibold text-white hover:opacity-90"
          style={{ background: "#CC1C01" }}
        >
          Bắt đầu <ArrowRight className="w-4 h-4" />
        </Button>
        {!disabled && wrongCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 font-semibold"
            onClick={() => {
              const ids = new Set(wrongSetIds);
              const retrySets = sets.filter((s) => ids.has(s.id));
              if (retrySets.length === 0 || !current) return;
              onStart({
                skill: activeSkill!,
                part: current.part,
                sets: retrySets,
                retry: true,
                wrongQuestionIdsBySet: last?.wrongQuestionsBySet,
              });
            }}
          >
            Làm lại câu sai ({wrongCount})
          </Button>
        )}
      </div>
    </div>
  );
}
