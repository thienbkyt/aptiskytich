import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, normalizePart, type ExamQuestionRow } from "@/hooks/useExamSets";
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

type SkillType = "speaking" | "listening" | "grammar_vocab" | "reading" | "writing";

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar_vocab: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};

const SKILL_TIMES: Record<string, number> = {
  speaking: 720,
  listening: 2400,
  grammar_vocab: 1500,
  reading: 2100,
  writing: 3000,
};

interface PartSet {
  id: string;
  part: string;
  partNorm: string;
  questions: ExamQuestionRow[];
}

interface SkillFullPracticeEngineProps {
  fullTestId: string;
  skill: SkillType;
  testTitle: string;
  onExit: () => void;
}

type FlowPhase = "loading" | "exam" | "completed";

const SkillFullPracticeEngine = ({ fullTestId, skill, testTitle, onExit }: SkillFullPracticeEngineProps) => {
  const [phase, setPhase] = useState<FlowPhase>("loading");
  const [parts, setParts] = useState<PartSet[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [scores, setScores] = useState({ correct: 0, total: 0 });
  const [engineKey, setEngineKey] = useState(0);
  const [writingTimeLeft, setWritingTimeLeft] = useState(SKILL_TIMES.writing);
  const [listeningTimeLeft, setListeningTimeLeft] = useState(SKILL_TIMES.listening);
  const [readingTimeLeft, setReadingTimeLeft] = useState<number | null>(null);

  const skillLabel = SKILL_LABELS[skill] || skill;
  const timeLimit = SKILL_TIMES[skill] || 1800;

  useEffect(() => {
    loadData();
  }, [fullTestId, skill]);

  const loadData = async () => {
    setPhase("loading");

    const { data: sets } = await supabase
      .from("exam_sets")
      .select("id, part, skill")
      .eq("full_test_id", fullTestId)
      .eq("skill", skill)
      .eq("is_published", true)
      .order("part", { ascending: true });

    if (!sets || sets.length === 0) {
      setPhase("completed");
      return;
    }

    const setsWithQuestions = await Promise.all(
      sets.map(async (s) => {
        const questions = await fetchExamQuestions(s.id);
        return { ...s, questions, partNorm: normalizePart(s.part) };
      })
    );

    // Sort by part
    setsWithQuestions.sort((a, b) => a.part.localeCompare(b.part));

    setParts(setsWithQuestions);
    if (skill === "reading") setReadingTimeLeft(SKILL_TIMES.reading);
    setPhase("exam");
  };

  const handlePartComplete = useCallback((correct?: number, total?: number) => {
    if (correct !== undefined && total !== undefined) {
      setScores(prev => ({
        correct: prev.correct + correct,
        total: prev.total + total,
      }));
    }

    // For grammar, all parts combined into one engine call
    const isGrammar = skill === "grammar_vocab";
    if (isGrammar || currentPartIndex >= parts.length - 1) {
      setPhase("completed");
    } else {
      setCurrentPartIndex(prev => prev + 1);
      // Writing & Listening keep the same engine mounted to preserve timer + skip intros
      if (skill !== "writing" && skill !== "listening") {
        setEngineKey(prev => prev + 1);
      }
    }
  }, [currentPartIndex, parts.length, skill]);

  // ── Loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu bài luyện tập...</p>
      </div>
    );
  }

  // ── Completed ──
  if (phase === "completed") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <div className="max-w-xl mx-auto text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            Hoàn thành luyện tập {skillLabel}!
          </h2>
          <p className="text-muted-foreground mb-6">{testTitle}</p>
          {scores.total > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-foreground">Tổng điểm</span>
                <span className="text-primary">{scores.correct}/{scores.total}</span>
              </div>
            </div>
          )}
          <Button onClick={onExit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Quay lại danh sách đề
          </Button>
        </div>
      </div>
    );
  }

  // ── Exam Phase ──
  if (parts.length === 0) return null;

  const headerTitle = skill === "reading" ? "Reading Đề 01" : `${skillLabel} - Full Practice`;

  // Grammar: merge all parts
  if (skill === "grammar_vocab") {
    const allQuestions = parts.flatMap(p => p.questions);
    const grammarQuestions = toGrammarQuestions(allQuestions);
    return (
      <GrammarExamEngine
        key={`grammar-${engineKey}`}
        questions={grammarQuestions}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        onExit={onExit}
        onComplete={(correct, total) => handlePartComplete(correct, total)}
        showResultsOnSubmit
      />
    );
  }

  const currentPart = parts[currentPartIndex];
  if (!currentPart) return null;
  const partNorm = currentPart.partNorm;
  const isLastPart = currentPartIndex >= parts.length - 1;

  // Progress indicator removed — engines render full-screen like individual parts

  if (skill === "speaking") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const speakingProps: any = {};
    switch (partType) {
      case "part1": speakingProps.part1Data = toSpeakingPart1(currentPart.questions); break;
      case "part2": speakingProps.part2Data = toSpeakingPart2(currentPart.questions); break;
      case "part3": speakingProps.part3Data = toSpeakingPart3(currentPart.questions); break;
      case "part4": speakingProps.part4Data = toSpeakingPart4(currentPart.questions); break;
    }
    return (
      <SpeakingExamEngine
        key={`speaking-${engineKey}`}
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        onExit={onExit}
        onComplete={() => handlePartComplete()}
        skipIntro={currentPartIndex > 0}
        {...speakingProps}
      />
    );
  }

  if (skill === "listening") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const listeningProps: any = {};
    switch (partType) {
      case "part1": listeningProps.part1Questions = toListeningPart1(currentPart.questions); break;
      case "part2": listeningProps.part2Questions = toListeningPart2(currentPart.questions); break;
      case "part3": listeningProps.part3Questions = toListeningPart3(currentPart.questions); break;
      case "part4": listeningProps.part4Questions = toListeningPart4(currentPart.questions); break;
    }
    return (
      <ListeningExamEngine
        key="listening-full"
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        externalTimeLeft={listeningTimeLeft}
        onTimeTick={(t) => setListeningTimeLeft(t)}
        skipIntro={currentPartIndex > 0}
        fullFlow
        onExit={onExit}
        onComplete={(correct, total) => handlePartComplete(correct, total)}
        showResultsOnSubmit={isLastPart}
        {...listeningProps}
      />
    );
  }

  if (skill === "reading") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const readingProps: any = {};
    switch (partType) {
      case "part1": readingProps.part1Question = toReadingPart1(currentPart.questions); break;
      case "part2": readingProps.part2Question = toReadingPart2(currentPart.questions); break;
      case "part3": readingProps.part3Question = toReadingPart3(currentPart.questions); break;
      case "part4": readingProps.part4Question = toReadingPart4(currentPart.questions); break;
    }
    return (
      <ReadingExamEngine
        key={`reading-${engineKey}`}
        partType={partType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        initialTimeLeft={readingTimeLeft ?? SKILL_TIMES.reading}
        onTimeTick={(t) => setReadingTimeLeft(t)}
        skipIntro={currentPartIndex > 0}
        fullFlow
        onExit={onExit}
        onComplete={(correct, total) => handlePartComplete(correct, total)}
        onPreviousPart={currentPartIndex > 0 ? () => setCurrentPartIndex((p) => Math.max(0, p - 1)) : undefined}
        showResultsOnSubmit={isLastPart}
        {...readingProps}
      />
    );
  }

  if (skill === "writing") {
    const writingPartType = partNorm.replace("part", "task") as "task1" | "task2" | "task3" | "task4";
    const writingProps: any = {};
    switch (partNorm) {
      case "part1": writingProps.part1Data = toWritingPart1(currentPart.questions); break;
      case "part2": writingProps.part2Data = toWritingPart2(currentPart.questions); break;
      case "part3": writingProps.part3Data = toWritingPart3(currentPart.questions); break;
      case "part4": writingProps.part4Data = toWritingPart4(currentPart.questions); break;
    }
    return (
      <WritingExamEngine
        key="writing-full"
        partType={writingPartType}
        testTitle={headerTitle}
        timeLimit={timeLimit}
        externalTimeLeft={writingTimeLeft}
        onTimeTick={(t) => setWritingTimeLeft(t)}
        skipIntro={currentPartIndex > 0}
        fullFlow
        isLastPart={currentPartIndex >= parts.length - 1}
        onExit={onExit}
        onComplete={() => handlePartComplete()}
        onPrevious={currentPartIndex > 0 ? () => setCurrentPartIndex(prev => Math.max(0, prev - 1)) : undefined}
        {...writingProps}
      />
    );
  }

  return null;
};

export default SkillFullPracticeEngine;
