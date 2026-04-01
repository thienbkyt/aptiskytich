import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Mic, Headphones, Brain, BookOpen, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, type ExamQuestionRow } from "@/hooks/useExamSets";
import {
  toSpeakingPart1, toSpeakingPart2, toSpeakingPart3, toSpeakingPart4,
  toListeningPart1, toListeningPart2, toListeningPart3, toListeningPart4,
  toGrammarQuestions,
  toReadingPart1, toReadingPart2, toReadingPart3, toReadingPart4,
  toWritingPart1, toWritingPart2, toWritingPart3, toWritingPart4,
} from "@/lib/examTransformers";

import SpeakingExamEngine from "@/components/speaking/SpeakingExamEngine";
import ListeningExamEngine from "@/components/listening/ListeningExamEngine";
import GrammarExamEngine from "@/components/grammar/GrammarExamEngine";
import ReadingExamEngine from "@/components/reading/ReadingExamEngine";
import WritingExamEngine from "@/components/writing/WritingExamEngine";
import { normalizePart } from "@/hooks/useExamSets";

type SkillStep = "speaking" | "listening" | "grammar" | "reading" | "writing";
const SKILL_ORDER: SkillStep[] = ["speaking", "listening", "grammar", "reading", "writing"];
const SKILL_LABELS: Record<SkillStep, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};
const SKILL_ICONS: Record<SkillStep, React.ElementType> = {
  speaking: Mic,
  listening: Headphones,
  grammar: Brain,
  reading: BookOpen,
  writing: PenLine,
};
const SKILL_TIMES: Record<SkillStep, number> = {
  speaking: 720,
  listening: 2400,
  grammar: 1500,
  reading: 2100,
  writing: 3000,
};

interface FullTestEngineProps {
  testId: string;
  testTitle: string;
  onExit: () => void;
}

interface PartSet {
  id: string;
  part: string;
  partNorm: string;
  questions: ExamQuestionRow[];
}

type SkillData = Record<SkillStep, PartSet[]>;

type FlowPhase = "loading" | "skill-intro" | "exam" | "skill-transition" | "completed";

const FullTestEngine = ({ testId, testTitle, onExit }: FullTestEngineProps) => {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [skillData, setSkillData] = useState<SkillData>({
    speaking: [], listening: [], grammar: [], reading: [], writing: [],
  });
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [scores, setScores] = useState<Record<SkillStep, { correct: number; total: number }>>({
    speaking: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
  });
  // Key to force re-mount engines on part change
  const [engineKey, setEngineKey] = useState(0);

  const currentSkill = SKILL_ORDER[currentSkillIndex];

  // Load ALL skill data upfront
  useEffect(() => {
    loadAllData();
  }, [testId]);

  const loadAllData = async () => {
    setPhase("loading");

    const { data: sets } = await supabase
      .from("exam_sets")
      .select("id, part, skill")
      .eq("full_test_id", testId)
      .eq("is_published", true)
      .order("created_at", { ascending: true });

    if (!sets || sets.length === 0) {
      setPhase("completed");
      return;
    }

    // Load all questions for all sets in parallel
    const setsWithQuestions = await Promise.all(
      sets.map(async (s) => {
        const questions = await fetchExamQuestions(s.id);
        return { ...s, questions, partNorm: normalizePart(s.part) };
      })
    );

    // Group by skill
    const grouped: SkillData = {
      speaking: [], listening: [], grammar: [], reading: [], writing: [],
    };

    for (const s of setsWithQuestions) {
      const skillKey = s.skill === "grammar_vocab" ? "grammar" : s.skill as SkillStep;
      if (grouped[skillKey]) {
        grouped[skillKey].push({
          id: s.id,
          part: s.part,
          partNorm: s.partNorm,
          questions: s.questions,
        });
      }
    }

    // Sort parts within each skill by part name to ensure correct order
    for (const skill of SKILL_ORDER) {
      grouped[skill].sort((a, b) => a.part.localeCompare(b.part));
    }

    setSkillData(grouped);
    setPhase("skill-intro");
  };

  const handlePartComplete = useCallback((correct?: number, total?: number) => {
    const skill = SKILL_ORDER[currentSkillIndex];
    const parts = skillData[skill];

    // Accumulate scores
    if (correct !== undefined && total !== undefined) {
      setScores(prev => ({
        ...prev,
        [skill]: {
          correct: prev[skill].correct + correct,
          total: prev[skill].total + total,
        },
      }));
    }

    // Check if there are more parts in this skill
    // For grammar, all parts are combined into one engine call, so always move to next skill
    if (skill === "grammar" || currentPartIndex >= parts.length - 1) {
      // Skill completed - show transition or finish
      if (currentSkillIndex >= SKILL_ORDER.length - 1) {
        setPhase("completed");
      } else {
        setPhase("skill-transition");
      }
    } else {
      // Move to next part within same skill
      setCurrentPartIndex(prev => prev + 1);
      setEngineKey(prev => prev + 1);
    }
  }, [currentSkillIndex, currentPartIndex, skillData]);

  const handleNextSkill = () => {
    setCurrentSkillIndex(prev => prev + 1);
    setCurrentPartIndex(0);
    setEngineKey(prev => prev + 1);
    setPhase("skill-intro");
  };

  const handleStartSkill = () => {
    setPhase("exam");
  };

  // ── Progress bar ──
  const progressBar = (
    <div className="flex items-center gap-2 mb-4">
      {SKILL_ORDER.map((skill, i) => (
        <div key={skill} className="flex items-center gap-1">
          <div
            className={`h-1.5 rounded-full transition-all ${
              i < currentSkillIndex ? "bg-green-500 w-10"
                : i === currentSkillIndex ? "bg-primary w-14"
                : "bg-muted w-10"
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-2">
        {currentSkillIndex + 1}/{SKILL_ORDER.length} – {SKILL_LABELS[currentSkill]}
      </span>
    </div>
  );

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu bài thi...</p>
      </div>
    );
  }

  // ── Completed ──
  if (phase === "completed") {
    const totalCorrect = Object.values(scores).reduce((s, v) => s + v.correct, 0);
    const totalQ = Object.values(scores).reduce((s, v) => s + v.total, 0);
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <div className="max-w-xl mx-auto text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Hoàn thành bài thi thử!</h2>
          <p className="text-muted-foreground mb-6">{testTitle}</p>
          <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-3">
            {SKILL_ORDER.map((skill) => {
              const s = scores[skill];
              return (
                <div key={skill} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{SKILL_LABELS[skill]}</span>
                  <span className="text-muted-foreground">
                    {s.total > 0 ? `${s.correct}/${s.total}` : "Đã hoàn thành"}
                  </span>
                </div>
              );
            })}
            {totalQ > 0 && (
              <div className="border-t border-border pt-3 flex items-center justify-between font-semibold">
                <span className="text-foreground">Tổng điểm</span>
                <span className="text-primary">{totalCorrect}/{totalQ}</span>
              </div>
            )}
          </div>
          <Button onClick={onExit} className="bg-primary hover:bg-brand-brown text-white">
            Quay lại danh sách đề
          </Button>
        </div>
      </div>
    );
  }

  const partsForSkill = skillData[currentSkill];

  // ── Skill Intro Screen ──
  if (phase === "skill-intro") {
    const Icon = SKILL_ICONS[currentSkill];
    const partCount = partsForSkill.length;
    const totalMinutes = Math.ceil(SKILL_TIMES[currentSkill] / 60);

    // Skip if no data for this skill
    if (partCount === 0) {
      return (
        <div className="min-h-[70vh]">
          {progressBar}
          <div className="max-w-xl mx-auto text-center py-12">
            <p className="text-muted-foreground mb-4">
              Chưa có dữ liệu cho phần {SKILL_LABELS[currentSkill]}.
            </p>
            <Button onClick={() => {
              if (currentSkillIndex >= SKILL_ORDER.length - 1) {
                setPhase("completed");
              } else {
                handleNextSkill();
              }
            }} className="bg-primary hover:bg-brand-brown text-white">
              Bỏ qua, tiếp tục
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[70vh]">
        {progressBar}
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            {SKILL_LABELS[currentSkill]}
          </h2>
          <p className="text-muted-foreground mb-1">
            {currentSkill === "grammar"
              ? `${partCount} phần • ${totalMinutes} phút`
              : `${partCount} Part • ${totalMinutes} phút`}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            {currentSkill === "grammar"
              ? "Hoàn thành tất cả các câu hỏi Grammar & Vocabulary."
              : `Hoàn thành lần lượt từ Part 1 đến Part ${partCount}.`}
          </p>
          <Button onClick={handleStartSkill} className="bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5 px-8">
            Bắt đầu phần {SKILL_LABELS[currentSkill]}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Skill Transition Screen ──
  if (phase === "skill-transition") {
    const completedSkill = SKILL_ORDER[currentSkillIndex];
    const nextSkill = SKILL_ORDER[currentSkillIndex + 1];
    const NextIcon = nextSkill ? SKILL_ICONS[nextSkill] : CheckCircle2;

    return (
      <div className="min-h-[70vh]">
        {progressBar}
        <div className="max-w-lg mx-auto text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">
            Bạn đã hoàn thành phần {SKILL_LABELS[completedSkill]}!
          </h2>
          {nextSkill && (
            <>
              <p className="text-muted-foreground mb-8">
                Bấm để chuyển sang phần <strong>{SKILL_LABELS[nextSkill]}</strong>.
              </p>
              <Button onClick={handleNextSkill} className="bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5 px-8">
                <NextIcon className="w-4 h-4" />
                Chuyển sang {SKILL_LABELS[nextSkill]}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Exam Phase ──
  if (partsForSkill.length === 0) return null;

  // For grammar: merge ALL parts into a single question list
  if (currentSkill === "grammar") {
    const allQuestions = partsForSkill.flatMap(p => p.questions);
    const grammarQuestions = toGrammarQuestions(allQuestions);
    return (
      <>
        {progressBar}
        <GrammarExamEngine
          key={`grammar-${engineKey}`}
          questions={grammarQuestions}
          testTitle={`${testTitle} – Grammar & Vocabulary`}
          timeLimit={SKILL_TIMES.grammar}
          onExit={onExit}
          onComplete={(correct, total) => handlePartComplete(correct, total)}
        />
      </>
    );
  }

  // For other skills: render current part
  const currentPart = partsForSkill[currentPartIndex];
  if (!currentPart) return null;

  const partNorm = currentPart.partNorm;

  if (currentSkill === "speaking") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const speakingProps: any = {};
    switch (partType) {
      case "part1": speakingProps.part1Data = toSpeakingPart1(currentPart.questions); break;
      case "part2": speakingProps.part2Data = toSpeakingPart2(currentPart.questions); break;
      case "part3": speakingProps.part3Data = toSpeakingPart3(currentPart.questions); break;
      case "part4": speakingProps.part4Data = toSpeakingPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        <SpeakingExamEngine
          key={`speaking-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Speaking ${currentPart.part}`}
          timeLimit={SKILL_TIMES.speaking}
          onExit={onExit}
          onComplete={() => handlePartComplete()}
          {...speakingProps}
        />
      </>
    );
  }

  if (currentSkill === "listening") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const listeningProps: any = {};
    switch (partType) {
      case "part1": listeningProps.part1Questions = toListeningPart1(currentPart.questions); break;
      case "part2": listeningProps.part2Questions = toListeningPart2(currentPart.questions); break;
      case "part3": listeningProps.part3Questions = toListeningPart3(currentPart.questions); break;
      case "part4": listeningProps.part4Questions = toListeningPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        <ListeningExamEngine
          key={`listening-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Listening ${currentPart.part}`}
          timeLimit={SKILL_TIMES.listening}
          onExit={onExit}
          onComplete={(correct, total) => handlePartComplete(correct, total)}
          {...listeningProps}
        />
      </>
    );
  }

  if (currentSkill === "reading") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const readingProps: any = {};
    switch (partType) {
      case "part1": readingProps.part1Questions = toReadingPart1(currentPart.questions); break;
      case "part2": readingProps.part2Question = toReadingPart2(currentPart.questions); break;
      case "part3": readingProps.part3Question = toReadingPart3(currentPart.questions); break;
      case "part4": readingProps.part4Question = toReadingPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        <ReadingExamEngine
          key={`reading-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Reading ${currentPart.part}`}
          timeLimit={SKILL_TIMES.reading}
          onExit={onExit}
          onComplete={(correct, total) => handlePartComplete(correct, total)}
          {...readingProps}
        />
      </>
    );
  }

  if (currentSkill === "writing") {
    const partType = partNorm as "task1" | "task2" | "task3" | "task4";
    const writingProps: any = {};
    switch (partType) {
      case "task1": writingProps.part1Data = toWritingPart1(currentPart.questions); break;
      case "task2": writingProps.part2Data = toWritingPart2(currentPart.questions); break;
      case "task3": writingProps.part3Data = toWritingPart3(currentPart.questions); break;
      case "task4": writingProps.part4Data = toWritingPart4(currentPart.questions); break;
    }
    return (
      <>
        {progressBar}
        <WritingExamEngine
          key={`writing-${engineKey}`}
          partType={partType}
          testTitle={`${testTitle} – Writing ${currentPart.part}`}
          timeLimit={SKILL_TIMES.writing}
          onExit={onExit}
          onComplete={() => handlePartComplete()}
          {...writingProps}
        />
      </>
    );
  }

  return null;
};

export default FullTestEngine;
