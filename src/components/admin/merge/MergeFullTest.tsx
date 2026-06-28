import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, ClipboardCheck, Mic, Headphones, Brain, BookOpen, PenLine } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SkillKey = "speaking" | "listening" | "grammar_vocab" | "reading" | "writing";

const SKILL_SLOTS: { key: SkillKey; label: string; icon: typeof Mic }[] = [
  { key: "speaking", label: "Speaking", icon: Mic },
  { key: "listening", label: "Listening", icon: Headphones },
  { key: "grammar_vocab", label: "Grammar & Vocabulary", icon: Brain },
  { key: "reading", label: "Reading", icon: BookOpen },
  { key: "writing", label: "Writing", icon: PenLine },
];

interface FullPartGroup {
  fullTestId: string;
  title: string;
  skill: string;
  examSetIds: string[];
}

const MergeFullTest = () => {
  const [groups, setGroups] = useState<FullPartGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"aptis" | "key">("aptis");
  // skillKey -> selected fullTestId (which Full Part to use for that skill)
  const [selected, setSelected] = useState<Record<SkillKey, string>>({
    speaking: "",
    listening: "",
    grammar_vocab: "",
    reading: "",
    writing: "",
  });

  const loadGroups = async () => {
    setLoading(true);
    // Load all per-skill Full Part groups (exam_sets with full_test_id + category IS NULL).
    const { data, error } = await supabase
      .from("exam_sets")
      .select("id, full_test_id, full_test_title, skill")
      .not("full_test_id", "is", null)
      .is("full_test_category", null)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Lỗi tải Full Part", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const map = new Map<string, FullPartGroup>();
    for (const row of data || []) {
      if (!row.full_test_id) continue;
      const k = `${row.full_test_id}::${row.skill}`;
      if (!map.has(k)) {
        map.set(k, {
          fullTestId: row.full_test_id,
          title: row.full_test_title || "Full Part",
          skill: row.skill,
          examSetIds: [],
        });
      }
      map.get(k)!.examSetIds.push(row.id);
    }
    setGroups(Array.from(map.values()));
    setLoading(false);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const groupsBySkill = useMemo(() => {
    const m = new Map<SkillKey, FullPartGroup[]>();
    for (const g of groups) {
      const sk = g.skill as SkillKey;
      if (!m.has(sk)) m.set(sk, []);
      m.get(sk)!.push(g);
    }
    return m;
  }, [groups]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Vui lòng nhập tên bài thi", variant: "destructive" });
      return;
    }
    // Collect all exam_set ids from selected Full Parts
    const ids: string[] = [];
    for (const slot of SKILL_SLOTS) {
      const fullTestId = selected[slot.key];
      if (!fullTestId) {
        toast({ title: `Hãy chọn Full Part cho ${slot.label}`, variant: "destructive" });
        return;
      }
      const grp = groups.find((g) => g.fullTestId === fullTestId && g.skill === slot.key);
      if (grp) ids.push(...grp.examSetIds);
    }

    if (ids.length === 0) {
      toast({ title: "Không có bộ đề nào để ghép", variant: "destructive" });
      return;
    }

    setSaving(true);
    // Create the Full Test as a separate record; link to underlying exam_sets via full_test_members.
    // This intentionally does NOT mutate exam_sets, so Full Part groupings stay intact.
    const { data: ft, error: ftErr } = await supabase
      .from("full_tests")
      .insert({ title: title.trim(), category, is_published: true })
      .select("id")
      .single();

    if (ftErr || !ft) {
      setSaving(false);
      toast({ title: "Lưu thất bại", description: ftErr?.message || "Không tạo được Full Test", variant: "destructive" });
      return;
    }

    const rows = ids.map((examSetId, i) => ({
      full_test_id: ft.id,
      exam_set_id: examSetId,
      position: i,
    }));
    const { error: memErr } = await supabase.from("full_test_members").insert(rows);

    setSaving(false);

    if (memErr) {
      toast({ title: "Lưu thất bại", description: memErr.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Đã ghép Full Test",
      description: `Bài thi "${title}" đã hiển thị ở ${category === "aptis" ? "Bộ đề thi Aptis" : "Đề Key Dự Đoán (Update hằng ngày)"}`,
    });
    setTitle("");
    setSelected({ speaking: "", listening: "", grammar_vocab: "", reading: "", writing: "" });
    loadGroups();
  };

  return (
    <div className="space-y-5">
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-foreground">Ghép Full Test (5 kỹ năng)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Chọn 1 Full Part cho mỗi kỹ năng. Bài thi sẽ hiển thị ở trang Thi thử (/thi-thu) theo nhóm bạn chọn.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tên bài thi</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đề thi thử số 1 - Topic: Art club"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Hiển thị ở</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as "aptis" | "key")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aptis">Bộ đề thi Aptis</SelectItem>
                <SelectItem value="key">Bộ đề Key Aptis</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKILL_SLOTS.map((slot) => {
            const Icon = slot.icon;
            const opts = groupsBySkill.get(slot.key) || [];
            return (
              <div key={slot.key} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-primary" />
                  <h4 className="font-bold text-foreground">{slot.label}</h4>
                </div>
                <Select
                  value={selected[slot.key]}
                  onValueChange={(v) => setSelected((prev) => ({ ...prev, [slot.key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={opts.length === 0 ? "Chưa có Full Part" : "-- Chọn Full Part --"} />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((g) => (
                      <SelectItem key={g.fullTestId} value={g.fullTestId}>
                        {g.title} ({g.examSetIds.length} bộ)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-brand-brown text-white gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Lưu Full Test
      </Button>
    </div>
  );
};

export default MergeFullTest;
