import { useState, useEffect, useCallback, useRef } from "react";
import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import CircularTimer from "./CircularTimer";
import SpeakingPromptScreen from "./SpeakingPromptScreen";
import SpeakingMicCheck from "./SpeakingMicCheck";
import { resolveImageUrl } from "@/lib/imageUrl";
import { speakAsync as ttsSpeakAsync, stopTTS } from "@/lib/tts";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { saveSpeakingRecording, saveExamResult } from "@/lib/saveExamResult";
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
  examSetId?: string | null;
  sourceQuestionIds?: string[];
  onExit: () => void;
  onComplete?: () => void;
  skipIntro?: boolean;
}

type Phase = "start" | "mic-check" | "instructions" | "prompt" | "reading-question" | "prep" | "recording" | "grading" | "done";

/** Play a short beep using Web Audio API */
function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.5;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => { ctx.close(); resolve(); };
    } catch { resolve(); }
  });
}

/** Speak text using Google Cloud TTS (from src/lib/tts.ts) */
function speakAsync(text: string): Promise<void> {
  return ttsSpeakAsync(text, "en");
}

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
  examSetId, sourceQuestionIds,
  onExit, onComplete, skipIntro = false,
}: SpeakingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "prompt" : "start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prepTimeLeft, setPrepTimeLeft] = useState(0);
  const [speakTimeLeft, setSpeakTimeLeft] = useState(0);
  const [canFinish, setCanFinish] = useState(false);
  const [recordings, setRecordings] = useState<(string | null)[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [resolvedImg1, setResolvedImg1] = useState<string | null>(null);
  const [resolvedImg2, setResolvedImg2] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentIndexRef = useRef(0);



  const partNumber = PART_NUMBERS[partType];
  const totalParts = 4;

  // Get total questions for this part
  const getTotalQuestions = () => {
    if (partType === "part1") return part1Data?.questions.length || 0;
    if (partType === "part2") return part2Data?.questions?.length || 1;
    if (partType === "part3") return part3Data?.questions?.length || 1;
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
    if (partType === "part2" && part2Data) return part2Data.questions?.[currentIndex] || part2Data.prompt;
    if (partType === "part3" && part3Data) return part3Data.questions?.[currentIndex] || part3Data.prompt;
    if (partType === "part4" && part4Data) return part4Data.topic;
    return "";
  };

  // Resolve images
  useEffect(() => {
    if (part2Data?.imageUrl) resolveImageUrl(part2Data.imageUrl).then(setResolvedImg1);
    if (part3Data?.imageUrl1) resolveImageUrl(part3Data.imageUrl1).then(setResolvedImg1);
    if (part3Data?.imageUrl2) resolveImageUrl(part3Data.imageUrl2).then(setResolvedImg2);
    if (part4Data?.imageUrl) resolveImageUrl(part4Data.imageUrl).then(setResolvedImg1);
  }, [part2Data, part3Data, part4Data]);

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
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Read question aloud, beep, then start prep/recording
  const startQuestionFlow = useCallback(async () => {
    setPhase("reading-question");
    
    // Get the question text for current index
    const questionText = (() => {
      if (partType === "part1" && part1Data) return part1Data.questions[currentIndexRef.current];
      if (partType === "part2" && part2Data) return part2Data.questions?.[currentIndexRef.current] || part2Data.prompt;
      if (partType === "part3" && part3Data) return part3Data.questions?.[currentIndexRef.current] || part3Data.prompt;
      if (partType === "part4" && part4Data) {
        const parts: string[] = [];
        if (part4Data.topic) parts.push(`Topic: ${part4Data.topic}.`);
        if (part4Data.questions?.length) parts.push(part4Data.questions.join(" "));
        parts.push("You now have one minute to think about your answers. You can make notes if you wish.");
        return parts.join(" ");
      }
      return "";
    })();

    if (questionText) {
      await speakAsync(questionText);
    }
    await playBeep();
    await new Promise(r => setTimeout(r, 500));

    // Now start prep or recording
    const prepTime = getPrepTime();
    if (prepTime <= 0) {
      startRecording();
      return;
    }
    setPrepTimeLeft(prepTime);
    setPhase("prep");
    
    if (timerRef.current) clearInterval(timerRef.current);
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
  }, [partType, part1Data, part2Data, part3Data, part4Data]);

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
        const idx = currentIndexRef.current;
        setRecordings(prev => {
          const next = [...prev];
          next[idx] = url;
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
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSpeakTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            doStopAndAdvance();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
    }
  }, [partType]);

  // Stop recording and move to next question/finish (uses refs to avoid stale closures)
  const doStopAndAdvance = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsTransitioning(true);
    
    const total = getTotalQuestions();
    const idx = currentIndexRef.current;
    if (idx < total - 1) {
      const nextIdx = idx + 1;
      currentIndexRef.current = nextIdx;
      setTimeout(() => {
        setCurrentIndex(nextIdx);
        setCanFinish(false);
        setIsTransitioning(false);
        startQuestionFlow();
      }, 300);
    } else {
      setIsTransitioning(false);
      handleFinish();
    }
  }, [partType]);

  const handleFinishRecording = useCallback(() => {
    if (!canFinish) return;
    doStopAndAdvance();
  }, [canFinish, doStopAndAdvance]);

  const handleFinish = async () => {
    // Best-effort upload of all recordings — never block UI on failure
    try {
      const currentRecordings = recordings;
      await Promise.all(
        currentRecordings.map(async (url, idx) => {
          if (!url) return;
          try {
            const blob = await fetch(url).then((r) => r.blob());
            await saveSpeakingRecording({
              examSetId: examSetId ?? null,
              part: `${partType}_q${idx + 1}`,
              blob,
            });
          } catch { /* ignore individual upload failures */ }
        })
      );
      // Persist per-question rows (for HistoryDetail review)
      if (sourceQuestionIds && sourceQuestionIds.length > 0) {
        const perQuestion = sourceQuestionIds.map((qid, idx) => ({
          exam_question_id: qid,
          user_answer: recordings[idx] ? "(recorded)" : null,
          is_correct: false,
        }));
        await saveExamResult({
          examSetId: examSetId ?? null,
          skill: "speaking",
          correct: 0,
          total: sourceQuestionIds.length,
          perQuestion,
        });
      }
    } catch { /* swallow */ }
    onComplete?.();
    setPhase("done");
  };

  const handleExit = () => {
    // Just open the confirm dialog — keep timer & TTS running in background
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    try { stopTTS(); } catch { /* noop */ }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowExitConfirm(false);
    onExit();
  };

  // ============ RENDER ============
  const exitDialog = showExitConfirm && (
    <ExamFinishScreen
      title="Submit Test?"
      message="Once you submit your test you will no longer have access to the questions."
      buttonText="Submit test"
      cancelText="Cancel"
      onSubmit={handleConfirmExit}
      onCancel={() => setShowExitConfirm(false)}
    />
  );

  // Start Assessment (info) screen
  if (phase === "start") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <SpeakingHeader partLabel="Speaking" partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 bg-white pl-[80px] pt-[40px] font-sans text-black">
          <p className="text-sm text-gray-500 mb-2">Aptis General Practice Test</p>
          <h1 className="text-xl font-bold text-black mb-1">Speaking Practice Test</h1>
          <p className="text-sm text-gray-500 mb-6">{testTitle}</p>
          <div className="flex gap-16 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Number of Questions</p>
              <p className="text-sm font-bold text-black">4</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Time Allowed</p>
              <p className="text-sm font-bold text-black">12 min</p>
            </div>
          </div>
          <p className="text-sm font-bold text-black mb-4">Assessment Description</p>
          <div className="max-w-md mb-6">
            <SpeakingMicCheck />
          </div>
          <button
            onClick={() => setPhase("instructions")}
            className="bg-[#2D1B69] text-white text-sm rounded-md px-6 py-2.5 hover:bg-[#1f1149] transition-colors"
          >
            Start Assessment
          </button>
        </div>
        {exitDialog}
      </div>
    );
  }

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
              onClick={() => setPhase("instructions")}
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

  // Instructions screen
  if (phase === "instructions") {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex flex-col">
        <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-20">
          <div className="bg-white rounded-xl shadow-sm max-w-3xl w-full p-8 md:p-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Aptis General Speaking Test Instructions</h2>
            <p className="text-sm font-bold text-gray-900 mb-3">Speaking</p>
            <div className="text-sm text-gray-700 leading-relaxed space-y-2">
              <p>You will answer some questions about yourself and then do three short speaking tasks.</p>
              <p>Listen to the instructions and speak clearly into your microphone when you hear the signal.</p>
              <p>Each part of the test will appear automatically.</p>
              <p>The test will take about 12 minutes.</p>
              <p className="mt-4">When you click on the 'Next' button, the test will begin.</p>
            </div>
          </div>
        </div>
        <BottomNavBar
          onPrevious={() => setPhase("start")}
          onNext={() => setPhase("prompt")}
          isFirst={false}
          isLast={false}
        />
        {exitDialog}
      </div>
    );
  }

  // Prompt/Instructions screen
  if (phase === "prompt") {
    return (
      <>
        <SpeakingPromptScreen
          partNumber={partNumber}
          totalParts={totalParts}
          title={`Speaking Part ${partNumber}`}
          instructions={PART_PROMPTS[partType]}
          onNext={() => startQuestionFlow()}
          onExit={handleExit}
        />
        {exitDialog}
      </>
    );
  }

  // Grading / Done — submitted screen with per-question playback
  if (phase === "grading" || phase === "done") {
    const promptsList: string[] = (() => {
      if (partType === "part1" && part1Data) return part1Data.questions;
      if (partType === "part2" && part2Data) return part2Data.questions || [part2Data.prompt];
      if (partType === "part3" && part3Data) return part3Data.questions || [part3Data.prompt];
      if (partType === "part4" && part4Data) return [part4Data.topic];
      return [];
    })();
    const samples: string[] = (() => {
      if (partType === "part1") return part1Data?.sampleAnswers || [];
      if (partType === "part2") return part2Data?.sampleAnswers || [];
      if (partType === "part3") return part3Data?.sampleAnswers || [];
      if (partType === "part4") return part4Data?.sampleAnswers || [];
      return [];
    })();
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SpeakingHeader partLabel="Speaking" partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                Bài Speaking đã được nộp
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Cảm ơn bạn đã hoàn thành phần Speaking. Bạn có thể nghe lại bài làm và tham khảo bài mẫu bên dưới.
              </p>
              <button
                onClick={onExit}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Quay lại danh sách đề
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-base font-heading font-bold text-foreground mb-4">
                🎙️ Xem lại từng câu
              </h3>
              <div className="space-y-4">
                {promptsList.map((prompt, i) => (
                  <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Câu {i + 1}</p>
                      <p className="text-sm text-foreground">{prompt}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Bài ghi âm của bạn</p>
                      {recordings[i] ? (
                        <audio controls src={recordings[i]!} className="w-full h-9" />
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Không có bài ghi âm</p>
                      )}
                    </div>

                    {samples[i] && (
                      <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-success mb-1">💡 Bài nói mẫu</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{samples[i]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {exitDialog}
      </div>
    );
  }

  // Reading-question, Prep or Recording phase
  const question = getCurrentQuestion();
  const isRec = phase === "recording";
  const isReading = phase === "reading-question";
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
              {(partType === "part1" || partType === "part2" || partType === "part3") ? "Question" : "Part"} {(partType === "part1" || partType === "part2" || partType === "part3") ? currentIndex + 1 : partNumber} of {getTotalQuestions() > 1 ? getTotalQuestions() : totalParts}
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

            {/* Part 4 topic + image + questions */}
            {partType === "part4" && part4Data && (
              <div className="bg-gray-50 rounded-lg p-5 mb-4">
                <p className="font-bold text-gray-900 mb-3">Topic: {part4Data.topic}</p>
                {part4Data.imageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 max-w-md">
                    <img
                      src={resolvedImg1 || part4Data.imageUrl}
                      alt="Part 4 topic"
                      className="w-full h-56 object-cover"
                    />
                  </div>
                )}
                <ul className="space-y-1.5 mb-3">
                  {part4Data.questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-700">• {q}</li>
                  ))}
                </ul>
                <p className="text-sm font-bold text-gray-900">
                  You now have one minute to think about your answers. You can make notes if you wish.
                </p>
              </div>
            )}

            {/* Question text */}
            {partType !== "part4" && <p className="text-sm text-gray-800 mt-4">{question}</p>}
          </div>
        </div>

        {/* Right: Timer panel */}
        <div className="w-[220px] shrink-0">
          {isReading ? (
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[260px]">
              <div className="w-16 h-16 rounded-full bg-[#24085a]/10 flex items-center justify-center mb-4 animate-pulse">
                <span className="text-3xl">🔊</span>
              </div>
              <p className="text-sm font-semibold text-[#24085a] text-center">Đang đọc câu hỏi...</p>
              <p className="text-xs text-gray-500 text-center mt-2">Nghe xong sẽ có tiếng bíp rồi bắt đầu ghi âm</p>
            </div>
          ) : (
            <CircularTimer
              timeLeft={timeLeft}
              totalTime={totalTime}
              label={isRec ? "Recording..." : "Preparation..."}
              isRecording={isRec}
              isPrep={phase === "prep"}
            />
          )}

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

      {/* Transitioning indicator */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#24085a]" />
            <span className="text-xs text-[#24085a] font-medium">Đang xử lý...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {exitDialog}
    </div>
  );
};

export default SpeakingExamEngine;
