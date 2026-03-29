import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { readExcelFile, createAndDownloadExcel } from "@/lib/excelUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FULL_EXAM_SHEETS } from "./types";
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

/**
 * Generate template matching official Aptis General format (British Council 2023)
 */
const downloadTemplate = async () => {
  const sheets: { name: string; cols: Record<string, string | number | boolean>[] }[] = [
    // ─── Core Grammar: 25 MCQ × 3 options ───
    {
      name: "Core_Grammar",
      cols: [
        { question_text: "She _____ to work every day.", option_a: "go", option_b: "goes", option_c: "going", correct_answer: "B", explanation: "Present Simple, ngôi 3 số ít" },
        { question_text: "I _____ seen that movie before.", option_a: "have", option_b: "has", option_c: "had", correct_answer: "A", explanation: "Present Perfect với I/you/we/they" },
      ],
    },
    {
      name: "Core_Vocab",
      cols: [
        { vocab_type: "matching", question_text: "Which word is closest in meaning to 'happy'?", option_a: "sad", option_b: "joyful", option_c: "angry", correct_answer: "B", explanation: "joyful = happy" },
        { vocab_type: "usage", question_text: "She made a good _____ on her boss.", option_a: "impression", option_b: "expression", option_c: "depression", option_d: "possession", correct_answer: "A", explanation: "make an impression" },
      ],
    },
    {
      name: "R_Part1",
      cols: [
        { sentence: "The cat sat on the _____.", option_a: "mat", option_b: "map", option_c: "man", correct_answer: "A", explanation: "The cat sat on the mat - nghĩa phù hợp" },
        { sentence: "Please _____ the door when you leave.", option_a: "close", option_b: "clothes", option_c: "clock", correct_answer: "A", explanation: "close the door" },
      ],
    },
    {
      name: "R_Part2",
      cols: [
        { sentence_text: "First, she woke up early in the morning.", correct_position: 1, explanation: "Đây là câu mở đầu" },
        { sentence_text: "Then, she had breakfast with her family.", correct_position: 2, explanation: "" },
        { sentence_text: "After that, she went to school by bus.", correct_position: 3, explanation: "" },
        { sentence_text: "She studied hard all day.", correct_position: 4, explanation: "" },
        { sentence_text: "In the evening, she did her homework.", correct_position: 5, explanation: "" },
        { sentence_text: "Finally, she went to bed at 10 PM.", correct_position: 6, explanation: "" },
      ],
    },
    {
      name: "R_Part3",
      cols: [
        { person_name: "Alice", person_text: "I love reading books in my free time. There's nothing better than a good novel.", statement: "This person enjoys literature.", correct_person: "Alice", explanation: "Alice nói love reading books" },
        { person_name: "Bob", person_text: "I prefer outdoor activities like hiking and cycling.", statement: "This person likes being outside.", correct_person: "Bob", explanation: "" },
        { person_name: "Carol", person_text: "Cooking is my passion. I try new recipes every weekend.", statement: "This person is interested in food preparation.", correct_person: "Carol", explanation: "" },
        { person_name: "David", person_text: "I spend most of my time playing video games online.", statement: "This person enjoys digital entertainment.", correct_person: "David", explanation: "" },
        { person_name: "", person_text: "", statement: "This person prefers solitary activities.", correct_person: "Alice", explanation: "Alice đọc sách - hoạt động cá nhân" },
        { person_name: "", person_text: "", statement: "This person is physically active.", correct_person: "Bob", explanation: "" },
        { person_name: "", person_text: "", statement: "This person creates things at home.", correct_person: "Carol", explanation: "" },
      ],
    },
    {
      name: "R_Part4",
      cols: [
        { passage: "Paste your long reading passage here (~750 words). Each paragraph should be clearly separated.", heading: "The Beginning of Change", paragraph_index: 1, is_extra: false, explanation: "" },
        { passage: "", heading: "Modern Solutions", paragraph_index: 2, is_extra: false, explanation: "" },
        { passage: "", heading: "Community Response", paragraph_index: 3, is_extra: false, explanation: "" },
        { passage: "", heading: "Financial Impact", paragraph_index: 4, is_extra: false, explanation: "" },
        { passage: "", heading: "Future Plans", paragraph_index: 5, is_extra: false, explanation: "" },
        { passage: "", heading: "Environmental Concerns", paragraph_index: 6, is_extra: false, explanation: "" },
        { passage: "", heading: "Final Thoughts", paragraph_index: 7, is_extra: false, explanation: "" },
        { passage: "", heading: "This heading does not match", paragraph_index: 0, is_extra: true, explanation: "Extra heading" },
      ],
    },
    {
      name: "L_Part1",
      cols: [
        { question_text: "What time is the meeting?", option_a: "2:00 PM", option_b: "3:00 PM", option_c: "4:00 PM", correct_answer: "B", explanation: "Speaker says 3 o'clock", audio_filename: "l_part1_q1.mp3" },
      ],
    },
    {
      name: "L_Part2",
      cols: [
        { person_name: "Speaker 1", audio_filename: "l_part2.mp3", info_text: "Lives near the city center", correct_person: "Speaker 1", explanation: "" },
        { person_name: "Speaker 2", audio_filename: "", info_text: "Works from home", correct_person: "Speaker 2", explanation: "" },
        { person_name: "Speaker 3", audio_filename: "", info_text: "Has two children", correct_person: "Speaker 3", explanation: "" },
        { person_name: "Speaker 4", audio_filename: "", info_text: "Recently changed jobs", correct_person: "Speaker 4", explanation: "" },
        { person_name: "", audio_filename: "", info_text: "Enjoys gardening", correct_person: "Speaker 1", explanation: "" },
        { person_name: "", audio_filename: "", info_text: "Plans to travel abroad", correct_person: "Speaker 3", explanation: "" },
      ],
    },
    {
      name: "L_Part3",
      cols: [
        { question_text: "Who thinks online learning is effective?", correct_answer: "woman", audio_filename: "l_part3.mp3", explanation: "The woman says she finds it very useful" },
        { question_text: "Who prefers face-to-face classes?", correct_answer: "man", audio_filename: "", explanation: "" },
        { question_text: "Who agrees that practice is important?", correct_answer: "both", audio_filename: "", explanation: "" },
        { question_text: "Who mentions cost as a factor?", correct_answer: "man", audio_filename: "", explanation: "" },
      ],
    },
    {
      name: "L_Part4",
      cols: [
        { question_text: "What is the speaker's main point?", option_a: "Education needs reform", option_b: "Technology is harmful", option_c: "Students are lazy", correct_answer: "A", explanation: "", audio_filename: "l_part4.mp3" },
        { question_text: "How does the speaker feel about the topic?", option_a: "Concerned", option_b: "Indifferent", option_c: "Excited", correct_answer: "A", explanation: "", audio_filename: "" },
      ],
    },
    {
      name: "S_Part1",
      cols: [
        { question_text: "Please tell me about your hometown.", sample_answer: "I come from..." },
        { question_text: "What do you enjoy doing in your free time?", sample_answer: "In my free time, I..." },
        { question_text: "Do you prefer spending time indoors or outdoors? Why?", sample_answer: "I prefer..." },
      ],
    },
    {
      name: "S_Part2",
      cols: [
        { question_text: "Describe what you can see in the photograph.", image_url: "https://example.com/photo.jpg", sample_answer: "In this photograph, I can see..." },
        { question_text: "Would you like to visit this place? Why or why not?", image_url: "", sample_answer: "I would like to..." },
        { question_text: "What are the advantages of places like this?", image_url: "", sample_answer: "The advantages are..." },
      ],
    },
    {
      name: "S_Part3",
      cols: [
        { question_text: "Describe and compare the two photographs.", image_url_1: "https://example.com/photo1.jpg", image_url_2: "https://example.com/photo2.jpg", sample_answer: "In the first photo..." },
        { question_text: "Which situation would you prefer? Why?", image_url_1: "", image_url_2: "", sample_answer: "I would prefer..." },
        { question_text: "What do you think are the advantages and disadvantages of each?", image_url_1: "", image_url_2: "", sample_answer: "The advantages..." },
      ],
    },
    {
      name: "S_Part4",
      cols: [
        { topic: "The role of technology in education", question_text: "How has technology changed the way people learn?", image_url: "https://example.com/topic.jpg", sample_answer: "Technology has changed..." },
        { topic: "", question_text: "Do you think technology always improves learning? Why or why not?", image_url: "", sample_answer: "I think..." },
        { topic: "", question_text: "What might education look like in the future?", image_url: "", sample_answer: "In the future..." },
      ],
    },
    {
      name: "W_Part1",
      cols: [
        { context: "You have joined a photography club. Other members are chatting.", message_text: "Hi! What's your name?", sample_answer: "My name is..." },
        { context: "", message_text: "Where are you from?", sample_answer: "Vietnam" },
        { context: "", message_text: "How long have you been interested in photography?", sample_answer: "Two years" },
        { context: "", message_text: "What kind of photos do you like?", sample_answer: "Landscape" },
        { context: "", message_text: "When can you come to the next meeting?", sample_answer: "Saturday" },
      ],
    },
    {
      name: "W_Part2",
      cols: [
        { social_post_author: "John", social_post_content: "Just visited a new café downtown. The coffee was amazing!", prompt_question: "Would you like to go there?", sample_answer: "That sounds great! I'd love to try it..." },
      ],
    },
    {
      name: "W_Part3",
      cols: [
        { question_text: "What do you think about online learning?", sample_answer: "Online learning has many advantages..." },
        { question_text: "How do you usually study for exams?", sample_answer: "I usually make a study plan..." },
        { question_text: "Do you prefer studying alone or in groups?", sample_answer: "I prefer studying alone because..." },
      ],
    },
    {
      name: "W_Part4",
      cols: [
        { email_type: "informal", change_info: "Your company has announced that the office will move to a new location next month.", scenario: "Write to your friend who works at the same company about the office move.", bullet_points: "your feelings about the move;how it affects your commute;suggestion to meet up", word_limit: 50, sample_answer: "Hi! Did you hear about the office move..." },
        { email_type: "formal", change_info: "", scenario: "Write to your manager about the office relocation.", bullet_points: "ask about the new address;request for flexible hours during transition;offer to help with the move", word_limit: 150, sample_answer: "Dear Sir/Madam, I am writing regarding..." },
      ],
    },
  ];

  await createAndDownloadExcel("aptis_general_full_exam_template.xlsx", sheets);
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
          toast({ title: "Không tìm thấy tab hợp lệ", description: "Tên tab phải theo format: Core_Grammar, Core_Vocab, R_Part1, L_Part2, S_Part3, W_Part4...", variant: "destructive" });
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
          <Download className="w-4 h-4" /> Tải Template Aptis General (18 Parts)
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

            <div>
              <Label>Tên đề thi (prefix cho tất cả parts)</Label>
              <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="VD: Aptis Mock Test #5" className="mt-1" />
            </div>

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
