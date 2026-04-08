import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
  onImageUpload: (idx: number, file: File) => void;
  uploadingIdx: number | null;
}

const ReadingPart4Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "long_reading", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const title = (ed.title || "") as string;
  const instruction = (ed.instruction || "Read the passage quickly. Choose a heading for each numbered paragraph from the drop-down box. There is one more heading than you need.") as string;
  const paragraphs: { index: number; text: string }[] = ed.paragraphs || [];
  const headings: { text: string; paragraphIndex: number | null }[] = ed.headings || [];

  const update = (field: string, val: any) => {
    const newEd = { ...ed, [field]: val };
    setQuestions([{ ...q, extra_data: newEd, question_text: newEd.title || q.question_text }]);
  };

  const updateParagraph = (idx: number, field: string, val: any) => {
    const ps = [...paragraphs];
    ps[idx] = { ...ps[idx], [field]: val };
    update("paragraphs", ps);
  };

  const addParagraph = () => {
    const nextIdx = paragraphs.length > 0 ? Math.max(...paragraphs.map(p => p.index)) + 1 : 1;
    update("paragraphs", [...paragraphs, { index: nextIdx, text: "" }]);
  };

  const removeParagraph = (idx: number) => update("paragraphs", paragraphs.filter((_, i) => i !== idx));

  const updateHeading = (idx: number, field: string, val: any) => {
    const hs = [...headings];
    hs[idx] = { ...hs[idx], [field]: val };
    update("headings", hs);
  };

  const addHeading = () => update("headings", [...headings, { text: "", paragraphIndex: null }]);
  const removeHeading = (idx: number) => update("headings", headings.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 4 — Heading Matching</h3>

      <div>
        <Label>Tiêu đề bài đọc (Title)</Label>
        <Input value={title} onChange={(e) => update("title", e.target.value)} placeholder="Ví dụ: Mission to Mars" />
      </div>

      <div>
        <Label>Hướng dẫn (Instruction)</Label>
        <Textarea value={instruction} onChange={(e) => update("instruction", e.target.value)} rows={2} />
      </div>

      <div>
        <Label>Các đoạn văn (Paragraphs)</Label>
        <p className="text-xs text-muted-foreground mb-2">Mỗi đoạn văn có số thứ tự và nội dung. Học viên sẽ chọn heading cho từng đoạn.</p>
        <div className="space-y-3 mt-1">
          {paragraphs.map((p, i) => (
            <div key={i} className="p-3 rounded-lg border border-border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Đoạn {p.index}</span>
                <Button variant="ghost" size="icon" onClick={() => removeParagraph(i)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <div className="flex gap-2">
                <Input type="number" value={p.index} onChange={(e) => updateParagraph(i, "index", parseInt(e.target.value) || 1)} className="w-20" placeholder="#" />
                <Textarea value={p.text} onChange={(e) => updateParagraph(i, "text", e.target.value)} rows={3} placeholder="Nội dung đoạn văn..." className="flex-1" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addParagraph} className="gap-1"><Plus className="w-3 h-3" /> Thêm đoạn văn</Button>
        </div>
      </div>

      <div>
        <Label>Headings (Tiêu đề để chọn)</Label>
        <p className="text-xs text-muted-foreground mb-2">Nhập tiêu đề và gán cho đoạn văn tương ứng. Để trống số đoạn = tiêu đề gây nhiễu (distractor).</p>
        <div className="space-y-2 mt-1">
          {headings.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={h.text} onChange={(e) => updateHeading(i, "text", e.target.value)} placeholder="Heading text..." className="flex-1" />
              <Input
                type="number"
                value={h.paragraphIndex ?? ""}
                onChange={(e) => updateHeading(i, "paragraphIndex", e.target.value ? parseInt(e.target.value) : null)}
                className="w-24"
                placeholder="Đoạn #"
              />
              <Button variant="ghost" size="icon" onClick={() => removeHeading(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addHeading} className="gap-1"><Plus className="w-3 h-3" /> Thêm heading</Button>
        </div>
      </div>

      <div>
        <Label>Giải thích</Label>
        <Textarea value={q.explanation} onChange={(e) => setQuestions([{ ...q, explanation: e.target.value }])} rows={2} />
      </div>
    </div>
  );
};

export default ReadingPart4Form;
