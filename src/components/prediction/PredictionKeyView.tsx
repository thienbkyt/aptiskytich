import { useEffect, useMemo, useRef, useState } from "react";
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
  Eye,
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
import ReadingMarathonEngine from "@/components/practice/ReadingMarathonEngine";
import ListeningMarathonEngine from "@/components/practice/ListeningMarathonEngine";
import WritingMarathonEngine from "@/components/practice/WritingMarathonEngine";
import SpeakingBrowseViewer from "@/components/speaking/SpeakingBrowseViewer";

type Priority = "high" | "medium" | "low" | "backup";
type PrioFilter = "all" | Priority;
type DoneFilter = "all" | "undone" | "done";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
  backup: "Backup",
};

const PRIORITY_CHIP_STYLE: Record<Priority, React.CSSProperties> = {
  high: { background: "#CC1C01", color: "#fff", border: "1px solid #CC1C01" },
  medium: { background: "#FEAD5F", color: "#4D0D0D", border: "1px solid #FEAD5F" },
  low: {
    background: "var(--surface-0, hsl(var(--background)))",
    color: "inherit",
    border: "1px solid var(--border-strong, hsl(var(--border)))",
  },
  backup: {
    background: "transparent",
    color: "var(--text-secondary, hsl(var(--muted-foreground)))",
    border: "1px dashed var(--border-strong, hsl(var(--border)))",
  },
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

const GRID = "minmax(0,1fr) 92px 82px 60px 92px";

/** Same gradient as the "Thi thử" CTA in Navbar.tsx */
const BRAND_GRADIENT = "linear-gradient(to right, #CC1C01, #FEAD5F)";


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
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all");
  const [partFilter, setPartFilter] = useState<string>("all");
  const [marathon, setMarathon] = useState<MarathonState | null>(null);
  const [browse, setBrowse] = useState<{ sets: ExamSetRow[]; part: string } | null>(null);

  const stripRef = useRef<HTMLDivElement | null>(null);

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

  // Always exactly one skill selected; default Speaking
  useEffect(() => {
    if (availableSkills.length === 0) { setActiveSkill(null); return; }
    if (activeSkill && availableSkills.includes(activeSkill)) return;
    setActiveSkill(availableSkills.includes("speaking") ? "speaking" : availableSkills[0]);
  }, [availableSkills]);

  // Reset part filter when skill changes
  useEffect(() => { setPartFilter("all"); }, [activeSkill]);

  const skillItems = useMemo(
    () => items.filter((it) => (it.skill || "other").toLowerCase() === activeSkill),
    [items, activeSkill]
  );

  const availableParts = useMemo(() => {
    const m = new Map<string, number>();
    skillItems.forEach((it) => {
      const p = normalizePart(it.part || "") || "other";
      m.set(p, (m.get(p) ?? 0) + 1);
    });
    return Array.from(m.keys()).sort((a, b) => a.localeCompare(b));
  }, [skillItems]);

  const matchPrio = (p: Priority) => prioFilter === "all" || p === prioFilter;
  const matchDone = (id: string) =>
    doneFilter === "all" || (doneFilter === "done" ? best.has(id) : !best.has(id));
  const matchPart = (part: string | null) =>
    partFilter === "all" || (normalizePart(part || "") || "other") === partFilter;

  const visibleItems = useMemo(() => {
    const rank: Priority[] = ["high", "medium", "low", "backup"];
    return skillItems
      .filter((it) => matchPrio(it.priority) && matchDone(it.exam_set_id) && matchPart(it.part))
      .slice()
      .sort((a, b) => {
        const d = rank.indexOf(a.priority) - rank.indexOf(b.priority);
        if (d !== 0) return d;
        return a.sort_order - b.sort_order;
      });
  }, [skillItems, prioFilter, doneFilter, partFilter, best]);

  // Sets used by the action card: single part group (engines take one partType)
  const actionGroup = useMemo(() => {
    const pool = skillItems.filter((it) => matchPrio(it.priority) && matchPart(it.part) && it.set);
    const m = new Map<string, ExamSetRow[]>();
    pool.forEach((it) => {
      const p = normalizePart(it.part || "") || "other";
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(it.set!);
    });
    const entries = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return null;
    const [part, sets] = entries[0];
    return { part, sets, singlePart: entries.length === 1 };
  }, [skillItems, prioFilter, partFilter]);

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

  // last 7 key days, ascending (oldest -> newest)
  const strip = useMemo(
    () => keys.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-7),
    [keys]
  );

  const newestId = strip[strip.length - 1]?.id;

  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [strip.length]);

  // ---- Overlays ----
  if (browse) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <SpeakingBrowseViewer
          sets={browse.sets}
          partType={(browse.part as any) || "part1"}
          partLabel={partLabelFor("speaking", browse.part)}
          onExit={() => setBrowse(null)}
        />
      </div>
    );
  }

  if (marathon) {
    const label = `${SKILL_LABEL[marathon.skill] || marathon.skill} · Marathon ${partLabelFor(marathon.skill, marathon.part)}`;
    const close = () => setMarathon(null);
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        {marathon.skill === "reading" && (
          <ReadingMarathonEngine sets={marathon.sets} partType={marathon.part as any} skillLabel={label} persist onExit={close} />
        )}
        {marathon.skill === "listening" && (
          <ListeningMarathonEngine sets={marathon.sets} partType={marathon.part as any} skillLabel={label} persist onExit={close} />
        )}
        {marathon.skill === "writing" && (
          <WritingMarathonEngine
            sets={marathon.sets}
            partType={marathon.part.replace("part", "task") as any}
            skillLabel={label}
            persist
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

  const prioName = prioFilter === "all" ? "" : `ưu tiên ${PRIORITY_LABEL[prioFilter].toLowerCase()}`;
  const partChosen = partFilter !== "all";
  const actionCount = partChosen ? actionGroup?.sets.length ?? 0 : 0;
  const partName = partChosen && actionGroup ? partLabelFor(activeSkill || "", actionGroup.part) : "";
  const actionTitleTail = [prioName, SKILL_LABEL[activeSkill || ""] || activeSkill || "", partName]
    .filter(Boolean)
    .join(" ");
  const isSpeaking = activeSkill === "speaking";
  const marathonSupported = !!activeSkill && ["reading", "listening", "writing"].includes(activeSkill);
  const actionDisabled = !partChosen || actionCount === 0 || (!isSpeaking && !marathonSupported);


  return (
    <div className="space-y-5">
      {/* 1. Date strip */}
      <div className="flex items-stretch gap-2">
        <div ref={stripRef} className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-stretch gap-2 pb-1">
            {strip.map((k) => {
              const d = new Date(k.date + "T00:00:00");
              const on = k.id === selectedKeyId;
              const isNewest = k.id === newestId;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelectedKeyId(k.id)}
                  className={cn(
                    "shrink-0 min-w-[68px] rounded-xl px-3 py-2 text-center transition-colors",
                    on ? "font-semibold" : "border border-border bg-card hover:bg-muted",
                  )}
                  style={
                    on
                      ? {
                          border: "1.5px solid #CC1C01",
                          color: "#CC1C01",
                          background: "var(--bg-danger, rgba(204,28,1,0.08))",
                        }
                      : undefined
                  }
                >
                  <div className="text-[11px] leading-tight opacity-80">{WEEKDAY_VI[d.getDay()]}</div>
                  <div className="text-sm font-bold leading-tight" style={on ? { color: "#CC1C01" } : undefined}>
                    {format(d, "dd/MM")}
                  </div>
                  {isNewest && k.date === todayStr && (
                    <div className="text-[10px] leading-tight opacity-70">hôm nay</div>
                  )}
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
                  onClick={() => setActiveSkill(sk)}
                  className={cn(
                    "rounded-xl px-3 py-3 text-left transition-colors",
                    on ? "text-white shadow-[0_4px_14px_rgba(204,28,1,0.35)]" : "border border-border hover:bg-muted/50",
                  )}
                  style={
                    on
                      ? { background: BRAND_GRADIENT }
                      : { background: "var(--surface-1, hsl(var(--card)))" }
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4 shrink-0")} style={{ color: on ? "#fff" : "#CC1C01" }} />
                    <span className={cn("text-sm font-semibold truncate", on ? "text-white" : "text-foreground")}>
                      {SKILL_LABEL[sk] || sk}
                    </span>
                  </div>
                  <p className={cn("mt-1", on ? "text-white" : "text-foreground")}>
                    <span style={{ fontSize: 19, fontWeight: 500 }}>{all.length}</span>{" "}
                    <span className="text-xs">đề</span>
                  </p>
                  <p className={cn("text-[11px]", on ? "text-white/90" : "text-muted-foreground")}>đã làm {done}</p>
                </button>
              );
            })}

          </div>

          {/* 3. Filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Ưu tiên</span>
              {(["all", "high", "medium", "low", "backup"] as PrioFilter[]).map((v) => (
                <FilterChip
                  key={v}
                  active={prioFilter === v}
                  onClick={() => setPrioFilter(v)}
                  label={v === "all" ? "Tất cả" : PRIORITY_LABEL[v as Priority]}
                />
              ))}
              <span className="w-px h-5 bg-border mx-1" />
              <FilterChip
                active={doneFilter === "undone"}
                onClick={() => setDoneFilter((d) => (d === "undone" ? "all" : "undone"))}
                label="Chưa làm"
              />
              <FilterChip
                active={doneFilter === "done"}
                onClick={() => setDoneFilter((d) => (d === "done" ? "all" : "done"))}
                label="Đã làm"
              />
            </div>
            {availableParts.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">Part</span>
                <FilterChip active={partFilter === "all"} onClick={() => setPartFilter("all")} label="Tất cả" />
                {availableParts.map((p) => (
                  <FilterChip
                    key={p}
                    active={partFilter === p}
                    onClick={() => setPartFilter(p)}
                    label={partLabelFor(activeSkill || "", p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 4. Action card */}
          <div
            className="rounded-xl px-4 py-2.5"
            style={
              partChosen
                ? { border: "2px solid #CC1C01" }
                : {
                    border: "0.5px dashed var(--border-strong, hsl(var(--border)))",
                    background: "var(--surface-1, hsl(var(--card)))",
                  }
            }
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className="text-[11px] font-semibold border-0 gap-1 text-white shrink-0"
                style={partChosen ? { background: BRAND_GRADIENT } : { background: "hsl(var(--muted-foreground))" }}
              >
                {isSpeaking ? <Eye className="w-3 h-3" /> : <InfinityIcon className="w-3 h-3" />}
                {isSpeaking ? "Xem đề" : "Marathon"}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold tracking-wide shrink-0">PRO</Badge>
              <span className="text-sm font-semibold text-foreground truncate">
                {isSpeaking ? "Xem" : "Luyện"} {actionCount} đề {actionTitleTail}
              </span>
              <Button
                size="sm"
                disabled={actionDisabled}
                className="ml-auto gap-1.5 font-semibold text-white hover:opacity-90 shrink-0 border-0 disabled:cursor-not-allowed"
                style={
                  actionDisabled
                    ? { background: BRAND_GRADIENT, opacity: 0.45, cursor: "not-allowed" }
                    : { background: BRAND_GRADIENT }
                }
                onClick={() => {
                  if (!actionGroup || !activeSkill || !partChosen) return;
                  if (isSpeaking) setBrowse({ sets: actionGroup.sets, part: actionGroup.part });
                  else setMarathon({ skill: activeSkill, part: actionGroup.part, sets: actionGroup.sets });
                }}
              >
                {isSpeaking ? "Xem đề" : "Bắt đầu"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {!partChosen && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {isSpeaking
                  ? "Chọn một Part cụ thể ở trên để xem đề liên tục"
                  : "Chọn một Part cụ thể ở trên để luyện marathon"}
              </p>
            )}
            {partChosen && isSpeaking && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Bài nói mẫu tham khảo — chỉ để xem, không ghi âm, không chấm điểm.
              </p>
            )}
          </div>


          {/* 5. Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div
              className="hidden sm:grid items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="min-w-0">Tên đề</div>
              <div>Part</div>
              <div>Ưu tiên</div>
              <div>Điểm</div>
              <div>Trạng thái</div>
            </div>
            {visibleItems.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">Không có đề nào khớp bộ lọc</p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleItems.map((it) => {
                  const sk = (it.skill || "other").toLowerCase();
                  const b = best.get(it.exam_set_id);
                  const partText = partLabelFor(sk, normalizePart(it.part || ""));
                  const chipEl = (
                    <span
                      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={PRIORITY_CHIP_STYLE[it.priority] || PRIORITY_CHIP_STYLE.medium}
                    >
                      {PRIORITY_LABEL[it.priority] || PRIORITY_LABEL.medium}
                    </span>
                  );
                  const scoreEl = b ? (
                    <span className="text-xs font-semibold text-foreground">{b.score}/{b.total}</span>
                  ) : null;
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
                        <div className="hidden sm:grid items-center gap-3" style={{ gridTemplateColumns: GRID }}>
                          <div className="min-w-0 text-sm font-medium text-foreground truncate">{it.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{partText}</div>
                          <div>{chipEl}</div>
                          <div>{scoreEl}</div>
                          <div>{statusEl}</div>
                        </div>
                        {/* mobile 2-tier */}
                        <div className="sm:hidden">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{it.title}</span>
                            {scoreEl}
                            {chipEl}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground truncate">{partText}</span>
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
            Hiện {visibleItems.length} đề · {SKILL_LABEL[activeSkill || ""] || activeSkill}
            {selectedDate ? ` · key ${format(selectedDate, "dd/MM")}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
