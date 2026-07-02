import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normalizePart } from "@/hooks/useExamSets";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Sparkles,
  BookOpen,
  Headphones,
  Type,
  PenLine,
  Mic,
  ChevronDown,
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

type Priority = "high" | "medium" | "low" | "backup";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Ưu tiên cao",
  medium: "Ưu tiên vừa",
  low: "Ưu tiên thấp",
  backup: "Backup",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  backup: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};
const PRIORITY_ORDER: Priority[] = ["high", "medium", "low", "backup"];

const SKILL_LABEL: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar_vocab: "Grammar & Vocabulary",
  grammar: "Grammar & Vocabulary",
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

function skillRoute(skill: string | null | undefined, setId: string): string {
  const s = (skill || "").toLowerCase();
  if (s === "reading") return `/reading?set=${setId}&jump=1&from=key`;
  if (s === "listening") return `/listening?set=${setId}&jump=1&from=key`;
  if (s === "grammar_vocab" || s === "grammar") return `/grammar?set=${setId}&jump=1&from=key`;
  if (s === "writing") return `/writing?set=${setId}&jump=1&from=key`;
  if (s === "speaking") return `/speaking?set=${setId}&jump=1&from=key`;
  return `/?set=${setId}`;
}

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
}

export default function PredictionKeyView() {
  const { user } = useAuth();
  const { isPremium, loading: tierLoading } = useIsPro();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [history, setHistory] = useState<Map<string, { count: number; best: number }>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activePriorities, setActivePriorities] = useState<Priority[]>([]);
  const [activeSkills, setActiveSkills] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<("done" | "undone")[]>(["undone"]);
  const [openSkill, setOpenSkill] = useState<string | undefined>(undefined);
  const togglePriority = (p: Priority) =>
    setActivePriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const toggleSkill = (s: string) =>
    setActiveSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleStatus = (s: "done" | "undone") =>
    setActiveStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

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
      const firstWithItems = rows.find((k: any) => k.itemCount > 0) || rows[0];
      if (firstWithItems) setSelectedKeyId(firstWithItems.id);
      setLoadingKeys(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load items for selected key
  useEffect(() => {
    if (!selectedKeyId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingItems(true);
      const { data } = await supabase
        .from("prediction_items")
        .select("id,exam_set_id,priority,sort_order,exam_sets(title,skill,part)")
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
      }));
      setItems(rows);
      setLoadingItems(false);
    })();
    return () => { cancelled = true; };
  }, [selectedKeyId]);

  // Load user history for items
  useEffect(() => {
    if (!user || items.length === 0) {
      setHistory(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(items.map((i) => i.exam_set_id)));
      const { data } = await supabase
        .from("test_results")
        .select("exam_set_id,score,total")
        .eq("user_id", user.id)
        .in("exam_set_id", ids);
      if (cancelled) return;
      const map = new Map<string, { count: number; best: number }>();
      (data || []).forEach((r: any) => {
        if (!r.exam_set_id || !r.total || r.total <= 0) return;
        const pct = Math.round((r.score / r.total) * 100);
        const prev = map.get(r.exam_set_id);
        if (!prev) map.set(r.exam_set_id, { count: 1, best: pct });
        else map.set(r.exam_set_id, { count: prev.count + 1, best: Math.max(prev.best, pct) });
      });
      setHistory(map);
    })();
    return () => { cancelled = true; };
  }, [user, items]);

  const availableSkills = useMemo(() => {
    const set = new Set(items.map((it) => (it.skill || "other").toLowerCase()));
    return Array.from(set).sort(
      (a, b) => (SKILL_ORDER.indexOf(a) + 1 || 999) - (SKILL_ORDER.indexOf(b) + 1 || 999)
    );
  }, [items]);

  // Overview counts (based on ALL items in key, ignoring filters)
  const overview = useMemo(() => {
    const total = items.length;
    let done = 0;
    let highUndone = 0;
    items.forEach((it) => {
      const isDone = history.has(it.exam_set_id);
      if (isDone) done++;
      if (it.priority === "high" && !isDone) highUndone++;
    });
    return { total, done, highUndone };
  }, [items, history]);

  const visibleItems = useMemo(() => {
    return items.filter((it) => {
      const sk = (it.skill || "other").toLowerCase();
      const okSkill = activeSkills.length === 0 || activeSkills.includes(sk);
      const okPrio = activePriorities.length === 0 || activePriorities.includes(it.priority);
      const done = history.has(it.exam_set_id);
      const okStatus =
        activeStatus.length === 0 ||
        (activeStatus.includes("done") && done) ||
        (activeStatus.includes("undone") && !done);
      return okSkill && okPrio && okStatus;
    });
  }, [items, activeSkills, activePriorities, activeStatus, history]);

  // skill → part → items
  const groupedBySkillPart = useMemo(() => {
    const bySkill = new Map<string, Map<string, ItemRow[]>>();
    visibleItems.forEach((it) => {
      const sk = (it.skill || "other").toLowerCase();
      const p = normalizePart(it.part || "") || "other";
      if (!bySkill.has(sk)) bySkill.set(sk, new Map());
      const pmap = bySkill.get(sk)!;
      if (!pmap.has(p)) pmap.set(p, []);
      pmap.get(p)!.push(it);
    });
    const skills = Array.from(bySkill.keys()).sort(
      (a, b) => (SKILL_ORDER.indexOf(a) + 1 || 999) - (SKILL_ORDER.indexOf(b) + 1 || 999),
    );
    return skills.map((sk) => {
      const pmap = bySkill.get(sk)!;
      const parts = Array.from(pmap.keys()).sort();
      const total = Array.from(pmap.values()).reduce((s, arr) => s + arr.length, 0);
      return {
        skill: sk,
        label: SKILL_LABEL[sk] || sk,
        total,
        parts: parts.map((p) => {
          const arr = pmap.get(p)!.slice().sort(
            (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
          );
          return { part: p, items: arr };
        }),
      };
    });
  }, [visibleItems]);




  // Load question counts per exam set
  const [qCount, setQCount] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (items.length === 0) { setQCount(new Map()); return; }
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(items.map((i) => i.exam_set_id)));
      const { data } = await supabase.from("exam_questions").select("exam_set_id").in("exam_set_id", ids);
      if (cancelled) return;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.exam_set_id, (m.get(r.exam_set_id) || 0) + 1));
      setQCount(m);
    })();
    return () => { cancelled = true; };
  }, [items]);

  const ymd = (d: Date) => format(d, "yyyy-MM-dd");
  const keyByDate = useMemo(() => {
    const m = new Map<string, KeyRow>();
    keys.forEach((k) => m.set(k.date, k));
    return m;
  }, [keys]);
  const keyDates = useMemo(() => keys.map((k) => new Date(k.date + "T00:00:00")), [keys]);
  const selectedDate = useMemo(() => {
    const k = keys.find((x) => x.id === selectedKeyId);
    return k ? new Date(k.date + "T00:00:00") : undefined;
  }, [keys, selectedKeyId]);

  if (loadingKeys || tierLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
        <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium mb-1">Chưa có Key Dự Đoán nào được công bố</p>
        <p className="text-sm text-muted-foreground">Quay lại sau nhé — key sẽ được cập nhật hằng ngày.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Date picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4 text-primary" /> Ngày:
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarDays className="w-4 h-4" />
              {selectedDate
                ? `${format(selectedDate, "dd/MM/yyyy")}${
                    keyByDate.get(ymd(selectedDate))?.title
                      ? ` · ${keyByDate.get(ymd(selectedDate))!.title}`
                      : ""
                  }`
                : "Chọn ngày"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 rounded-2xl border border-border shadow-xl bg-card"
            align="start"
            side="bottom"
            sideOffset={8}
          >
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

      {/* Overview */}
      {isPremium && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Đã làm</p>
              <p className="text-base font-bold text-foreground">
                {overview.done}<span className="text-muted-foreground font-medium">/{overview.total}</span>
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ưu tiên cao còn</p>
              <p className="text-base font-bold text-foreground">{overview.highUndone}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters — skill */}
      {availableSkills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Kỹ năng:</span>
          {availableSkills.map((s) => {
            const on = activeSkills.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSkill(s)}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                  on ? "bg-primary/15 text-primary border-primary/40" : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {SKILL_LABEL[s] || s}
              </button>
            );
          })}
          {activeSkills.length > 0 && (
            <button onClick={() => setActiveSkills([])} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Xoá</button>
          )}
        </div>
      )}

      {/* Filters — priority */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Ưu tiên:</span>
        {(["high", "medium", "low", "backup"] as Priority[]).map((p) => {
          const on = activePriorities.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                on ? PRIORITY_COLOR[p] : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {PRIORITY_LABEL[p]}
            </button>
          );
        })}
        {activePriorities.length > 0 && (
          <button onClick={() => setActivePriorities([])} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Xoá</button>
        )}
      </div>

      {/* Filters — status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Trạng thái:</span>
        {([["done", "Đã làm"], ["undone", "Chưa làm"]] as const).map(([val, label]) => {
          const on = activeStatus.includes(val);
          return (
            <button
              key={val}
              onClick={() => toggleStatus(val)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                on
                  ? (val === "done"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                      : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40")
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {label}
            </button>
          );
        })}
        {activeStatus.length > 0 && (
          <button onClick={() => setActiveStatus([])} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Xoá</button>
        )}
      </div>

      {/* Content */}
      {!isPremium ? (
        <UpgradeLock
          reason="premium"
          need="premium"
          featureLabel="Key Dự Đoán (Update hằng ngày)"
        />
      ) : loadingItems ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground font-medium">Chưa có key cho ngày này</p>
        </div>
      ) : groupedBySkillPart.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground font-medium">Không có đề phù hợp bộ lọc</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedBySkillPart.map((sk) => {
            const Icon = SKILL_ICON[sk.skill] || Sparkles;
            const open = openSkill === sk.skill;
            return (
              <div key={sk.skill} className="border border-border rounded-xl bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSkill(open ? undefined : sk.skill)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="flex-1 min-w-0 font-heading font-bold text-foreground">{sk.label}</p>
                  <Badge variant="outline" className="text-[11px]">{sk.total} đề</Badge>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="space-y-4">
                      {sk.parts.map((pg) => {
                        const isRL = sk.skill === "reading" || sk.skill === "listening";
                        const highCount = pg.items.filter((i) => i.priority === "high").length;
                        const partLabel = pg.part.replace(/^part(\d+)$/i, "Part $1");
                        const highPrimary = pg.items.filter((i) => i.priority === "high" || i.priority === "medium");
                        const lowSecondary = pg.items.filter((i) => i.priority === "low" || i.priority === "backup");
                        return (
                          <div key={pg.part} className="rounded-lg border border-border/60">
                            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 flex-wrap">
                              <p className="text-sm font-semibold text-foreground">
                                {partLabel} <span className="text-muted-foreground font-normal">· {pg.items.length} đề</span>
                              </p>
                              {isRL && (
                                <div className="flex flex-wrap gap-1.5">
                                  {highCount > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        navigate(
                                          `/${sk.skill}?marathon=${pg.part}&keyId=${selectedKeyId}&prio=high&from=key`,
                                        )
                                      }
                                      className="h-7 text-xs gap-1 border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/10"
                                    >
                                      <Sparkles className="w-3 h-3" /> Marathon Cao ({highCount})
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      navigate(
                                        `/${sk.skill}?marathon=${pg.part}&keyId=${selectedKeyId}&from=key`,
                                      )
                                    }
                                    className="h-7 text-xs gap-1"
                                  >
                                    <Sparkles className="w-3 h-3" /> Marathon cả part ({pg.items.length})
                                  </Button>
                                </div>
                              )}
                            </div>

                            <ul className="divide-y divide-border/60">
                              {highPrimary.map((it) => (
                                <ItemRowView key={it.id} it={it} history={history} qCount={qCount} />
                              ))}
                            </ul>

                            {lowSecondary.length > 0 && (
                              <details className="group">
                                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 border-t border-border/60">
                                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                  Ít ưu tiên ({lowSecondary.length})
                                </summary>
                                <ul className="divide-y divide-border/60">
                                  {lowSecondary.map((it) => (
                                    <ItemRowView key={it.id} it={it} history={history} qCount={qCount} />
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemRowView({
  it,
  history,
  qCount,
}: {
  it: ItemRow;
  history: Map<string, { count: number; best: number }>;
  qCount: Map<string, number>;
}) {
  const h = history.get(it.exam_set_id);
  const done = !!h;
  const n = qCount.get(it.exam_set_id) ?? 0;
  return (
    <li className="px-3 py-2.5 flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {it.title} <span className="text-xs text-muted-foreground font-normal">· {n} câu</span>
        </p>
        {done && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            {h!.count} lần · cao nhất {h!.best}%
          </p>
        )}
      </div>
      <Badge
        variant="outline"
        className={cn("text-[10px] font-semibold border shrink-0", PRIORITY_COLOR[it.priority])}
      >
        {PRIORITY_LABEL[it.priority]}
      </Badge>
      <Button
        asChild
        size="sm"
        variant={done ? "outline" : "default"}
        className={cn(
          "h-8 text-xs gap-1 shrink-0",
          !done && "bg-primary hover:bg-brand-brown text-white",
        )}
      >
        <Link to={skillRoute(it.skill, it.exam_set_id)}>
          {done ? "Làm lại" : "Luyện"} <ArrowRight className="w-3 h-3" />
        </Link>
      </Button>
    </li>
  );
}
