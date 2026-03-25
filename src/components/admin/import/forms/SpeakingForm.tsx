import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ExamQuestionRow } from "../types";

interface Props {
  questions: Omit<ExamQuestionRow, "exam_set_id">[];
  setQuestions: React.Dispatch<React.SetStateAction<Omit<ExamQuestionRow, "exam_set_id">[]>>;
  part: string;
  onImageUpload: (idx: number, file: File) => void;
  uploadingIdx: number | null;
}

const EMPTY_SPEAKING_Q = (): Omit<ExamQuestionRow, "exam_set_id"> => ({
  order_index: 0,
  question_text: "",
  question_type: "speaking",
  options: [],
  correct_answer: 0,
  explanation: "",
  audio_url: null,
  image_url: null,
  response_time: 30,
  extra_data: { prepTime: 0, speakTime: 30 },
});

const SpeakingForm = ({ questions, setQuestions, part, onImageUpload, uploadingIdx }: Props) => {
  const isPart1 = part.includes("1");
  const isPart2 = part.includes("2");
  const isPart3 = part.includes("3");
  const isPart4 = part.includes("4");

  const updateQ = (idx: number, field: string, val: any) => {
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  const updateExtra = (idx: number, field: string, val: any) => {
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, extra_data: { ...q.extra_data, [field]: val } } : q));
  };

  const addQuestion = () => setQuestions((qs) => [...qs, { ...EMPTY_SPEAKING_Q(), order_index: qs.length }]);
  const removeQuestion = (idx: number) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      {/* Part 4 topic */}
      {isPart4 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <Label>Topic (chủ đề chung)</Label>
          <Input value={questions[0]?.extra_data?.topic || ""} onChange={(e) => updateExtra(0, "topic", e.target.value)} placeholder="Education and technology" />
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={idx} className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{isPart2 || isPart3 ? "Prompt" : `Câu ${idx + 1}`}</span>
            {(isPart1 || isPart4) && questions.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
            )}
          </div>

          <div>
            <Label>{isPart2 || isPart3 ? "Prompt" : "Câu hỏi"}</Label>
            <Textarea value={q.question_text} onChange={(e) => updateQ(idx, "question_text", e.target.value)} rows={2} placeholder="Nhập câu hỏi / prompt..." />
          </div>

          {/* Image for Part 2 */}
          {isPart2 && (
            <div>
              <Label>Image URL</Label>
              {q.image_url ? (
                <div className="flex items-center gap-2">
                  <img src={q.image_url} alt="" className="w-20 h-20 object-cover rounded border border-border" />
                  <Button variant="outline" size="sm" onClick={() => updateQ(idx, "image_url", null)}>Xóa</Button>
                </div>
              ) : (
                <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(idx, f); }} disabled={uploadingIdx === idx} />
              )}
            </div>
          )}

          {/* Two images for Part 3 */}
          {isPart3 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Image 1 URL</Label>
                {q.image_url ? (
                  <div className="flex items-center gap-2">
                    <img src={q.image_url} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                    <Button variant="outline" size="sm" onClick={() => updateQ(idx, "image_url", null)}>Xóa</Button>
                  </div>
                ) : (
                  <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(idx, f); }} disabled={uploadingIdx === idx} />
                )}
              </div>
              <div>
                <Label>Image 2 URL</Label>
                <Input value={q.extra_data?.imageUrl2 || ""} onChange={(e) => updateExtra(idx, "imageUrl2", e.target.value)} placeholder="URL ảnh thứ 2" />
              </div>
            </div>
          )}

          {/* Prep/Speak times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prep Time (giây)</Label>
              <Input type="number" value={q.extra_data?.prepTime || 0} onChange={(e) => updateExtra(idx, "prepTime", Number(e.target.value))} />
            </div>
            <div>
              <Label>Speak Time (giây)</Label>
              <Input type="number" value={q.extra_data?.speakTime || 30} onChange={(e) => { updateExtra(idx, "speakTime", Number(e.target.value)); updateQ(idx, "response_time", Number(e.target.value)); }} />
            </div>
          </div>

          <div>
            <Label>Sample Answer</Label>
            <Textarea value={q.explanation} onChange={(e) => updateQ(idx, "explanation", e.target.value)} rows={2} placeholder="Câu trả lời mẫu..." />
          </div>
        </div>
      ))}

      {(isPart1 || isPart4) && (
        <Button variant="outline" onClick={addQuestion} className="gap-2"><Plus className="w-4 h-4" /> Thêm câu hỏi</Button>
      )}
    </div>
  );
};

export default SpeakingForm;
