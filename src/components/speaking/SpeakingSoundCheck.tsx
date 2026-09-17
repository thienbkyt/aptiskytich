import { useState } from "react";
import { Volume2, CheckCircle, AlertTriangle } from "lucide-react";
import { playBeep, unlockBeepAudio } from "@/lib/beep";
import { unlockAudio } from "@/lib/tts";

interface SpeakingSoundCheckProps {
  onTested: () => void;
}

/**
 * Sound check step: the click both unlocks the shared AudioContext (user
 * gesture) and lets the student confirm they can hear the beep.
 */
const SpeakingSoundCheck = ({ onTested }: SpeakingSoundCheckProps) => {
  const [status, setStatus] = useState<"idle" | "ok" | "blocked">("idle");

  const handleTest = async () => {
    // Must run synchronously in the gesture.
    unlockBeepAudio();
    unlockAudio();
    const played = await playBeep();
    setStatus(played ? "ok" : "blocked");
    onTested();
  };

  return (
    <div className="mt-4 p-4 rounded-lg border border-border bg-card">
      <p className="text-sm font-heading font-bold text-foreground mb-1">Kiểm tra âm thanh</p>
      <p className="text-xs text-muted-foreground mb-3">
        Bấm để nghe thử tiếng bíp. Trong bài, tiếng bíp báo bạn bắt đầu nói.
      </p>

      <button
        type="button"
        onClick={handleTest}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <Volume2 className="w-4 h-4" />
        {status === "idle" ? "Nghe thử tiếng bíp" : "Nghe lại"}
      </button>

      {status === "ok" && (
        <div className="mt-2 flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Đã phát tiếng bíp. Nếu không nghe, hãy tăng âm lượng.</span>
        </div>
      )}

      {status === "blocked" && (
        <div className="mt-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">
            Trình duyệt chặn âm báo. Bạn vẫn làm bài được — hãy nhìn đèn đỏ khi ghi âm.
          </span>
        </div>
      )}
    </div>
  );
};

export default SpeakingSoundCheck;
