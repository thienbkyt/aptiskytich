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

const ReadingPart1Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "gap_fill", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const instruction = (ed.instruction || "") as string;
  const passage = (ed.passage || q.question_text || "") as string;
  const gaps: { options: string[]; correct: number }[] = ed.gaps || [];

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const updateGap = (gapIdx: number, field: string, val: any) => {
    const g = [...gaps];
    g[gapIdx] = { ...g[gapIdx], [field]: val };
    update("gaps", g);
  };

  const updateGapOption = (gapIdx: number, optIdx: number, val: string) => {
    const g = [...gaps];
    const opts = [...(g[gapIdx].options || [])];
    opts[optIdx] = val;
    g[gapIdx] = { ...g[gapIdx], options: opts };
    update("gaps", g);
  };

  const addGapOption = (gapIdx: number) => {
    const g = [...gaps];
    g[gapIdx] = { ...g[gapIdx], options: [...(g[gapIdx].options || []), ""] };
    update("gaps", g);
  };

  const removeGapOption = (gapIdx: number, optIdx: number) => {
    const g = [...gaps];
    g[gapIdx] = { ...g[gapIdx], options: g[gapIdx].options.filter((_, i) => i !== optIdx) };
    update("gaps", g);
  };

  const addGap = () => update("gaps", [...gaps, { options: ["", "", ""], correct: 0 }]);
  const removeGap = (idx: number) => update("gaps", gaps.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 1 — Gap Fill (Dropdown)</h3>
      <p className="text-xs text-muted-foreground">
        Nhập passage với placeholder {"{0}"}, {"{1}"}... cho mỗi gap. Mỗi gap có danh sách options riêng và chọn đáp án đúng.
      </p>

      <div>
        <Label>Instruction</Label>
        <Input
          value={instruction}
          onChange={(e) => update("instruction", e.target.value)}
          placeholder="Read the email from ... Choose one word from the list for each gap."
        />
      </div>

      <div>
        <Label>Passage (dùng {"{0}"}, {"{1}"}... cho gaps)</Label>
        <Textarea
          value={passage}
          onChange={(e) => {
            update("passage", e.target.value);
            setQuestions((qs) => [{ ...qs[0], question_text: e.target.value }]);
          }}
          rows={8}
          placeholder={`Dear Sally,\n\nWe have a nice {0} of the sea.\n\nThe weather is {1} and hot.\n\nLove,\nJanice`}
        />
      </div>

      <div>
        <Label>Gaps (mỗi gap có options riêng)</Label>
        <div className="space-y-3 mt-1">
          {gaps.map((g, gi) => (
            <div key={gi} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Gap {gi} — Đáp án đúng: option #{g.correct}</span>
                <Button variant="ghost" size="icon" onClick={() => removeGap(gi)} className="text-destructive shrink-0">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {(g.options || []).map((opt, oi) => (
                  <div key={oi} className="flex gap-2 items-center">
                    <Button
                      variant={g.correct === oi ? "default" : "outline"}
                      size="sm"
                      className="shrink-0 w-8 h-8 p-0 text-xs"
                      onClick={() => updateGap(gi, "correct", oi)}
                      title="Chọn đáp án đúng"
                    >
                      {oi}
                    </Button>
                    <Input
                      value={opt}
                      onChange={(e) => updateGapOption(gi, oi, e.target.value)}
                      placeholder={`Option ${oi}`}
                      className={g.correct === oi ? "border-primary" : ""}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeGapOption(gi, oi)} className="text-destructive shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addGapOption(gi)} className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Thêm option
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGap} className="gap-1">
            <Plus className="w-3 h-3" /> Thêm gap
          </Button>
        </div>
      </div>

      <div>
        <Label>Giải thích</Label>
        <Textarea value={q.explanation} onChange={(e) => setQuestions((qs) => [{ ...qs[0], explanation: e.target.value }])} rows={2} />
      </div>
    </div>
  );
};

export default ReadingPart1Form;
