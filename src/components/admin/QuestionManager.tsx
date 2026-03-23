import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X, ArrowLeft, Upload, Headphones, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Question {
  id: string;
  skill: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  audio_url?: string | null;
  order_index: number;
  test_id: string | null;
}

interface QuestionManagerProps {
  testId: string;
  testTitle: string;
  testSkill: string;
  onBack: () => void;
}

const emptyForm = {
  question_text: "",
  options: ["", "", "", ""],
  correct_answer: 0,
  explanation: "",
  audio_url: "",
  order_index: 0,
};

const QuestionManager = ({ testId, testTitle, testSkill, onBack }: QuestionManagerProps) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchQuestions();
  }, [testId]);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("order_index");
    if (!error && data) {
      setQuestions(data.map((q) => ({ ...q, options: q.options as unknown as string[] })));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.question_text || form.options.some((o) => !o.trim())) {
      toast({ title: "Thiếu thông tin", description: "Điền đầy đủ câu hỏi và 4 đáp án.", variant: "destructive" });
      return;
    }

    const payload = {
      test_id: testId,
      skill: testSkill,
      question_text: form.question_text,
      options: form.options as unknown as any,
      correct_answer: form.correct_answer,
      explanation: form.explanation,
      audio_url: form.audio_url || null,
      order_index: form.order_index,
    };

    if (editingId) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Đã cập nhật!" });
    } else {
      const { error } = await supabase.from("questions").insert(payload as any);
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Đã thêm câu hỏi!" });
    }

    setCreating(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchQuestions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá câu hỏi này?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Đã xoá!" });
    fetchQuestions();
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setCreating(false);
    setForm({
      question_text: q.question_text,
      options: [...q.options],
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      audio_url: q.audio_url || "",
      order_index: q.order_index,
    });
  };

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ ...emptyForm, order_index: questions.length + 1 });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const uploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fileName = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("audio").upload(fileName, file);
      if (error) { toast({ title: "Lỗi upload", description: error.message, variant: "destructive" }); return; }
      // Store just the file path, not the full public URL
      setForm((prev) => ({ ...prev, audio_url: fileName }));
      toast({ title: "Đã upload audio!" });
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="font-heading font-bold text-foreground">{testTitle}</h2>
          <p className="text-xs text-muted-foreground">{testSkill} · {questions.length} câu hỏi</p>
        </div>
        <Button onClick={startCreate} className="ml-auto gap-2">
          <Plus className="w-4 h-4" /> Thêm câu hỏi
        </Button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {(creating || editingId) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass-card p-5 space-y-4">
            <h3 className="font-bold text-foreground">{editingId ? "Sửa câu hỏi" : "Thêm câu hỏi"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Đáp án đúng</Label>
                <Select value={String(form.correct_answer)} onValueChange={(v) => setForm({ ...form, correct_answer: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">A</SelectItem>
                    <SelectItem value="1">B</SelectItem>
                    <SelectItem value="2">C</SelectItem>
                    <SelectItem value="3">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Thứ tự</Label>
                <Input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Câu hỏi</Label>
              <Textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.options.map((opt, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs">Đáp án {String.fromCharCode(65 + i)}</Label>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...form.options];
                      newOpts[i] = e.target.value;
                      setForm({ ...form, options: newOpts });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Giải thích</Label>
              <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} />
            </div>
            {testSkill === "listening" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Headphones className="w-4 h-4" /> Audio URL</Label>
                <div className="flex gap-3">
                  <Input placeholder="Dán URL audio..." value={form.audio_url} onChange={(e) => setForm({ ...form, audio_url: e.target.value })} className="flex-1" />
                  <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={uploadAudio}>
                    <Upload className="w-4 h-4" /> Upload
                  </Button>
                </div>
                {form.audio_url && <audio controls src={form.audio_url} className="w-full mt-2" />}
              </div>
            )}
            <div className="flex gap-3">
              <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Lưu</Button>
              <Button onClick={cancel} variant="outline" className="gap-2"><X className="w-4 h-4" /> Huỷ</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question list */}
      {loading ? (
        <p className="text-center text-muted-foreground py-10">Đang tải...</p>
      ) : questions.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-muted-foreground">Chưa có câu hỏi. Nhấn "Thêm câu hỏi" hoặc import từ Excel.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-1 text-muted-foreground shrink-0 pt-1">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-mono w-6 text-center">{q.order_index}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">Đáp án: {String.fromCharCode(65 + q.correct_answer)}</span>
                    {q.audio_url && <Headphones className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    {q.options.map((o, oi) => (
                      <span key={oi} className={oi === q.correct_answer ? "text-primary font-semibold" : ""}>
                        {String.fromCharCode(65 + oi)}. {o.length > 20 ? o.slice(0, 20) + "…" : o}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(q)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
