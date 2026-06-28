import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function skillRoute(skill: string | null | undefined, setId: string): string {
  const s = (skill || "").toLowerCase();
  if (s === "reading") return `/reading?set=${setId}&jump=1`;
  if (s === "listening") return `/listening?set=${setId}&jump=1`;
  if (s === "grammar_vocab" || s === "grammar") return `/grammar?set=${setId}&jump=1`;
  if (s === "writing") return `/writing?set=${setId}&jump=1`;
  if (s === "speaking") return `/speaking?set=${setId}&jump=1`;
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

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [history, setHistory] = useState<Map<string, { count: number; best: number }>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  // Load keys
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingKeys(true);
      const { data } = await supabase
        .from("prediction_keys")
        .select("id,date,title,is_published")
        .eq("is_published", true)
        .order("date", { ascending: false });
      if (cancelled) return;
      const rows = (data || []) as any[];
      setKeys(rows);
      if (rows.length > 0) setSelectedKeyId(rows[0].id);
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

  const grouped = useMemo(() => {
    const bySkill = new Map<string, Map<Priority, ItemRow[]>>();
    items.forEach((it) => {
      const sk = (it.skill || "other").toLowerCase();
      if (!bySkill.has(sk)) bySkill.set(sk, new Map());
      const pmap = bySkill.get(sk)!;
      if (!pmap.has(it.priority)) pmap.set(it.priority, []);
      pmap.get(it.priority)!.push(it);
    });
    const skills = Array.from(bySkill.keys()).sort(
      (a, b) => (SKILL_ORDER.indexOf(a) + 1 || 999) - (SKILL_ORDER.indexOf(b) + 1 || 999),
    );
    return skills.map((sk) => ({
      skill: sk,
      label: SKILL_LABEL[sk] || sk,
      groups: PRIORITY_ORDER.filter((p) => bySkill.get(sk)!.has(p)).map((p) => ({
        priority: p,
        items: bySkill.get(sk)!.get(p)!,
      })),
    }));
  }, [items]);

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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="w-4 h-4 text-primary" /> Ngày:
        </div>
        <Select value={selectedKeyId ?? undefined} onValueChange={(v) => setSelectedKeyId(v)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Chọn ngày" />
          </SelectTrigger>
          <SelectContent>
            {keys.map((k) => {
              const d = new Date(k.date + "T00:00:00");
              return (
                <SelectItem key={k.id} value={k.id}>
                  {format(d, "dd/MM/yyyy")} {k.title ? `· ${k.title}` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Gate */}
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
      ) : (
        <div className="space-y-6">
          {grouped.map((sk) => (
            <div key={sk.skill}>
              <h3 className="text-base font-heading font-bold text-foreground mb-3">{sk.label}</h3>
              <div className="space-y-4">
                {sk.groups.map((g) => (
                  <div key={g.priority}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={cn("text-[11px] font-semibold border", PRIORITY_COLOR[g.priority])}>
                        {PRIORITY_LABEL[g.priority]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{g.items.length} đề</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {g.items.map((it) => {
                        const h = history.get(it.exam_set_id);
                        return (
                          <div
                            key={it.id}
                            className="tech-card bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground leading-snug">{it.title}</p>
                                {it.part && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{it.part}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-xs">
                              {h ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  Đã làm {h.count} lần · cao nhất {h.best}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Chưa làm</span>
                              )}
                            </div>
                            <Button asChild size="sm" className="w-full mt-1 bg-primary hover:bg-brand-brown text-white gap-1.5">
                              <Link to={skillRoute(it.skill, it.exam_set_id)}>
                                Luyện <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
