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

const ReadingPart3Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "opinion_matching", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const people: { name: string; text: string }[] = ed.people || [];
  const statements: { text: string; correctPerson: number }[] = ed.statements || [];

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const updatePerson = (idx: number, field: string, val: string) => {
    const p = [...people];
    p[idx] = { ...p[idx], [field]: val };
    update("people", p);
  };

  const addPerson = () => update("people", [...people, { name: "", text: "" }]);
  const removePerson = (idx: number) => update("people", people.filter((_, i) => i !== idx));

  const updateStatement = (idx: number, field: string, val: any) => {
    const s = [...statements];
    s[idx] = { ...s[idx], [field]: val };
    update("statements", s);
  };

  const addStatement = () => update("statements", [...statements, { text: "", correctPerson: 0 }]);
  const removeStatement = (idx: number) => update("statements", statements.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 3 — Opinion Matching</h3>

      <div>
        <Label>Instruction</Label>
        <Input value={q.question_text} onChange={(e) => setQuestions([{ ...q, question_text: e.target.value }])} placeholder="Match the statements to the people." />
      </div>

      <div>
        <Label>People (tên + đoạn văn)</Label>
        <div className="space-y-3 mt-1">
          {people.map((p, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-muted-foreground mt-2 w-6">{i + 1}</span>
              <div className="flex-1 space-y-1">
                <Input value={p.name} onChange={(e) => updatePerson(i, "name", e.target.value)} placeholder="Tên người" />
                <Textarea value={p.text} onChange={(e) => updatePerson(i, "text", e.target.value)} placeholder="Đoạn văn / ý kiến" rows={2} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removePerson(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addPerson} className="gap-1"><Plus className="w-3 h-3" /> Thêm person</Button>
        </div>
      </div>

      <div>
        <Label>Statements</Label>
        <div className="space-y-2 mt-1">
          {statements.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={s.text} onChange={(e) => updateStatement(i, "text", e.target.value)} placeholder="Statement..." className="flex-1" />
              <select
                value={s.correctPerson}
                onChange={(e) => updateStatement(i, "correctPerson", Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm"
              >
                {people.map((p, pi) => <option key={pi} value={pi}>{p.name || `Person ${pi + 1}`}</option>)}
              </select>
              <Button variant="ghost" size="icon" onClick={() => removeStatement(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStatement} className="gap-1"><Plus className="w-3 h-3" /> Thêm statement</Button>
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
