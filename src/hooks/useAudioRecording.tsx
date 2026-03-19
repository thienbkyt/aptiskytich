import { useState, useRef, useEffect, useCallback } from "react";

interface UseAudioRecordingOptions {
  maxDuration: number;
  onComplete: (url: string) => void;
  questionKey: string | number;
  autoStart?: boolean;
}

export const useAudioRecording = ({
  maxDuration,
  onComplete,
  questionKey,
  autoStart = false,
}: UseAudioRecordingOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);

  // Reset on question change
  useEffect(() => {
    setIsRecording(false);
    setAudioUrl(null);
    setTimeLeft(maxDuration);
    autoStartedRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [questionKey, maxDuration]);

  // Auto-start recording
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && !audioUrl) {
      autoStartedRef.current = true;
      // Small delay to let UI render
      const timeout = setTimeout(() => startRecording(), 500);
      return () => clearTimeout(timeout);
    }
  }, [autoStart, audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onComplete(url);
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimeLeft(maxDuration);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [maxDuration, onComplete, stopRecording]);

  return {
    isRecording,
    audioUrl,
    timeLeft,
    startRecording,
    stopRecording,
  };
};
