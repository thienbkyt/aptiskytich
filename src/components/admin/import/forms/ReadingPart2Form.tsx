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

const ReadingPart2Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "text_cohesion", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const passage = (ed.passage || q.question_text || "") as string;
  const sentenceOptions: string[] = ed.sentenceOptions || q.options || [];
  const gaps: { correct: number }[] = ed.gaps || [];

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  const updateSentence = (idx: number, val: string) => {
    const opts = [...sentenceOptions];
    opts[idx] = val;
    update("sentenceOptions", opts);
  };

  const addSentence = () => update("sentenceOptions", [...sentenceOptions, ""]);
  const removeSentence = (idx: number) => update("sentenceOptions", sentenceOptions.filter((_, i) => i !== idx));

  const updateGapCorrect = (gapIdx: number, correctIdx: number) => {
    const g = [...gaps];
    g[gapIdx] = { correct: correctIdx };
    update("gaps", g);
  };

  const addGap = () => update("gaps", [...gaps, { correct: 0 }]);
  const removeGap = (idx: number) => update("gaps", gaps.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Reading Part 2 — Text Cohesion</h3>
      <p className="text-xs text-muted-foreground">Nhập passage với placeholder {"{0}"}, {"{1}"}... cho mỗi gap. Thêm sentence options và chọn đáp án đúng cho mỗi gap.</p>

      <div>
        <Label>Passage (dùng {"{0}"}, {"{1}"}... cho gaps)</Label>
        <Textarea value={passage} onChange={(e) => { update("passage", e.target.value); setQuestions((qs) => [{ ...qs[0], question_text: e.target.value }]); }} rows={6} placeholder="The city has changed a lot. {0} New buildings appeared. {1}" />
      </div>

      <div>
        <Label>Sentence Options</Label>
        <div className="space-y-2 mt-1">
          {sentenceOptions.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-6">{i}</span>
              <Input value={s} onChange={(e) => updateSentence(i, e.target.value)} placeholder={`Sentence option ${i}`} />
              <Button variant="ghost" size="icon" onClick={() => removeSentence(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSentence} className="gap-1"><Plus className="w-3 h-3" /> Thêm sentence</Button>
        </div>
      </div>

      <div>
        <Label>Gaps (đáp án đúng cho mỗi gap)</Label>
        <div className="space-y-2 mt-1">
          {gaps.map((g, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground">Gap {i}:</span>
              <Input type="number" value={g.correct} onChange={(e) => updateGapCorrect(i, Number(e.target.value))} className="w-20" min={0} max={sentenceOptions.length - 1} />
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">→ {sentenceOptions[g.correct] || "?"}</span>
              <Button variant="ghost" size="icon" onClick={() => removeGap(i)} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addGap} className="gap-1"><Plus className="w-3 h-3" /> Thêm gap</Button>
        </div>
      </div>

      <div>
        <Label>Giải thích</Label>
        <Textarea value={q.explanation} onChange={(e) => setQuestions((qs) => [{ ...qs[0], explanation: e.target.value }])} rows={2} />
      </div>
    </div>
  );
};

export default ReadingPart2Form;
