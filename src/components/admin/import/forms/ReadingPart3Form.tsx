import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

const ReadingPart3Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "gap_fill_reading", options: Array(11).fill(""), correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const gaps: { gapNumber: number; correctAnswer: number }[] = ed.gaps || [];
  const options: string[] = q.options?.length === 11 ? q.options : Array(11).fill("");

  const updateEd = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const updateOption = (idx: number, val: string) => {
    const o = [...options];
    o[idx] = val;
    setQuestions([{ ...q, options: o }]);
  };

  const updateGap = (idx: number, field: string, val: any) => {
    const g = [...gaps];
    g[idx] = { ...g[idx], [field]: val };
    updateEd("gaps", g);
  };

  const addGap = () => updateEd("gaps", [...gaps, { gapNumber: gaps.length + 12, correctAnswer: 0 }]);
  const removeGap = (idx: number) => updateEd("gaps", gaps.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 3 — Gap Fill</h3>

      <div>
        <Label>Tiêu đề bài đọc</Label>
        <Input value={ed.title || ""} onChange={(e) => updateEd("title", e.target.value)} placeholder="Occupational Stress" />
      </div>

      <div>
        <Label>Đoạn văn (dùng (12)_____, (13)_____ cho chỗ trống)</Label>
        <Textarea value={q.question_text} onChange={(e) => setQuestions([{ ...q, question_text: e.target.value }])} rows={6} placeholder="Occupational stress relates to the physical... (12)_____ between..." />
      </div>

      <div>
        <Label>Ví dụ (Example)</Label>
        <Input value={ed.example || ""} onChange={(e) => updateEd("example", e.target.value)} placeholder="Example (0): K - effects" />
      </div>

      <div>
        <Label>11 từ lựa chọn (A-K)</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {OPTION_KEYS.map((k, i) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-xs font-mono text-muted-foreground w-4">{k}</span>
              <Input value={options[i]} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Từ ${k}`} className="text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Các chỗ trống (Gaps)</Label>
        <div className="space-y-2 mt-1">
          {gaps.map((g, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-6">({g.gapNumber})</span>
              <Input type="number" value={g.gapNumber} onChange={(e) => updateGap(i, "gapNumber", Number(e.target.value))} className="w-20" placeholder="Số" />
              <select
                value={g.correctAnswer}
                onChange={(e) => updateGap(i, "correctAnswer", Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm"
              >
                {OPTION_KEYS.map((k, ki) => <option key={ki} value={ki}>{k} - {options[ki] || "..."}</option>)}
              </select>
              <Button variant="ghost" size="icon" onClick={() => removeGap(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGap} className="gap-1"><Plus className="w-3 h-3" /> Thêm gap</Button>
        </div>
      </div>

      <div>
        <Label>Giải thích</Label>
        <Textarea value={q.explanation} onChange={(e) => setQuestions([{ ...q, explanation: e.target.value }])} rows={2} />
      </div>
    </div>
  );
};

export default ReadingPart3Form;
