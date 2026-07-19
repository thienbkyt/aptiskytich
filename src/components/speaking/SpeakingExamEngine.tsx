import { useState, useEffect, useCallback, useRef } from "react";
import { useExitWarning } from "@/hooks/useExitWarning";
import SpeakingHeader from "./SpeakingHeader";
import BottomNavBar from "@/components/reading/BottomNavBar";
import ExamFinishScreen from "@/components/exam/ExamFinishScreen";
import CircularTimer from "./CircularTimer";
import SpeakingPromptScreen from "./SpeakingPromptScreen";
import SpeakingMicCheck from "./SpeakingMicCheck";
import SignedImage from "@/components/exam/SignedImage";
import MissingMediaNotice from "@/components/exam/MissingMediaNotice";
import { speakAsync as ttsSpeakAsync, stopTTS, unlockAudio } from "@/lib/tts";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { saveSpeakingRecording, saveExamResult } from "@/lib/saveExamResult";
import { supabase } from "@/integrations/supabase/client";
import { safeText } from "@/lib/safeText";
import AdminExamControls from "@/components/exam/AdminExamControls";
import ExamReportButton from "@/components/exam/ExamReportButton";
import RevealAnswerButton from "@/components/exam/RevealAnswerButton";

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

import SpeakingProfileView from "./SpeakingProfileView";

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

/** Play a short beep using Web Audio API */
function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, 700); // safety latch: proceed even if onended never fires (iOS)
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
      osc.onended = () => { try { ctx.close(); } catch {} finish(); };
    } catch { finish(); }
  });
}

/** Speak text using Google Cloud TTS (from src/lib/tts.ts) */
function speakAsync(text: string): Promise<void> {
  return ttsSpeakAsync(text, "en");
}

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
  // Mic failure (permission denied / device removed) — pauses timer + shows retry UI.
  const [micError, setMicError] = useState<string | null>(null);
  const [v2Result, setV2Result] = useState<SpeakingPartResultV2 | null>(null);
  const [v2Scale, setV2Scale] = useState<number | null>(null);
  const [v2Cefr, setV2Cefr] = useState<string | null>(null);
  const [v2Error, setV2Error] = useState<string | null>(null);

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
  // When true, the next onstop should trigger handleFinish after writing the blob.
  const finishAfterStopRef = useRef(false);
  // When non-null, onstop should advance to this question index after writing the blob.
  const pendingAdvanceRef = useRef<number | null>(null);





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

  // Image resolution is handled by <SignedImage /> directly.

  // Initialize recordings array
  useEffect(() => {
    const total = getTotalQuestions();
    setRecordings(new Array(total).fill(null));
    recordingsRef.current = new Array(total).fill(null);
    durationsRef.current = new Array(total).fill(null);
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
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Single-part mode: when phase becomes "done", grade via NEW V2 system (5-criteria profile).
  // Legacy per-item grading is intentionally disabled for single-part mode (replaced by V2).
  useEffect(() => {
    if (fullFlow) return;
    if (phase !== "done" || v2RanRef.current) return;
    v2RanRef.current = true;

    const promptsList: string[] = (() => {
      if (partType === "part1" && part1Data) return part1Data.questions || [];
      if (partType === "part2" && part2Data) return part2Data.questions || [part2Data.prompt];
      if (partType === "part3" && part3Data) return part3Data.questions || [part3Data.prompt];
      if (partType === "part4" && part4Data) return part4Data.questions?.length ? part4Data.questions : [part4Data.topic];
      return [];
    })();
    const blobs = recordingsRef.current.slice();
    const questions = promptsList.map((q) => ({ questionText: q }));

    setIsGrading(true);
    setV2Error(null);
    (async () => {
      try {
        const result = await gradeSpeakingPartV2(partType, questions, blobs, {
          testResultId: testResultIdRef.current ?? null,
          examSetId: examSetId ?? null,
          fullTestSessionId: fullTestSessionId ?? null,
        });
        // Merge questionText back into per-item results for display.
        const mergedPerItem = (result.perItem || []).map((it, i) => ({
          ...it,
          questionText: safeText(it.questionText) || safeText(promptsList[i]) || `Question ${i + 1}`,
          transcript: safeText((it as any).transcript),
          improvedVersion: safeText((it as any).improvedVersion),
          upgradeTips: safeText((it as any).upgradeTips),
        }));

        const finalResult: SpeakingPartResultV2 = { ...result, perItem: mergedPerItem };
        setV2Result(finalResult);

        // Compute scale50 + CEFR for this single part using the finalize edge.
        // Trick: pass rawPart in all 4 slots so the server math (rawTotal/126*50)
        // collapses to rawPart/30*50 — i.e. percent = round(rawPart/30 * 100).
        let scale50Out = Math.round((Number(finalResult.rawPart || 0) / 30) * 50);
        let cefrOut = "";
        let greyOut = false;
        let flagOut = false;
        try {
          const fin = await finalizeSpeaking({
            part1: finalResult.rawPart,
            part2: finalResult.rawPart,
            part3: finalResult.rawPart,
            part4: finalResult.rawPart,
          });
          scale50Out = Number(fin.scale50 ?? scale50Out);
          cefrOut = fin.cefr || "";
          greyOut = !!fin.greyZone;
          flagOut = !!fin.flagReview;
        } catch (e) {
          console.warn("[Speaking V2] finalize (single part) failed:", e);
        }
        setV2Scale(scale50Out);
        setV2Cefr(cefrOut);

        // Best-effort save to speaking_skill_results (parts contains only this part).
        try {
          await saveSpeakingSkillResult({
            testResultId: testResultIdRef.current,
            examSetId: examSetId ?? null,
            fullTestSessionId: fullTestSessionId ?? null,
            parts: {
              [partType]: {
                bands: finalResult.bands,
                items: mergedPerItem,
                analysis: finalResult.analysis,
                criteriaAnalysis: finalResult.criteriaAnalysis,
                feedback: finalResult.feedback,
                improvedVersion: finalResult.improvedVersion,
                rawPart: finalResult.rawPart,
              },
            },
            rawTotal: finalResult.rawPart || 0,
            scale50: scale50Out,
            cefr: cefrOut,
            greyZone: greyOut,
            flagReview: flagOut,
            feedback: finalResult.feedback,
          });
        } catch (e) {
          console.warn("[Speaking V2] save skill result failed:", e);
        }

      } catch (e: any) {
        console.error("[Speaking V2] grading failed:", e);
        setV2Error(e?.message || "AI Kỳ Tích chưa chấm được phần này. Vui lòng thử lại sau.");
      } finally {
        setIsGrading(false);
      }
    })();
  }, [phase, fullFlow, partType, part1Data, part2Data, part3Data, part4Data, examSetId, fullTestSessionId]);



  // Read question aloud, beep, then start prep/recording
  const startQuestionFlow = useCallback(async () => {
    const token = ++flowTokenRef.current;
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
    if (token !== flowTokenRef.current) {
      console.warn("[Speaking] flow aborted - stale token after speakAsync");
      return;
    }

    const prepTime = getPrepTime();
    // Beep after reading question: signals start of prep (if any) or start of recording
    await playBeep();
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
    timerRef.current = setInterval(() => {
      setPrepTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          // Beep right before recording starts (prep just ended)
          playBeep().then(() => {
            startRecording();
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
        const url = URL.createObjectURL(blob);
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
      try {
        const specs = buildSpeakingGradingSpecs(partType, { part1Data, part2Data, part3Data, part4Data });
        const items: SpeakingPartSubmissionItem[] = await Promise.all(
          specs.map(async (spec, idx) => {
            const blob = recordingsRef.current[idx] ?? null;
            const audioBase64 = blob ? await blobToBase64(blob).catch(() => null) : null;
            return {
              spec,
              audioBase64,
              audioUrl: recordings[idx] ?? (blob ? URL.createObjectURL(blob) : null),
              blob,
              actualSpoken: durationsRef.current[idx] ?? 0,
            };
          }),
        );
        onPartSubmissions?.({
          partType,
          partNumber: PART_NUMBERS[partType],
          items,
        });
      } catch (e) {
        console.warn("[SpeakingExamEngine] fullFlow submission build failed", e);
      }
      onComplete?.();
      return;
    }

    // Create the aggregate test_results row FIRST so each recording can be linked
    // by test_result_id (review page no longer relies on time-window matching).
    const promptsList: string[] = (() => {
      if (partType === "part1" && part1Data) return part1Data.questions || [];
      if (partType === "part2" && part2Data) return part2Data.questions || [part2Data.prompt];
      if (partType === "part3" && part3Data) return part3Data.questions || [part3Data.prompt];
      if (partType === "part4" && part4Data) return part4Data.questions || [part4Data.topic];
      return [];
    })();
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
          user_answer: recordingsRef.current[idx] ? "(recorded)" : null,
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
      const currentRecordings = recordingsRef.current;
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
    try { stopTTS(); } catch { /* noop */ }
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
    if (transitionTimeoutRef.current) { clearTimeout(transitionTimeoutRef.current); transitionTimeoutRef.current = null; }
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

  // ===== Admin-only controls: skip current part / go to previous part =====
  const stopEverything = (suppressCurrentRecording = false) => {
    flowTokenRef.current += 1;
    try { stopTTS(); } catch (e) { console.warn("[SpeakingExamEngine] stopTTS failed:", e); }
    try { window.speechSynthesis?.cancel(); } catch (e) { console.warn("[SpeakingExamEngine] speechSynthesis.cancel failed:", e); }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (finishTimerRef.current) { clearTimeout(finishTimerRef.current); finishTimerRef.current = null; }
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

            {isGrading && !v2Result && !v2Error && (
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

            {v2Result && (
              <SpeakingProfileView
                bands={v2Result.bands}
                items={itemsForView}
                analysis={v2Result.analysis}
                criteriaAnalysis={v2Result.criteriaAnalysis}
                improvedVersion={v2Result.improvedVersion}
                scale50={v2Scale}
                cefr={v2Cefr}
                partLabel={`Part ${partNumber}`}

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
                    className="w-full rounded-lg object-cover h-56"
                  />
                ) : (
                  <MissingMediaNotice kind="image" skill="speaking" partType="part3" questionNumber={1} />
                )}
                {part3Data.imageUrl2 ? (
                  <SignedImage
                    src={part3Data.imageUrl2}
                    alt="Picture 2"
                    className="w-full rounded-lg object-cover h-56"
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
                {part4Data.imageUrl && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 max-w-md">
                    <SignedImage
                      src={part4Data.imageUrl}
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

          {allowReveal && revealed && (() => {
            const sample = (() => {
              if (partType === "part1") return part1Data?.sampleAnswers?.[currentIndex] || "";
              if (partType === "part2") return part2Data?.sampleAnswers?.[currentIndex] || "";
              if (partType === "part3") return part3Data?.sampleAnswers?.[currentIndex] || "";
              if (partType === "part4") return part4Data?.sampleAnswers?.[0] || "";
              return "";
            })();
            return (
              <div className="mt-4 bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#24085a]">
                <p className="text-xs font-bold text-[#24085a] uppercase tracking-wide mb-2">
                  💡 Bài nói mẫu
                </p>
                {sample ? (
                  <p className="text-sm text-gray-900 font-medium whitespace-pre-line leading-relaxed">{sample}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Chưa có bài nói mẫu.</p>
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
              <p className="text-sm font-semibold text-[#24085a] text-center">Instructions...</p>
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
