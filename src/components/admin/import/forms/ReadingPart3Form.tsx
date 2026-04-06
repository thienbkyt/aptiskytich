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
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = {
    order_index: 0, question_text: "", question_type: "opinion_matching",
    options: [], correct_answer: 0, explanation: "", audio_url: null,
    image_url: null, response_time: null,
    extra_data: { instruction: "", people: [], statements: [] },
  };
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
    <div className="space-y-6 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 3 — Opinion Matching</h3>

      {/* Instruction */}
      <div>
        <Label>Hướng dẫn làm bài (Instruction)</Label>
        <Textarea
          value={ed.instruction || ""}
          onChange={(e) => update("instruction", e.target.value)}
          rows={2}
          placeholder="Four people respond in the comments section of an online magazine article about education. Read the texts and then answer the questions below."
        />
      </div>

      {/* People */}
      <div>
        <Label>Danh sách người và ý kiến ({people.length} người)</Label>
        <div className="space-y-3 mt-2">
          {people.map((p, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-background">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                <Input
                  value={p.name}
                  onChange={(e) => updatePerson(i, "name", e.target.value)}
                  placeholder="Tên người (ví dụ: Petra)"
                  className="text-sm flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removePerson(i)} className="text-destructive shrink-0">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Textarea
                value={p.text}
                onChange={(e) => updatePerson(i, "text", e.target.value)}
                rows={3}
                placeholder="Nội dung ý kiến của người này..."
                className="text-sm"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addPerson} className="gap-1">
            <Plus className="w-3 h-3" /> Thêm người
          </Button>
        </div>
      </div>

      {/* Statements / Questions */}
      <div>
        <Label>Các câu hỏi ({statements.length} câu)</Label>
        <div className="space-y-2 mt-2">
          {statements.map((s, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-muted-foreground w-6 pt-2">{i + 1}.</span>
              <Input
                value={s.text}
                onChange={(e) => updateStatement(i, "text", e.target.value)}
                placeholder="Câu hỏi (ví dụ: Who thinks you should study when you are older?)"
                className="text-sm flex-1"
              />
              <select
                value={s.correctPerson}
                onChange={(e) => updateStatement(i, "correctPerson", Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm min-w-[120px]"
              >
                {people.length === 0 && <option value={0}>—</option>}
                {people.map((p, pi) => (
                  <option key={pi} value={pi}>{p.name || `Người ${pi + 1}`}</option>
                ))}
              </select>
              <Button variant="ghost" size="icon" onClick={() => removeStatement(i)} className="text-destructive shrink-0">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStatement} className="gap-1">
            <Plus className="w-3 h-3" /> Thêm câu hỏi
          </Button>
        </div>
      </div>

      {/* Explanation */}
      <div>
        <Label>Giải thích</Label>
        <Textarea
          value={q.explanation}
          onChange={(e) => setQuestions([{ ...q, explanation: e.target.value }])}
          rows={2}
        />
      </div>

      {/* Preview */}
      {people.length > 0 && statements.length > 0 && (
        <div className="border-t border-border pt-4">
          <Label className="mb-2 block">Xem trước</Label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {people.map((p, i) => (
              <div key={i} className="bg-background border border-border rounded-lg p-3">
                <p className="text-xs font-bold">{p.name || "..."}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.text || "..."}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {statements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-bold">{i + 1}.</span>
                <span className="flex-1">{s.text || "..."}</span>
                <span className="px-2 py-1 bg-muted rounded text-muted-foreground">
                  {people[s.correctPerson]?.name || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPart3Form;
