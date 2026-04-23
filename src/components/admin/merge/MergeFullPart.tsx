import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Layers } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SkillKey = "speaking" | "listening" | "reading" | "writing" | "grammar_vocab";

const SKILL_OPTIONS: { value: SkillKey; label: string }[] = [
  { value: "speaking", label: "Speaking" },
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "grammar_vocab", label: "Grammar & Vocabulary" },
];

interface ExamSetItem {
  id: string;
  title: string;
  part: string;
  skill: string;
  full_test_id: string | null;
}

const MergeFullPart = () => {
  const [skill, setSkill] = useState<SkillKey>("speaking");
  const [sets, setSets] = useState<ExamSetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({}); // partKey -> exam_set_id

  useEffect(() => {
    (async () => {
      setLoading(true);
      setSelected({});
      const { data, error } = await supabase
        .from("exam_sets")
        .select("id, title, part, skill, full_test_id")
        .eq("skill", skill)
        .order("part", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) {
        toast({ title: "Lỗi tải bộ đề", description: error.message, variant: "destructive" });
        setSets([]);
      } else {
        setSets((data || []) as ExamSetItem[]);
      }
      setLoading(false);
    })();
  }, [skill]);

  // Group by Part number (extract "Part X" from part string)
  const grouped = useMemo(() => {
    const map = new Map<string, ExamSetItem[]>();
    for (const s of sets) {
      const m = s.part?.match(/Part\s*(\d+)/i);
      const key = m ? `Part ${m[1]}` : s.part || "Khác";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sets]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Vui lòng nhập tên Full Part", variant: "destructive" });
      return;
    }
    const ids = Object.values(selected).filter(Boolean);
    if (ids.length === 0) {
      toast({ title: "Hãy chọn ít nhất 1 bộ đề", variant: "destructive" });
      return;
    }

    setSaving(true);
    const fullTestId = crypto.randomUUID();
    const { error } = await supabase
      .from("exam_sets")
      .update({ full_test_id: fullTestId, full_test_title: title.trim() })
      .in("id", ids);

    setSaving(false);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã ghép Full Part", description: `${ids.length} bộ đề đã được gán vào "${title}"` });
    setTitle("");
    setSelected({});
    // Refresh
    const { data } = await supabase
      .from("exam_sets")
      .select("id, title, part, skill, full_test_id")
      .eq("skill", skill)
      .order("part", { ascending: true })
      .order("created_at", { ascending: true });
    setSets((data || []) as ExamSetItem[]);
  };

  return (
    <div className="space-y-5">
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-foreground">Ghép Full Part theo kỹ năng</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Chọn 1 bộ đề cho mỗi Part, đặt tên rồi bấm Lưu. Full Part này sẽ tự xuất hiện ở tab "Full Part" của trang luyện kỹ năng tương ứng.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Kỹ năng</Label>
            <Select value={skill} onValueChange={(v) => setSkill(v as SkillKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tên Full Part</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Full Part Speaking - Bộ đề 1"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card">
          <p className="text-muted-foreground">Chưa có bộ đề nào cho kỹ năng này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([partKey, items]) => (
            <div key={partKey} className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-foreground">{partKey}</h4>
                <span className="text-xs text-muted-foreground">{items.length} bộ đề</span>
              </div>
              <Select
                value={selected[partKey] || ""}
                onValueChange={(v) => setSelected((prev) => ({ ...prev, [partKey]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn bộ đề --" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} {s.full_test_id ? "(đã ghép)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-brand-brown text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu Full Part
          </Button>
        </div>
      )}
    </div>
  );
};

export default MergeFullPart;
