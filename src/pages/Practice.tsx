import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Headphones, FileText, Mic, PenLine } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getQuestionsBySkill, sampleGapFillQuestions, type Question, type GapFillQuestion } from "@/data/questions";
import { fetchQuestionsBySkill } from "@/lib/questions";
import ReadingInstructions from "@/components/reading/ReadingInstructions";
import ReadingGapFill from "@/components/reading/ReadingGapFill";
import ExamInstructions from "@/components/exam/ExamInstructions";
import ExamMCQ from "@/components/exam/ExamMCQ";

const skills = [
  { key: "grammar" as const, label: "Grammar & Vocabulary", icon: BookOpen, color: "bg-primary", iconColor: "text-primary-foreground" },
  { key: "reading" as const, label: "Reading", icon: FileText, color: "bg-info", iconColor: "text-info-foreground" },
  { key: "listening" as const, label: "Listening", icon: Headphones, color: "bg-warning", iconColor: "text-warning-foreground" },
  { key: "speaking" as const, label: "Speaking", icon: Mic, color: "bg-success", iconColor: "text-success-foreground" },
  { key: "writing" as const, label: "Writing", icon: PenLine, color: "bg-destructive", iconColor: "text-destructive-foreground" },
];

const skillLabels: Record<string, string> = {
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

const EXAM_TIME = 600; // 10 minutes

type ExamPhase = "instructions" | "practice" | "review";

const Practice = () => {
  const [selectedSkill, setSelectedSkill] = useState<Question["skill"] | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0 });

  // Reading gap-fill state
  const [readingPhase, setReadingPhase] = useState<ExamPhase>("instructions");
  const [gapFillQuestions] = useState<GapFillQuestion[]>(sampleGapFillQuestions);
  const [currentGapFill, setCurrentGapFill] = useState(0);
  const [gapFillAnswers, setGapFillAnswers] = useState<(number | null)[][]>([]);
  const [readingSubmitted, setReadingSubmitted] = useState(false);
  const [readingTimeLeft, setReadingTimeLeft] = useState(EXAM_TIME);
  const [seenGaps, setSeenGaps] = useState<Set<string>>(new Set());

  // MCQ exam state (grammar, listening, speaking, writing)
  const [mcqPhase, setMcqPhase] = useState<ExamPhase>("instructions");
  const [mcqQuestions, setMcqQuestions] = useState<Question[]>([]);
  const [mcqCurrent, setMcqCurrent] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<(number | null)[]>([]);
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [mcqTimeLeft, setMcqTimeLeft] = useState(EXAM_TIME);
  const [seenMcq, setSeenMcq] = useState<Set<number>>(new Set());

  // Mark current gap as seen
  useEffect(() => {
    if (selectedSkill === "reading" && readingPhase === "practice") {
      setSeenGaps(prev => new Set(prev).add(`${currentGapFill}`));
    }
  }, [selectedSkill, readingPhase, currentGapFill]);

  // Mark current MCQ as seen
  useEffect(() => {
    if (selectedSkill && selectedSkill !== "reading" && mcqPhase === "practice") {
      setSeenMcq(prev => new Set(prev).add(mcqCurrent));
    }
  }, [selectedSkill, mcqPhase, mcqCurrent]);

  // Reading timer
  useEffect(() => {
    if (selectedSkill !== "reading" || readingPhase !== "practice" || readingSubmitted || readingTimeLeft <= 0) return;
    const t = setInterval(() => setReadingTimeLeft(p => {
      if (p <= 1) { clearInterval(t); setReadingSubmitted(true); setReadingPhase("review"); setCurrentGapFill(0); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [selectedSkill, readingPhase, readingSubmitted, readingTimeLeft]);

  // MCQ timer
  useEffect(() => {
    if (!selectedSkill || selectedSkill === "reading" || mcqPhase !== "practice" || mcqSubmitted || mcqTimeLeft <= 0) return;
    const t = setInterval(() => setMcqTimeLeft(p => {
      if (p <= 1) { clearInterval(t); setMcqSubmitted(true); setMcqPhase("review"); setMcqCurrent(0); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [selectedSkill, mcqPhase, mcqSubmitted, mcqTimeLeft]);

  const startPractice = async (skill: Question["skill"]) => {
    if (skill === "reading") {
      setSelectedSkill("reading");
      setReadingPhase("instructions");
      setCurrentGapFill(0);
      setGapFillAnswers(gapFillQuestions.map(q => new Array(q.gaps.length).fill(null)));
      setReadingSubmitted(false);
      setReadingTimeLeft(EXAM_TIME);
      setSeenGaps(new Set());
      return;
    }
    const qs = (await fetchQuestionsBySkill(skill)).sort(() => Math.random() - 0.5);
    setMcqQuestions(qs);
    setSelectedSkill(skill);
    setMcqPhase("instructions");
    setMcqCurrent(0);
    setMcqAnswers(new Array(qs.length).fill(null));
    setMcqSubmitted(false);
    setMcqTimeLeft(EXAM_TIME);
    setSeenMcq(new Set());
  };

  // Skill selection screen
  if (!selectedSkill) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">Luyện tập theo kỹ năng</h1>
              <p className="text-muted-foreground">Chọn kỹ năng bạn muốn luyện tập</p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {skills.map((skill, i) => (
                <motion.button
                  key={skill.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => startPractice(skill.key)}
                  className="glass-card p-6 md:p-8 text-center hover:shadow-lg transition-all group hover:scale-[1.02]"
                >
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${skill.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <skill.icon className={`w-6 h-6 md:w-7 md:h-7 ${skill.iconColor}`} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-1 text-sm md:text-base">{skill.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {skill.key === "reading"
                      ? `${sampleGapFillQuestions.length} bài đọc`
                      : `${getQuestionsBySkill(skill.key).length} câu hỏi`
                    }
                  </p>
                </motion.button>
              ))}
            </div>

            {stats.total > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 mt-10 text-center">
                <p className="text-sm text-muted-foreground">Phiên luyện tập hôm nay</p>
                <p className="text-2xl font-heading font-extrabold text-foreground mt-1">
                  {stats.correct}/{stats.total} đúng ({Math.round((stats.correct / stats.total) * 100)}%)
                </p>
              </motion.div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Build sections for reading question list panel
  const readingSections = [
    {
      title: "Aptis General Reading Instructions",
      isCurrent: readingPhase === "instructions",
      onClick: () => { setReadingPhase("instructions"); },
    },
    ...gapFillQuestions.map((q, qi) => ({
      title: "Reading",
      questionCount: q.gaps.length,
      isCurrent: readingPhase !== "instructions" && currentGapFill === qi,
      onClick: () => { setReadingPhase("practice"); setCurrentGapFill(qi); },
      questions: q.gaps.map((_gap, gi) => ({
        label: String(gi + 1).padStart(2, "0"),
        seen: seenGaps.has(`${qi}`),
        attempted: gapFillAnswers[qi]?.[gi] !== null && gapFillAnswers[qi]?.[gi] !== undefined,
        isCurrent: readingPhase === "practice" && currentGapFill === qi,
        onClick: () => { setReadingPhase("practice"); setCurrentGapFill(qi); },
      })),
    })),
  ];

  // Build sections for MCQ question list panel
  const mcqSections = [
    {
      title: `Aptis General ${skillLabels[selectedSkill] || ""} Instructions`,
      isCurrent: mcqPhase === "instructions",
      onClick: () => { setMcqPhase("instructions"); },
    },
    {
      title: skillLabels[selectedSkill] || "",
      questionCount: mcqQuestions.length,
      isCurrent: mcqPhase !== "instructions",
      onClick: () => { setMcqPhase("practice"); setMcqCurrent(0); },
      questions: mcqQuestions.map((_, qi) => ({
        label: String(qi + 1).padStart(2, "0"),
        seen: seenMcq.has(qi),
        attempted: mcqAnswers[qi] !== null && mcqAnswers[qi] !== undefined,
        isCurrent: mcqPhase === "practice" && mcqCurrent === qi,
        onClick: () => { setMcqPhase("practice"); setMcqCurrent(qi); },
      })),
    },
  ];

  // Reading gap-fill mode
  if (selectedSkill === "reading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setSelectedSkill(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Chọn kỹ năng khác
              </button>
            </div>

            {readingPhase === "instructions" && (
              <ReadingInstructions
                timeLeft={readingTimeLeft}
                totalTime={EXAM_TIME}
                totalParts={gapFillQuestions.length}
                totalMinutes={10}
                onStart={() => setReadingPhase("practice")}
                sections={readingSections}
              />
            )}

            {(readingPhase === "practice" || readingPhase === "review") && (
              <ReadingGapFill
                question={gapFillQuestions[currentGapFill]}
                questionIndex={currentGapFill}
                totalQuestions={gapFillQuestions.length}
                timeLeft={readingTimeLeft}
                totalTime={EXAM_TIME}
                answers={gapFillAnswers[currentGapFill] || []}
                onAnswerChange={(gapIndex, value) => {
                  if (readingSubmitted) return;
                  const newAnswers = [...gapFillAnswers];
                  const currentAnswers = [...(newAnswers[currentGapFill] || [])];
                  currentAnswers[gapIndex] = value;
                  newAnswers[currentGapFill] = currentAnswers;
                  setGapFillAnswers(newAnswers);
                }}
                onPrevious={currentGapFill > 0 ? () => setCurrentGapFill(p => p - 1) : undefined}
                onNext={currentGapFill < gapFillQuestions.length - 1 ? () => setCurrentGapFill(p => p + 1) : undefined}
                onSubmit={currentGapFill === gapFillQuestions.length - 1 ? () => {
                  setReadingSubmitted(true);
                  setReadingPhase("review");
                  setCurrentGapFill(0);
                } : undefined}
                isFirst={currentGapFill === 0}
                isLast={currentGapFill === gapFillQuestions.length - 1}
                showResults={readingSubmitted}
                sections={readingSections}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // MCQ exam mode (grammar, listening, speaking, writing)
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setSelectedSkill(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Chọn kỹ năng khác
            </button>
          </div>

          {mcqPhase === "instructions" && (
            <ExamInstructions
              skillName={skillLabels[selectedSkill] || ""}
              timeLeft={mcqTimeLeft}
              totalTime={EXAM_TIME}
              totalParts={mcqQuestions.length}
              totalMinutes={10}
              onStart={() => setMcqPhase("practice")}
              sections={mcqSections}
            />
          )}

          {(mcqPhase === "practice" || mcqPhase === "review") && (
            <ExamMCQ
              skillName={skillLabels[selectedSkill] || ""}
              questions={mcqQuestions}
              currentIndex={mcqCurrent}
              answers={mcqAnswers}
              timeLeft={mcqTimeLeft}
              totalTime={EXAM_TIME}
              onAnswerSelect={(qi, ai) => {
                if (mcqSubmitted) return;
                const newAnswers = [...mcqAnswers];
                newAnswers[qi] = ai;
                setMcqAnswers(newAnswers);
              }}
              onPrevious={mcqCurrent > 0 ? () => setMcqCurrent(p => p - 1) : undefined}
              onNext={mcqCurrent < mcqQuestions.length - 1 ? () => setMcqCurrent(p => p + 1) : undefined}
              onSubmit={mcqCurrent === mcqQuestions.length - 1 ? () => {
                setMcqSubmitted(true);
                setMcqPhase("review");
                setMcqCurrent(0);
                const correct = mcqAnswers.reduce((acc, a, i) => acc + (a === mcqQuestions[i]?.correct_answer ? 1 : 0), 0);
                setStats(p => ({ total: p.total + mcqQuestions.length, correct: p.correct + correct }));
              } : undefined}
              isFirst={mcqCurrent === 0}
              isLast={mcqCurrent === mcqQuestions.length - 1}
              showResults={mcqSubmitted}
              sections={mcqSections}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Practice;
