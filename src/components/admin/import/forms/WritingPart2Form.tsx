import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const WritingPart2Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "writing", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;

  const update = (field: string, val: any) => {
    const newEd = { ...ed, [field]: val };
    const newQ = { ...q, extra_data: newEd };
    if (field === "instruction") newQ.question_text = val;
    if (field === "sampleAnswer") newQ.explanation = val;
    setQuestions([newQ]);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Writing Part 2 — Form Fill</h3>

      <div>
        <Label>Instruction (dòng hướng dẫn in đậm)</Label>
        <Textarea
          value={ed.instruction || q.question_text || ""}
          onChange={(e) => update("instruction", e.target.value)}
          rows={2}
          placeholder="You are a new member of the Travel Club. Fill in the form..."
        />
      </div>

      <div>
        <Label>Question (câu hỏi cụ thể)</Label>
        <Input
          value={ed.question || ""}
          onChange={(e) => update("question", e.target.value)}
          placeholder="Please tell us why you are interested in travel."
        />
      </div>

      <div>
        <Label>Word Limit</Label>
        <Input
          type="number"
          value={ed.wordLimit || 45}
          onChange={(e) => update("wordLimit", Number(e.target.value))}
        />
      </div>

      <div>
        <Label>Sample Answer</Label>
        <Textarea
          value={ed.sampleAnswer || q.explanation || ""}
          onChange={(e) => update("sampleAnswer", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
};

export default WritingPart2Form;
