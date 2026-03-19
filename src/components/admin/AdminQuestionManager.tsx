import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Save, X, Upload, Headphones } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Test { id: string; title: string; skill: string; part: string; }
interface Question {
  id: string;
  test_id: string | null;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  audio_url: string | null;
  image_url: string | null;
  order_index: number;
  skill: string;
}

interface Answer {
  id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean;
}

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Trắc nghiệm" },
  { value: "fill_blank", label: "Điền từ" },
  { value: "speaking", label: "Speaking" },
  { value: "writing", label: "Writing" },
];

const AdminQuestionManager = () => {
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState({
    question_text: "",
    question_type: "multiple_choice",
    options: ["", "", "", ""],
    correct_answer: 0,
    explanation: "",
    audio_url: "",
    image_url: "",
    order_index: 0,
    sample_answer: "",
  });

  useEffect(() => {
    supabase.from("tests").select("id, title, skill, part").order("created_at").then(({ data }) => {
      if (data) setTests(data as Test[]);
    });
  }, []);

  useEffect(() => {
    if (selectedTestId) fetchQuestions();
  }, [selectedTestId]);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", selectedTestId)
      .order("order_index");
    if (data) setQuestions(data.map((q: any) => ({ ...q, options: q.options as string[] })));
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.question_text) {
      toast({ title: "Thiếu câu hỏi", variant: "destructive" });
      return;
    }
    const selectedTest = tests.find(t => t.id === selectedTestId);
    const payload = {
      test_id: selectedTestId,
      skill: selectedTest?.skill || "grammar",
      question_text: form.question_text,
      question_type: form.question_type,
      options: form.options as any,
      correct_answer: form.correct_answer,
      explanation: form.explanation,
      audio_url: form.audio_url || null,
      image_url: form.image_url || null,
      order_index: form.order_index,
    };

    let questionId: string | null = null;

    if (editing) {
      const { error } = await supabase.from("questions").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      questionId = editing.id;
      toast({ title: "Đã cập nhật!" });
    } else {
      const { data, error } = await supabase.from("questions").insert(payload).select("id").single();
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      questionId = data.id;
      toast({ title: "Đã thêm câu hỏi!" });
    }

    // Save answers for multiple_choice
    if (questionId && form.question_type === "multiple_choice") {
      await supabase.from("answers").delete().eq("question_id", questionId);
      const answers = form.options.map((opt, i) => ({
        question_id: questionId!,
        answer_text: opt,
        is_correct: i === form.correct_answer,
      }));
      await supabase.from("answers").insert(answers);
    }

    // Save sample answer for speaking/writing
    if (questionId && (form.question_type === "speaking" || form.question_type === "writing") && form.sample_answer) {
      await supabase.from("answers").delete().eq("question_id", questionId);
      await supabase.from("answers").insert({
        question_id: questionId,
        answer_text: form.sample_answer,
        is_correct: true,
      });
    }

    setShowForm(false);
    setEditing(null);
    resetForm();
    fetchQuestions();
  };

  const resetForm = () => {
    setForm({ question_text: "", question_type: "multiple_choice", options: ["", "", "", ""], correct_answer: 0, explanation: "", audio_url: "", image_url: "", order_index: questions.length, sample_answer: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá câu hỏi này?")) return;
    await supabase.from("questions").delete().eq("id", id);
    toast({ title: "Đã xoá!" });
    fetchQuestions();
  };

  const startEdit = async (q: Question) => {
    setEditing(q);
    let sampleAnswer = "";
    if (q.question_type === "speaking" || q.question_type === "writing") {
      const { data } = await supabase.from("answers").select("answer_text").eq("question_id", q.id).eq("is_correct", true).maybeSingle();
      sampleAnswer = data?.answer_text || "";
    }
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: [...q.options],
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      audio_url: q.audio_url || "",
      image_url: q.image_url || "",
      order_index: q.order_index,
      sample_answer: sampleAnswer,
    });
    setShowForm(true);
  };

  const handleUploadAudio = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fileName = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("audio").upload(fileName, file);
      if (error) { toast({ title: "Lỗi upload", description: error.message, variant: "destructive" }); return; }
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(fileName);
      setForm(prev => ({ ...prev, audio_url: urlData.publicUrl }));
      toast({ title: "Đã upload audio!" });
    };
    input.click();
  };

  const selectedTest = tests.find(t => t.id === selectedTestId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm space-y-2">
          <Label>Chọn đề thi</Label>
          <Select value={selectedTestId} onValueChange={setSelectedTestId}>
            <SelectTrigger><SelectValue placeholder="Chọn đề thi..." /></SelectTrigger>
            <SelectContent>
              {tests.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.title} ({t.skill} - {t.part})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedTestId && (
          <Button onClick={() => { setShowForm(true); setEditing(null); resetForm(); }} className="gap-2 mt-6">
            <Plus className="w-4 h-4" /> Thêm câu hỏi
          </Button>
        )}
      </div>

      {!selectedTestId && (
        <div className="text-center py-16 text-muted-foreground">
          Vui lòng chọn đề thi để quản lý câu hỏi.
        </div>
      )}

      {showForm && selectedTestId && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <h3 className="font-heading font-semibold">{editing ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loại câu hỏi</Label>
              <Select value={form.question_type} onValueChange={(v) => setForm({ ...form, question_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(qt => <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>)}
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

          {form.question_type === "multiple_choice" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {form.options.map((opt, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">Đáp án {String.fromCharCode(65 + i)}</Label>
                    <Input value={opt} onChange={(e) => {
                      const newOpts = [...form.options];
                      newOpts[i] = e.target.value;
                      setForm({ ...form, options: newOpts });
                    }} />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Đáp án đúng</Label>
                <Select value={String(form.correct_answer)} onValueChange={(v) => setForm({ ...form, correct_answer: parseInt(v) })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">A</SelectItem>
                    <SelectItem value="1">B</SelectItem>
                    <SelectItem value="2">C</SelectItem>
                    <SelectItem value="3">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(form.question_type === "speaking" || form.question_type === "writing") && (
            <div className="space-y-2">
              <Label>Câu trả lời mẫu</Label>
              <Textarea value={form.sample_answer} onChange={(e) => setForm({ ...form, sample_answer: e.target.value })} rows={4} placeholder="Nhập câu trả lời mẫu..." />
            </div>
          )}

          {/* Audio upload for listening */}
          {selectedTest?.skill === "listening" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Headphones className="w-4 h-4" /> Audio URL</Label>
              <div className="flex gap-3">
                <Input value={form.audio_url} onChange={(e) => setForm({ ...form, audio_url: e.target.value })} placeholder="URL audio..." className="flex-1" />
                <Button type="button" variant="outline" onClick={handleUploadAudio} className="gap-2 shrink-0">
                  <Upload className="w-4 h-4" /> Upload
                </Button>
              </div>
              {form.audio_url && <audio controls src={form.audio_url} className="w-full mt-2" />}
            </div>
          )}

          <div className="space-y-2">
            <Label>Giải thích</Label>
            <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Lưu</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} className="gap-2"><X className="w-4 h-4" /> Huỷ</Button>
          </div>
        </div>
      )}

      {selectedTestId && !loading && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Chưa có câu hỏi nào trong đề thi này.</div>
          ) : (
            questions.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">#{q.order_index + 1}</span>
                      <span className="text-xs text-muted-foreground capitalize">{q.question_type.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                    {q.question_type === "multiple_choice" && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {q.options.map((opt, idx) => (
                          <span key={idx} className={`text-xs px-2 py-1 rounded ${idx === q.correct_answer ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold' : 'bg-muted text-muted-foreground'}`}>
                            {String.fromCharCode(65 + idx)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(q)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {loading && <p className="text-center text-muted-foreground py-10">Đang tải...</p>}
    </div>
  );
};

export default AdminQuestionManager;
