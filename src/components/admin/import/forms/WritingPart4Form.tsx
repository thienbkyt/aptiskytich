import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const WritingPart4Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "writing", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;

  const update = (patch: Record<string, any>) => {
    setQuestions([{ ...q, extra_data: { ...ed, ...patch } }]);
  };

  const informalEmail = ed.informalEmail || { instruction: "", wordLimit: 75, sampleAnswer: "" };
  const formalEmail = ed.formalEmail || { instruction: "", wordLimit: 225, sampleAnswer: "" };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Writing Part 4 — Two Emails</h3>

      <div>
        <Label>Scenario Intro (vai trò & bối cảnh)</Label>
        <Input value={ed.scenarioIntro || q.question_text || ""} onChange={(e) => { setQuestions([{ ...q, question_text: e.target.value, extra_data: { ...ed, scenarioIntro: e.target.value } }]); }} placeholder="You are a member of the Travel Club..." />
      </div>

      <div>
        <Label>Scenario Email (nội dung email từ CLB)</Label>
        <Textarea value={ed.scenarioEmail || ""} onChange={(e) => update({ scenarioEmail: e.target.value })} rows={5} placeholder="Dear Member,&#10;&#10;We are writing to tell you..." />
      </div>

      <div className="p-3 rounded-lg border border-border bg-background space-y-3">
        <h4 className="font-medium text-foreground">📧 Informal Email</h4>
        <div>
          <Label>Instruction</Label>
          <Textarea value={informalEmail.instruction} onChange={(e) => update({ informalEmail: { ...informalEmail, instruction: e.target.value } })} rows={2} placeholder="Write an email to your friend..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Word Limit</Label>
            <Input type="number" value={informalEmail.wordLimit} onChange={(e) => update({ informalEmail: { ...informalEmail, wordLimit: Number(e.target.value) } })} />
          </div>
        </div>
        <div>
          <Label>Sample Answer</Label>
          <Textarea value={informalEmail.sampleAnswer} onChange={(e) => update({ informalEmail: { ...informalEmail, sampleAnswer: e.target.value } })} rows={3} />
        </div>
      </div>

      <div className="p-3 rounded-lg border border-border bg-background space-y-3">
        <h4 className="font-medium text-foreground">📨 Formal Email</h4>
        <div>
          <Label>Instruction</Label>
          <Textarea value={formalEmail.instruction} onChange={(e) => update({ formalEmail: { ...formalEmail, instruction: e.target.value } })} rows={2} placeholder="Write an email to the president..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Word Limit</Label>
            <Input type="number" value={formalEmail.wordLimit} onChange={(e) => update({ formalEmail: { ...formalEmail, wordLimit: Number(e.target.value) } })} />
          </div>
        </div>
        <div>
          <Label>Sample Answer</Label>
          <Textarea value={formalEmail.sampleAnswer} onChange={(e) => update({ formalEmail: { ...formalEmail, sampleAnswer: e.target.value } })} rows={3} />
        </div>
      </div>
    </div>
  );
};

export default WritingPart4Form;
