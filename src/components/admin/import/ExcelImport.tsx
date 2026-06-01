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
      name: "G&V1-25",
      cols: [
        { question_text: "She _____ to work every day.", option_a: "go", option_b: "goes", option_c: "going", correct_answer: "B", explanation: "Present Simple, ngôi 3 số ít" },
        { question_text: "I _____ seen that movie before.", option_a: "have", option_b: "has", option_c: "had", correct_answer: "A", explanation: "Present Perfect với I/you/we/they" },
      ],
    },
    {
      name: "G&V26",
      cols: [
        { word: "happy", option_A: "joyful", option_B: "sad", option_C: "angry", option_D: "tired", option_E: "hungry", option_F: "clever", option_G: "brave", option_H: "lazy", option_I: "kind", option_J: "rude", option_K: "shy", correct_answer: "A", explanation: "joyful = happy (đồng nghĩa)" },
        { word: "fast", option_A: "joyful", option_B: "sad", option_C: "quick", option_D: "tired", option_E: "hungry", option_F: "clever", option_G: "brave", option_H: "lazy", option_I: "kind", option_J: "rude", option_K: "shy", correct_answer: "C", explanation: "quick = fast" },
      ],
    },
    {
      name: "G&V27",
      cols: [
        { sentence: "A person who fixes water pipes is a _____.", option_A: "plumber", option_B: "teacher", option_C: "doctor", option_D: "lawyer", option_E: "driver", option_F: "painter", option_G: "chef", option_H: "nurse", option_I: "pilot", option_J: "farmer", option_K: "singer", correct_answer: "A", explanation: "plumber = thợ sửa ống nước" },
      ],
    },
    {
      name: "G&V28",
      cols: [
        { definition: "feeling of great happiness", option_A: "joy", option_B: "anger", option_C: "fear", option_D: "pain", option_E: "hope", option_F: "pride", option_G: "shame", option_H: "guilt", option_I: "love", option_J: "hate", option_K: "envy", correct_answer: "A", explanation: "joy = feeling of great happiness" },
      ],
    },
    {
      name: "G&V29",
      cols: [
        { sentence: "She _____ her coat because it was cold outside.", option_A: "put on", option_B: "took off", option_C: "gave up", option_D: "set out", option_E: "broke down", option_F: "turned on", option_G: "looked after", option_H: "ran into", option_I: "picked up", option_J: "held on", option_K: "went through", correct_answer: "A", explanation: "put on = mặc vào" },
      ],
    },
    {
      name: "G&V30",
      cols: [
        { word: "make", option_A: "a decision", option_B: "a bath", option_C: "a sleep", option_D: "a walk", option_E: "a read", option_F: "a drive", option_G: "a cook", option_H: "a swim", option_I: "a run", option_J: "a fight", option_K: "a dream", correct_answer: "A", explanation: "make a decision = ra quyết định (collocation)" },
      ],
    },
    {
      name: "R_Part1",
      cols: [
        { instruction: "Read the email from Janice to her friend. Choose one word from the list for each gap. The first one is done for you.", passage: "Dear Sally,\n\nTim and I are on holiday in Greece. We have a nice {0} of the sea from our hotel.\n\nThe weather is {1} and it's really hot.\n\nYesterday we went on a {2} on the lake and caught some fish.\n\nWe had lunch and then we visited an old {3}.\n\nTomorrow we are going to take a car and {4} around.\n\nWe are going to visit some {5} and buy clothes.\n\nLove,\n\nJanice", gaps: "{0} view,large,boat:view\n{1} sunny,large,boat:sunny\n{2} boat,castle,drive:boat\n{3} castle,shops,drive:castle\n{4} drive,shops,books:drive\n{5} shops,books,brothers:shops", explanation: "Chọn từ phù hợp với ngữ cảnh bức thư." },
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
        {
          instruction: "Four people respond in the comments section of an online magazine article about education and work. Read the texts and then answer the questions below.",
          texts: "A: Petra\nAs you get older, responsibilities like a job and family dominate your life. It can be hard to balance things. Studying at university is demanding. So you should do it at an age when you are independent and carefree.\n\nB: Antonio\nLife doesn't really get serious until you hit your mid-twenties. Before that, try out different things and get some life experience. It's only as you approach your thirties that you need to get serious about your career.\n\nC: Eleanor\nNowadays, it is popular for school leavers to take a break. I think the most important thing is to start working as soon as you can. You need practical experience for your CV.\n\nD: Jermaine\nI think we should all keep learning, but you don't need a piece of paper from an institution to prove it. There are many free courses available online. A lot of young people get into debt because they have to pay for their studies.",
          questions_answers: "Who thinks you should study when you are older?: B\nWho thinks formal qualifications are too expensive?: D\nWho thinks you should go to university when you are young?: A\nWho thinks you should study independently?: D\nWho thinks you should combine a job with studying?: C\nWho thinks you should choose a course that is practical?: A\nWho thinks you should get a job immediately after leaving school?: C",
          explanation: "Đọc kỹ ý kiến của từng người và so sánh với các câu hỏi để tìm đáp án phù hợp."
        },
      ],
    },
    {
      name: "R_Part4",
      cols: [
        {
          title: "Mission to Mars",
          paragraphs: "1. On 3 June 2010, an international crew of six astronauts entered a spaceship and prepared themselves for a 520-day voyage to the planet Mars and back.\n\n2. Emerging from the spaceship after an exhausting 520 days, Russian commander Alexei Sitev declared the mission finally over.\n\n3. Mars 500 was, in fact, a simulation exercise. The astronauts never even left the ground.\n\n4. All communications between the crew and mission control were subject to a twenty-minute delay.\n\n5. In addition to the discomforts of living in a confined space, the astronauts also had to endure the psychological stresses.\n\n6. The data collected by the experiment is further evidence that human beings are capable of overcoming the pressures of long space flight.\n\n7. Although the dry and dusty landscape of Mars may not be the most suitable spot for future habitation, there are other planets that could sustain human life.",
          headings_answers: "Life on Mars: 1\nIs space the future for mankind?: 6\nThe difficulties of living in space: 5\nA successful outcome: 2\nA distant new world: 7\nImitating life in space: 3\nA long journey in space: 4\nOnly an experiment",
          instruction: "Read the passage quickly. Choose a heading for each numbered paragraph (1–7) from the drop-down box. There is one more heading than you need.",
          explanation: "Mỗi đoạn văn cần được gán một tiêu đề phù hợp. 'Only an experiment' là tiêu đề gây nhiễu."
        },
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
        { instruction: "Answer the following questions. Write between 1 and 5 words for each answer.", question_text: "What is your name?", sample_answer: "My name is Lan." },
        { instruction: "Answer the following questions. Write between 1 and 5 words for each answer.", question_text: "Where are you from?", sample_answer: "I am from Hanoi." },
        { instruction: "Answer the following questions. Write between 1 and 5 words for each answer.", question_text: "How long have you been interested in travel?", sample_answer: "For three years." },
        { instruction: "Answer the following questions. Write between 1 and 5 words for each answer.", question_text: "What kind of trips do you like?", sample_answer: "I like beach holidays." },
        { instruction: "Answer the following questions. Write between 1 and 5 words for each answer.", question_text: "When can you join the next club meeting?", sample_answer: "I can come on Saturday." },
      ],
    },
    {
      name: "W_Part2",
      cols: [
        {
          instruction: "You are a new member of the Travel Club. Fill in the form. Write in sentences. Use 20–30 words. Recommended time: 7 minutes.",
          question: "Please tell us why you are interested in travel.",
          sample_answer: "I am interested in travel because I enjoy discovering new places, meeting different people, and learning about other cultures.",
        },
      ],
    },
    {
      name: "W_Part3",
      cols: [
        { instruction: "Answer the following three questions. Write between 30 and 40 words for each answer.", question_text: "What do you think about online learning?", sample_answer: "I think online learning is flexible and convenient because students can study anywhere and review lessons easily." },
        { instruction: "Answer the following three questions. Write between 30 and 40 words for each answer.", question_text: "How do you usually study for exams?", sample_answer: "I usually make a study plan, revise my notes every day, and practise with sample tests before the exam." },
        { instruction: "Answer the following three questions. Write between 30 and 40 words for each answer.", question_text: "Do you prefer studying alone or in groups?", sample_answer: "I prefer studying alone because it helps me focus better, but group study is useful for sharing ideas." },
      ],
    },
    {
      name: "W_Part4",
      cols: [
        {
          scenario_intro: "You are a member of the Travel Club. You have received this email from the club:",
          scenario_email: "Dear Member,\n\nWe are writing to tell you that the famous travel writer Mr David Price will unfortunately not be able to attend our next club meeting. Although Mr Price will not be there to sign copies of his new book Around The World In Eighty Ways, members of the club will be able to buy a copy at the price of twenty five pounds. If you would like to reserve a copy of the book, please contact the club secretary.\n\nThe President",
          informal_instruction: "Write an email to a friend. Tell your friend about the situation and say what you think about it.",
          sample_answer: "Dear President,\n\nI am writing because I would like to reserve a copy of Mr David Price's book. Although I am disappointed that he cannot attend the meeting, I am still very interested in buying the book. Please let me know how I can collect it and when payment should be made.\n\nKind regards,\nLan",
        },
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { sheetNames, sheets: excelSheets } = await readExcelFile(buffer);
      const parsedResults: ParsedSheet[] = [];

      sheetNames.forEach((name) => {
        const rows = excelSheets[name];
        if (!rows || rows.length === 0) return;

        const parsed = parseSheet(name, rows);
        if (!parsed.mapping) return;

        parsedResults.push({
          sheetName: name,
          skill: parsed.mapping.skill,
          part: parsed.mapping.part,
          label: parsed.mapping.label,
          questions: parsed.questions,
          errors: parsed.errors,
          rowCount: rows.length,
        });
      });

      if (parsedResults.length === 0) {
        toast({ title: "Không tìm thấy tab hợp lệ", description: "Tên tab phải theo format: Core_Grammar, Core_Vocab, R_Part1, L_Part2, S_Part3, W_Part4...", variant: "destructive" });
        return;
      }

      setParsedSheets(parsedResults);
      setActiveSheet(0);
      setResult(null);
    } catch {
      toast({ title: "Lỗi đọc file", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!examTitle.trim()) { toast({ title: "Nhập tên đề thi", variant: "destructive" }); return; }
    setImporting(true);
    let totalSuccess = 0;
    let setsCreated = 0;

    // Generate a shared full_test_id if importing multiple parts
    const fullTestId = parsedSheets.length > 1 ? crypto.randomUUID() : null;

    for (const sheet of parsedSheets) {
      if (sheet.errors.length > 0 || sheet.questions.length === 0) continue;

      const { data: setData, error: setErr } = await supabase
        .from("exam_sets")
        .insert({
          title: `${examTitle} - ${sheet.label}`,
          exam_type: examType,
          skill: sheet.skill,
          part: sheet.part,
          ...(fullTestId ? { full_test_id: fullTestId, full_test_title: examTitle } : {}),
        } as any)
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
