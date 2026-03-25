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

const WritingPart2Form = ({ questions, setQuestions }: Props) => {
  const defaultQ: Omit<ExamQuestionRow, "exam_set_id"> = { order_index: 0, question_text: "", question_type: "writing", options: [], correct_answer: 0, explanation: "", audio_url: null, image_url: null, response_time: null, extra_data: {} };
  const q = questions[0] || defaultQ;
  const ed = (q.extra_data || {}) as Record<string, any>;
  const socialPost = ed.socialPost || { author: "", content: "" };
  const promptQuestions: string[] = ed.promptQuestions || [];

  const update = (field: string, val: any) => {
    setQuestions([{ ...q, extra_data: { ...ed, [field]: val } }]);
  };

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground">Writing Part 2 — Social Media Response</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Post Author</Label>
          <Input value={socialPost.author} onChange={(e) => update("socialPost", { ...socialPost, author: e.target.value })} placeholder="John" />
        </div>
        <div>
          <Label>Word Limit</Label>
          <Input type="number" value={ed.wordLimit || 30} onChange={(e) => update("wordLimit", Number(e.target.value))} />
        </div>
      </div>

      <div>
        <Label>Social Post Content</Label>
        <Textarea value={socialPost.content} onChange={(e) => { update("socialPost", { ...socialPost, content: e.target.value }); setQuestions((qs) => [{ ...qs[0], question_text: e.target.value }]); }} rows={3} placeholder="Just visited a new café!" />
      </div>

      <div>
        <Label>Prompt Questions</Label>
        <div className="space-y-2 mt-1">
          {promptQuestions.map((pq, i) => (
            <div key={i} className="flex gap-2">
              <Input value={pq} onChange={(e) => { const pqs = [...promptQuestions]; pqs[i] = e.target.value; update("promptQuestions", pqs); }} placeholder="Would you like to try it?" />
              <Button variant="ghost" size="icon" onClick={() => update("promptQuestions", promptQuestions.filter((_, pi) => pi !== i))} className="text-destructive shrink-0"><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => update("promptQuestions", [...promptQuestions, ""])} className="gap-1"><Plus className="w-3 h-3" /> Thêm prompt</Button>
        </div>
      </div>

      <div>
        <Label>Sample Answer</Label>
        <Textarea value={ed.sampleAnswer || q.explanation} onChange={(e) => { update("sampleAnswer", e.target.value); setQuestions((qs) => [{ ...qs[0], explanation: e.target.value }]); }} rows={3} />
      </div>
    </div>
  );
};

export default WritingPart2Form;
