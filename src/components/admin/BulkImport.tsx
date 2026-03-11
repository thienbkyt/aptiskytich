import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImportRow {
  skill: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  audio_url?: string;
}

interface ImportResult {
  total: number;
  success: number;
  errors: { row: number; message: string }[];
}

const VALID_SKILLS = ["grammar", "reading", "listening", "speaking", "writing"];
const VALID_ANSWERS = ["A", "B", "C", "D"];

const TEMPLATE_DATA = [
  {
    skill: "grammar",
    question_text: "She _____ to the office every day.",
    option_a: "go",
    option_b: "goes",
    option_c: "going",
    option_d: "gone",
    correct_answer: "B",
    explanation: "Chủ ngữ 'She' (ngôi 3 số ít) → động từ thêm -s/-es.",
    audio_url: "",
  },
  {
    skill: "listening",
    question_text: "What does the speaker suggest?",
    option_a: "Answer A",
    option_b: "Answer B",
    option_c: "Answer C",
    option_d: "Answer D",
    correct_answer: "A",
    explanation: "Giải thích đáp án đúng.",
    audio_url: "https://example.com/audio.mp3",
  },
];

const downloadTemplate = () => {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_DATA);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 12 },  // skill
    { wch: 50 },  // question_text
    { wch: 20 },  // option_a
    { wch: 20 },  // option_b
    { wch: 20 },  // option_c
    { wch: 20 },  // option_d
    { wch: 14 },  // correct_answer
    { wch: 40 },  // explanation
    { wch: 40 },  // audio_url
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");

  // Add instructions sheet
  const instructions = [
    { "Hướng dẫn nhập liệu": "Cột skill", "Chi tiết": "grammar, reading, listening, speaking, writing" },
    { "Hướng dẫn nhập liệu": "Cột correct_answer", "Chi tiết": "A, B, C hoặc D (viết hoa)" },
    { "Hướng dẫn nhập liệu": "Cột option_a đến option_d", "Chi tiết": "4 đáp án cho mỗi câu hỏi" },
    { "Hướng dẫn nhập liệu": "Cột explanation", "Chi tiết": "Giải thích đáp án đúng" },
    { "Hướng dẫn nhập liệu": "Cột audio_url", "Chi tiết": "URL audio cho câu hỏi listening (để trống nếu không cần)" },
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 25 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Hướng dẫn");

  XLSX.writeFile(wb, "aptis_questions_template.xlsx");
};

const validateRow = (row: ImportRow, index: number): string | null => {
  if (!row.skill || !VALID_SKILLS.includes(row.skill.toLowerCase().trim())) {
    return `Skill không hợp lệ: "${row.skill}". Chọn: ${VALID_SKILLS.join(", ")}`;
  }
  if (!row.question_text?.trim()) return "Thiếu câu hỏi";
  if (!row.option_a?.trim() || !row.option_b?.trim() || !row.option_c?.trim() || !row.option_d?.trim()) {
    return "Thiếu đáp án (cần đủ 4 đáp án A-D)";
  }
  const answer = row.correct_answer?.toString().toUpperCase().trim();
  if (!answer || !VALID_ANSWERS.includes(answer)) {
    return `Đáp án đúng không hợp lệ: "${row.correct_answer}". Chọn: A, B, C hoặc D`;
  }
  if (!row.explanation?.trim()) return "Thiếu giải thích";
  return null;
};

const BulkImport = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ImportRow>(ws);

        if (rows.length === 0) {
          toast({ title: "File trống", description: "Không tìm thấy dữ liệu.", variant: "destructive" });
          return;
        }

        // Validate
        const errors: { row: number; message: string }[] = [];
        rows.forEach((row, i) => {
          const err = validateRow(row, i);
          if (err) errors.push({ row: i + 2, message: err }); // +2 for header + 0-index
        });

        setValidationErrors(errors);
        setPreview(rows);
        setResult(null);
      } catch {
        toast({ title: "Lỗi đọc file", description: "File không đúng định dạng Excel.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!preview || validationErrors.length > 0) return;
    setImporting(true);

    const toInsert = preview.map((row) => ({
      skill: row.skill.toLowerCase().trim(),
      question_text: row.question_text.trim(),
      options: [row.option_a.trim(), row.option_b.trim(), row.option_c.trim(), row.option_d.trim()],
      correct_answer: VALID_ANSWERS.indexOf(row.correct_answer.toString().toUpperCase().trim()),
      explanation: row.explanation.trim(),
    }));

    // Insert in batches of 50
    const batchSize = 50;
    let success = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabase.from("questions").insert(batch as any);
      if (error) {
        errors.push({ row: i + 2, message: `Batch lỗi: ${error.message}` });
      } else {
        success += batch.length;
      }
    }

    setResult({ total: toInsert.length, success, errors });
    setImporting(false);

    if (success > 0) {
      toast({ title: `Đã nhập ${success}/${toInsert.length} câu hỏi!` });
      onImportComplete();
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setValidationErrors([]);
  };

  return (
    <div className="space-y-4">
      {/* Actions row */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Tải template Excel
        </Button>
        <Button
          onClick={() => fileRef.current?.click()}
          variant="outline"
          className="gap-2"
          disabled={importing}
        >
          <Upload className="w-4 h-4" /> Chọn file Excel
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {/* Preview */}
      <AnimatePresence>
        {preview && !result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-foreground">
                  Xem trước: {preview.length} câu hỏi
                </h3>
              </div>
              <Button variant="ghost" size="icon" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.length} lỗi cần sửa
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Dòng {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">#</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Skill</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Câu hỏi</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Đáp án</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Đúng</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((row, i) => {
                    const hasError = validationErrors.some((e) => e.row === i + 2);
                    return (
                      <tr
                        key={i}
                        className={`border-t border-border ${hasError ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {row.skill}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-foreground max-w-[300px] truncate">
                          {row.question_text}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[row.option_a, row.option_b, row.option_c, row.option_d]
                            .filter(Boolean)
                            .length}{" "}
                          đáp án
                        </td>
                        <td className="px-3 py-2 font-bold text-foreground">
                          {row.correct_answer?.toString().toUpperCase()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ...và {preview.length - 20} câu hỏi khác
                </p>
              )}
            </div>

            {/* Skill summary */}
            <div className="flex flex-wrap gap-2">
              {VALID_SKILLS.map((skill) => {
                const count = preview.filter(
                  (r) => r.skill?.toLowerCase().trim() === skill
                ).length;
                if (count === 0) return null;
                return (
                  <span
                    key={skill}
                    className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    {skill}: {count}
                  </span>
                );
              })}
            </div>

            {/* Import button */}
            <Button
              onClick={handleImport}
              disabled={importing || validationErrors.length > 0}
              className="w-full bg-primary text-primary-foreground gap-2"
            >
              {importing ? (
                "Đang nhập..."
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Nhập {preview.length} câu hỏi
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <h3 className="font-heading font-bold text-foreground">Kết quả nhập liệu</h3>
            </div>
            <p className="text-sm text-foreground">
              Thành công: <span className="font-bold text-success">{result.success}</span> /{" "}
              {result.total} câu hỏi
            </p>
            {result.errors.length > 0 && (
              <div className="text-xs text-destructive space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i}>Dòng {err.row}: {err.message}</p>
                ))}
              </div>
            )}
            <Button onClick={reset} variant="outline" size="sm">
              Đóng
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkImport;
