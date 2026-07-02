import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizePart } from "@/hooks/useExamSets";

// One line format:  skill | part | tựa đề chứa (vd: reading | Part 4 | Đề 09)
const parseLine = (line: string) => {
  const parts = line.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [skill, part, titleFrag] = parts;
  return { skill: skill.toLowerCase(), partNorm: normalizePart(part), titleFrag };
};

const KeyDateAssigner = () => {
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; miss: string[] } | null>(null);

  const handleAssign = async () => {
    if (!date.trim()) return toast.error("Nhập ngày trước (vd 2026-07-01)");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return toast.error("Chưa có dòng nào");
    setBusy(true);
    setResult(null);
    let ok = 0;
    const miss: string[] = [];
    try {
      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) { miss.push(line); continue; }
        const { skill, partNorm, titleFrag } = parsed;
        const { data, error } = await supabase
          .from("exam_sets")
          .select("id, part, title")
          .eq("skill", skill)
          .ilike("title", `%${titleFrag}%`);
        if (error || !data) { miss.push(line); continue; }
        const target = data.find((s: any) => normalizePart(s.part) === partNorm);
        if (!target) { miss.push(line); continue; }
        const { error: upErr } = await supabase
          .from("exam_sets")
          .update({ key_date: date.trim() })
          .eq("id", target.id);
        if (upErr) { miss.push(line); continue; }
        ok++;
      }
      setResult({ ok, miss });
      toast.success(`Đã gán ${ok}/${lines.length} đề vào ngày ${date.trim()}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUnassign = async () => {
    if (!date.trim()) return toast.error("Nhập ngày trước");
    if (!confirm(`Bỏ gán tất cả đề đang có key_date = ${date.trim()}?`)) return;
    setBusy(true);
    try {
      const { error, count } = await supabase
        .from("exam_sets")
        .update({ key_date: null }, { count: "exact" })
        .eq("key_date", date.trim());
      if (error) throw error;
      toast.success(`Đã bỏ gán ${count ?? 0} đề khỏi ngày ${date.trim()}`);
      setResult(null);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi bỏ gán");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-foreground">Gán Key theo ngày</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Mỗi dòng theo mẫu: <code>skill | part | phần tựa đề</code>. Ví dụ: <code>reading | Part 4 | Đề 09</code>.
        Hệ thống sẽ tìm đề có <b>skill</b> khớp, cùng <b>số Part</b>, và tựa chứa chuỗi bạn nhập.
      </p>
      <div className="grid gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Ngày (YYYY-MM-DD)</Label>
          <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="2026-07-01" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Danh sách đề</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"reading | Part 4 | Đề 09\nlistening | Part 3 | Đề 02\nspeaking | Part 2 | Đề 05"}
            className="min-h-[160px] font-mono text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleAssign} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
          Gán vào ngày {date || "…"}
        </Button>
        <Button variant="outline" onClick={handleUnassign} disabled={busy}>
          Bỏ gán ngày này
        </Button>
      </div>
      {result && (
        <div className="text-sm space-y-2 border-t border-border pt-3">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">Thành công: {result.ok}</p>
          {result.miss.length > 0 && (
            <div>
              <p className="text-destructive font-medium mb-1">Không tìm thấy ({result.miss.length}):</p>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                {result.miss.map((l, i) => <li key={i}><code>{l}</code></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KeyDateAssigner;
