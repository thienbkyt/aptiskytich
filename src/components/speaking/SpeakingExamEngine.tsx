import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import ExamInstructions from "@/components/exam/ExamInstructions";
import SpeakingMicCheck from "@/components/speaking/SpeakingMicCheck";
import SpeakingPart1Personal from "@/components/speaking/SpeakingPart1Personal";
import SpeakingPart2Describe from "@/components/speaking/SpeakingPart2Describe";
import SpeakingPart3Compare from "@/components/speaking/SpeakingPart3Compare";
import SpeakingPart4Opinion from "@/components/speaking/SpeakingPart4Opinion";
import SpeakingResults from "@/components/speaking/SpeakingResults";
import TimerDisplay from "@/components/reading/TimerDisplay";
import BottomNavBar from "@/components/reading/BottomNavBar";
import { useExamGrading, blobUrlToBase64 } from "@/hooks/useExamGrading";
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

type Phase = "instructions" | "practice" | "grading" | "done";

const PART_LABELS: Record<SpeakingPartType, string> = {
  part1: "Part 1 – Personal Questions",
  part2: "Part 2 – Describe a Picture",
  part3: "Part 3 – Compare Pictures",
  part4: "Part 4 – Opinion Questions",
};

const SpeakingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  onExit, onComplete,
}: SpeakingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>("instructions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  const [p1Recordings, setP1Recordings] = useState<(string | null)[]>(
    new Array(part1Data?.questions.length || 0).fill(null)
  );
  const [p2Recording, setP2Recording] = useState<string | null>(null);
  const [p3Recording, setP3Recording] = useState<string | null>(null);
  const [p4Recording, setP4Recording] = useState<string | null>(null);

  const { grading, isGrading, gradeExam } = useExamGrading();

  const totalQuestions = partType === "part1" ? (part1Data?.questions.length || 0) : 1;

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

  const getQuestions = (): string[] => {
    if (partType === "part1" && part1Data) return part1Data.questions;
    if (partType === "part2" && part2Data) return [part2Data.prompt];
    if (partType === "part3" && part3Data) return [part3Data.prompt];
    if (partType === "part4" && part4Data) return part4Data.questions;
    return [];
  };

  const handleFinish = async () => {
    setPhase("grading");
    onComplete?.();

    // Collect recordings and convert to base64
    let audioBase64: string | undefined;
    const recordings = partType === "part1"
      ? p1Recordings.filter(Boolean) as string[]
      : partType === "part2" ? (p2Recording ? [p2Recording] : [])
      : partType === "part3" ? (p3Recording ? [p3Recording] : [])
      : (p4Recording ? [p4Recording] : []);

    if (recordings.length > 0) {
      try {
        // Use the first/main recording for grading
        audioBase64 = await blobUrlToBase64(recordings[0]);
      } catch (e) {
        console.error("Failed to convert audio:", e);
      }
    }

    const result = await gradeExam({
      type: "speaking",
      audioBase64,
      questions: getQuestions(),
      partType,
    });

    setPhase("done");
  };

  const partLabel = PART_LABELS[partType];

  const sections = [
    {
      title: "Aptis General Speaking Instructions",
      isCurrent: phase === "instructions",
    },
    {
      title: partLabel,
      questionCount: totalQuestions,
      isCurrent: phase === "practice",
    },
  ];

  const navProps = partType === "part1" ? {
    onPrevious: currentIndex > 0 ? () => setCurrentIndex((p) => p - 1) : undefined,
    onNext: currentIndex < totalQuestions - 1 ? () => setCurrentIndex((p) => p + 1) : undefined,
    onSubmit: currentIndex === totalQuestions - 1 ? handleFinish : undefined,
    isFirst: currentIndex === 0,
    isLast: currentIndex === totalQuestions - 1,
    sections,
  } : {
    onSubmit: handleFinish,
    isFirst: true,
    isLast: true,
    sections,
  };

  if (phase === "instructions") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <ExamInstructions
          skillName={`Speaking – ${partLabel}`}
          timeLeft={timeLeft}
          totalTime={timeLimit}
          totalParts={totalQuestions}
          totalMinutes={Math.ceil(timeLimit / 60)}
          onStart={() => setPhase("practice")}
          sections={sections}
          description={`Bài luyện tập: ${testTitle}. Bạn cần cho phép trình duyệt truy cập microphone để ghi âm.`}
        />
      </div>
    );
  }

  if (phase === "grading" || phase === "done") {
    return (
      <div className="min-h-[70vh]">
        <div className="flex items-center mb-6">
          <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
        </div>
        <SpeakingResults isGrading={isGrading} grading={grading} onExit={onExit} />
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
        <TimerDisplay timeLeft={timeLeft} totalTime={timeLimit} />
      </div>

      <div className="mb-3">
        <p className="text-sm font-heading font-bold text-foreground">{partLabel}</p>
      </div>

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

      <BottomNavBar {...navProps} />
    </div>
  );
};

export default SpeakingExamEngine;
