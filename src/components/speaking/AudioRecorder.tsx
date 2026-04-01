import { Mic, Square, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import VolumeIndicator from "@/components/speaking/VolumeIndicator";

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
  recordingElapsed?: number;
  stream?: MediaStream | null;
  minRecordingTime?: number; // seconds before Finish is allowed
}

const AudioRecorder = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled,
  audioUrl,
  timeLeft,
  totalTime,
  label = "Your Answer",
  micError,
  isRequestingMic,
  recordingElapsed = 0,
  stream = null,
  minRecordingTime = 10,
}: AudioRecorderProps) => {
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const canFinish = recordingElapsed >= minRecordingTime;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Mic error */}
      {micError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{micError}</AlertDescription>
        </Alert>
      )}

      {/* Not recording, no audio yet */}
      {!isRecording && !audioUrl && (
        <div className="flex flex-col items-center gap-4 py-4">
          {isRequestingMic ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Đang yêu cầu quyền microphone...</span>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-700 mb-1">Preparation Time</p>
                <p className="text-3xl font-mono font-extrabold tabular-nums text-gray-800">
                  {formatTime(timeLeft)}
                </p>
              </div>
              <div className="h-2 w-full max-w-xs bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-blue-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {!disabled && !micError && (
                <Button
                  onClick={onStartRecording}
                  className="gap-2 px-6 mt-2"
                  style={{ backgroundColor: "#24085a" }}
                >
                  <Mic className="w-4 h-4" />
                  Bắt đầu ghi âm
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Recording state */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-3.5 h-3.5 rounded-full bg-red-600"
            />
            <span className="text-base font-bold text-red-600">Recording</span>
          </div>

          <p className="text-3xl font-mono font-extrabold tabular-nums text-gray-800">
            {formatTime(timeLeft)}
          </p>

          {/* Progress bar */}
          <div className="h-2 w-full max-w-xs bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-red-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Volume indicator */}
          <div className="flex flex-col items-center gap-1">
            <VolumeIndicator stream={stream} />
            <span className="text-[10px] text-gray-400">Mic đang nhận âm thanh</span>
          </div>

          {/* Finish Recording button - hidden for first N seconds */}
          <div className="h-10 flex items-center">
            {canFinish ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Button
                  onClick={onStopRecording}
                  variant="outline"
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Square className="w-3.5 h-3.5" />
                  Finish Recording
                </Button>
              </motion.div>
            ) : (
              <p className="text-xs text-gray-400">
                Finish Recording sẽ khả dụng sau {minRecordingTime - recordingElapsed}s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Playback */}
      {audioUrl && !isRecording && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm font-bold text-green-600">✓ Đã ghi âm xong</p>
          <audio src={audioUrl} controls className="w-full max-w-md h-10" />
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
