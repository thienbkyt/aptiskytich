import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, Headphones, Loader2, RotateCcw, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { useIsPro } from "@/hooks/useIsPro";

export type ShadowSentence = {
  sentence_id: string;
  text: string;
  audio_url: string | null;
  start_sec: number | null;
  end_sec: number | null;
};

type WordStatus = "correct" | "close" | "wrong" | "missing";

type ShadowWord = {
  expected: string;
  spoken: string | null;
  status: WordStatus;
  ipa?: string;
};

type ShadowResult = {
  transcript: string;
  score: number;
  words: ShadowWord[];
  extra: string[];
};

async function blobToBase64Raw(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

/** Dải waveform tĩnh trang trí — cố định theo hash, không phân tích audio thật. */
function staticBars(seed: string, count = 44) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let x = h || 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out.push(18 + Math.round((x / 0xffffffff) * 82));
  }
  return out;
}

const MAX_RECORD_SEC = 20;

export default function ShadowPanel({
  sentence,
  speed,
  revealed,
  onScored,
  onPlayModel,
}: {
  sentence: ShadowSentence;
  speed: number;
  revealed: boolean;
  onScored: (score: number) => void;
  onPlayModel?: () => void;
}) {
  const { isPro } = useIsPro();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<ShadowResult | null>(null);
  const [gate, setGate] = useState<null | "pro" | "quota">(null);

  const bars = useMemo(() => staticBars(`${sentence.sentence_id}:rec`), [sentence.sentence_id]);

  const {
    isRecording,
    audioUrl,
    timeLeft,
    micError,
    isRequestingMic,
    startRecording,
    stopRecording,
  } = useAudioRecording({
    maxDuration: MAX_RECORD_SEC,
    questionKey: sentence.sentence_id,
    minBlobBytes: 2000,
    onComplete: async (url: string) => {
      try {
        const res = await fetch(url);
        setBlob(await res.blob());
      } catch {
        setBlob(null);
      }
    },
  });

  const missedSet = useMemo(
    () =>
      new Set(
        (result?.words ?? [])
          .filter((w) => w.status !== "correct")
          .map((w) => w.expected.toLowerCase().replace(/[^a-z0-9']/gi, "")),
      ),
    [result],
  );

  const handleGrade = async () => {
    if (!blob) return;
    setGrading(true);
    setGate(null);
    try {
      const base64 = await blobToBase64Raw(blob);
      const { data, error } = await supabase.functions.invoke("grade-shadowing", {
        body: { audio: base64, mimeType: blob.type || "audio/webm", text: sentence.text },
      });
      let errCode = "";
      if (error) {
        try {
          const body = await (error as any)?.context?.json?.();
          errCode = String(body?.error ?? "");
        } catch {
          errCode = "";
        }
        if (!errCode) errCode = String((error as any)?.message ?? "");
      } else if ((data as any)?.error) {
        errCode = String((data as any).error);
      }
      const low = errCode.toLowerCase();
      if (low.includes("quota")) {
        setGate("quota");
        return;
      }
      if (low.includes("pro")) {
        setGate("pro");
        return;
      }
      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Không phân tích được",
          description: "Vui lòng thử lại sau ít phút.",
        });
        return;
      }
      const r: ShadowResult = {
        transcript: String((data as any).transcript ?? ""),
        score: Number((data as any).score ?? 0),
        words: Array.isArray((data as any).words) ? ((data as any).words as ShadowWord[]) : [],
        extra: Array.isArray((data as any).extra) ? (data as any).extra : [],
      };
      setResult(r);
      onScored(r.score);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Nghe và nói đuổi
          </p>
          <p className="text-lg font-bold leading-tight">Listen &amp; Shadowing</p>
        </div>
      </div>

      {/* Câu mẫu — chỉ mở khi revealed để tránh nhìn trộm đáp án phần điền từ */}
      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pronunciation</p>
        {revealed ? (
          <p className="text-lg sm:text-xl font-bold leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
            {sentence.text
              .split(/\s+/)
              .filter(Boolean)
              .map((w, i) => {
                const norm = w.toLowerCase().replace(/[^a-z0-9']/gi, "");
                const bad = missedSet.has(norm);
                return (
                  <span key={`${w}-${i}`} className={cn(bad && "text-destructive underline")}>
                    {w}
                  </span>
                );
              })}
          </p>
        ) : (
          <div className="rounded-lg bg-muted/70 border border-dashed px-4 py-6 text-center">
            <Lock className="w-4 h-4 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              Làm xong phần điền từ để mở phần luyện nói
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onPlayModel} disabled={!onPlayModel}>
          <Headphones className="w-4 h-4 mr-2" /> Nghe câu mẫu
        </Button>
        <span className="text-xs text-muted-foreground">Tốc độ mẫu {speed}x · không tính lượt nghe</span>
      </div>


      <div className="mt-5">
        <p className="text-sm font-semibold mb-2">Luyện nói</p>
        <div className={cn(!revealed && "opacity-50 pointer-events-none")}>
        <AudioRecorder
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          audioUrl={audioUrl}
          timeLeft={timeLeft}
          totalTime={MAX_RECORD_SEC}
          label="Thu âm câu nói của bạn"
          micError={micError}
          isRequestingMic={isRequestingMic}
        />
        </div>

        {/* Waveform ghi âm — trang trí tĩnh */}
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <div className="h-14 flex items-center gap-[3px] overflow-hidden">
            {bars.map((b, i) => (
              <span
                key={i}
                className={cn("flex-1 rounded-full", isRecording ? "bg-primary/60" : "bg-primary/25")}
                style={{ height: `${b}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Nói theo từ nghe được</p>
        </div>

        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Bấm để ghi âm, bấm lần nữa để dừng
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
          Bản ghi chỉ lưu trên thiết bị, trừ khi bạn bấm Phân tích bài nói — lúc đó audio được gửi
          lên máy chủ để phân tích rồi không lưu lại.
        </p>
      </div>

      {audioUrl && !isRecording && (
        <div className="mt-3">
          <audio src={audioUrl} controls className="w-full" />
          <Button variant="ghost" size="sm" className="mt-2" onClick={startRecording}>
            <RotateCcw className="w-4 h-4 mr-2" /> Thu lại
          </Button>
        </div>
      )}

      {gate ? (
        <div className="mt-4">
          <UpgradeLock reason={gate} featureLabel="AI chấm phát âm" />
        </div>
      ) : !isPro ? (
        <div className="mt-4">
          <UpgradeLock reason="pro" featureLabel="AI chấm phát âm" />
        </div>
      ) : (
        !result && (
          <div className="mt-4">
            <Button onClick={handleGrade} disabled={!blob || isRecording || grading}>
              {grading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang phân tích…
                </>
              ) : (
                "Phân tích bài nói"
              )}
            </Button>
          </div>
        )
      )}

      {result && (
        <div className="mt-4 rounded-xl border bg-muted/40 p-4">
          <p className="font-semibold">Điểm phát âm: {result.score}%</p>
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bạn đã nói</p>
            {result.words.length > 0 ? (
              <p className="leading-loose">
                {result.words.map((w, i) => (
                  <span key={`${w.expected}-${i}`} className="mr-2 inline-block">
                    <span
                      className={cn(
                        "font-medium",
                        w.status === "correct" && "text-green-600",
                        w.status === "close" && "text-amber-600",
                        w.status === "wrong" && "text-destructive",
                        w.status === "missing" && "text-destructive line-through",
                      )}
                    >
                      {w.status === "missing" ? w.expected : (w.spoken ?? w.expected)}
                    </span>
                    {w.status !== "correct" && w.ipa && (
                      <span className="ml-1 text-[11px] text-muted-foreground/70">/{w.ipa}/</span>
                    )}
                  </span>
                ))}
              </p>
            ) : (
              <p className="leading-relaxed">(Không nghe được tiếng nói)</p>
            )}
          </div>
          {result.extra.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Từ nói thừa: {result.extra.join(", ")}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600" /> đúng
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> hơi lệch
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive" /> sai
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
