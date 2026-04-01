import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
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

/**
 * Sequential exam flow: Speaking → Listening → Grammar → Reading → Writing
 * Each skill loads its exam_set on-demand when the user reaches that section.
 */

type SkillStep = "speaking" | "listening" | "grammar" | "reading" | "writing";
const SKILL_ORDER: SkillStep[] = ["speaking", "listening", "grammar", "reading", "writing"];
const SKILL_LABELS: Record<SkillStep, string> = {
  speaking: "Speaking",
  listening: "Listening",
  grammar: "Grammar & Vocabulary",
  reading: "Reading",
  writing: "Writing",
};
const SKILL_TIMES: Record<SkillStep, number> = {
  speaking: 720,    // 12 min
  listening: 2400,  // 40 min
  grammar: 1500,    // 25 min
  reading: 2100,    // 35 min
  writing: 3000,    // 50 min
};

interface FullTestEngineProps {
  testId: string; // not used directly yet - for future full_test exam_set linking
  testTitle: string;
  onExit: () => void;
}

interface SkillExamSets {
  skill: SkillStep;
  sets: { id: string; part: string; questions?: ExamQuestionRow[] }[];
}

const FullTestEngine = ({ testId, testTitle, onExit }: FullTestEngineProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skillData, setSkillData] = useState<Record<SkillStep, { id: string; part: string; questions: ExamQuestionRow[] }[]>>({
    speaking: [], listening: [], grammar: [], reading: [], writing: [],
  });
  const [completed, setCompleted] = useState(false);
  const [scores, setScores] = useState<Record<SkillStep, { correct: number; total: number }>>({
    speaking: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
  });

  const currentSkill = SKILL_ORDER[currentStepIndex];

  // Load all exam sets for each skill on-demand (only current skill)
  useEffect(() => {
    loadSkillData(currentSkill);
  }, [currentSkill]);

  const loadSkillData = async (skill: SkillStep) => {
    // Already loaded
    if (skillData[skill].length > 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Map skill step to DB skill value
    const dbSkill = skill === "grammar" ? "grammar_vocab" : skill;
    
    // Fetch exam_sets linked to this full test for the current skill
    const { data: sets } = await supabase
      .from("exam_sets")
      .select("id, part, skill")
      .eq("full_test_id", testId)
      .eq("skill", dbSkill)
      .eq("is_published", true)
      .order("created_at", { ascending: true });

    if (!sets || sets.length === 0) {
      setLoading(false);
      return;
    }

    // Load questions for each set
    const loaded = await Promise.all(
      sets.map(async (s) => {
        const questions = await fetchExamQuestions(s.id);
        return { id: s.id, part: s.part, questions };
      })
    );

    setSkillData((prev) => ({ ...prev, [skill]: loaded }));
    setLoading(false);
  };

  const handleSkillComplete = (correct?: number, total?: number) => {
    if (correct !== undefined && total !== undefined) {
      setScores((prev) => ({
        ...prev,
        [currentSkill]: { correct, total },
      }));
    }

    // Move to next skill
    if (currentStepIndex < SKILL_ORDER.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  // Results screen
  if (completed) {
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

  // Loading
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Đang tải phần {SKILL_LABELS[currentSkill]}...
        </p>
        {/* Progress indicator */}
        <div className="flex gap-2">
          {SKILL_ORDER.map((skill, i) => (
            <div
              key={skill}
              className={`w-8 h-1 rounded-full ${
                i < currentStepIndex ? "bg-green-500" : i === currentStepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  const setsForSkill = skillData[currentSkill];

  // No data for this skill - skip
  if (setsForSkill.length === 0) {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <div className="max-w-xl mx-auto text-center py-12">
          <p className="text-muted-foreground mb-4">
            Chưa có dữ liệu cho phần {SKILL_LABELS[currentSkill]}. Bỏ qua phần này.
          </p>
          <Button onClick={() => handleSkillComplete()} className="bg-primary hover:bg-brand-brown text-white">
            Tiếp tục phần tiếp theo
          </Button>
        </div>
      </div>
    );
  }

  // Render the appropriate engine
  const firstSet = setsForSkill[0];
  const partNorm = normalizePart(firstSet.part);

  // Progress bar
  const progressBar = (
    <div className="flex items-center gap-2 mb-4">
      {SKILL_ORDER.map((skill, i) => (
        <div key={skill} className="flex items-center gap-1">
          <div
            className={`h-1.5 rounded-full transition-all ${
              i < currentStepIndex ? "bg-green-500 w-10" : i === currentStepIndex ? "bg-primary w-14" : "bg-muted w-10"
            }`}
          />
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-2">
        {currentStepIndex + 1}/{SKILL_ORDER.length} – {SKILL_LABELS[currentSkill]}
      </span>
    </div>
  );

  if (currentSkill === "speaking") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const speakingProps: any = {};
    switch (partType) {
      case "part1": speakingProps.part1Data = toSpeakingPart1(firstSet.questions); break;
      case "part2": speakingProps.part2Data = toSpeakingPart2(firstSet.questions); break;
      case "part3": speakingProps.part3Data = toSpeakingPart3(firstSet.questions); break;
      case "part4": speakingProps.part4Data = toSpeakingPart4(firstSet.questions); break;
    }
    return (
      <>
        {progressBar}
        <SpeakingExamEngine
          partType={partType}
          testTitle={`${testTitle} – Speaking`}
          timeLimit={SKILL_TIMES.speaking}
          onExit={onExit}
          onComplete={() => handleSkillComplete()}
          {...speakingProps}
        />
      </>
    );
  }

  if (currentSkill === "listening") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const listeningProps: any = {};
    switch (partType) {
      case "part1": listeningProps.part1Questions = toListeningPart1(firstSet.questions); break;
      case "part2": listeningProps.part2Questions = toListeningPart2(firstSet.questions); break;
      case "part3": listeningProps.part3Questions = toListeningPart3(firstSet.questions); break;
      case "part4": listeningProps.part4Questions = toListeningPart4(firstSet.questions); break;
    }
    return (
      <>
        {progressBar}
        <ListeningExamEngine
          partType={partType}
          testTitle={`${testTitle} – Listening`}
          timeLimit={SKILL_TIMES.listening}
          onExit={onExit}
          onComplete={(correct, total) => handleSkillComplete(correct, total)}
          {...listeningProps}
        />
      </>
    );
  }

  if (currentSkill === "grammar") {
    const questions = toGrammarQuestions(firstSet.questions);
    return (
      <>
        {progressBar}
        <GrammarExamEngine
          questions={questions}
          testTitle={`${testTitle} – Grammar`}
          timeLimit={SKILL_TIMES.grammar}
          onExit={onExit}
          onComplete={(correct, total) => handleSkillComplete(correct, total)}
        />
      </>
    );
  }

  if (currentSkill === "reading") {
    const partType = partNorm as "part1" | "part2" | "part3" | "part4";
    const readingProps: any = {};
    switch (partType) {
      case "part1": readingProps.part1Questions = toReadingPart1(firstSet.questions); break;
      case "part2": readingProps.part2Question = toReadingPart2(firstSet.questions); break;
      case "part3": readingProps.part3Question = toReadingPart3(firstSet.questions); break;
      case "part4": readingProps.part4Question = toReadingPart4(firstSet.questions); break;
    }
    return (
      <>
        {progressBar}
        <ReadingExamEngine
          partType={partType}
          testTitle={`${testTitle} – Reading`}
          timeLimit={SKILL_TIMES.reading}
          onExit={onExit}
          onComplete={(correct, total) => handleSkillComplete(correct, total)}
          {...readingProps}
        />
      </>
    );
  }

  if (currentSkill === "writing") {
    const partType = partNorm as "task1" | "task2" | "task3" | "task4";
    const writingProps: any = {};
    switch (partType) {
      case "task1": writingProps.part1Data = toWritingPart1(firstSet.questions); break;
      case "task2": writingProps.part2Data = toWritingPart2(firstSet.questions); break;
      case "task3": writingProps.part3Data = toWritingPart3(firstSet.questions); break;
      case "task4": writingProps.part4Data = toWritingPart4(firstSet.questions); break;
    }
    return (
      <>
        {progressBar}
        <WritingExamEngine
          partType={partType}
          testTitle={`${testTitle} – Writing`}
          timeLimit={SKILL_TIMES.writing}
          onExit={onExit}
          onComplete={() => handleSkillComplete()}
          {...writingProps}
        />
      </>
    );
  }

  return null;
};

export default FullTestEngine;
