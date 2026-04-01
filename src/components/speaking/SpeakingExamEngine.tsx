import { useState, useEffect, useCallback, useRef } from "react";
import SpeakingLayout from "@/components/speaking/SpeakingLayout";
import SpeakingMicCheck from "@/components/speaking/SpeakingMicCheck";
import SpeakingPart1Personal from "@/components/speaking/SpeakingPart1Personal";
import SpeakingPart2Describe from "@/components/speaking/SpeakingPart2Describe";
import SpeakingPart3Compare from "@/components/speaking/SpeakingPart3Compare";
import SpeakingPart4Opinion from "@/components/speaking/SpeakingPart4Opinion";
import SpeakingResults from "@/components/speaking/SpeakingResults";
import { useExamGrading, blobUrlToBase64 } from "@/hooks/useExamGrading";
import { speakText, cancelSpeech } from "@/lib/speechSynthesis";
import { Button } from "@/components/ui/button";
import { Mic, Loader2 } from "lucide-react";
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

type Phase = "mic-check" | "tts" | "practice" | "grading" | "done";

const PART_LABELS: Record<SpeakingPartType, string> = {
  part1: "Speaking Part 1",
  part2: "Speaking Part 2",
  part3: "Speaking Part 3",
  part4: "Speaking Part 4",
};

const PART_INSTRUCTIONS: Record<SpeakingPartType, string> = {
  part1: "In this part, I'm going to ask you some questions about yourself. Please answer each question. You will have 30 seconds to answer each question.",
  part2: "Now, look at this picture. Please describe what you can see. You will have some time to prepare, and then you should speak for about 45 seconds.",
  part3: "Now look at these two pictures. Please compare the two pictures. Talk about the similarities and differences. You will have some time to prepare, then speak for about 1 minute.",
  part4: "Now I'm going to give you a topic to talk about. You should give your opinion and explain your reasons. You will have some time to prepare, then speak for about 2 minutes.",
};

const SpeakingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  onExit, onComplete,
}: SpeakingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("mic-check");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [p1Recordings, setP1Recordings] = useState<(string | null)[]>(
    new Array(part1Data?.questions.length || 0).fill(null)
  );
  const [p2Recording, setP2Recording] = useState<string | null>(null);
  const [p3Recording, setP3Recording] = useState<string | null>(null);
  const [p4Recording, setP4Recording] = useState<string | null>(null);

  const { grading, isGrading, gradeExam } = useExamGrading();

  const totalQuestions = partType === "part1" ? (part1Data?.questions.length || 0) : 1;

  // Check if current recording is done (for Next button)
  const isCurrentRecordingDone = (() => {
    if (partType === "part1") return !!p1Recordings[currentIndex];
    if (partType === "part2") return !!p2Recording;
    if (partType === "part3") return !!p3Recording;
    if (partType === "part4") return !!p4Recording;
    return false;
  })();

  // Timer
  useEffect(() => {
    if (phase !== "practice" || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(t);
          handleFinish();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft]);

  // TTS: read instructions when entering TTS phase
  useEffect(() => {
    if (phase === "tts") {
      setIsSpeaking(true);
      const instruction = PART_INSTRUCTIONS[partType];
      speakText(instruction).then(() => {
        setIsSpeaking(false);
        setPhase("practice");
      });
    }
    return () => {
      cancelSpeech();
    };
  }, [phase, partType]);

  const getQuestions = (): string[] => {
    if (partType === "part1" && part1Data) return part1Data.questions;
    if (partType === "part2" && part2Data) return [part2Data.prompt];
    if (partType === "part3" && part3Data) return [part3Data.prompt];
    if (partType === "part4" && part4Data) return part4Data.questions;
    return [];
  };

  const handleFinish = async () => {
    const recordings = partType === "part1"
      ? p1Recordings.filter(Boolean) as string[]
      : partType === "part2" ? (p2Recording ? [p2Recording] : [])
      : partType === "part3" ? (p3Recording ? [p3Recording] : [])
      : (p4Recording ? [p4Recording] : []);

    if (recordings.length === 0) {
      const { toast } = await import("sonner");
      toast.error("Bạn chưa ghi âm câu trả lời nào. Vui lòng ghi âm trước khi nộp bài.");
      return;
    }

    setPhase("grading");
    onComplete?.();

    let audioBase64: string | undefined;
    try {
      audioBase64 = await blobUrlToBase64(recordings[0]);
    } catch (e) {
      console.error("Failed to convert audio:", e);
    }

    await gradeExam({
      type: "speaking",
      audioBase64,
      questions: getQuestions(),
      partType,
    });

    setPhase("done");
  };

  const handleNext = () => {
    if (partType === "part1" && currentIndex < totalQuestions - 1) {
      setCurrentIndex((p) => p + 1);
    } else {
      handleFinish();
    }
  };

  const partLabel = PART_LABELS[partType];

  // ── Mic Check ──
  if (phase === "mic-check") {
    return (
      <SpeakingLayout
        partLabel={partLabel}
        timeLeft={timeLimit}
        totalTime={timeLimit}
        showFooter={false}
        onExit={onExit}
      >
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-lg mx-auto">
          <Mic className="w-12 h-12 mx-auto mb-4" style={{ color: "#24085a" }} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">{partLabel}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {testTitle}. Kiểm tra microphone trước khi bắt đầu.
          </p>
          <SpeakingMicCheck />
          <Button
            onClick={() => setPhase("tts")}
            className="mt-6 px-8 font-bold text-white"
            style={{ backgroundColor: "#24085a" }}
          >
            Bắt đầu bài thi
          </Button>
        </div>
      </SpeakingLayout>
    );
  }

  // ── TTS Phase (reading instructions) ──
  if (phase === "tts") {
    return (
      <SpeakingLayout
        partLabel={partLabel}
        timeLeft={timeLeft}
        totalTime={timeLimit}
        showFooter={false}
        onExit={onExit}
      >
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-lg mx-auto">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800 mb-3">Listening to Instructions...</h2>
          <p className="text-sm text-gray-500 italic">
            "{PART_INSTRUCTIONS[partType]}"
          </p>
        </div>
      </SpeakingLayout>
    );
  }

  // ── Grading / Done ──
  if (phase === "grading" || phase === "done") {
    return (
      <div className="min-h-[70vh] p-6">
        <SpeakingResults isGrading={isGrading} grading={grading} onExit={onExit} />
      </div>
    );
  }

  // ── Practice Phase ──
  return (
    <SpeakingLayout
      partLabel={partLabel}
      timeLeft={timeLeft}
      totalTime={timeLimit}
      onExit={onExit}
      showFooter={true}
      nextDisabled={!isCurrentRecordingDone}
      onNext={handleNext}
    >
      {partType === "part1" && part1Data && (
        <SpeakingPart1Personal
          data={part1Data}
          currentIndex={currentIndex}
          recordings={p1Recordings}
          onRecordingComplete={(qi, url) => {
            const n = [...p1Recordings];
            n[qi] = url;
            setP1Recordings(n);
          }}
        />
      )}

      {partType === "part2" && part2Data && (
        <SpeakingPart2Describe
          data={part2Data}
          recording={p2Recording}
          onRecordingComplete={setP2Recording}
        />
      )}

      {partType === "part3" && part3Data && (
        <SpeakingPart3Compare
          data={part3Data}
          recording={p3Recording}
          onRecordingComplete={setP3Recording}
        />
      )}

      {partType === "part4" && part4Data && (
        <SpeakingPart4Opinion
          data={part4Data}
          recording={p4Recording}
          onRecordingComplete={setP4Recording}
        />
      )}
    </SpeakingLayout>
  );
};

export default SpeakingExamEngine;
