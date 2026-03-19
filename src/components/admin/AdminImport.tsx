import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ImportRow {
  title: string;
  skill: string;
  part: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string;
}

const AdminImport = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ tests: number; questions: number } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: ImportRow[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast({ title: "File trống", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Group by test (title + skill + part)
      const testMap = new Map<string, { title: string; skill: string; part: string; questions: ImportRow[] }>();
      rows.forEach((row) => {
        const key = `${row.title}|${row.skill}|${row.part}`;
        if (!testMap.has(key)) {
          testMap.set(key, { title: row.title, skill: row.skill, part: row.part, questions: [] });
        }
        testMap.get(key)!.questions.push(row);
      });

      let testCount = 0;
      let questionCount = 0;

      for (const [, group] of testMap) {
        // Check if test exists
        const { data: existing } = await supabase
          .from("tests")
          .select("id")
          .eq("title", group.title)
          .eq("skill", group.skill)
          .eq("part", group.part)
          .maybeSingle();

        let testId: string;
        if (existing) {
          testId = existing.id;
        } else {
          const { data: newTest, error } = await supabase
            .from("tests")
            .insert({ title: group.title, skill: group.skill, part: group.part, time_limit: 30 })
            .select("id")
            .single();
          if (error || !newTest) continue;
          testId = newTest.id;
          testCount++;
        }

        // Insert questions
        for (let i = 0; i < group.questions.length; i++) {
          const q = group.questions[i];
          const correctIndex = ["A", "B", "C", "D"].indexOf(q.correct_answer?.toUpperCase());
          const options = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];

          const { data: newQ, error } = await supabase.from("questions").insert({
            test_id: testId,
            skill: group.skill,
            question_text: q.question_text,
            question_type: "multiple_choice",
            options: options as any,
            correct_answer: correctIndex >= 0 ? correctIndex : 0,
            explanation: q.explanation || "",
            order_index: i,
          }).select("id").single();

          if (!error && newQ) {
            // Insert answers
            const answers = options.map((opt, idx) => ({
              question_id: newQ.id,
              answer_text: opt || "",
              is_correct: idx === (correctIndex >= 0 ? correctIndex : 0),
            }));
            await supabase.from("answers").insert(answers);
            questionCount++;
          }
        }
      }

      setResult({ tests: testCount, questions: questionCount });
      toast({ title: `Import thành công! ${testCount} đề, ${questionCount} câu hỏi.` });
    } catch (err: any) {
      toast({ title: "Lỗi import", description: err.message, variant: "destructive" });
    }

    setImporting(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border border-border rounded-xl p-6 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          <h3 className="font-heading font-semibold">Import từ CSV / Excel</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Upload file Excel hoặc CSV với các cột: <code className="bg-muted px-1 py-0.5 rounded text-xs">title, skill, part, question_text, answer_a, answer_b, answer_c, answer_d, correct_answer, explanation</code>
        </p>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Kéo thả file hoặc click để chọn</p>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={importing} />
            <Button variant="outline" className="gap-2" disabled={importing} asChild>
              <span>{importing ? "Đang import..." : "Chọn file"}</span>
            </Button>
          </label>
        </div>

        {result && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Đã import {result.tests} đề thi mới và {result.questions} câu hỏi.</span>
          </div>
        )}
      </div>

      <div className="border border-border rounded-xl p-6 bg-card">
        <h3 className="font-heading font-semibold mb-3">Mẫu file import</h3>
        <div className="overflow-x-auto">
          <table className="text-xs border border-border w-full">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border p-2">title</th>
                <th className="border border-border p-2">skill</th>
                <th className="border border-border p-2">part</th>
                <th className="border border-border p-2">question_text</th>
                <th className="border border-border p-2">answer_a</th>
                <th className="border border-border p-2">answer_b</th>
                <th className="border border-border p-2">answer_c</th>
                <th className="border border-border p-2">answer_d</th>
                <th className="border border-border p-2">correct_answer</th>
                <th className="border border-border p-2">explanation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-2">TEST 1</td>
                <td className="border border-border p-2">reading</td>
                <td className="border border-border p-2">Part 1</td>
                <td className="border border-border p-2">What is...?</td>
                <td className="border border-border p-2">Option A</td>
                <td className="border border-border p-2">Option B</td>
                <td className="border border-border p-2">Option C</td>
                <td className="border border-border p-2">Option D</td>
                <td className="border border-border p-2">A</td>
                <td className="border border-border p-2">Because...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminImport;
