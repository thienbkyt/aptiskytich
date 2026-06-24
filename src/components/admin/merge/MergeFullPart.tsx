import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, Loader2, Layers, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { safeRandomId } from "@/lib/browserCompat";

type SkillKey = "speaking" | "listening" | "reading" | "writing" | "grammar_vocab";

const SKILL_OPTIONS: { value: SkillKey; label: string }[] = [
  { value: "speaking", label: "Speaking" },
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "grammar_vocab", label: "Grammar & Vocabulary" },
];

const ALL_SKILLS: SkillKey[] = ["speaking", "listening", "reading", "writing", "grammar_vocab"];

interface ExamSetItem {
  id: string;
  title: string;
  part: string;
  skill: string;
  full_test_id: string | null;
  full_test_category: string | null;
}

// Extract prefix like "Đề 01" / "Đề 1" from a title. Returns normalized "Đề NN" (zero-padded 2 digits) or null.
// IMPORTANT: titles in DB may be stored in decomposed Unicode (e.g. "Đ"+"e"+combining marks),
// so we normalize to NFC first to ensure the regex matches both forms.
const extractDePrefix = (title: string): string | null => {
  if (!title) return null;
  const normalized = title.normalize("NFC");
  const m = normalized.match(/^\s*Đề\s*0*(\d+)/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (!Number.isFinite(num)) return null;
  return `Đề ${String(num).padStart(2, "0")}`;
};

const MergeFullPart = () => {
  const [skill, setSkill] = useState<SkillKey>("speaking");
  const [sets, setSets] = useState<ExamSetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({}); // partKey -> exam_set_id
  const [autoMerging, setAutoMerging] = useState(false);
  const [autoConfirmOpen, setAutoConfirmOpen] = useState(false);
  const [autoAllSkills, setAutoAllSkills] = useState(false);
  const [autoPreview, setAutoPreview] = useState<{ groups: number; sets: number }>({ groups: 0, sets: 0 });

  const loadSetsForSkill = async (s: SkillKey) => {
    const { data, error } = await supabase
      .from("exam_sets")
      .select("id, title, part, skill, full_test_id, full_test_category")
      .eq("skill", s)
      .order("part", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Lỗi tải bộ đề", description: error.message, variant: "destructive" });
      return [] as ExamSetItem[];
    }
    return (data || []) as ExamSetItem[];
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setSelected({});
      const data = await loadSetsForSkill(skill);
      setSets(data);
      setLoading(false);
    })();
  }, [skill]);

  // Group by Part. For grammar_vocab we MUST distinguish "Part 1 - Grammar" from
  // "Vocab Part 1 - Word Synonyms" (both match /Part 1/), otherwise the dropdown
  // merges 6 distinct parts into 5 buckets and only one of each pair can be chosen.
  const grouped = useMemo(() => {
    const map = new Map<string, ExamSetItem[]>();
    for (const s of sets) {
      let key: string;
      if (skill === "grammar_vocab") {
        const raw = (s.part || "").trim();
        const isVocab = /vocab/i.test(raw);
        const m = raw.match(/Part\s*(\d+)/i);
        if (isVocab && m) key = `Vocab Part ${m[1]}`;
        else if (m) key = `Grammar Part ${m[1]}`;
        else key = raw || "Khác";
      } else {
        const m = s.part?.match(/Part\s*(\d+)/i);
        key = m ? `Part ${m[1]}` : s.part || "Khác";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      // Grammar before Vocab, then numeric order
      const rank = (k: string) => (k.startsWith("Grammar") ? 0 : k.startsWith("Vocab") ? 1 : 2);
      const ra = rank(a[0]), rb = rank(b[0]);
      if (ra !== rb) return ra - rb;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [sets, skill]);

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
    const fullTestId = safeRandomId("full_part");
    const { error } = await supabase
      .from("exam_sets")
      .update({ full_test_id: fullTestId, full_test_title: title.trim(), full_test_category: null })
      .in("id", ids);

    setSaving(false);
    if (error) {
      toast({ title: "Lưu thất bại", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã ghép Full Part", description: `${ids.length} bộ đề đã được gán vào "${title}"` });
    setTitle("");
    setSelected({});
    setSets(await loadSetsForSkill(skill));
  };

  // ---- Auto merge by "Đề NN" prefix ----
  const computeAutoPreview = async (allSkills: boolean): Promise<{ groups: number; sets: number }> => {
    const skills = allSkills ? ALL_SKILLS : [skill];
    let totalGroups = 0;
    let totalSets = 0;
    for (const s of skills) {
      const data = await loadSetsForSkill(s);
      const groups = new Map<string, ExamSetItem[]>();
      for (const item of data) {
        if (item.full_test_id) continue;
        const prefix = extractDePrefix(item.title);
        if (!prefix) continue;
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix)!.push(item);
      }
      for (const [, items] of groups) {
        const uniqueParts = new Set(items.map((i) => i.part));
        if (uniqueParts.size >= 2) {
          totalGroups += 1;
          totalSets += items.length;
        }
      }
    }
    return { groups: totalGroups, sets: totalSets };
  };

  const openAutoConfirm = async () => {
    const preview = await computeAutoPreview(autoAllSkills);
    setAutoPreview(preview);
    setAutoConfirmOpen(true);
  };

  const runAutoMerge = async () => {
    setAutoConfirmOpen(false);
    setAutoMerging(true);

    const skills = autoAllSkills ? ALL_SKILLS : [skill];

    // Pre-fetch existing prefix → full_test_id mappings, but ONLY from rows that are also
    // Full Part merges (full_test_category IS NULL). Reusing a full_test_id from a multi-skill
    // Full Test merge (full_test_category = 'aptis'/'key') would pull the newly merged parts
    // into the Aptis Full Test section instead of the per-skill Full Part section.
    const { data: existingAll, error: existingErr } = await supabase
      .from("exam_sets")
      .select("title, full_test_id")
      .not("full_test_id", "is", null)
      .is("full_test_category", null);

    if (existingErr) {
      setAutoMerging(false);
      toast({ title: "Không tải được dữ liệu hiện có", description: existingErr.message, variant: "destructive" });
      return;
    }

    const prefixToFullTestId = new Map<string, string>();
    for (const row of existingAll || []) {
      const p = extractDePrefix(row.title || "");
      if (p && row.full_test_id && !prefixToFullTestId.has(p)) {
        prefixToFullTestId.set(p, row.full_test_id as string);
      }
    }

    let mergedGroups = 0;
    let mergedSets = 0;
    const errors: string[] = [];

    for (const s of skills) {
      const data = await loadSetsForSkill(s);
      const groups = new Map<string, ExamSetItem[]>();
      for (const item of data) {
        if (item.full_test_id) continue;
        const prefix = extractDePrefix(item.title);
        if (!prefix) continue;
        if (!groups.has(prefix)) groups.set(prefix, []);
        groups.get(prefix)!.push(item);
      }

      for (const [prefix, items] of groups) {
        const uniqueParts = new Set(items.map((i) => i.part));
        if (uniqueParts.size < 2) continue;

        let fullTestId = prefixToFullTestId.get(prefix);
        if (!fullTestId) {
          fullTestId = safeRandomId("full_part");
          prefixToFullTestId.set(prefix, fullTestId);
        }

        const ids = items.map((i) => i.id);
        const { error } = await supabase
          .from("exam_sets")
          .update({ full_test_id: fullTestId, full_test_title: prefix, full_test_category: null })
          .in("id", ids);

        if (error) {
          errors.push(`${s} / ${prefix}: ${error.message}`);
          continue;
        }
        mergedGroups += 1;
        mergedSets += ids.length;
      }
    }

    setAutoMerging(false);

    if (errors.length > 0) {
      toast({
        title: "Hoàn tất với lỗi",
        description: `Ghép ${mergedGroups} nhóm (${mergedSets} bộ đề). Lỗi: ${errors.length}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✓ Tự động ghép xong",
        description: `Đã ghép ${mergedGroups} nhóm (${mergedSets} bộ đề)${autoAllSkills ? " cho 5 kỹ năng" : ""}.`,
      });
    }

    setSets(await loadSetsForSkill(skill));
  };

  return (
    <div className="space-y-5">
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-bold text-foreground">Ghép Full Part theo kỹ năng</h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAllSkills}
                onChange={(e) => setAutoAllSkills(e.target.checked)}
                className="accent-primary"
              />
              Ghép cho cả 5 kỹ năng
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={openAutoConfirm}
              disabled={autoMerging}
              className="gap-1.5"
            >
              {autoMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Tự động ghép theo tên đề
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Chọn 1 bộ đề cho mỗi Part, đặt tên rồi bấm Lưu. Hoặc dùng <b>Tự động ghép theo tên đề</b> để gộp các bộ đề có cùng prefix <code className="text-xs">Đề NN</code> (ví dụ <code className="text-xs">Đề 01</code>) thành 1 Full Part.
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
            <Label className="text-xs text-muted-foreground mb-1 block">Tên Full Part (ghép thủ công)</Label>
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

      <AlertDialog open={autoConfirmOpen} onOpenChange={setAutoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận tự động ghép</AlertDialogTitle>
            <AlertDialogDescription>
              Sẽ ghép <b>{autoPreview.groups}</b> nhóm ({autoPreview.sets} bộ đề) theo prefix <code>Đề NN</code>
              {autoAllSkills ? " trên cả 5 kỹ năng" : ` cho kỹ năng ${SKILL_OPTIONS.find((s) => s.value === skill)?.label}`}.
              <br />
              Bộ đề đã có <code>full_test_id</code> sẽ được bỏ qua. Nhóm cùng prefix nhưng khác kỹ năng sẽ dùng chung 1 <code>full_test_id</code> để giữ liên kết Full Test.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={runAutoMerge} disabled={autoPreview.groups === 0}>
              Ghép ngay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MergeFullPart;
