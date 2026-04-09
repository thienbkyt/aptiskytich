import { useState, useEffect } from "react";
import { Save, Plus, Trash2, ArrowLeft, Upload, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExamSetRow, ExamQuestionRow, Skill, SKILL_PARTS, ExcelImportRow } from "./types";
import ReadingPart1Form from "./forms/ReadingPart1Form";
import ReadingPart2Form from "./forms/ReadingPart2Form";
import ReadingPart3Form from "./forms/ReadingPart3Form";
import ReadingPart4Form from "./forms/ReadingPart4Form";
import SpeakingForm from "./forms/SpeakingForm";
import WritingPart1Form from "./forms/WritingPart1Form";
import WritingPart2Form from "./forms/WritingPart2Form";
import WritingPart3Form from "./forms/WritingPart3Form";
import WritingPart4Form from "./forms/WritingPart4Form";

interface Props {
  examSet: ExamSetRow | null;
  skill: Skill;
  examType: string;
  onBack: () => void;
  onSaved: () => void;
  prefillQuestions?: ExcelImportRow[] | null;
}

const EMPTY_Q = (): Omit<ExamQuestionRow, "exam_set_id"> => ({
  order_index: 0,
  question_text: "",
  question_type: "multiple_choice",
  options: ["", "", "", ""],
  correct_answer: 0,
  explanation: "",
  audio_url: null,
  image_url: null,
  response_time: null,
  extra_data: {},
});

// Detect if this part needs a special (non-MCQ) form
const getFormType = (skill: Skill, part: string): string => {
  if (skill === "reading" && part.includes("1")) return "reading_part1";
  if (skill === "reading" && part.includes("2")) return "reading_part2";
  if (skill === "reading" && part.includes("3")) return "reading_part3";
  if (skill === "reading" && part.includes("4")) return "reading_part4";
  if (skill === "speaking") return "speaking";
  if (skill === "writing" && part.includes("1")) return "writing_part1";
  if (skill === "writing" && part.includes("2")) return "writing_part2";
  if (skill === "writing" && part.includes("3")) return "writing_part3";
  if (skill === "writing" && part.includes("4")) return "writing_part4";
  return "mcq";
};

const SmartForm = ({ examSet, skill, examType, onBack, onSaved, prefillQuestions }: Props) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(examSet?.title || "");
  const [part, setPart] = useState(examSet?.part || SKILL_PARTS[skill][0]);
  const [timeLimit, setTimeLimit] = useState(examSet?.time_limit || 30);
  const [questions, setQuestions] = useState<Omit<ExamQuestionRow, "exam_set_id">[]>([EMPTY_Q()]);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const formType = getFormType(skill, part);

  // Prefill from AI Parser
  useEffect(() => {
    if (prefillQuestions && prefillQuestions.length > 0) {
      const VALID_ANSWERS = ["A", "B", "C", "D"];
      setQuestions(prefillQuestions.map((q, i) => ({
        order_index: q.order_index || i,
        question_text: q.question_text || "",
        question_type: "multiple_choice",
        options: [q.option_a || "", q.option_b || "", q.option_c || "", q.option_d || ""],
        correct_answer: VALID_ANSWERS.indexOf(q.correct_answer?.toUpperCase() || "A"),
        explanation: q.explanation || "",
        audio_url: null,
        image_url: null,
        response_time: null,
        extra_data: {},
      })));
    }
  }, [prefillQuestions]);

  // Load existing questions if editing
  useEffect(() => {
    if (!examSet) return;
    const load = async () => {
      const { data } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_set_id", examSet.id)
        .order("order_index");
      if (data && data.length > 0) {
        setQuestions(data.map((q: any) => ({
          id: q.id,
          order_index: q.order_index,
          question_text: q.question_text,
          question_type: q.question_type,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer,
          explanation: q.explanation || "",
          audio_url: q.audio_url,
          image_url: q.image_url,
          response_time: q.response_time,
          extra_data: q.extra_data || {},
        })));
      }
    };
    load();
  }, [examSet]);

  const needsAudio = skill === "listening";

  const updateQ = (idx: number, field: string, val: any) => {
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  const updateOption = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((qs) => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[optIdx] = val;
      return { ...q, options: opts };
    }));
  };

  const addQuestion = () => setQuestions((qs) => [...qs, { ...EMPTY_Q(), order_index: qs.length }]);
  const removeQuestion = (idx: number) => setQuestions((qs) => qs.filter((_, i) => i !== idx));

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    const ext = file.name.split(".").pop();
    const path = `${skill}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("exam-images").upload(path, file);
    if (error) {
      toast({ title: "Upload lỗi", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("exam-images").getPublicUrl(path);
      updateQ(idx, "image_url", urlData.publicUrl);
      toast({ title: "Đã upload ảnh" });
    }
    setUploadingIdx(null);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Thiếu tên đề", variant: "destructive" }); return; }
    setSaving(true);

    let setId = examSet?.id;
    if (setId) {
      const { error } = await supabase.from("exam_sets").update({ title, part, time_limit: timeLimit }).eq("id", setId);
      if (error) { toast({ title: "Lỗi cập nhật đề", description: error.message, variant: "destructive" }); setSaving(false); return; }
      await supabase.from("exam_questions").delete().eq("exam_set_id", setId);
    } else {
      const { data, error } = await supabase.from("exam_sets")
        .insert({ title, exam_type: examType, skill, part, time_limit: timeLimit })
        .select("id").single();
      if (error || !data) { toast({ title: "Lỗi tạo đề", description: error?.message, variant: "destructive" }); setSaving(false); return; }
      setId = data.id;
    }

    const toInsert = questions.map((q, i) => ({
      exam_set_id: setId!,
      order_index: i,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      audio_url: q.audio_url || null,
      image_url: q.image_url || null,
      response_time: q.response_time,
      extra_data: q.extra_data,
    }));

    const { error: qErr } = await supabase.from("exam_questions").insert(toInsert as any);
    if (qErr) {
      toast({ title: "Lỗi lưu câu hỏi", description: qErr.message, variant: "destructive" });
    } else {
      toast({ title: `Đã lưu ${questions.length} câu hỏi!` });
      onSaved();
    }
    setSaving(false);
  };

  // Render specialized form for certain part types
  const renderSpecialForm = () => {
    switch (formType) {
      case "reading_part1":
        return <ReadingPart1Form questions={questions} setQuestions={setQuestions} />;
      case "reading_part2":
        return <ReadingPart2Form questions={questions} setQuestions={setQuestions} />;
      case "reading_part3":
        return <ReadingPart3Form questions={questions} setQuestions={setQuestions} />;
      case "reading_part4":
        return <ReadingPart4Form questions={questions} setQuestions={setQuestions} onImageUpload={handleImageUpload} uploadingIdx={uploadingIdx} />;
      case "speaking":
        return <SpeakingForm questions={questions} setQuestions={setQuestions} part={part} onImageUpload={handleImageUpload} uploadingIdx={uploadingIdx} />;
      case "writing_part1":
        return <WritingPart1Form questions={questions} setQuestions={setQuestions} />;
      case "writing_part2":
        return <WritingPart2Form questions={questions} setQuestions={setQuestions} />;
      case "writing_part3":
        return <WritingPart3Form questions={questions} setQuestions={setQuestions} />;
      case "writing_part4":
        return <WritingPart4Form questions={questions} setQuestions={setQuestions} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <h2 className="text-lg font-heading font-bold text-foreground">{examSet ? "Sửa đề thi" : "Tạo đề thi mới"}</h2>
      </div>

      {/* Exam set info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-card">
        <div>
          <Label>Tên đề thi</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Đề thi Grammar #1" />
        </div>
        <div>
          <Label>Phần thi (Part)</Label>
          <Select value={part} onValueChange={setPart}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SKILL_PARTS[skill].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Thời gian (phút)</Label>
          <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
        </div>
      </div>

      {/* Special forms OR default MCQ form */}
      {formType !== "mcq" ? (
        renderSpecialForm()
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">Câu {idx + 1}</span>
                </div>
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div>
                <Label>Câu hỏi</Label>
                <Textarea value={q.question_text} onChange={(e) => updateQ(idx, "question_text", e.target.value)} placeholder="Nhập câu hỏi..." rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {["A", "B", "C", "D"].map((label, optIdx) => (
                  <div key={label}>
                    <Label className="text-xs">
                      Đáp án {label} {q.correct_answer === optIdx && <span className="text-primary font-bold">✓ Đúng</span>}
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        value={q.options[optIdx] || ""}
                        onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                        placeholder={`Đáp án ${label}`}
                        className={q.correct_answer === optIdx ? "border-primary" : ""}
                      />
                      <Button
                        variant={q.correct_answer === optIdx ? "default" : "outline"}
                        size="icon"
                        className="shrink-0"
                        onClick={() => updateQ(idx, "correct_answer", optIdx)}
                        title="Chọn đáp án đúng"
                      >
                        {label}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label>Giải thích</Label>
                <Textarea value={q.explanation} onChange={(e) => updateQ(idx, "explanation", e.target.value)} placeholder="Giải thích đáp án đúng..." rows={2} />
              </div>

              {/* Audio for listening */}
              {needsAudio && (
                <div>
                  <Label>Audio URL / Filename</Label>
                  <Input value={q.audio_url || ""} onChange={(e) => updateQ(idx, "audio_url", e.target.value)} placeholder="audio_part1_q1.mp3" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {formType === "mcq" && (
          <Button variant="outline" onClick={addQuestion} className="gap-2">
            <Plus className="w-4 h-4" /> Thêm câu hỏi
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving} className="gap-2 ml-auto">
          <Save className="w-4 h-4" /> {saving ? "Đang lưu..." : `Lưu ${questions.length} câu hỏi`}
        </Button>
      </div>
    </div>
  );
};

export default SmartForm;
