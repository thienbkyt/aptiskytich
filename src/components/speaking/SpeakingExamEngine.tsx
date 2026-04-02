import { useState, useEffect, useCallback, useRef } from "react";
import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import QuestionReviewModal, { type ReviewSkill } from "@/components/exam/QuestionReviewModal";
import CircularTimer from "./CircularTimer";
import SpeakingPromptScreen from "./SpeakingPromptScreen";
import SpeakingResults from "./SpeakingResults";
import SpeakingMicCheck from "./SpeakingMicCheck";
import { useExamGrading, blobUrlToBase64 } from "@/hooks/useExamGrading";
import { resolveImageUrl } from "@/lib/imageUrl";
import { motion } from "framer-motion";
import type {
  SpeakingPartType,
  SpeakingPart1Data,
  SpeakingPart2Data,
  SpeakingPart3Data,
  SpeakingPart4Data,
} from "@/data/speakingQuestions";

interface SpeakingExamEngineProps {
  partType: SpeakingPartType;
  testTitle: string;
  timeLimit: number;
  part1Data?: SpeakingPart1Data;
  part2Data?: SpeakingPart2Data;
  part3Data?: SpeakingPart3Data;
  part4Data?: SpeakingPart4Data;
  onExit: () => void;
  onComplete?: () => void;
}

type Phase = "mic-check" | "prompt" | "prep" | "recording" | "grading" | "done";

const PART_PROMPTS: Record<SpeakingPartType, string> = {
  part1: "Part One - In this part, I am going to ask you three short questions about yourself and your interests. You will have 30 seconds to reply to each question.\n\nBegin speaking when you hear this sound.",
  part2: "Part Two - In this part, I'm going to ask you to describe a picture. Then I will ask you two questions about it. You will have 45 seconds for each response.\n\nBegin speaking when you hear this sound.",
  part3: "Part Three - In this part, I'm going to ask you to compare two pictures and then answer a question about them. You will have 45 seconds of preparation and 60 seconds to speak.\n\nBegin speaking when you hear this sound.",
  part4: "Part Four - In this part, you will discuss a topic. You will have 60 seconds to prepare and 120 seconds to speak.\n\nBegin speaking when you hear this sound.",
};

const PART_NUMBERS: Record<SpeakingPartType, number> = {
  part1: 1, part2: 2, part3: 3, part4: 4,
};

const SpeakingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  onExit, onComplete,
}: SpeakingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("mic-check");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prepTimeLeft, setPrepTimeLeft] = useState(0);
  const [speakTimeLeft, setSpeakTimeLeft] = useState(0);
  const [canFinish, setCanFinish] = useState(false);
  const [recordings, setRecordings] = useState<(string | null)[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [resolvedImg1, setResolvedImg1] = useState<string | null>(null);
  const [resolvedImg2, setResolvedImg2] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { grading, isGrading, gradeExam } = useExamGrading();

  const partNumber = PART_NUMBERS[partType];
  const totalParts = 4;

  // Get total questions for this part
  const getTotalQuestions = () => {
    if (partType === "part1") return part1Data?.questions.length || 0;
    return 1;
  };

  const getPrepTime = () => {
    if (partType === "part1") return part1Data?.prepTime || 0;
    if (partType === "part2") return part2Data?.prepTime || 0;
    if (partType === "part3") return part3Data?.prepTime || 0;
    if (partType === "part4") return part4Data?.prepTime || 0;
    return 0;
  };

  const getSpeakTime = () => {
    if (partType === "part1") return part1Data?.speakTime || 30;
    if (partType === "part2") return part2Data?.speakTime || 45;
    if (partType === "part3") return part3Data?.speakTime || 60;
    if (partType === "part4") return part4Data?.speakTime || 120;
    return 30;
  };

  const getCurrentQuestion = () => {
    if (partType === "part1" && part1Data) return part1Data.questions[currentIndex];
    if (partType === "part2" && part2Data) return part2Data.prompt;
    if (partType === "part3" && part3Data) return part3Data.prompt;
    if (partType === "part4" && part4Data) return part4Data.topic;
    return "";
  };

  // Resolve images
  useEffect(() => {
    if (part2Data?.imageUrl) resolveImageUrl(part2Data.imageUrl).then(setResolvedImg1);
    if (part3Data?.imageUrl1) resolveImageUrl(part3Data.imageUrl1).then(setResolvedImg1);
    if (part3Data?.imageUrl2) resolveImageUrl(part3Data.imageUrl2).then(setResolvedImg2);
  }, [part2Data, part3Data]);

  // Initialize recordings array
  useEffect(() => {
    setRecordings(new Array(getTotalQuestions()).fill(null));
  }, [partType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Start preparation phase
  const startPrep = useCallback(() => {
    const prepTime = getPrepTime();
    if (prepTime <= 0) {
      startRecording();
      return;
    }
    setPrepTimeLeft(prepTime);
    setPhase("prep");
    
    timerRef.current = setInterval(() => {
      setPrepTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [partType, currentIndex]);

  // Start recording
  const startRecording = useCallback(async () => {
    const speakTime = getSpeakTime();
    setSpeakTimeLeft(speakTime);
    setCanFinish(false);
    setPhase("recording");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => {
          const next = [...prev];
          next[currentIndex] = url;
          return next;
        });
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();

      // Enable "Finish Recording" after 10 seconds
      finishTimerRef.current = setTimeout(() => {
        setCanFinish(true);
      }, 10000);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setSpeakTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            stopAndAdvance();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
    }
  }, [partType, currentIndex]);

  // Stop recording and move to next question/finish
  const stopAndAdvance = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    const total = getTotalQuestions();
    if (currentIndex < total - 1) {
      // Next question within same part
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setCanFinish(false);
        startPrep();
      }, 500);
    } else {
      // Part complete - go to grading
      handleFinish();
    }
  }, [currentIndex, partType]);

  const handleFinishRecording = useCallback(() => {
    if (!canFinish) return;
    stopAndAdvance();
  }, [canFinish, stopAndAdvance]);

  const handleFinish = async () => {
    setPhase("grading");
    onComplete?.();

    const validRecordings = recordings.filter(Boolean) as string[];
    if (validRecordings.length === 0) {
      setPhase("done");
      return;
    }

    let audioBase64: string | undefined;
    try {
      audioBase64 = await blobUrlToBase64(validRecordings[0]);
    } catch (e) {
      console.error("Failed to convert audio:", e);
    }

    const questions = partType === "part1" && part1Data
      ? part1Data.questions
      : partType === "part2" && part2Data ? [part2Data.prompt]
      : partType === "part3" && part3Data ? [part3Data.prompt]
      : partType === "part4" && part4Data ? part4Data.questions
      : [];

    await gradeExam({ type: "speaking", audioBase64, questions, partType });
    setPhase("done");
  };

  const handleExit = () => setShowExitConfirm(true);

  // ============ RENDER ============
  const exitDialog = showExitConfirm && (
    <ExamFinishScreen
      title="Submit Test?"
      message="Once you submit your test you will no longer have access to the questions."
      buttonText="Submit test"
      onSubmit={onExit}
    />
  );

  // Mic check
  if (phase === "mic-check") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <SpeakingHeader partLabel={`Speaking`} partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-20">
          <div className="bg-white rounded-xl shadow-sm max-w-xl w-full p-8">
            <p className="text-xs text-gray-500">Aptis General Practice Test</p>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Speaking Practice Test – {testTitle}</h2>
            <p className="text-sm text-gray-500 mb-1">Number of Questions</p>
            <p className="text-lg font-bold text-gray-900 mb-4">{getTotalQuestions()}</p>
            <p className="text-sm font-bold text-gray-900 mb-4">Assessment Description</p>
            <SpeakingMicCheck />
            <button
              onClick={() => setPhase("prompt")}
              className="mt-6 bg-[#24085a] hover:bg-[#1a0640] text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Assessment
            </button>
          </div>
        </div>
        {exitDialog}
      </div>
    );
  }

  // Prompt/Instructions screen
  if (phase === "prompt") {
    return (
      <SpeakingPromptScreen
        partNumber={partNumber}
        totalParts={totalParts}
        title={`Speaking Part ${partNumber}`}
        instructions={PART_PROMPTS[partType]}
        onNext={() => startPrep()}
        onExit={handleExit}
      />
    );
  }

  // Grading / Done
  if (phase === "grading" || phase === "done") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <SpeakingHeader partLabel="Speaking Results" partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 px-4 pt-8">
          <SpeakingResults isGrading={isGrading} grading={grading} onExit={onExit} />
        </div>
        {exitDialog}
      </div>
    );
  }

  // Prep or Recording phase
  const question = getCurrentQuestion();
  const isRec = phase === "recording";
  const timeLeft = isRec ? speakTimeLeft : prepTimeLeft;
  const totalTime = isRec ? getSpeakTime() : getPrepTime();

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
      <SpeakingHeader partLabel={`Speaking Part ${partNumber}`} partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />

      <div className="flex-1 flex px-4 pt-8 pb-20 gap-6 max-w-6xl mx-auto w-full">
        {/* Left: Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-8 min-h-[400px]">
            <p className="text-xs text-gray-500 mb-1">Speaking</p>
            <p className="text-sm font-bold text-gray-900 mb-6">
              Part {partNumber} of {getTotalQuestions() > 1 ? getTotalQuestions() : totalParts}
            </p>

            {/* Part 2 image */}
            {partType === "part2" && (
              <div className="mb-4">
                <img
                  src={resolvedImg1 || part2Data?.imageUrl}
                  alt="Describe this picture"
                  className="w-full max-w-md rounded-lg object-cover"
                />
              </div>
            )}

            {/* Part 3 two images side by side */}
            {partType === "part3" && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <img
                  src={resolvedImg1 || part3Data?.imageUrl1}
                  alt="Picture 1"
                  className="w-full rounded-lg object-cover h-56"
                />
                <img
                  src={resolvedImg2 || part3Data?.imageUrl2}
                  alt="Picture 2"
                  className="w-full rounded-lg object-cover h-56"
                />
              </div>
            )}

            {/* Part 4 topic + questions */}
            {partType === "part4" && part4Data && (
              <div className="bg-gray-50 rounded-lg p-5 mb-4">
                <p className="font-bold text-gray-900 mb-2">Topic: {part4Data.topic}</p>
                <ul className="space-y-1.5">
                  {part4Data.questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-700">• {q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Question text */}
            <p className="text-sm text-gray-800 mt-4">{question}</p>
          </div>
        </div>

        {/* Right: Timer panel */}
        <div className="w-[220px] shrink-0">
          <CircularTimer
            timeLeft={timeLeft}
            totalTime={totalTime}
            label={isRec ? "Recording..." : "Preparation..."}
            isRecording={isRec}
            isPrep={phase === "prep"}
          />

          {/* Finish Recording button - only shows after 10s of recording */}
          {isRec && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: canFinish ? 1 : 0.3, y: 0 }}
              className="mt-4"
            >
              <button
                onClick={handleFinishRecording}
                disabled={!canFinish}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#24085a] text-white hover:bg-[#1a0640]"
              >
                Finish Recording
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <BottomNavBar
        onSubmit={handleExit}
        submitLabel="Exit"
        isLast={true}
        isFirst={true}
      />
      {exitDialog}
    </div>
  );
};

export default SpeakingExamEngine;
