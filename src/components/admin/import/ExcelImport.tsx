import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skill, SKILL_LABELS, ExcelImportRow } from "./types";

const VALID_ANSWERS = ["A", "B", "C", "D"];

const SHEET_SKILL_MAP: Record<string, Skill> = {
  grammar_vocab: "grammar_vocab",
  reading: "reading",
  listening: "listening",
  speaking: "speaking",
  writing: "writing",
};

interface ParsedSheet {
  skill: Skill;
  sheetName: string;
  rows: ExcelImportRow[];
  errors: { row: number; message: string }[];
}

interface Props {
  examType: string;
  onImportComplete: () => void;
}

const downloadTemplate = () => {
  const wb = XLSX.utils.book_new();

  const skills: { name: string; cols: Record<string, string>[] }[] = [
    {
      name: "Grammar_Vocab",
      cols: [
        { question_text: "She _____ to work every day.", option_a: "go", option_b: "goes", option_c: "going", option_d: "gone", correct_answer: "B", explanation: "Ngôi 3 số ít + Present Simple", order_index: "1" },
      ],
    },
    {
      name: "Reading",
      cols: [
        { question_text: "What does the author suggest?", option_a: "Answer A", option_b: "Answer B", option_c: "Answer C", option_d: "Answer D", correct_answer: "A", explanation: "Đoạn 2, dòng 3", order_index: "1" },
      ],
    },
    {
      name: "Listening",
      cols: [
        { question_text: "What does the speaker mean?", option_a: "A", option_b: "B", option_c: "C", option_d: "D", correct_answer: "C", explanation: "Speaker nói...", audio_filename: "listening_p1_q1.mp3", order_index: "1" },
      ],
    },
    {
      name: "Speaking",
      cols: [
        { question_text: "Describe this image.", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "Sample answer", image_url: "", response_time: "45", order_index: "1" },
      ],
    },
    {
      name: "Writing",
      cols: [
        { question_text: "Write a short message to...", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "", explanation: "Model answer", order_index: "1" },
      ],
    },
  ];

  skills.forEach(({ name, cols }) => {
    const ws = XLSX.utils.json_to_sheet(cols);
    ws["!cols"] = Object.keys(cols[0]).map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  XLSX.writeFile(wb, "aptis_import_template.xlsx");
};

const validateRow = (row: ExcelImportRow, rowNum: number, skill: Skill): string | null => {
  if (!row.question_text?.toString().trim()) return `Dòng ${rowNum}: Thiếu câu hỏi`;
  if (skill !== "speaking" && skill !== "writing") {
    if (!row.option_a?.toString().trim() || !row.option_b?.toString().trim()) return `Dòng ${rowNum}: Thiếu đáp án`;
    const ans = row.correct_answer?.toString().toUpperCase().trim();
    if (!ans || !VALID_ANSWERS.includes(ans)) return `Dòng ${rowNum}: Đáp án đúng không hợp lệ: "${row.correct_answer}"`;
  }
  return null;
};

const ExcelImport = ({ examType, onImportComplete }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [result, setResult] = useState<{ success: number; total: number; setsCreated: number } | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [examPart, setExamPart] = useState("Part 1");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const sheets: ParsedSheet[] = [];

        wb.SheetNames.forEach((name) => {
          const normalizedName = name.toLowerCase().replace(/[\s-]/g, "_");
          const skill = SHEET_SKILL_MAP[normalizedName];
          if (!skill) return;

          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<ExcelImportRow>(ws);
          const errors: { row: number; message: string }[] = [];
          rows.forEach((row, i) => {
            const err = validateRow(row, i + 2, skill);
            if (err) errors.push({ row: i + 2, message: err });
          });
          sheets.push({ skill, sheetName: name, rows, errors });
        });

        if (sheets.length === 0) {
          toast({ title: "Không tìm thấy tab hợp lệ", description: "Đặt tên tab: Grammar_Vocab, Reading, Listening, Speaking, Writing", variant: "destructive" });
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
      if (sheet.errors.length > 0) continue;

      // Create exam_set
      const { data: setData, error: setErr } = await supabase
        .from("exam_sets")
        .insert({ title: `${examTitle} - ${SKILL_LABELS[sheet.skill]}`, exam_type: examType, skill: sheet.skill, part: examPart })
        .select("id").single();
      if (setErr || !setData) continue;
      setsCreated++;

      const toInsert = sheet.rows.map((row, i) => ({
        exam_set_id: setData.id,
        order_index: row.order_index || i + 1,
        question_text: row.question_text?.toString().trim() || "",
        question_type: "multiple_choice",
        options: [row.option_a || "", row.option_b || "", row.option_c || "", row.option_d || ""].map((o) => o.toString().trim()),
        correct_answer: VALID_ANSWERS.indexOf(row.correct_answer?.toString().toUpperCase().trim() || "A"),
        explanation: row.explanation?.toString().trim() || "",
        audio_url: row.audio_filename?.toString().trim() || null,
        image_url: row.image_url?.toString().trim() || null,
        response_time: row.response_time ? Number(row.response_time) : null,
      }));

      const { error } = await supabase.from("exam_questions").insert(toInsert as any);
      if (!error) totalSuccess += toInsert.length;
    }

    setResult({ success: totalSuccess, total: parsedSheets.reduce((s, sh) => s + sh.rows.length, 0), setsCreated });
    setImporting(false);
    if (totalSuccess > 0) {
      toast({ title: `Đã nhập ${totalSuccess} câu hỏi vào ${setsCreated} đề!` });
      onImportComplete();
    }
  };

  const reset = () => { setParsedSheets([]); setResult(null); };
  const currentSheet = parsedSheets[activeSheet];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Tải Template Excel
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
                <h3 className="font-heading font-bold text-foreground">Preview — {parsedSheets.length} tab</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={reset}><X className="w-4 h-4" /></Button>
            </div>

            {/* Exam info inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Tên đề thi</label>
                <input className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="VD: Đề thi Aptis #5" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Part</label>
                <input className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" value={examPart} onChange={(e) => setExamPart(e.target.value)} placeholder="Part 1" />
              </div>
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
                  {sh.sheetName} ({sh.rows.length})
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

            {/* Audio warnings for listening */}
            {currentSheet?.skill === "listening" && currentSheet.rows.some((r) => r.audio_filename) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Kiểm tra audio
                </p>
                <div className="text-xs text-yellow-600 mt-1 space-y-0.5">
                  {currentSheet.rows.filter((r) => r.audio_filename).map((r, i) => (
                    <p key={i}>🎵 {r.audio_filename} — sẽ liên kết với bucket audio</p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {currentSheet && (
              <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Câu hỏi</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">A</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">B</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Đúng</th>
                      {currentSheet.skill === "listening" && <th className="px-3 py-2 text-left text-muted-foreground">Audio</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.rows.slice(0, 25).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-foreground max-w-[200px] truncate">{row.question_text}</td>
                        <td className="px-3 py-2 text-foreground truncate max-w-[80px]">{row.option_a}</td>
                        <td className="px-3 py-2 text-foreground truncate max-w-[80px]">{row.option_b}</td>
                        <td className="px-3 py-2 font-bold text-primary">{row.correct_answer?.toString().toUpperCase()}</td>
                        {currentSheet.skill === "listening" && (
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">
                            {row.audio_filename ? <Badge variant="outline" className="text-xs">{row.audio_filename}</Badge> : "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={importing || parsedSheets.every((s) => s.errors.length > 0) || !examTitle.trim()}
              className="w-full gap-2"
            >
              {importing ? "Đang nhập..." : <><Upload className="w-4 h-4" /> Lưu vào Database</>}
            </Button>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="border border-border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h3 className="font-heading font-bold text-foreground">Hoàn tất</h3>
            </div>
            <p className="text-sm text-foreground">
              Đã nhập <span className="font-bold text-primary">{result.success}</span> / {result.total} câu hỏi
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
