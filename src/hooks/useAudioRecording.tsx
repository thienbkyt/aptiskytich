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
  const [micError, setMicError] = useState<string | null>(null);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset on question change
  useEffect(() => {
    setIsRecording(false);
    setAudioUrl(null);
    setTimeLeft(maxDuration);
    setMicError(null);
    setIsRequestingMic(false);
    setRecordingElapsed(0);
    autoStartedRef.current = false;
    streamRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  }, [questionKey, maxDuration]);

  // Auto-start recording
  useEffect(() => {
    if (autoStart && !autoStartedRef.current && !audioUrl) {
      autoStartedRef.current = true;
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
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(null);
    setIsRequestingMic(true);
    setRecordingElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRequestingMic(false);
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
        setAudioUrl(url);
        onComplete(url);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimeLeft(maxDuration);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Track elapsed recording time
      elapsedRef.current = setInterval(() => {
        setRecordingElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setIsRequestingMic(false);
      console.error("Microphone access denied:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setMicError("Quyền truy cập microphone bị từ chối. Vui lòng cho phép trong cài đặt trình duyệt và tải lại trang.");
      } else if (err?.name === "NotFoundError") {
        setMicError("Không tìm thấy microphone. Vui lòng kết nối microphone và thử lại.");
      } else {
        setMicError("Không thể truy cập microphone. Vui lòng kiểm tra thiết bị và thử lại.");
      }
    }
  }, [maxDuration, onComplete, stopRecording]);

  return {
    isRecording,
    audioUrl,
    timeLeft,
    micError,
    isRequestingMic,
    recordingElapsed,
    stream: streamRef.current,
    startRecording,
    stopRecording,
  };
};

/** Check mic permission without starting recording */
export async function checkMicrophoneAccess(): Promise<{ ok: boolean; error?: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (err: any) {
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      return { ok: false, error: "Quyền truy cập microphone bị từ chối. Vui lòng cho phép trong cài đặt trình duyệt." };
    }
    if (err?.name === "NotFoundError") {
      return { ok: false, error: "Không tìm thấy microphone trên thiết bị này." };
    }
    return { ok: false, error: "Không thể truy cập microphone." };
  }
}
