import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
}

const WritingPart4Form = ({ questions, setQuestions }: Props) => {
  const q = questions[0] || { extra_data: {}, question_text: "", explanation: "" };
  const ed = q.extra_data || {};
  const informal = ed.informalEmail || { label: "Informal Email (~50 words)", scenario: "", bulletPoints: [], wordLimit: 50, sampleAnswer: "" };
  const formal = ed.formalEmail || { label: "Formal Email (~120-150 words)", scenario: "", bulletPoints: [], wordLimit: 150, sampleAnswer: "" };

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const renderEmailSection = (email: any, key: string, label: string) => (
    <div className="p-3 rounded-lg border border-border bg-background space-y-3">
      <h4 className="font-medium text-foreground">{label}</h4>
      <div>
        <Label>Scenario</Label>
        <Textarea value={email.scenario} onChange={(e) => update(key, { ...email, scenario: e.target.value })} rows={2} placeholder="Write to your friend about..." />
      </div>
      <div>
        <Label>Bullet Points (mỗi dòng 1 bullet)</Label>
        <Textarea value={(email.bulletPoints || []).join("\n")} onChange={(e) => update(key, { ...email, bulletPoints: e.target.value.split("\n").filter(Boolean) })} rows={3} placeholder="when&#10;where&#10;what to bring" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Word Limit</Label>
          <Input type="number" value={email.wordLimit} onChange={(e) => update(key, { ...email, wordLimit: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label>Sample Answer</Label>
        <Textarea value={email.sampleAnswer} onChange={(e) => update(key, { ...email, sampleAnswer: e.target.value })} rows={3} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Writing Part 4 — Two Emails</h3>

      <div>
        <Label>Instruction</Label>
        <Input value={q.question_text || "Write two emails based on the scenarios below."} onChange={(e) => setQuestions([{ ...q, question_text: e.target.value }])} />
      </div>

      {renderEmailSection(informal, "informalEmail", "📧 Informal Email")}
      {renderEmailSection(formal, "formalEmail", "📨 Formal Email")}
    </div>
  );
};

export default WritingPart4Form;
