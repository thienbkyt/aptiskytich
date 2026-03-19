import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Save, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Test {
  id: string;
  title: string;
  skill: string;
  part: string;
  time_limit: number;
  created_at: string;
  question_count?: number;
}

const SKILLS = ["reading", "listening", "speaking", "writing", "grammar"];
const PARTS: Record<string, string[]> = {
  reading: ["Part 1 – Sentence comprehension", "Part 2 – Text cohesion", "Part 3 – Opinion matching", "Part 4 – Long reading"],
  listening: ["Part 1 – Word recognition", "Part 2 – Matching information", "Part 3 – Short conversations", "Part 4 – Monologues"],
  speaking: ["Part 1 – Personal Questions", "Part 2 – Describe a Picture", "Part 3 – Compare Pictures", "Part 4 – Opinion Questions"],
  writing: ["Part 1 – Short messages", "Part 2 – Fill form", "Part 3 – Informal email", "Part 4 – Formal letter"],
  grammar: ["Grammar & Vocabulary"],
};

const emptyForm = { title: "", skill: "reading", part: "", time_limit: 30 };

const AdminTestManager = () => {
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Test | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchTests(); }, []);

  const fetchTests = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      // Get question counts
      const { data: counts } = await supabase.from("questions").select("test_id");
      const countMap: Record<string, number> = {};
      counts?.forEach((q: any) => { if (q.test_id) countMap[q.test_id] = (countMap[q.test_id] || 0) + 1; });
      setTests(data.map((t: any) => ({ ...t, question_count: countMap[t.id] || 0 })));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.part) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng điền đầy đủ.", variant: "destructive" });
      return;
    }
    if (editing) {
      const { error } = await supabase.from("tests").update({ title: form.title, skill: form.skill, part: form.part, time_limit: form.time_limit }).eq("id", editing.id);
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Đã cập nhật!" });
    } else {
      const { error } = await supabase.from("tests").insert({ title: form.title, skill: form.skill, part: form.part, time_limit: form.time_limit });
      if (error) { toast({ title: "Lỗi", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Đã tạo đề thi!" });
    }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    fetchTests();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá đề thi này?")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (!error) { toast({ title: "Đã xoá!" }); fetchTests(); }
  };

  const startEdit = (t: Test) => {
    setEditing(t);
    setForm({ title: t.title, skill: t.skill, part: t.part, time_limit: t.time_limit });
    setShowForm(true);
  };

  const availableParts = PARTS[form.skill] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tests.length} đề thi</p>
        <Button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }} className="gap-2">
          <Plus className="w-4 h-4" /> Tạo đề mới
        </Button>
      </div>

      {showForm && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <h3 className="font-heading font-semibold">{editing ? "Sửa đề thi" : "Tạo đề thi mới"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tiêu đề</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="TEST 1" />
            </div>
            <div className="space-y-2">
              <Label>Thời gian (phút)</Label>
              <Input type="number" value={form.time_limit} onChange={(e) => setForm({ ...form, time_limit: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Kỹ năng</Label>
              <Select value={form.skill} onValueChange={(v) => setForm({ ...form, skill: v, part: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILLS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Part</Label>
              <Select value={form.part} onValueChange={(v) => setForm({ ...form, part: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn part" /></SelectTrigger>
                <SelectContent>
                  {availableParts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Lưu</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }} className="gap-2"><X className="w-4 h-4" /> Huỷ</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-10">Đang tải...</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Kỹ năng</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Câu hỏi</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><span className="capitalize">{t.skill}</span></TableCell>
                  <TableCell className="text-sm">{t.part}</TableCell>
                  <TableCell>{t.question_count}</TableCell>
                  <TableCell>{t.time_limit} phút</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tests.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Chưa có đề thi nào.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminTestManager;
