import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const WritingPart1Form = ({ questions, setQuestions }: Props) => {
  const makeDefault = (idx: number): Omit<ExamQuestionRow, "exam_set_id"> => ({
    order_index: idx,
    question_text: "",
    question_type: "writing",
    options: [],
    correct_answer: 0,
    explanation: "",
    audio_url: null,
    image_url: null,
    response_time: null,
    extra_data: { sampleAnswer: "" },
  });

  const items = questions.length > 0 ? questions : [makeDefault(0)];

  const updateQ = (idx: number, field: string, val: string) => {
    setQuestions(items.map((q, i) => {
      if (i !== idx) return q;
      const ed = (q.extra_data || {}) as Record<string, any>;
      if (field === "question_text") return { ...q, question_text: val };
      if (field === "sampleAnswer") return { ...q, explanation: val, extra_data: { ...ed, sampleAnswer: val } };
      return q;
    }));
  };

  const addQuestion = () => setQuestions([...items, makeDefault(items.length)]);
  const removeQuestion = (idx: number) => {
    if (items.length <= 1) return;
    setQuestions(items.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })));
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Writing Part 1 — Short Answers (1–5 words)</h3>

      {items.map((q, idx) => (
        <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Câu {idx + 1}</span>
            {items.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div>
            <Label>Question</Label>
            <Input
              value={q.question_text}
              onChange={(e) => updateQ(idx, "question_text", e.target.value)}
              placeholder="What is your favourite season?"
            />
          </div>
          <div>
            <Label>Sample Answer</Label>
            <Input
              value={(q.extra_data as any)?.sampleAnswer || q.explanation || ""}
              onChange={(e) => updateQ(idx, "sampleAnswer", e.target.value)}
              placeholder="I like summer best."
            />
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addQuestion} className="gap-2">
        <Plus className="w-4 h-4" /> Thêm câu hỏi
      </Button>
    </div>
  );
};

export default WritingPart1Form;
