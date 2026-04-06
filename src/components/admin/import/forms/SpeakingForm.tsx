import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown } from "lucide-react";
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

  // ─── Part 3: Opinion Matching Editor ───
  if (isPart3) {
    const q = questions[0] || EMPTY_SPEAKING_Q();
    const ed = q.extra_data || {};
    const texts: { name: string; content: string }[] = ed.texts || [
      { name: "", content: "" }, { name: "", content: "" },
      { name: "", content: "" }, { name: "", content: "" },
    ];
    const part3Questions: { text: string; correctPerson: string }[] = ed.questions || [];

    const setTexts = (newTexts: typeof texts) => {
      setQuestions([{ ...q, extra_data: { ...ed, texts: newTexts } }]);
    };
    const setPart3Questions = (newQs: typeof part3Questions) => {
      setQuestions([{ ...q, extra_data: { ...ed, questions: newQs } }]);
    };

    const personNames = texts.map(t => t.name).filter(Boolean);

    return (
      <div className="space-y-4">
        {/* Instruction */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <Label>Instruction (hướng dẫn)</Label>
          <Textarea
            value={ed.instruction || ""}
            onChange={(e) => setQuestions([{ ...q, extra_data: { ...ed, instruction: e.target.value } }])}
            rows={2}
            placeholder="Four people respond in the comments section..."
          />
        </div>

        {/* 4 Person cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {texts.map((person, pi) => (
            <div key={pi} className="p-4 rounded-xl border border-border bg-card space-y-2">
              <Label>Tên người {pi + 1}</Label>
              <Input value={person.name} onChange={(e) => {
                const newTexts = [...texts];
                newTexts[pi] = { ...newTexts[pi], name: e.target.value };
                setTexts(newTexts);
              }} placeholder="Petra" />
              <Label>Nội dung ý kiến</Label>
              <Textarea value={person.content} onChange={(e) => {
                const newTexts = [...texts];
                newTexts[pi] = { ...newTexts[pi], content: e.target.value };
                setTexts(newTexts);
              }} rows={4} placeholder="As you get older, responsibilities like..." />
            </div>
          ))}
        </div>

        {/* Questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Câu hỏi ({part3Questions.length})</Label>
            <Button variant="outline" size="sm" onClick={() => setPart3Questions([...part3Questions, { text: "", correctPerson: "" }])}>
              <Plus className="w-4 h-4 mr-1" /> Thêm câu hỏi
            </Button>
          </div>
          {part3Questions.map((pq, qi) => (
            <div key={qi} className="p-3 rounded-lg border border-border bg-card flex gap-3 items-start">
              <span className="text-sm font-bold text-muted-foreground mt-2">{qi + 1}.</span>
              <div className="flex-1 space-y-2">
                <Input value={pq.text} onChange={(e) => {
                  const newQs = [...part3Questions];
                  newQs[qi] = { ...newQs[qi], text: e.target.value };
                  setPart3Questions(newQs);
                }} placeholder="Who thinks you should study when you are older?" />
                <div>
                  <Label className="text-xs">Đáp án đúng</Label>
                  <select
                    value={pq.correctPerson}
                    onChange={(e) => {
                      const newQs = [...part3Questions];
                      newQs[qi] = { ...newQs[qi], correctPerson: e.target.value };
                      setPart3Questions(newQs);
                    }}
                    className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background"
                  >
                    <option value="">-- Chọn người --</option>
                    {personNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPart3Questions(part3Questions.filter((_, i) => i !== qi))} className="text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Preview */}
        {texts.some(t => t.name) && part3Questions.length > 0 && (
          <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
            <p className="text-xs font-semibold text-primary mb-3">📋 Preview</p>
            <p className="text-sm text-foreground mb-3">{ed.instruction || "Read the texts and answer the questions below."}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {texts.filter(t => t.name).map((t, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xs font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{t.content}</p>
                </div>
              ))}
            </div>
            {part3Questions.map((pq, qi) => (
              <div key={qi} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-foreground"><strong>{qi + 1}.</strong> {pq.text}</span>
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">{pq.correctPerson || "?"}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <Label>Explanation</Label>
          <Textarea value={q.explanation} onChange={(e) => updateQ(0, "explanation", e.target.value)} rows={2} placeholder="Giải thích đáp án..." />
        </div>
      </div>
    );
  }

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
            <span className="font-semibold text-foreground">{isPart2 ? "Prompt" : `Câu ${idx + 1}`}</span>
            {(isPart1 || isPart4) && questions.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
            )}
          </div>

          <div>
            <Label>{isPart2 ? "Prompt" : "Câu hỏi"}</Label>
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
