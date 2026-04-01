import { Mic, Square, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";

interface AudioRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
  audioUrl?: string | null;
  timeLeft: number;
  totalTime: number;
  label?: string;
  micError?: string | null;
  isRequestingMic?: boolean;
}

const AudioRecorder = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled,
  audioUrl,
  timeLeft,
  totalTime,
  label = "Ghi âm",
  micError,
  isRequestingMic,
}: AudioRecorderProps) => {
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-heading font-bold text-foreground">{label}</span>
        <span className={`text-sm font-heading font-bold tabular-nums ${
          timeLeft <= 10 ? "text-destructive" : "text-foreground"
        }`}>
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full bg-muted rounded-full mb-5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isRecording ? "bg-destructive" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Mic error */}
      {micError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{micError}</AlertDescription>
        </Alert>
      )}

      {/* Recording controls */}
      <div className="flex flex-col items-center gap-3">
        {!isRecording && !audioUrl && (
          <>
            {isRequestingMic ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Đang yêu cầu quyền microphone...</span>
              </div>
            ) : (
              <>
                <Button
                  onClick={onStartRecording}
                  disabled={disabled}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2 px-6"
                >
                  <Mic className="w-4 h-4" />
                  Bắt đầu ghi âm
                </Button>
                {!micError && (
                  <p className="text-xs text-muted-foreground text-center">
                    Nhấn nút và cho phép truy cập microphone khi trình duyệt yêu cầu
                  </p>
                )}
              </>
            )}
          </>
        )}

        {isRecording && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-3 h-3 rounded-full bg-destructive"
              />
              <span className="text-sm font-medium text-destructive">Đang ghi âm...</span>
            </div>
            <Button
              onClick={onStopRecording}
              variant="outline"
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Dừng
            </Button>
          </div>
        )}

        {audioUrl && !isRecording && (
          <div className="w-full">
            <audio src={audioUrl} controls className="w-full h-10" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
