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
  const q = questions[0] || { extra_data: {}, question_text: "", explanation: "" };
  const ed = q.extra_data || {};
  const passage = ed.passage || q.question_text || "";
  const subQuestions: { text: string; options: string[]; correct: number }[] = ed.questions || [];

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const updateSub = (idx: number, field: string, val: any) => {
    const subs = [...subQuestions];
    subs[idx] = { ...subs[idx], [field]: val };
    update("questions", subs);
  };

  const updateSubOption = (qIdx: number, optIdx: number, val: string) => {
    const subs = [...subQuestions];
    const opts = [...subs[qIdx].options];
    opts[optIdx] = val;
    subs[qIdx] = { ...subs[qIdx], options: opts };
    update("questions", subs);
  };

  const addSub = () => update("questions", [...subQuestions, { text: "", options: ["", "", "", ""], correct: 0 }]);
  const removeSub = (idx: number) => update("questions", subQuestions.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 4 — Long Reading</h3>

      <div>
        <Label>Passage</Label>
        <Textarea value={passage} onChange={(e) => { update("passage", e.target.value); setQuestions((qs) => [{ ...qs[0], question_text: e.target.value }]); }} rows={8} placeholder="Nhập đoạn văn dài..." />
      </div>

      <div>
        <Label>Câu hỏi MCQ</Label>
        <div className="space-y-4 mt-1">
          {subQuestions.map((sq, i) => (
            <div key={i} className="p-3 rounded-lg border border-border bg-background space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Câu {i + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeSub(i)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <Input value={sq.text} onChange={(e) => updateSub(i, "text", e.target.value)} placeholder="Câu hỏi..." />
              <div className="grid grid-cols-2 gap-2">
                {["A", "B", "C", "D"].map((label, oi) => (
                  <div key={label} className="flex gap-1">
                    <Input value={sq.options[oi] || ""} onChange={(e) => updateSubOption(i, oi, e.target.value)} placeholder={label} className={sq.correct === oi ? "border-primary" : ""} />
                    <Button variant={sq.correct === oi ? "default" : "outline"} size="icon" className="shrink-0" onClick={() => updateSub(i, "correct", oi)}>{label}</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSub} className="gap-1"><Plus className="w-3 h-3" /> Thêm câu hỏi</Button>
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
