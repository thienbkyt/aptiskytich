import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X, BookOpen, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Test {
  id: string;
  skill: string;
  part: string;
  title: string;
  time_limit: number;
  created_at: string;
  question_count?: number;
}

interface TestManagerProps {
  onSelectTest: (test: Test) => void;
  selectedTestId?: string;
}

const SKILLS = [
  { value: "grammar", label: "Grammar & Vocabulary" },
  { value: "reading", label: "Reading" },
  { value: "listening", label: "Listening" },
  { value: "speaking", label: "Speaking" },
  { value: "writing", label: "Writing" },
];

const PARTS: Record<string, string[]> = {
  grammar: ["Part 1"],
  reading: ["Part 1", "Part 2", "Part 3", "Part 4"],
  listening: ["Part 1", "Part 2", "Part 3", "Part 4"],
  speaking: ["Part 1", "Part 2", "Part 3", "Part 4"],
  writing: ["Part 1", "Part 2", "Part 3", "Part 4"],
};

const emptyForm = { skill: "grammar", part: "Part 1", title: "", time_limit: 30 };

const TestManager = ({ onSelectTest, selectedTestId }: TestManagerProps) => {
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSkill, setFilterSkill] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    setLoading(true);
    const { data: testsData, error } = await supabase
      .from("tests")
      .select("*")
      .order("skill")
      .order("part")
      .order("title");

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get question counts
    const { data: countData } = await supabase
      .from("questions")
      .select("test_id");

    const countMap: Record<string, number> = {};
    countData?.forEach((q) => {
      if (q.test_id) countMap[q.test_id] = (countMap[q.test_id] || 0) + 1;
    });

    setTests(
      (testsData || []).map((t) => ({
        ...t,
        question_count: countMap[t.id] || 0,
      }))
    );
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Thiếu tiêu đề", variant: "destructive" });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("tests")
        .update({ skill: form.skill, part: form.part, title: form.title, time_limit: form.time_limit })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Đã cập nhật bộ đề!" });
    } else {
      const { error } = await supabase
        .from("tests")
        .insert({ skill: form.skill, part: form.part, title: form.title, time_limit: form.time_limit });
      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Đã tạo bộ đề!" });
    }

    setCreating(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchTests();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá bộ đề này sẽ xoá tất cả câu hỏi bên trong. Tiếp tục?")) return;
    // Delete questions first
    await supabase.from("questions").delete().eq("test_id", id);
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã xoá bộ đề!" });
      fetchTests();
    }
  };

  const startEdit = (t: Test) => {
    setEditingId(t.id);
    setCreating(false);
    setForm({ skill: t.skill, part: t.part, title: t.title, time_limit: t.time_limit });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const filtered = filterSkill === "all" ? tests : tests.filter((t) => t.skill === filterSkill);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-foreground">Danh sách bộ đề ({tests.length})</h2>
        <Button onClick={() => { setCreating(true); setEditingId(null); setForm(emptyForm); }} className="gap-2">
          <Plus className="w-4 h-4" /> Tạo bộ đề
        </Button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {(creating || editingId) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-foreground">{editingId ? "Sửa bộ đề" : "Tạo bộ đề mới"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kỹ năng</Label>
                <Select value={form.skill} onValueChange={(v) => setForm({ ...form, skill: v, part: PARTS[v]?.[0] || "Part 1" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SKILLS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phần thi</Label>
                <Select value={form.part} onValueChange={(v) => setForm({ ...form, part: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(PARTS[form.skill] || ["Part 1"]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tiêu đề</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Test 1 - Tenses" />
              </div>
              <div className="space-y-2">
                <Label>Thời gian (phút)</Label>
                <Input type="number" value={form.time_limit} onChange={(e) => setForm({ ...form, time_limit: parseInt(e.target.value) || 30 })} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Lưu</Button>
              <Button onClick={cancel} variant="outline" className="gap-2"><X className="w-4 h-4" /> Huỷ</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {["all", ...SKILLS.map((s) => s.value)].map((s) => (
          <Button key={s} variant={filterSkill === s ? "default" : "outline"} size="sm" onClick={() => setFilterSkill(s)}>
            {s === "all" ? "Tất cả" : SKILLS.find((sk) => sk.value === s)?.label || s}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-10">Đang tải...</p>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có bộ đề nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`glass-card p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedTestId === t.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => onSelectTest(t)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {t.skill}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{t.part}</span>
                    <span className="text-xs text-muted-foreground">{t.time_limit} phút</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.question_count || 0} câu hỏi</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); startEdit(t); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestManager;
