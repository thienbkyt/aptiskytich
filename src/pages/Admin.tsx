import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X, BookOpen, Shield, FileSpreadsheet } from "lucide-react";
import BulkImport from "@/components/admin/BulkImport";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface DBQuestion {
  id: string;
  skill: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

const emptyQ = { skill: "grammar", question_text: "", options: ["", "", "", ""], correct_answer: 0, explanation: "" };

const Admin = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<DBQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DBQuestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyQ);
  const [filterSkill, setFilterSkill] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setQuestions(data.map((q) => ({ ...q, options: q.options as string[] })));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.question_text || form.options.some((o) => !o)) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng điền đầy đủ.", variant: "destructive" });
      return;
    }

    if (editing) {
      const { error } = await supabase.from("questions").update({
        skill: form.skill,
        question_text: form.question_text,
        options: form.options as unknown as any,
        correct_answer: form.correct_answer,
        explanation: form.explanation,
      }).eq("id", editing.id);
      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Đã cập nhật!" });
      }
    } else {
      const { error } = await supabase.from("questions").insert({
        skill: form.skill,
        question_text: form.question_text,
        options: form.options as unknown as any,
        correct_answer: form.correct_answer,
        explanation: form.explanation,
      });
      if (error) {
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Đã thêm câu hỏi!" });
      }
    }
    setEditing(null);
    setCreating(false);
    setForm(emptyQ);
    fetchQuestions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xoá câu hỏi này?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã xoá!" });
      fetchQuestions();
    }
  };

  const startEdit = (q: DBQuestion) => {
    setEditing(q);
    setCreating(false);
    setForm({ skill: q.skill, question_text: q.question_text, options: [...q.options], correct_answer: q.correct_answer, explanation: q.explanation });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyQ);
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyQ);
  };

  const filtered = filterSkill === "all" ? questions : questions.filter((q) => q.skill === filterSkill);

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><p>Đang tải...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-heading font-extrabold text-foreground">Quản lý câu hỏi</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={startCreate} className="bg-primary text-primary-foreground gap-2">
                <Plus className="w-4 h-4" /> Thêm câu hỏi
              </Button>
            </div>
          </div>

          {/* Bulk Import */}
          <div className="glass-card p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-bold text-foreground">Nhập liệu hàng loạt từ Excel</h2>
            </div>
            <BulkImport onImportComplete={fetchQuestions} />
          </div>

          {(creating || editing) && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-8">
              <h2 className="font-heading font-bold text-foreground mb-4">{editing ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kỹ năng</Label>
                    <Select value={form.skill} onValueChange={(v) => setForm({ ...form, skill: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grammar">Grammar & Vocabulary</SelectItem>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="listening">Listening</SelectItem>
                        <SelectItem value="speaking">Speaking</SelectItem>
                        <SelectItem value="writing">Writing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                <div className="flex gap-3">
                  <Button onClick={handleSave} className="bg-primary text-primary-foreground gap-2"><Save className="w-4 h-4" /> Lưu</Button>
                  <Button onClick={cancelEdit} variant="outline" className="gap-2"><X className="w-4 h-4" /> Huỷ</Button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {["all", "grammar", "reading", "listening", "speaking", "writing"].map((s) => (
              <Button key={s} variant={filterSkill === s ? "default" : "outline"} size="sm" onClick={() => setFilterSkill(s)}>
                {s === "all" ? "Tất cả" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground self-center">{filtered.length} câu hỏi</span>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-10">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Chưa có câu hỏi nào. Nhấn "Thêm câu hỏi" để bắt đầu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((q, i) => (
                <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          q.skill === "grammar" ? "bg-primary/10 text-primary" : q.skill === "reading" ? "bg-secondary/10 text-secondary" : "bg-info/10 text-info"
                        }`}>
                          {q.skill}
                        </span>
                        <span className="text-xs text-muted-foreground">Đáp án: {String.fromCharCode(65 + q.correct_answer)}</span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
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
      </div>
      <Footer />
    </div>
  );
};

export default Admin;
