import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ExamQuestionRow } from "../types";
import { useState } from "react";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const WritingPart3Form = ({ questions, setQuestions }: Props) => {
  const [instruction, setInstruction] = useState(
    () => (questions[0]?.extra_data as any)?.instruction || "Answer the following three questions. Write between 30 and 40 words for each answer."
  );

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
    extra_data: { sampleAnswer: "", wordLimit: 40, instruction },
  });

  const items = questions.length > 0 ? questions : [makeDefault(0)];

  const updateInstruction = (val: string) => {
    setInstruction(val);
    setQuestions(items.map((q) => {
      const ed = (q.extra_data || {}) as Record<string, any>;
      return { ...q, extra_data: { ...ed, instruction: val } };
    }));
  };

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
      <h3 className="font-semibold text-foreground">Writing Part 3 — Three Questions (30–40 words each)</h3>

      <div>
        <Label>Instruction (Cột A)</Label>
        <Textarea
          value={instruction}
          onChange={(e) => updateInstruction(e.target.value)}
          placeholder="Answer the following three questions. Write between 30 and 40 words for each answer."
          className="min-h-[60px]"
        />
      </div>

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
            <Label>Question (Cột B)</Label>
            <Input
              value={q.question_text}
              onChange={(e) => updateQ(idx, "question_text", e.target.value)}
              placeholder="Do you think it is important to learn a foreign language?"
            />
          </div>
          <div>
            <Label>Sample Answer (Cột C)</Label>
            <Textarea
              value={(q.extra_data as any)?.sampleAnswer || q.explanation || ""}
              onChange={(e) => updateQ(idx, "sampleAnswer", e.target.value)}
              rows={2}
              placeholder="Yes, I believe learning a foreign language is very important..."
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

export default WritingPart3Form;
