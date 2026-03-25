import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FULL_EXAM_SHEETS, SKILL_LABELS } from "./types";
import { parseSheet } from "./excelParsers";

interface ParsedSheet {
  sheetName: string;
  skill: string;
  part: string;
  label: string;
  questions: any[];
  errors: { row: number; message: string }[];
  rowCount: number;
}

interface Props {
  examType: string;
  onImportComplete: () => void;
}

const downloadTemplate = () => {
  const wb = XLSX.utils.book_new();

  const sheets: { name: string; cols: Record<string, string>[] }[] = [
    // Grammar & Vocab Part 1-4 (MCQ)
    ...[1, 2, 3, 4].map((p) => ({
      name: `GV_Part${p}`,
      cols: [{ question_text: "She _____ to work every day.", option_a: "go", option_b: "goes", option_c: "going", option_d: "gone", correct_answer: "B", explanation: "Present Simple, ngôi 3 số ít" }],
    })),
    // Reading Part 1
    {
      name: "R_Part1",
      cols: [{ sentence: "The cat sat on the mat.", question: "Where is the cat?", option_a: "On the mat", option_b: "Under the table", option_c: "In the garden", option_d: "On the chair", correct_answer: "A", explanation: "Câu nói rõ: on the mat" }],
    },
    // Reading Part 2
    {
      name: "R_Part2",
      cols: [
        { passage: "The city has changed a lot. {0} New buildings have appeared everywhere. {1} However, some old traditions remain.", sentence_option: "It is now very modern.", gap_index: "0", explanation: "Cohesion logic" },
        { passage: "", sentence_option: "Many people still celebrate local festivals.", gap_index: "1", explanation: "" },
        { passage: "", sentence_option: "The weather has become colder.", gap_index: "", explanation: "" },
      ],
    },
    // Reading Part 3
    {
      name: "R_Part3",
      cols: [
        { person_name: "Alice", person_text: "I love reading books in my free time.", statement: "This person enjoys literature.", correct_person: "Alice", explanation: "Alice nói rõ love reading books" },
        { person_name: "Bob", person_text: "I prefer outdoor activities like hiking.", statement: "This person prefers being outside.", correct_person: "Bob", explanation: "" },
      ],
    },
    // Reading Part 4
    {
      name: "R_Part4",
      cols: [{ passage: "Long reading passage here...", question_text: "What is the main idea?", option_a: "Idea A", option_b: "Idea B", option_c: "Idea C", option_d: "Idea D", correct_answer: "A", explanation: "Đoạn đầu nêu rõ" }],
    },
    // Listening Part 1-4 (MCQ + audio)
    ...[1, 2, 3, 4].map((p) => ({
      name: `L_Part${p}`,
      cols: [{ question_text: "What does the speaker say?", option_a: "A", option_b: "B", option_c: "C", option_d: "D", correct_answer: "C", explanation: "Speaker nói...", audio_filename: `listening_p${p}_q1.mp3` }],
    })),
    // Speaking Part 1
    { name: "S_Part1", cols: [{ question_text: "What is your name?", prep_time: "0", speak_time: "30", sample_answer: "My name is..." }] },
    // Speaking Part 2
    { name: "S_Part2", cols: [{ prompt: "Describe this image.", image_url: "https://...", prep_time: "45", speak_time: "45", sample_answer: "In this image..." }] },
    // Speaking Part 3
    { name: "S_Part3", cols: [{ prompt: "Compare these two images.", image_url_1: "https://...", image_url_2: "https://...", prep_time: "45", speak_time: "60", sample_answer: "Both images show..." }] },
    // Speaking Part 4
    { name: "S_Part4", cols: [{ topic: "Education and technology", question_text: "Do you think technology improves education?", prep_time: "60", speak_time: "120", sample_answer: "I believe that..." }] },
    // Writing Part 1
    { name: "W_Part1", cols: [{ question_text: "What is your favorite color?", sample_answer: "My favorite color is blue." }] },
    // Writing Part 2
    { name: "W_Part2", cols: [{ social_post_author: "John", social_post_content: "Just visited a new café!", prompt_question: "Would you like to go there?", word_limit: "30", sample_answer: "That sounds great..." }] },
    // Writing Part 3
    { name: "W_Part3", cols: [{ question_text: "What do you think about online learning?", word_limit: "40", sample_answer: "Online learning is..." }] },
    // Writing Part 4
    {
      name: "W_Part4",
      cols: [
        { email_type: "informal", scenario: "Write to your friend about a party.", bullet_points: "when;where;what to bring", word_limit: "50", sample_answer: "Hi! I'm having a party..." },
        { email_type: "formal", scenario: "Write to your manager requesting leave.", bullet_points: "reason;dates;work coverage", word_limit: "150", sample_answer: "Dear Sir/Madam..." },
      ],
    },
  ];

  sheets.forEach(({ name, cols }) => {
    const ws = XLSX.utils.json_to_sheet(cols);
    ws["!cols"] = Object.keys(cols[0]).map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, "aptis_full_exam_template.xlsx");
};

const ExcelImport = ({ examType, onImportComplete }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [result, setResult] = useState<{ success: number; total: number; setsCreated: number } | null>(null);
  const [examTitle, setExamTitle] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const sheets: ParsedSheet[] = [];

        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws);
          if (rows.length === 0) return;

          const parsed = parseSheet(name, rows);
          if (!parsed.mapping) return;

          sheets.push({
            sheetName: name,
            skill: parsed.mapping.skill,
            part: parsed.mapping.part,
            label: parsed.mapping.label,
            questions: parsed.questions,
            errors: parsed.errors,
            rowCount: rows.length,
          });
        });

        if (sheets.length === 0) {
          toast({ title: "Không tìm thấy tab hợp lệ", description: "Đặt tên tab theo format: GV_Part1, R_Part2, L_Part3, S_Part1, W_Part4...", variant: "destructive" });
          return;
        }

        setParsedSheets(sheets);
        setActiveSheet(0);
        setResult(null);
      } catch {
        toast({ title: "Lỗi đọc file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!examTitle.trim()) { toast({ title: "Nhập tên đề thi", variant: "destructive" }); return; }
    setImporting(true);
    let totalSuccess = 0;
    let setsCreated = 0;

    for (const sheet of parsedSheets) {
      if (sheet.errors.length > 0 || sheet.questions.length === 0) continue;

      const { data: setData, error: setErr } = await supabase
        .from("exam_sets")
        .insert({
          title: `${examTitle} - ${sheet.label}`,
          exam_type: examType,
          skill: sheet.skill,
          part: sheet.part,
        })
        .select("id").single();
      if (setErr || !setData) continue;
      setsCreated++;

      const toInsert = sheet.questions.map((q: any) => ({
        ...q,
        exam_set_id: setData.id,
      }));

      const { error } = await supabase.from("exam_questions").insert(toInsert as any);
      if (!error) totalSuccess += toInsert.length;
    }

    setResult({
      success: totalSuccess,
      total: parsedSheets.reduce((s, sh) => s + sh.questions.length, 0),
      setsCreated,
    });
    setImporting(false);
    if (totalSuccess > 0) {
      toast({ title: `Đã nhập ${totalSuccess} câu hỏi vào ${setsCreated} đề!` });
      onImportComplete();
    }
  };

  const reset = () => { setParsedSheets([]); setResult(null); setExamTitle(""); };
  const currentSheet = parsedSheets[activeSheet];
  const validSheets = parsedSheets.filter((s) => s.errors.length === 0 && s.questions.length > 0);
  const totalParts = FULL_EXAM_SHEETS.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Tải Template (20 Parts)
        </Button>
        <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2" disabled={importing}>
          <Upload className="w-4 h-4" /> Chọn file Excel
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      </div>

      <AnimatePresence>
        {parsedSheets.length > 0 && !result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border border-border rounded-xl p-5 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">
                  Preview — {parsedSheets.length}/{totalParts} parts
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {validSheets.length} sẵn sàng
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={reset}><X className="w-4 h-4" /></Button>
            </div>

            {/* Exam title */}
            <div>
              <Label>Tên đề thi (prefix cho tất cả parts)</Label>
              <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="VD: Aptis Mock Test #5" className="mt-1" />
            </div>

            {/* Sheet tabs */}
            <div className="flex gap-2 flex-wrap">
              {parsedSheets.map((sh, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    i === activeSheet ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {sh.label} ({sh.questions.length})
                  {sh.errors.length > 0 && <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive" />}
                </button>
              ))}
            </div>

            {/* Errors */}
            {currentSheet?.errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {currentSheet.errors.length} lỗi
                </p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {currentSheet.errors.map((err, i) => <p key={i} className="text-xs text-destructive">{err.message}</p>)}
                </div>
              </div>
            )}

            {/* Preview */}
            {currentSheet && currentSheet.questions.length > 0 && (
              <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Nội dung</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Loại</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.questions.slice(0, 25).map((q: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-foreground max-w-[250px] truncate">{q.question_text}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{q.question_type}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate">
                          {q.options?.length > 0 ? `${q.options.length} options` : ""}
                          {q.audio_url ? " 🎵" : ""}
                          {q.image_url ? " 🖼" : ""}
                          {Object.keys(q.extra_data || {}).length > 0 ? ` +${Object.keys(q.extra_data).length} fields` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={importing || validSheets.length === 0 || !examTitle.trim()}
              className="w-full gap-2"
            >
              {importing ? "Đang nhập..." : <><Upload className="w-4 h-4" /> Lưu {validSheets.length} parts ({validSheets.reduce((s, sh) => s + sh.questions.length, 0)} câu hỏi)</>}
            </Button>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="border border-border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h3 className="font-heading font-bold text-foreground">Hoàn tất</h3>
            </div>
            <p className="text-sm text-foreground">
              Đã nhập <span className="font-bold text-primary">{result.success}</span> câu hỏi
              vào <span className="font-bold text-primary">{result.setsCreated}</span> đề thi
            </p>
            <Button onClick={reset} variant="outline" size="sm">Đóng</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExcelImport;
