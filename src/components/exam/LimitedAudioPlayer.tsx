import { useState, useRef, useEffect, useCallback } from "react";
import { CircleDot, CirclePlay } from "lucide-react";
import { resolveAudioUrl, bustAudioUrlCache } from "@/lib/audioUrl";

interface LimitedAudioPlayerProps {
  src: string;
  maxPlays?: number;
  questionKey?: string | number;
}

const LimitedAudioPlayer = ({ src, maxPlays = 2, questionKey }: LimitedAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const retryCountRef = useRef(0);
  const disabled = playCount >= maxPlays && !isPlaying;

  const resolve = useCallback(async (force = false) => {
    if (!src) return;
    if (force) bustAudioUrlCache(src);
    setErrorMsg("");
    const url = await resolveAudioUrl(src);
    // Always fall back to raw src so audio never goes silent if signing fails.
    setResolvedSrc(url || src);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc("");
    retryCountRef.current = 0;
    if (src) {
      (async () => {
        const url = await resolveAudioUrl(src);
        if (!cancelled) setResolvedSrc(url || src);
      })();
    }
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    setPlayCount(0);
    setIsPlaying(false);
    setErrorMsg("");
    retryCountRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [questionKey, src]);

  const handleAudioError = useCallback(async () => {
    // Signed URL likely expired / network blip — bust cache and retry once.
    if (retryCountRef.current >= 2) {
      setErrorMsg("Không tải được audio. Vui lòng tải lại trang.");
      setIsPlaying(false);
      return;
    }
    retryCountRef.current += 1;
    await resolve(true);
    // Auto-resume if user had pressed play
    if (isPlaying && audioRef.current) {
      try {
        audioRef.current.load();
        await audioRef.current.play();
      } catch {
        setIsPlaying(false);
      }
    }
  }, [resolve, isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (disabled) return;
      // Safety: if src missing, try to resolve once.
      if (!resolvedSrc) {
        await resolve(true);
      }
      audio.currentTime = 0;
      setPlayCount((prev) => prev + 1);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        // First failure → re-sign and retry.
        await handleAudioError();
      }
    }
  };

  return (
    <div className="my-3">
      <audio
        ref={audioRef}
        src={resolvedSrc}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
        preload="auto"
      />
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled || !resolvedSrc}
        className={`inline-flex items-center gap-1.5 text-sm underline underline-offset-2 transition-colors ${
          disabled || !resolvedSrc
            ? "text-muted-foreground cursor-not-allowed no-underline"
            : "text-foreground hover:text-primary cursor-pointer"
        }`}
      >
        {isPlaying ? (
          <CircleDot className="w-4 h-4 animate-pulse" />
        ) : (
          <CirclePlay className="w-4 h-4" />
        )}
        <span>Play/Stop</span>
      </button>
      {errorMsg && <p className="text-xs text-destructive mt-1">{errorMsg}</p>}
    </div>
  );
};

export default LimitedAudioPlayer;
