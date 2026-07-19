import { useState } from "react";
import { Mic, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkMicrophoneAccess } from "@/hooks/useAudioRecording";
import { unlockAudio } from "@/lib/tts";

const SpeakingMicCheck = () => {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCheck = async () => {
    setStatus("checking");
    const result = await checkMicrophoneAccess();
    if (result.ok) {
      setStatus("ok");
    } else {
      setStatus("error");
      setErrorMsg(result.error || "Lỗi không xác định");
    }
  };

  return (
    <div className="mt-6 p-4 rounded-lg border border-border bg-card">
      <p className="text-sm font-heading font-bold text-foreground mb-3">Kiểm tra Microphone</p>

      {status === "idle" && (
        <Button onClick={handleCheck} variant="outline" className="gap-2">
          <Mic className="w-4 h-4" />
          Kiểm tra microphone
        </Button>
      )}

      {status === "checking" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Đang kiểm tra...</span>
        </div>
      )}

      {status === "ok" && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Microphone sẵn sàng!</span>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <Button onClick={handleCheck} variant="outline" size="sm" className="gap-2">
            <Mic className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
};

export default SpeakingMicCheck;
