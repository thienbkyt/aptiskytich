import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Save, Search, Sparkles, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePart } from "@/hooks/useExamSets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Priority = "high" | "medium" | "low" | "backup";

interface PredictionKey {
  id: string;
  date: string;
  title: string | null;
  is_published: boolean;
}

interface ExamSetRow {
  id: string;
  title: string;
  skill: string | null;
  part: string | null;
}

interface PredictionItem {
  id: string;
  key_id: string;
  exam_set_id: string;
  priority: Priority;
  sort_order: number;
  exam_set?: ExamSetRow | null;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
  backup: "Backup",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-slate-100 text-slate-700 border-slate-300",
  backup: "bg-blue-100 text-blue-700 border-blue-300",
};

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

const AdminPrediction = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [keyRow, setKeyRow] = useState<PredictionKey | null>(null);
  const [title, setTitle] = useState("");
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<PredictionItem[]>([]);

  // search exam sets
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ExamSetRow[]>([]);
  const [addingPriority, setAddingPriority] = useState<Priority>("medium");
  const [bulkText, setBulkText] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const dateStr = useMemo(() => ymd(date), [date]);

  // Load key + items for selected date
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: k } = await supabase
        .from("prediction_keys")
        .select("*")
        .eq("date", dateStr)
        .maybeSingle();
      if (cancelled) return;
      if (k) {
        setKeyRow(k as PredictionKey);
        setTitle((k as PredictionKey).title ?? "");
        setPublished(!!(k as PredictionKey).is_published);

        const { data: its } = await supabase
          .from("prediction_items")
          .select("*, exam_set:exam_sets(id,title,skill,part)")
          .eq("key_id", (k as PredictionKey).id)
          .order("sort_order", { ascending: true });
        if (!cancelled) setItems((its ?? []) as any);
      } else {
        setKeyRow(null);
        setTitle("");
        setPublished(false);
        setItems([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr]);

  // Search exam sets (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      const term = `%${search.trim()}%`;
      const { data } = await supabase
        .from("exam_sets")
        .select("id,title,skill,part")
        .or(`title.ilike.${term},skill.ilike.${term},part.ilike.${term}`)
        .order("created_at", { ascending: false })
        .limit(30);
      setResults((data ?? []) as ExamSetRow[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const ensureKey = async (): Promise<PredictionKey | null> => {
    if (keyRow) return keyRow;
    const { data, error } = await supabase
      .from("prediction_keys")
      .insert({ date: dateStr, title: title || null, is_published: published })
      .select()
      .single();
    if (error) {
      toast.error("Không tạo được key: " + error.message);
      return null;
    }
    setKeyRow(data as PredictionKey);
    return data as PredictionKey;
  };

  const saveKey = async () => {
    setSaving(true);
    if (!keyRow) {
      const { data, error } = await supabase
        .from("prediction_keys")
        .insert({ date: dateStr, title: title || null, is_published: published })
        .select()
        .single();
      if (error) toast.error(error.message);
      else {
        setKeyRow(data as PredictionKey);
        toast.success("Đã tạo key " + dateStr);
      }
    } else {
      const { error } = await supabase
        .from("prediction_keys")
        .update({ title: title || null, is_published: published })
        .eq("id", keyRow.id);
      if (error) toast.error(error.message);
      else toast.success("Đã lưu");
    }
    setSaving(false);
  };

  const addItem = async (set: ExamSetRow) => {
    const k = await ensureKey();
    if (!k) return;
    if (items.some((i) => i.exam_set_id === set.id)) {
      toast.info("Đề này đã có trong key");
      return;
    }
    const sort_order = items.length;
    const { data, error } = await supabase
      .from("prediction_items")
      .insert({
        key_id: k.id,
        exam_set_id: set.id,
        priority: addingPriority,
        sort_order,
      })
      .select("*, exam_set:exam_sets(id,title,skill,part)")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => [...prev, data as any]);
    toast.success("Đã thêm: " + set.title);
  };

  const PRIO_MAP: Record<string, Priority> = {
    "cao": "high", "high": "high",
    "vừa": "medium", "vua": "medium", "medium": "medium",
    "thấp": "low", "thap": "low", "low": "low",
    "backup": "backup",
  };

  const bulkAdd = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBulkRunning(true);
    const k = await ensureKey();
    if (!k) { setBulkRunning(false); return; }
    let ok = 0, fail = 0;
    let currentItems = [...items];
    for (const line of lines) {
      const parts = line.split("|").map((s) => s.trim());
      if (parts.length < 3) { fail++; continue; }
      const [skillRaw, partRaw, titleRaw, prioRaw] = parts;
      const skill = skillRaw.toLowerCase();
      const priority: Priority = PRIO_MAP[(prioRaw || "medium").toLowerCase()] ?? "medium";
      const wantPart = normalizePart(partRaw);
      const { data } = await supabase
        .from("exam_sets")
        .select("id,title,skill,part")
        .eq("skill", skill)
        .ilike("title", `%${titleRaw}%`)
        .limit(50);
      const match = (data ?? []).find((r: any) => normalizePart(r.part || "") === wantPart);
      if (!match) { fail++; continue; }
      if (currentItems.some((i) => i.exam_set_id === match.id)) { fail++; continue; }
      const sort_order = currentItems.length;
      const { data: inserted, error } = await supabase
        .from("prediction_items")
        .insert({ key_id: k.id, exam_set_id: match.id, priority, sort_order })
        .select("*, exam_set:exam_sets(id,title,skill,part)")
        .single();
      if (error || !inserted) { fail++; continue; }
      currentItems.push(inserted as any);
      ok++;
    }
    setItems(currentItems);
    setBulkRunning(false);
    setBulkText("");
    toast.success(`Đã thêm ${ok}, lỗi ${fail}`);
  };

  const updateItem = async (id: string, patch: { priority?: Priority; sort_order?: number }) => {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("prediction_items").update(patch).eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  const deleteItem = async (id: string) => {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from("prediction_items").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  };

  const moveItem = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    const reordered = next.map((it, k) => ({ ...it, sort_order: k }));
    setItems(reordered);
    await Promise.all(
      reordered.map((it) =>
        supabase.from("prediction_items").update({ sort_order: it.sort_order }).eq("id", it.id),
      ),
    );
  };

  const grouped = useMemo(() => {
    const g: Record<string, PredictionItem[]> = {};
    items.forEach((it) => {
      const sk = it.exam_set?.skill || "Khác";
      (g[sk] ||= []).push(it);
    });
    return g;
  }, [items]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-heading font-extrabold">Key Dự Đoán</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Chọn ngày & cấu hình key</CardTitle>
              <CardDescription>Mỗi ngày có 1 key duy nhất. Bật "Xuất bản" để user thấy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label className="mb-2 block">Ngày</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(date, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[240px]">
                  <Label className="mb-2 block">Tiêu đề</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Key Dự Đoán ${format(date, "dd/MM/yyyy")}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={published} onCheckedChange={setPublished} id="pub" />
                  <Label htmlFor="pub">Xuất bản</Label>
                </div>
                <Button onClick={saveKey} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Lưu
                </Button>
              </div>
              {keyRow && (
                <div className="text-sm text-muted-foreground">
                  Trạng thái:{" "}
                  <Badge variant={keyRow.is_published ? "default" : "secondary"}>
                    {keyRow.is_published ? "Đã xuất bản" : "Nháp"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Thêm đề vào key</CardTitle>
              <CardDescription>Tìm theo tên / skill / part. Chọn mức ưu tiên trước khi thêm.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[260px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm đề thi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={addingPriority} onValueChange={(v) => setAddingPriority(v as Priority)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {searching && <div className="text-sm text-muted-foreground">Đang tìm...</div>}
              {!searching && results.length > 0 && (
                <div className="border rounded-md divide-y max-h-80 overflow-auto">
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.skill} {r.part ? `· ${r.part}` : ""}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => addItem(r)}>
                        Thêm
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danh sách đề trong key ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Đang tải...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa có đề nào.</div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([skill, list]) => (
                    <div key={skill}>
                      <div className="font-semibold mb-2">{skill}</div>
                      <div className="space-y-2">
                        {list.map((it) => (
                          <div
                            key={it.id}
                            className="flex flex-wrap items-center gap-3 p-3 border rounded-md"
                          >
                            <div className="flex-1 min-w-[200px]">
                              <div className="font-medium">{it.exam_set?.title ?? "(đã xoá)"}</div>
                              <div className="text-xs text-muted-foreground">
                                {it.exam_set?.skill} {it.exam_set?.part ? `· ${it.exam_set?.part}` : ""}
                              </div>
                            </div>
                            <Badge className={cn("border", PRIORITY_COLOR[it.priority])} variant="outline">
                              {PRIORITY_LABEL[it.priority]}
                            </Badge>
                            <Select
                              value={it.priority}
                              onValueChange={(v) => updateItem(it.id, { priority: v as Priority })}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                                  <SelectItem key={p} value={p}>
                                    {PRIORITY_LABEL[p]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="outline" onClick={() => moveItem(it.id, -1)}>
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => moveItem(it.id, 1)}>
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteItem(it.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminPrediction;
