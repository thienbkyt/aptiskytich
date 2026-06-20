import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skill, SKILL_LABELS, ExcelImportRow } from "./types";

interface Props {
  onParsed: (questions: ExcelImportRow[], skill: Skill) => void;
}

const AiParser = ({ onParsed }: Props) => {
  const { toast } = useToast();
  const [rawText, setRawText] = useState("");
  const [skill, setSkill] = useState<Skill>("grammar_vocab");
  const [parsing, setParsing] = useState(false);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast({ title: "Nhập nội dung đề thi", variant: "destructive" });
      return;
    }
    setParsing(true);
    setParsedCount(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-exam", {
        body: { rawText, skill },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Lỗi AI", description: data.error, variant: "destructive" });
        setParsing(false);
        return;
      }

      const questions: ExcelImportRow[] = (data.questions || []).map((q: any, i: number) => ({
        question_text: q.question_text || "",
        option_a: q.option_a || "",
        option_b: q.option_b || "",
        option_c: q.option_c || "",
        option_d: q.option_d || "",
        correct_answer: q.correct_answer || "A",
        explanation: q.explanation || "",
        order_index: q.order_index || i + 1,
      }));

      if (questions.length === 0) {
        toast({ title: "AI không tìm thấy câu hỏi nào", variant: "destructive" });
      } else {
        setParsedCount(questions.length);
        toast({ title: `AI đã bóc tách ${questions.length} câu hỏi!` });
        onParsed(questions, skill);
      }
    } catch (err: any) {
      toast({ title: "Lỗi kết nối AI", description: err?.message || "Thử lại sau", variant: "destructive" });
    }
    setParsing(false);
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-foreground">AI Parser — Bóc tách đề thi tự động</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Dán nội dung đề thi thô vào ô bên dưới. AI Kỳ Tích sẽ tự động nhận diện câu hỏi, đáp án và điền vào Form thông minh.
      </p>

      <div>
        <Label className="text-xs text-muted-foreground">Kỹ năng</Label>
        <Select value={skill} onValueChange={(v) => setSkill(v as Skill)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(SKILL_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Nội dung đề thi thô</Label>
        <Textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={"Dán nội dung đề thi ở đây...\n\nVí dụ:\n1. She _____ to work every day.\nA. go  B. goes  C. going  D. gone\nĐáp án: B\n\n2. They have _____ finished the project.\nA. already  B. yet  C. still  D. just\nĐáp án: A"}
          rows={10}
          className="mt-1 font-mono text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleParse} disabled={parsing || !rawText.trim()} className="gap-2">
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {parsing ? "Đang phân tích..." : "Bóc tách bằng AI"}
        </Button>
        {parsedCount !== null && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Đã tìm {parsedCount} câu hỏi
          </span>
        )}
      </div>
    </div>
  );
};

export default AiParser;
