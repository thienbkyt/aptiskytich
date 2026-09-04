import { useState, useEffect, useCallback, useRef } from "react";
import { markExamActive } from "@/lib/examActive";
import { applyUpdateIfPending } from "@/lib/registerPWA";
import { useExitWarning } from "@/hooks/useExitWarning";
import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import CircularTimer from "./CircularTimer";
import SpeakingPromptScreen from "./SpeakingPromptScreen";
import SpeakingMicCheck from "./SpeakingMicCheck";
import SignedImage from "@/components/exam/SignedImage";
import { resolveImageUrl } from "@/lib/imageUrl";
import MissingMediaNotice from "@/components/exam/MissingMediaNotice";
import { playBeep } from "@/lib/beep";
import { speakAsync as ttsSpeakAsync, stopTTS, unlockAudio, warmTTS } from "@/lib/tts";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { saveSpeakingRecording, saveExamResult } from "@/lib/saveExamResult";
import { supabase } from "@/integrations/supabase/client";
import { fetchCoreGVBand } from "@/lib/coreGV";
import { safeText } from "@/lib/safeText";
import { logClientError } from "@/lib/clientErrorLog";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import RevealAnswerButton from "@/components/exam/RevealAnswerButton";
import OutlineBuilderButton from "@/components/speaking/OutlineBuilderButton";
import SpeakingScratchpad from "@/components/speaking/SpeakingScratchpad";



import type {
  SpeakingPartType,
  SpeakingPart1Data,
  SpeakingPart2Data,
  SpeakingPart3Data,
  SpeakingPart4Data,
} from "@/data/speakingQuestions";
import {
  buildSpeakingGradingSpecs,
  gradeSpeakingItems,
  saveSpeakingGradings,
  blobToBase64,
  type SpeakingItemGrading,
  type SpeakingGradingResult,
  type SpeakingGradingSpec,
} from "./speakingGrading";
import SpeakingReviewView from "./SpeakingReviewView";
import {
  gradeSpeakingPartV2,
  saveSpeakingSkillResult,
  finalizeSpeaking,
  type SpeakingPartResultV2,
} from "./speakingGradingV2";
import { QuotaExceededError, type QuotaInfo } from "@/lib/quotaError";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { uploadSpeakingBlobs } from "@/lib/speakingUpload";
import { enqueueGradingFallback } from "@/lib/gradingQueue";
import AiQuotaBadge from "@/components/pro/AiQuotaBadge";



import SpeakingProfileView from "./SpeakingProfileView";
import RotateDeviceOverlay from "@/components/exam/RotateDeviceOverlay";

/** Payload passed to parent in fullFlow mode (full-skill practice). */
export interface SpeakingPartSubmissionItem {
  spec: SpeakingGradingSpec;
  audioBase64: string | null;
  audioUrl: string | null;
  blob: Blob | null;
  actualSpoken: number;
}
export interface SpeakingPartSubmission {
  partType: SpeakingPartType;
  partNumber: number;
  items: SpeakingPartSubmissionItem[];
  /**
   * The REAL question texts of this part, taken from exam_questions via the
   * toSpeakingPartX transformers. This is the only source of truth for grading
   * and review — never the exam/custom-set title or a Part 4 topic. Part 4 has
   * a single recording (items.length === 1) but 3 questions, so this list can
   * be longer than `items`.
   */
  questions: string[];
}


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
  fullTestSessionId?: string | null;
  fullTestId?: string | null;
  onExit: () => void;
  onComplete?: () => void;
  skipIntro?: boolean;
  onAdminPrevious?: () => void;
  /** Full-skill practice mode: skip in-engine grading + DB save, hand submission to parent. */
  fullFlow?: boolean;
  isLastPart?: boolean;
  onPartSubmissions?: (submission: SpeakingPartSubmission) => void;
  /** Practice-only: show "Reveal answer" button (sample spoken answer). Default false. Never set in Full Test. */
  allowReveal?: boolean;
}

type Phase = "start" | "mic-check" | "instructions" | "prompt" | "reading-question" | "prep" | "recording" | "grading" | "done";

/** Speak text using Google Cloud TTS (from src/lib/tts.ts) */
function speakAsync(text: string): Promise<void> {
  return ttsSpeakAsync(text, "en", { surface: "exam" });
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

const PAUSE_AFTER_SPEAK_MS = 1500;

const PART_PROMPTS: Record<SpeakingPartType, string> = {
  part1: "Part One - In this part, I am going to ask you three short questions about yourself and your interests. You will have 30 seconds to reply to each question.\n\nBegin speaking when you hear this sound.",
  part2: "Part Two - In this part, I'm going to ask you to describe a picture. Then I will ask you two questions about it. You will have 45 seconds for each response.\n\nBegin speaking when you hear this sound.",
  part3: "Part Three - In this part, I'm going to ask you to compare two pictures, and I will then ask you two questions about them. You will have 45 seconds for each response.\n\nBegin speaking when you hear this sound.",
  part4: "Part Four - In this part, you will discuss a topic. You will have 60 seconds to prepare and 120 seconds to speak.\n\nBegin speaking when you hear this sound.",
};

const PART_NUMBERS: Record<SpeakingPartType, number> = {
  part1: 1, part2: 2, part3: 3, part4: 4,
};

const SpeakingExamEngine = ({
  partType, testTitle, timeLimit,
  part1Data, part2Data, part3Data, part4Data,
  examSetId, sourceQuestionIds, fullTestSessionId, fullTestId,
  onExit, onComplete, skipIntro = false, onAdminPrevious,
  fullFlow = false, isLastPart, onPartSubmissions,
  allowReveal = false,
}: SpeakingExamEngineProps) => {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "prompt" : "start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prepTimeLeft, setPrepTimeLeft] = useState(0);
  const [speakTimeLeft, setSpeakTimeLeft] = useState(0);
  const [canFinish, setCanFinish] = useState(false);
  const [recordings, setRecordings] = useState<(string | null)[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [gradings, setGradings] = useState<(SpeakingGradingResult | null)[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [reviewDetail, setReviewDetail] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sampleLevel, setSampleLevel] = useState<"basic" | "advanced">("basic");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [scratchNote, setScratchNote] = useState("");
  const activeOutline = partType === "part1" ? part1Data
    : partType === "part2" ? part2Data
    : partType === "part3" ? part3Data : part4Data;
  const canUseScratchpad = !fullTestSessionId
    && !!(activeOutline?.outlineB1 || activeOutline?.outlineB2);


  // Mic failure (permission denied / device removed) — pauses timer + shows retry UI.
  const [micError, setMicError] = useState<string | null>(null);
  const [v2Result, setV2Result] = useState<SpeakingPartResultV2 | null>(null);
  const [v2Scale, setV2Scale] = useState<number | null>(null);
  const [v2Cefr, setV2Cefr] = useState<string | null>(null);
  const [v2Error, setV2Error] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState<QuotaInfo | null>(null);
  // Background-queue grading state (single-part mode).
  const [queuePending, setQueuePending] = useState(false);
  const [queueTimedOut, setQueueTimedOut] = useState(false);


  useExitWarning(phase !== "start" && phase !== "instructions" && phase !== "grading" && phase !== "done");
  const gradingRanRef = useRef(false);
  const testResultIdRef = useRef<string | null>(null);
  const sessionStartIsoRef = useRef<string>(new Date().toISOString());
  const gradingsSavedRef = useRef(false);
  const v2RanRef = useRef(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeAudioContextRef = useRef<AudioContext | null>(null);
  const volumeAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeSampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeMeasurementActiveRef = useRef(false);
  const currentMaxRmsRef = useRef(0);
  const maxRmsByQuestionRef = useRef<number[]>([]);
  const silentByQuestionRef = useRef<boolean[]>([]);
  const currentIndexRef = useRef(0);
  const flowTokenRef = useRef(0);
  const adminNavLockedRef = useRef(false);
  const suppressRecordingSaveRef = useRef(false);
  // Guards to prevent doStopAndAdvance / handleFinish firing twice
  // (e.g. timer reaching 0 at the same instant the user clicks "Finish Recording")
  const advancingRef = useRef(false);
  const finishedRef = useRef(false);
  // Synchronously-updated recordings store (avoids stale state when finishing on last question).
  const recordingsRef = useRef<(Blob | null)[]>([]);
  // Actual spoken duration (seconds) per question. Computed at stop time.
  const durationsRef = useRef<(number | null)[]>([]);
  // Timestamp (ms) when current recording started, for duration calc.
  const recordingStartRef = useRef<number | null>(null);
  // Absolute deadlines for prep / recording so real elapsed time always wins.
  const prepEndAtRef = useRef<number | null>(null);
  const speakEndAtRef = useRef<number | null>(null);
  // When true, the next onstop should trigger handleFinish after writing the blob.
  const finishAfterStopRef = useRef(false);
  // When non-null, onstop should advance to this question index after writing the blob.
  const pendingAdvanceRef = useRef<number | null>(null);
  // One-shot guard: only log the missing-image diagnostic once per part render.
  const missingImageLoggedRef = useRef(false);

  // RMS is measured on a normalized 0..1 scale. Tune this threshold if real
  // devices prove consistently quieter/louder; background noise should stay below it.
  const SILENCE_RMS_THRESHOLD = 0.01;

  const stopVolumeMeasurement = useCallback(() => {
    if (volumeSampleTimerRef.current) {
      clearInterval(volumeSampleTimerRef.current);
      volumeSampleTimerRef.current = null;
    }
    try { volumeAnalyserRef.current?.disconnect(); } catch { /* noop */ }
    volumeAnalyserRef.current = null;
    const context = volumeAudioContextRef.current;
    volumeAudioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }, []);






  const partNumber = PART_NUMBERS[partType];
  const totalParts = 4;

  /**
   * The real question texts of this part (from exam_questions via the
   * toSpeakingPartX transformers). Single source of truth for grading + review,
   * in BOTH single-part and full-flow (Full Part / Full Test / custom set) mode.
   * Never falls back to the exam title; Part 4 falls back to its topic only when
   * the set truly has no question rows.
   */
  const getPromptList = useCallback((): string[] => {
    if (partType === "part1" && part1Data) return (part1Data.questions || []).filter(Boolean);
    if (partType === "part2" && part2Data) {
      const qs = (part2Data.questions || []).filter(Boolean);
      return qs.length ? qs : [part2Data.prompt].filter(Boolean);
    }
    if (partType === "part3" && part3Data) {
      const qs = (part3Data.questions || []).filter(Boolean);
      return qs.length ? qs : [part3Data.prompt].filter(Boolean);
    }
    if (partType === "part4" && part4Data) {
      const qs = (part4Data.questions || []).filter(Boolean);
      return qs.length ? qs : [part4Data.topic].filter(Boolean);
    }
    return [];
  }, [partType, part1Data, part2Data, part3Data, part4Data]);



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
    if (partType === "part3") return part3Data?.speakTime || 45;
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

  // Single source of truth for the text that is read aloud for a given question index.
  const getSpokenTextForIndex = useCallback((i: number): string => {
    if (partType === "part1" && part1Data) return part1Data.questions?.[i] || "";
    if (partType === "part2" && part2Data) return part2Data.questions?.[i] || part2Data.prompt || "";
    if (partType === "part3" && part3Data) return part3Data.questions?.[i] || part3Data.prompt || "";
    if (partType === "part4" && part4Data) {
      const parts: string[] = [];
      if (part4Data.topic) parts.push(`Topic: ${part4Data.topic}.`);
      if (part4Data.questions?.length) parts.push(part4Data.questions.join(" "));
      parts.push("You now have one minute to think about your answers. You can make notes if you wish.");
      return parts.join(" ");
    }
    return "";
  }, [partType, part1Data, part2Data, part3Data, part4Data]);

  // Warm the exam voice for the NEXT question so its playback starts instantly.
  useEffect(() => {
    if (partType === "part4") return; // part4 has a single combined text, warmed at the prompt screen
    const nextText = getSpokenTextForIndex(currentIndex + 1);
    if (nextText) void warmTTS(nextText, "en", "exam");
  }, [currentIndex, partType, getSpokenTextForIndex]);

  // Warm the FIRST question while the student is still on the instructions screen.
  useEffect(() => {
    if (phase !== "prompt" && phase !== "instructions" && phase !== "start") return;
    const firstText = getSpokenTextForIndex(0);
    if (firstText) void warmTTS(firstText, "en", "exam");
  }, [phase, getSpokenTextForIndex]);

  // Warm the PART PROMPT (first audio of every part) before the prompt screen.
  useEffect(() => {
    if (phase !== "start" && phase !== "instructions") return;
    const promptText = PART_PROMPTS[partType];
    if (promptText) void warmTTS(promptText, "en", "exam");
  }, [phase, partType]);




  // Image resolution is handled by <SignedImage /> directly.
  // Tầng B: warm up signed URLs + browser cache while the student reads the part
  // instructions, so the question screen shows the picture immediately.
  useEffect(() => {
    if (phase !== "prompt" && phase !== "instructions" && phase !== "start") return;
    const paths = [
      partType === "part2" ? part2Data?.imageUrl : null,
      partType === "part3" ? part3Data?.imageUrl1 : null,
      partType === "part3" ? part3Data?.imageUrl2 : null,
      partType === "part4" ? part4Data?.imageUrl : null,
    ].filter(Boolean) as string[];
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const p of paths) {
        try {
          const url = await resolveImageUrl(p);
          if (cancelled || !url) continue;
          const img = new Image();
          img.src = url;
        } catch {
          /* prefetch is best-effort */
        }
      }
    })();
    return () => { cancelled = true; };
  }, [phase, partType, part2Data?.imageUrl, part3Data?.imageUrl1, part3Data?.imageUrl2, part4Data?.imageUrl]);

  // Diagnostic logging: capture why Speaking Part 2/3/4 sometimes renders with a
  // missing image despite the DB having an image. Fires once when the prompt screen
  // first appears, not on every phase re-render.
  useEffect(() => {
    if (phase !== "prompt") return;
    if (missingImageLoggedRef.current) return;
    missingImageLoggedRef.current = true;

    const missingPart2 = partType === "part2" && !part2Data?.imageUrl;
    const missingPart3 = partType === "part3" && (!part3Data?.imageUrl1 || !part3Data?.imageUrl2);
    const missingPart4 = partType === "part4" && !part4Data?.imageUrl;

    if (!missingPart2 && !missingPart3 && !missingPart4) return;

    logClientError("speaking_missing_image", new Error("missing_image_on_render"), {
      partType,
      examSetId: examSetId ?? null,
      testTitle,
      fullFlow,
      nQuestions: (part1Data?.questions?.length ?? part2Data?.questions?.length ?? part3Data?.questions?.length ?? part4Data?.questions?.length ?? 0),
      hasPartData: { p2: !!part2Data, p3: !!part3Data, p4: !!part4Data },
      imageFields: {
        p2: part2Data?.imageUrl ?? null,
        p3a: part3Data?.imageUrl1 ?? null,
        p3b: part3Data?.imageUrl2 ?? null,
        p4: part4Data?.imageUrl ?? null,
      },
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      conn: (navigator as any)?.connection?.effectiveType ?? null,
    });
  }, [phase, partType, part2Data, part3Data, part4Data, part1Data, examSetId, testTitle, fullFlow]);

  useEffect(() => markExamActive(), []);

  // Pending app update? Apply it while the student is on the intro screen
  // (nothing recorded yet). Never during "prompt"/recording phases.
  useEffect(() => {
    if (phase !== "start" && phase !== "instructions") return;
    applyUpdateIfPending();
  }, [phase]);

  // Initialize recordings array
  useEffect(() => {
    const total = getTotalQuestions();
    setRecordings(new Array(total).fill(null));
    recordingsRef.current = new Array(total).fill(null);
    durationsRef.current = new Array(total).fill(null);
    maxRmsByQuestionRef.current = new Array(total).fill(0);
    silentByQuestionRef.current = new Array(total).fill(false);
  }, [partType]);

  // Ensure exam-mode dark overrides apply across ALL speaking phases
  // (start/mic-check/instructions/prompt screens don't mount ExamHeader).
  useEffect(() => {
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    setRevealed(false);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      stopVolumeMeasurement();
      // Stop the exam voice (ElevenLabs/OpenAI audio element) as well as browser TTS.
      try { stopTTS(); } catch { /* noop */ }
      // Drop any in-progress recording: it must NOT be graded or counted as a submission.
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        suppressRecordingSaveRef.current = true;
        try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, [stopVolumeMeasurement]);

  // Single-part mode: when phase becomes "done", grade in the BACKGROUND via the
  // grading_jobs queue (upload audio → enqueue → poll speaking_skill_results).
  // Quota is enforced server-side inside the enqueue_grading_job RPC.
  useEffect(() => {
    if (fullFlow) return;
    if (phase !== "done" || v2RanRef.current) return;
    v2RanRef.current = true;

    const promptsList: string[] = getPromptList();
    const blobs = recordingsRef.current.map((blob, index) =>
      silentByQuestionRef.current[index] ? null : blob,
    );
    const questions = promptsList.map((q) => ({ questionText: q }));

    // Never enqueue a part where RMS measurement found no intelligible speech.
    const anySpoken = blobs.some(Boolean);
    if (!anySpoken) {
      setV2Error(
        "Không nhận được âm thanh từ micro. Bài này không được chấm và không bị trừ lượt. Hãy kiểm tra micro rồi thu lại.",
      );
      setIsGrading(false);
      return;
    }

    let cancelled = false;
    setIsGrading(true);
    setV2Error(null);
    setQueuePending(true);
    setQueueTimedOut(false);

    (async () => {
      try {
        const testResultId = testResultIdRef.current ?? null;
        const audioPaths = await uploadSpeakingBlobs(
          blobs,
          testResultId || examSetId || "adhoc",
          partType,
        );

        const queued = await enqueueGradingFallback({
          skill: "speaking",
          partType,
          testResultId,
          examSetId: examSetId ?? null,
          fullTestSessionId: null,
          payload: { type: "speaking_v2", partType, questions, audioPaths },
        });

        if (!queued.id) {
          if (cancelled) return;
          const code = queued.errorCode || "";
          if (/quota_exceeded|disabled/i.test(code)) {
            setQuotaModal({ used: 0, cap: 0, tier: "free", need: "pro" } as QuotaInfo);
            setQueuePending(false);
          } else {
            setQueueTimedOut(true);
          }
          return;
        }

        if (!testResultId) {
          if (!cancelled) setQueueTimedOut(true);
          return;
        }

        // Poll for the worker's result: every 6s, max 5 minutes.
        const deadline = Date.now() + 5 * 60 * 1000;
        while (!cancelled && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 6000));
          if (cancelled) return;
          const { data } = await supabase
            .from("speaking_skill_results")
            .select("parts, raw_total, scale50, cefr")
            .eq("test_result_id", testResultId)
            .maybeSingle();
          const partData = (data as any)?.parts?.[partType];
          if (!partData) continue;

          const perItem = Array.isArray(partData.perItem) ? partData.perItem : [];
          const mergedPerItem = perItem.map((it: any, i: number) => ({
            ...it,
            questionText: safeText(it?.questionText) || safeText(promptsList[i]) || `Question ${i + 1}`,
            transcript: safeText(it?.transcript),
            improvedVersion: safeText(it?.improvedVersion),
            upgradeTips: safeText(it?.upgradeTips),
          }));

          if (cancelled) return;
          setV2Result({
            bands: partData.bands ?? { tf: "", gra: "", vra: "", pro: "", fc: "" },
            rawPart: Number(partData.rawPart ?? (data as any)?.raw_total ?? 0),
            perItem: mergedPerItem,
            analysis: partData.analysis ?? "",
            criteriaAnalysis: partData.criteriaAnalysis ?? undefined,
            improvedVersion: partData.improvedVersion ?? "",
            fullTranscript: partData.fullTranscript ?? "",
          } as SpeakingPartResultV2);
          setV2Scale(Number((data as any)?.scale50 ?? 0));
          setV2Cefr(String((data as any)?.cefr ?? ""));
          setQueuePending(false);
          setIsGrading(false);
          return;
        }
        if (!cancelled) setQueueTimedOut(true);
      } catch (e: any) {
        if (e instanceof QuotaExceededError) {
          setQuotaModal(e.info);
        } else {
          console.error("[Speaking V2] enqueue/poll failed:", e);
          setV2Error(e?.message || "AI Kỳ Tích chưa chấm được phần này. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled) setIsGrading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [phase, fullFlow, partType, part1Data, part2Data, part3Data, part4Data, examSetId, fullTestSessionId]);




  // Read question aloud, beep, then start prep/recording
  const startQuestionFlow = useCallback(async () => {
    const token = ++flowTokenRef.current;
    setPhase("reading-question");
    
    // Get the question text for current index
    const questionText = getSpokenTextForIndex(currentIndexRef.current);

    if (questionText) {
      const words = questionText.trim().split(/\s+/).filter(Boolean).length;
      const speakTimeout = Math.max(30000, words * 900 + 8000);
      let finished = false;
      try {
        await withTimeout(
          speakAsync(questionText).then(() => { finished = true; }),
          speakTimeout
        );
      } catch {
        finished = true; /* Continue even if mobile audio is blocked. */
      }
      if (!finished) {
        // Timed out: cut the voice so it never overlaps the prep timer.
        try { stopTTS(); } catch { /* noop */ }
      }
    }

    if (token !== flowTokenRef.current) {
      console.warn("[Speaking] flow aborted - stale token after speakAsync");
      return;
    }

    if (questionText) {
      await new Promise(r => setTimeout(r, PAUSE_AFTER_SPEAK_MS));
      if (token !== flowTokenRef.current) {
        console.warn("[Speaking] flow aborted - stale token after post-speak pause");
        return;
      }
    }

    const prepTime = getPrepTime();
    // Beep after reading question: signals start of prep (if any) or start of recording

    try {
      await withTimeout(playBeep(), 1000);
    } catch {
      /* Continue even if mobile audio is blocked. */
    }
    if (token !== flowTokenRef.current) {
      console.warn("[Speaking] flow aborted - stale token after playBeep");
      return;
    }
    await new Promise(r => setTimeout(r, 500));
    if (token !== flowTokenRef.current) {
      console.warn("[Speaking] flow aborted - stale token after pre-recording delay");
      return;
    }

    // Now start prep or recording
    if (prepTime <= 0) {
      startRecording();
      return;
    }
    setPrepTimeLeft(prepTime);
    setPhase("prep");
    
    if (timerRef.current) clearInterval(timerRef.current);
    // Wall-clock prep countdown: hidden tabs throttle intervals, so remaining
    // time must always be derived from a real deadline, never decremented.
    const prepEndAt = Date.now() + prepTime * 1000;
    prepEndAtRef.current = prepEndAt;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((prepEndAt - Date.now()) / 1000));
      setPrepTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        prepEndAtRef.current = null;
        withTimeout(playBeep(), 1000)
          .catch(() => undefined)
          .then(() => {
            startRecording();
          });
      }
    }, 250);
  }, [partType, part1Data, part2Data, part3Data, part4Data]);

  // Start recording
  const startRecording = useCallback(async () => {
    const token = flowTokenRef.current;
    const speakTime = getSpeakTime();
    const recordingIndex = currentIndexRef.current;
    setSpeakTimeLeft(speakTime);
    setCanFinish(false);
    setMicError(null);
    setPhase("recording");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      console.error("[SpeakingExamEngine] mic permission error:", err);
      // Pause the countdown — we don't want to silently count this as recorded time.
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
      const name = err?.name || "";
      const msg = name === "NotAllowedError" || name === "SecurityError"
        ? "Trình duyệt đã chặn quyền micro. Hãy cho phép micro trong cài đặt trình duyệt rồi bấm Thử lại."
        : name === "NotFoundError" || name === "OverconstrainedError"
        ? "Không tìm thấy micro. Hãy cắm/chọn lại thiết bị micro rồi bấm Thử lại."
        : "Không truy cập được micro. Nếu bạn đang mở link trong ứng dụng Facebook/Zalo, hãy mở bằng Safari hoặc Chrome rồi cho phép quyền micro.";
      setMicError(msg);
      return;
    }

    if (token !== flowTokenRef.current || recordingIndex !== currentIndexRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    try {
      streamRef.current = stream;

      stopVolumeMeasurement();
      currentMaxRmsRef.current = 0;
      volumeMeasurementActiveRef.current = false;
      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          const context = new AudioContextCtor();
          if (context.state === "suspended") await context.resume();
          const source = context.createMediaStreamSource(stream);
          const analyser = context.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          volumeAudioContextRef.current = context;
          volumeAnalyserRef.current = analyser;
          volumeMeasurementActiveRef.current = true;
          const samples = new Float32Array(analyser.fftSize);
          volumeSampleTimerRef.current = setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            let sumSquares = 0;
            for (let i = 0; i < samples.length; i += 1) sumSquares += samples[i] * samples[i];
            const rms = Math.sqrt(sumSquares / samples.length);
            if (rms > currentMaxRmsRef.current) currentMaxRmsRef.current = rms;
          }, 200);
        }
      } catch (error) {
        console.warn("[SpeakingExamEngine] volume measurement unavailable", error);
      }

      // Detect mid-recording disconnects (mic unplugged, OS revokes permission, etc.)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (token !== flowTokenRef.current) return;
          if (!streamRef.current) return; // already cleaned up normally
          console.warn("[SpeakingExamEngine] mic track ended unexpectedly");
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
          // Discard the partial chunk so we don't save a corrupted recording silently.
          suppressRecordingSaveRef.current = true;
          try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
              mediaRecorderRef.current.stop();
            }
          } catch { /* ignore */ }
          setMicError("Mất kết nối micro giữa chừng. Đã tạm dừng đồng hồ. Hãy kiểm tra thiết bị rồi bấm Thử lại.");
        };
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (e: any) => {
        console.error("[SpeakingExamEngine] mediaRecorder error", e);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
        setMicError("Lỗi khi ghi âm. Đã tạm dừng đồng hồ. Bấm Thử lại để ghi lại.");
      };

      mediaRecorder.onstop = () => {
        stopVolumeMeasurement();
        if (suppressRecordingSaveRef.current || token !== flowTokenRef.current) {
          suppressRecordingSaveRef.current = false;
          chunksRef.current = [];
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          pendingAdvanceRef.current = null;
          // Even when suppressed, honor a pending finish so we don't hang.
          if (finishAfterStopRef.current) {
            finishAfterStopRef.current = false;
            handleFinish();
          }
          return;
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const maxRms = currentMaxRmsRef.current;
        const isSilent = volumeMeasurementActiveRef.current && maxRms < SILENCE_RMS_THRESHOLD;
        maxRmsByQuestionRef.current[recordingIndex] = maxRms;
        silentByQuestionRef.current[recordingIndex] = isSilent;
        const url = isSilent ? null : URL.createObjectURL(blob);
        // Record actual spoken duration (capped at speakTime).
        const startedAt = recordingStartRef.current;
        const elapsedSec = startedAt
          ? Math.min(speakTime, Math.max(0, Math.round((Date.now() - startedAt) / 1000)))
          : speakTime;
        recordingStartRef.current = null;
        const durArr = durationsRef.current.slice();
        durArr[recordingIndex] = elapsedSec;
        durationsRef.current = durArr;
        // Update the ref synchronously BEFORE any async finish flow reads it.
        const arr = recordingsRef.current.slice();
        arr[recordingIndex] = blob;
        recordingsRef.current = arr;
        setRecordings(prev => {
          const next = [...prev];
          next[recordingIndex] = url;
          return next;
        });
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (finishAfterStopRef.current) {
          finishAfterStopRef.current = false;
          handleFinish();
          return;
        }
        // Advance to next question only after blob is safely stored.
        if (pendingAdvanceRef.current != null) {
          const nextIdx = pendingAdvanceRef.current;
          pendingAdvanceRef.current = null;
          const advToken = flowTokenRef.current;
          currentIndexRef.current = nextIdx;
          transitionTimeoutRef.current = setTimeout(() => {
            if (advToken !== flowTokenRef.current) return;
            setCurrentIndex(nextIdx);
            setCanFinish(false);
            setIsTransitioning(false);
            advancingRef.current = false;
            startQuestionFlow();
          }, 300);
        }
      };

      mediaRecorder.start();
      recordingStartRef.current = Date.now();

      // Enable "Finish Recording" after 10 seconds
      finishTimerRef.current = setTimeout(() => {
        setCanFinish(true);
      }, 10000);

      // Countdown timer
      if (timerRef.current) clearInterval(timerRef.current);
      // Wall-clock recording countdown. MediaRecorder keeps running while the
      // tab is hidden, so a decrementing interval would let the clip overrun.
      const recEndAt = (recordingStartRef.current ?? Date.now()) + speakTime * 1000;
      speakEndAtRef.current = recEndAt;
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((recEndAt - Date.now()) / 1000));
        setSpeakTimeLeft(remaining);
        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          speakEndAtRef.current = null;
          doStopAndAdvance();
        }
      }, 250);

    } catch (err) {
      console.error("Mic error:", err);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      streamRef.current = null;
      setMicError("Không khởi tạo được ghi âm. Bấm Thử lại để thử lại.");
    }
  }, [partType]);

  // Stop recording and move to next question/finish (uses refs to avoid stale closures)
  const doStopAndAdvance = useCallback(() => {
    // Guard against double-invocation (timer + button race)
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }

    const total = getTotalQuestions();
    const idx = currentIndexRef.current;
    const isLast = idx >= total - 1;

    const recorder = mediaRecorderRef.current;
    const recorderActive = recorder && recorder.state !== "inactive";

    if (isLast) {
      setIsTransitioning(false);
      // Defer handleFinish until onstop has written the last blob into recordingsRef.
      if (recorderActive) {
        finishAfterStopRef.current = true;
        try { recorder!.stop(); } catch { handleFinish(); }
      } else {
        handleFinish();
      }
      return;
    }

    setIsTransitioning(true);
    const nextIdx = idx + 1;
    const token = flowTokenRef.current;
    if (recorderActive) {
      // Defer the index bump until onstop has saved the blob for this question.
      pendingAdvanceRef.current = nextIdx;
      try {
        recorder!.stop();
      } catch {
        pendingAdvanceRef.current = null;
        currentIndexRef.current = nextIdx;
        transitionTimeoutRef.current = setTimeout(() => {
          if (token !== flowTokenRef.current) return;
          setCurrentIndex(nextIdx);
          setCanFinish(false);
          setIsTransitioning(false);
          advancingRef.current = false;
          startQuestionFlow();
        }, 300);
      }
    } else {
      // No active recorder (nothing to save) — advance immediately.
      currentIndexRef.current = nextIdx;
      transitionTimeoutRef.current = setTimeout(() => {
        if (token !== flowTokenRef.current) return;
        setCurrentIndex(nextIdx);
        setCanFinish(false);
        setIsTransitioning(false);
        advancingRef.current = false;
        startQuestionFlow();
      }, 300);
    }
  }, [partType]);

  // Coming back to a hidden tab: recompute the remaining time immediately from
  // the real deadline. If it already elapsed, stop the recording right away so
  // no over-length audio is ever graded.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (speakEndAtRef.current != null) {
        const remaining = Math.max(0, Math.ceil((speakEndAtRef.current - now) / 1000));
        setSpeakTimeLeft(remaining);
        if (remaining <= 0) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          speakEndAtRef.current = null;
          doStopAndAdvance();
        }
        return;
      }
      if (prepEndAtRef.current != null) {
        const remaining = Math.max(0, Math.ceil((prepEndAtRef.current - now) / 1000));
        setPrepTimeLeft(remaining);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [doStopAndAdvance]);

  const handleFinishRecording = useCallback(() => {
    if (!canFinish) return;
    doStopAndAdvance();
  }, [canFinish, doStopAndAdvance]);

  const handleFinish = async () => {
    // Guard: ensure onComplete fires exactly once per part
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Full-skill flow: parent grades & shows results at the end. Hand off the
    // raw recordings + grading specs and immediately advance — no per-part
    // DB save, no in-engine grading, no "done" screen here.
    if (fullFlow) {
      const effectiveRecordings = recordingsRef.current.map((blob, index) =>
        silentByQuestionRef.current[index] ? null : blob,
      );
      if (!effectiveRecordings.some(Boolean)) {
        setV2Error(
          "Không nhận được âm thanh từ micro. Bài này không được chấm và không bị trừ lượt. Hãy kiểm tra micro rồi thu lại.",
        );
        setIsGrading(false);
        setPhase("done");
        return;
      }
      try {
        const specs = buildSpeakingGradingSpecs(partType, { part1Data, part2Data, part3Data, part4Data });
        const items: SpeakingPartSubmissionItem[] = await Promise.all(
          specs.map(async (spec, idx) => {
            const blob = effectiveRecordings[idx] ?? null;
            const audioBase64 = blob ? await blobToBase64(blob).catch(() => null) : null;
            return {
              spec,
              audioBase64,
              audioUrl: blob ? (recordings[idx] ?? URL.createObjectURL(blob)) : null,
              blob,
              actualSpoken: durationsRef.current[idx] ?? 0,
            };
          }),
        );
        onPartSubmissions?.({
          partType,
          partNumber: PART_NUMBERS[partType],
          items,
          // Real question texts (Part 4: all 3 sub-questions, one recording).
          questions: getPromptList(),
        });
      } catch (e) {
        console.warn("[SpeakingExamEngine] fullFlow submission build failed", e);
      }
      onComplete?.();
      return;
    }

    // Create the aggregate test_results row FIRST so each recording can be linked
    // by test_result_id (review page no longer relies on time-window matching).
    const promptsList: string[] = getPromptList();

    try {
      const { buildReviewSnapshot } = await import("@/lib/reviewSnapshot");
      const { buildSpeakingItems, computeScaleAndBand } = await import("@/lib/reviewItemsBuilder");
      const partData =
        partType === "part1" ? { part1Data }
        : partType === "part2" ? { part2Data }
        : partType === "part3" ? { part3Data }
        : { part4Data };
      const itemCount = Math.max(sourceQuestionIds?.length || 0, promptsList.length, recordingsRef.current.length);
      const specs = Array.from({ length: itemCount }, (_, idx) => ({
        questionText: promptsList[idx] || `Question ${idx + 1}`,
        recordingPath: null,
        ai: null,
      }));
      const items = buildSpeakingItems(specs);
      const { scaled50, band } = computeScaleAndBand("speaking", 0, itemCount);
      const snap = buildReviewSnapshot({
        skill: "speaking",
        part: partType,
        testTitle,
        score: 0,
        total: itemCount || 1,
        scaled50, band,
        items,
        raw: { partType, ...partData, sourceQuestionIds, recordingCount: recordingsRef.current.length },
      });
      if (sourceQuestionIds && sourceQuestionIds.length > 0) {
        const perQuestion = sourceQuestionIds.map((qid, idx) => ({
          exam_question_id: qid,
          user_answer: recordingsRef.current[idx] && !silentByQuestionRef.current[idx] ? "(recorded)" : null,
          is_correct: false,
        }));
        const trid = await saveExamResult({
          examSetId: examSetId ?? null,
          skill: "speaking",
          correct: 0,
          total: sourceQuestionIds.length,
          perQuestion,
          fullTestSessionId: fullTestSessionId ?? null,
          fullTestId: fullTestId ?? null,
          reviewSnapshot: snap,
        });
        testResultIdRef.current = trid;
      } else {
        const trid = await saveExamResult({
          examSetId: examSetId ?? null,
          skill: "speaking",
          correct: 0,
          total: 1,
          fullTestSessionId: fullTestSessionId ?? null,
          fullTestId: fullTestId ?? null,
          reviewSnapshot: snap,
        });
        testResultIdRef.current = trid;
      }
      // Back-fill test_result_id on speaking_recordings saved during this part
      try {
        if (testResultIdRef.current && examSetId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await supabase.from("speaking_recordings")
              .update({ test_result_id: testResultIdRef.current })
              .eq("user_id", user.id)
              .eq("exam_set_id", examSetId)
              .is("test_result_id", null)
              .gte("created_at", sessionStartIsoRef.current);
          }
        }
      } catch { /* swallow */ }
    } catch { /* swallow */ }

    // Best-effort upload of all recordings — never block UI on failure. Collect paths
    // so we can bake them into the snapshot items.
    const uploadedPaths: (string | null)[] = [];
    try {
      const currentRecordings = recordingsRef.current.map((blob, index) =>
        silentByQuestionRef.current[index] ? null : blob,
      );
      await Promise.all(
        currentRecordings.map(async (blob, idx) => {
          if (!blob) { uploadedPaths[idx] = null; return; }
          try {
            const path = await saveSpeakingRecording({
              examSetId: examSetId ?? null,
              part: `${partType}_q${idx + 1}`,
              blob,
              durationSeconds: durationsRef.current[idx] ?? undefined,
              testResultId: testResultIdRef.current,
            });
            uploadedPaths[idx] = path;
          } catch { uploadedPaths[idx] = null; }
        })
      );
    } catch { /* swallow */ }

    // Bake recordingPath into snapshot items now that uploads are done.
    try {
      if (testResultIdRef.current) {
        const { mergeSnapshotAI } = await import("@/lib/reviewItemsBuilder");
        const aiByIndex: Record<number, any> = {};
        uploadedPaths.forEach((p, idx) => {
          if (p) aiByIndex[idx] = { recordingPath: p };
        });
        if (Object.keys(aiByIndex).length > 0) {
          await mergeSnapshotAI(testResultIdRef.current, aiByIndex);
        }
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
    flowTokenRef.current += 1;
    try { stopTTS(); } catch { /* noop */ }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    if (transitionTimeoutRef.current) { clearTimeout(transitionTimeoutRef.current); transitionTimeoutRef.current = null; }
    stopVolumeMeasurement();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      suppressRecordingSaveRef.current = true;
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowExitConfirm(false);
    onExit();
  };

  // ===== Admin-only controls: skip current part / go to previous part =====
  const stopEverything = (suppressCurrentRecording = false) => {
    flowTokenRef.current += 1;
    try { stopTTS(); } catch (e) { console.warn("[SpeakingExamEngine] stopTTS failed:", e); }
    try { window.speechSynthesis?.cancel(); } catch (e) { console.warn("[SpeakingExamEngine] speechSynthesis.cancel failed:", e); }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    stopVolumeMeasurement();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      suppressRecordingSaveRef.current = suppressCurrentRecording;
      try { mediaRecorderRef.current.stop(); } catch (e) { console.warn("[SpeakingExamEngine] mediaRecorder.stop failed:", e); }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Skip → advance to the NEXT question (page) within the current part.
  // If already on the last question, finish the part (calls onComplete normally).
  const handleAdminSkip = () => {
    if (adminNavLockedRef.current) return;
    adminNavLockedRef.current = true;
    window.setTimeout(() => { adminNavLockedRef.current = false; }, 450);
    if (phase === "start") {
      setPhase("instructions");
      return;
    }
    if (phase === "instructions") {
      setPhase("prompt");
      return;
    }
    if (phase === "prompt") {
      stopEverything(true);
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      advancingRef.current = false;
      finishedRef.current = false;
      setCanFinish(false);
      setIsTransitioning(false);
      window.setTimeout(() => { startQuestionFlow(); }, 100);
      return;
    }
    if (phase === "grading" || phase === "done") return;
    stopEverything(true);
    const total = getTotalQuestions();
    const idx = currentIndexRef.current;
    if (idx < total - 1) {
      const nextIdx = idx + 1;
      currentIndexRef.current = nextIdx;
      advancingRef.current = false;
      finishedRef.current = false;
      setCurrentIndex(nextIdx);
      setCanFinish(false);
      setIsTransitioning(false);
      setPhase("reading-question");
      window.setTimeout(() => { startQuestionFlow(); }, 100);
    } else {
      // Last question → finish part normally with whatever was recorded
      handleFinish();
    }
  };

  // Back → return to the PREVIOUS question (page) within the current part.
  // If already on the first question, jump to the previous part (admin only, full test).
  const handleAdminBack = () => {
    if (adminNavLockedRef.current) return;
    adminNavLockedRef.current = true;
    window.setTimeout(() => { adminNavLockedRef.current = false; }, 450);
    if (phase === "instructions") {
      setPhase("start");
      return;
    }
    if (phase === "prompt") {
      if (skipIntro && onAdminPrevious) onAdminPrevious();
      else setPhase("instructions");
      return;
    }
    if (phase === "start" || phase === "grading" || phase === "done") return;
    stopEverything(true);
    const idx = currentIndexRef.current;
    if (idx > 0) {
      const prevIdx = idx - 1;
      currentIndexRef.current = prevIdx;
      advancingRef.current = false;
      finishedRef.current = false;
      setCurrentIndex(prevIdx);
      setCanFinish(false);
      setIsTransitioning(false);
      setPhase("reading-question");
      window.setTimeout(() => { startQuestionFlow(); }, 100);
    } else if (onAdminPrevious) {
      onAdminPrevious();
    }
  };

  const adminBackHandler = (() => {
    if (phase === "start" || phase === "grading" || phase === "done") return undefined;
    if (phase === "instructions") return handleAdminBack;
    if (phase === "prompt") return (skipIntro && onAdminPrevious) || !skipIntro ? handleAdminBack : undefined;
    return currentIndex > 0 || onAdminPrevious ? handleAdminBack : undefined;
  })();

  const adminControls = phase !== "grading" && phase !== "done" ? (
    <AdminExamControls
      onSkip={handleAdminSkip}
      onBack={adminBackHandler}
      label={`Speaking Part ${partNumber} · Câu ${currentIndex + 1}/${getTotalQuestions() || 1}`}
    />
  ) : null;

  // ============ RENDER ============
  const exitDialog = (
    <>
      {adminControls}
      {showExitConfirm && (
        <ExamFinishScreen
          title="Submit Test?"
          message="Once you submit your test you will no longer have access to the questions."
          buttonText="Submit test"
          cancelText="Cancel"
          onSubmit={handleConfirmExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </>
  );

  // Start Assessment (info) screen
  if (phase === "start") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <RotateDeviceOverlay />
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
            onClick={() => { unlockAudio(); setPhase("instructions"); }}
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
        <RotateDeviceOverlay />
        <SpeakingHeader partLabel={`Speaking`} partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 flex items-start justify-center px-4 pt-6 sm:pt-12 pb-28 sm:pb-24">
          <div className="bg-white rounded-xl shadow-sm max-w-xl w-full p-8">
            <p className="text-xs text-gray-500">Aptis General Practice Test</p>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Speaking Practice Test – {testTitle}</h2>
            <p className="text-sm text-gray-500 mb-1">Number of Questions</p>
            <p className="text-lg font-bold text-gray-900 mb-4">{getTotalQuestions()}</p>
            <p className="text-sm font-bold text-gray-900 mb-4">Assessment Description</p>
            <SpeakingMicCheck />
            <button
              onClick={() => { unlockAudio(); setPhase("instructions"); }}
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
        <RotateDeviceOverlay />
        <div className="flex-1 flex items-start justify-center px-4 pt-6 sm:pt-12 pb-28 sm:pb-24">
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
          onNext={() => { unlockAudio(); setPhase("prompt"); }}
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

  // Grading / Done — V2 5-criteria profile
  if (phase === "grading" || phase === "done") {
    const itemsForView = v2Result
      ? v2Result.perItem.map((it, i) => ({
          questionText: it.questionText,
          transcript: it.transcript,
          onTopic: it.onTopic,
          improvedVersion: it.improvedVersion,
          upgradeTips: it.upgradeTips,
          audioUrl: recordings[i] ?? null,
        }))
      : [];

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RotateDeviceOverlay />
        <SpeakingHeader partLabel="Speaking" partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
        <div className="flex-1 px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                Bài Speaking đã được nộp
              </h2>
              <p className="text-sm text-muted-foreground">
                Cảm ơn bạn đã hoàn thành Speaking Part {partNumber}.
              </p>
            </div>

            {!v2Result && !v2Error && (queuePending || queueTimedOut) && !fullFlow && (
              <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
                {queueTimedOut ? (
                  <p className="text-sm text-muted-foreground">
                    Bài đã lưu và đang chờ chấm. Vui lòng xem lại trong Lịch sử sau ít phút.
                  </p>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>
                      AI Kỳ Tích đang chấm bài nói của bạn — thường mất 1–3 phút. Bạn có thể thoát ra
                      làm đề khác, kết quả sẽ có trong Lịch sử làm bài.
                    </span>
                  </div>
                )}
                <button
                  onClick={onExit}
                  className="bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
                >
                  Thoát
                </button>
              </div>
            )}

            {isGrading && fullFlow && !v2Result && !v2Error && (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI Kỳ Tích đang chấm... Đừng thoát hay đổi tab nha.
                </div>
              </div>
            )}


            {v2Error && (
              <div className="bg-card border border-rose-500/30 rounded-2xl p-6 text-center">
                <p className="text-sm text-rose-600 dark:text-rose-400">{v2Error}</p>
              </div>
            )}

            {quotaModal && (
              <UpgradeLock
                asModal
                open
                onOpenChange={(v) => { if (!v) setQuotaModal(null); }}
                reason="quota_exceeded"
                need="pro"
                featureLabel="Chấm bài bằng AI"
                freeQuota={quotaModal.cap}
                used={quotaModal.used}
                remaining={0}
                resetNote={
                  quotaModal.tier === "free"
                    ? "Tài khoản miễn phí có 3 lượt chấm AI (không reset). Bản ghi âm của bạn đã được lưu."
                    : `Trần ${quotaModal.cap} lượt/ngày — reset lúc 00:00. Bản ghi âm của bạn đã được lưu.`
                }
              />
            )}


            {v2Result && (
              <SpeakingProfileView
                bands={v2Result.bands}
                items={itemsForView}
                analysis={v2Result.analysis}
                criteriaAnalysis={v2Result.criteriaAnalysis}
                improvedVersion={v2Result.improvedVersion}
                fullTranscript={(v2Result as any).fullTranscript}
                scale50={v2Scale}
                cefr={v2Cefr}
                partLabel={`Part ${partNumber}`}
                sampleAnswers={
                  partType === "part1" ? part1Data?.sampleAnswers
                  : partType === "part2" ? part2Data?.sampleAnswers
                  : partType === "part3" ? part3Data?.sampleAnswers
                  : part4Data?.sampleAnswers
                }
                sharedSample={partType === "part4"}

              />
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onExit}
                className="bg-card border border-border hover:bg-muted/50 text-foreground rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Quay lại danh sách đề
              </button>
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
      <RotateDeviceOverlay />
      {micError && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center px-4">
          <div role="alertdialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-gray-900 mb-1">Vấn đề với micro</h3>
                <p className="text-sm text-gray-700">{micError}</p>
                <p className="text-xs text-gray-500 mt-2">Đồng hồ đã tạm dừng cho đến khi bạn ghi lại.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setMicError(null); startRecording(); }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      )}
      <SpeakingHeader partLabel={`Speaking Part ${partNumber}`} partNumber={partNumber} totalParts={totalParts} onExit={handleExit} />
      <ExamReportButton
        examQuestionId={sourceQuestionIds?.[currentIndex] ?? sourceQuestionIds?.[0] ?? null}
        examSetId={examSetId ?? null}
        skill="speaking"
        partType={partType}
        questionNumber={currentIndex + 1}
      />
      {allowReveal && (
        <RevealAnswerButton revealed={revealed} onToggle={() => setRevealed(v => !v)} />
      )}
      {canUseScratchpad && (
        <OutlineBuilderButton
          open={outlineOpen}
          onToggle={() => setOutlineOpen(v => !v)}
        />
      )}
      {canUseScratchpad && outlineOpen && (
        <SpeakingScratchpad
          outlineB1={activeOutline?.outlineB1 ?? null}
          outlineB2={activeOutline?.outlineB2 ?? null}
          currentQuestion={currentIndex}
          note={scratchNote}
          onNoteChange={setScratchNote}
          onClose={() => setOutlineOpen(false)}
        />
      )}

      <div className="fixed bottom-[76px] right-3 z-40">
        <AiQuotaBadge className="shadow-sm bg-white/95" />
      </div>



      <div className="flex-1 flex px-4 pt-4 sm:pt-8 pb-28 sm:pb-24 gap-6 max-w-6xl mx-auto w-full">
        {/* Left: Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-8 sm:min-h-[400px]">
            <p className="text-xs text-gray-500 mb-1">Speaking</p>
            <p className="text-sm font-bold text-gray-900 mb-6">
              {(partType === "part1" || partType === "part2" || partType === "part3") ? "Question" : "Part"} {(partType === "part1" || partType === "part2" || partType === "part3") ? currentIndex + 1 : partNumber} of {getTotalQuestions() > 1 ? getTotalQuestions() : totalParts}
            </p>

            {/* Part 2 image */}
            {partType === "part2" && (
              <div className="mb-4">
                {part2Data?.imageUrl ? (
                  <SignedImage
                    src={part2Data.imageUrl}
                    alt="Describe this picture"
                    className="w-full max-w-md rounded-lg object-cover"
                  />
                ) : (
                  <MissingMediaNotice kind="image" skill="speaking" partType="part2" questionNumber={currentIndex + 1} />
                )}
              </div>
            )}

            {/* Part 3 two images side by side */}
            {partType === "part3" && part3Data && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {part3Data.imageUrl1 ? (
                  <SignedImage
                    src={part3Data.imageUrl1}
                    alt="Picture 1"
                    className="w-full rounded-lg object-cover h-[min(30vh,14rem)]"
                  />
                ) : (
                  <MissingMediaNotice kind="image" skill="speaking" partType="part3" questionNumber={1} />
                )}
                {part3Data.imageUrl2 ? (
                  <SignedImage
                    src={part3Data.imageUrl2}
                    alt="Picture 2"
                    className="w-full rounded-lg object-cover h-[min(30vh,14rem)]"
                  />
                ) : (
                  <MissingMediaNotice kind="image" skill="speaking" partType="part3" questionNumber={2} />
                )}
              </div>
            )}

            {/* Part 4 topic + image + questions */}
            {partType === "part4" && part4Data && (
              <div className="bg-gray-50 rounded-lg p-5 mb-4">
                <p className="font-bold text-gray-900 mb-3">Topic: {part4Data.topic}</p>
                {part4Data.imageUrl ? (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 max-w-md">
                    <SignedImage
                      src={part4Data.imageUrl}
                      alt="Part 4 topic"
                      className="w-full h-[min(30vh,14rem)] object-cover"
                    />
                  </div>

                ) : (
                  <MissingMediaNotice
                    kind="image"
                    skill="speaking"
                    partType="part4"
                    questionNumber={1}
                    examSetId={examSetId ?? null}
                  />
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
            {isReading && (
              <p className="text-xs text-gray-400 mt-3 animate-pulse">
                Chuẩn bị ghi âm…
              </p>
            )}
          </div>






          {allowReveal && revealed && (() => {
            const pair = (() => {
              if (partType === "part1") return part1Data?.sampleAnswers?.[currentIndex];
              if (partType === "part2") return part2Data?.sampleAnswers?.[currentIndex];
              if (partType === "part3") return part3Data?.sampleAnswers?.[currentIndex];
              if (partType === "part4") return part4Data?.sampleAnswers?.[0];
              return undefined;
            })();
            const basic = (pair?.basic || "").trim();
            const advanced = (pair?.advanced || "").trim();
            // Auto-fall back to the other variant when the selected one is empty.
            const effectiveLevel =
              sampleLevel === "basic" && !basic && advanced
                ? "advanced"
                : sampleLevel === "advanced" && !advanced && basic
                ? "basic"
                : sampleLevel;
            const sample = effectiveLevel === "advanced" ? advanced : basic;
            const words = sample.trim().split(/\s+/).filter(Boolean).length;
            const speakTime =
              partType === "part1" ? part1Data?.speakTime
              : partType === "part2" ? part2Data?.speakTime
              : partType === "part3" ? part3Data?.speakTime
              : part4Data?.speakTime;
            const cardCls = (active: boolean) =>
              `flex-1 text-left rounded-xl border p-3 transition-colors ${
                active
                  ? "bg-[#24085a] text-white border-[#24085a]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`;
            return (
              <div className="mt-4 bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#24085a]">
                <p className="text-xs font-bold text-[#24085a] uppercase tracking-wide mb-3">
                  💡 Bài nói mẫu
                </p>
                <div className="flex gap-3 mb-4">
                  <button type="button" onClick={() => setSampleLevel("basic")} className={cardCls(effectiveLevel === "basic")}>
                    <span className="block text-sm font-bold">Bản dễ học</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">Phù hợp aim B1</span>
                  </button>
                  <button type="button" onClick={() => setSampleLevel("advanced")} className={cardCls(effectiveLevel === "advanced")}>
                    <span className="block text-sm font-bold">Bản nâng cao</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">Phù hợp aim B2 trở lên · câu phong phú hơn</span>
                  </button>
                </div>
                {sample ? (
                  <>
                    <p className="text-sm text-gray-900 font-medium whitespace-pre-line leading-relaxed">{sample}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {words} từ · nói vừa đủ {speakTime ?? 120} giây
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">Chưa có bài nói mẫu cho bản này.</p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right: Timer panel */}
        <div className="w-[220px] shrink-0">
          {isReading ? (
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[260px]">
              <div className="w-16 h-16 rounded-full bg-[#24085a]/10 flex items-center justify-center mb-4 animate-pulse">
                <span className="text-3xl">🔊</span>
              </div>
              <p className="text-sm font-semibold text-[#24085a] text-center">
                Instructions...
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                Nghe xong sẽ có tiếng bíp rồi bắt đầu ghi âm
              </p>
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
