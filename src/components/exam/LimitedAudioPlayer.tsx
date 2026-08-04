import { useState, useRef, useEffect, useCallback } from "react";
import { CircleDot, CirclePlay, RefreshCw } from "lucide-react";
import { resolveAudioUrl, bustAudioUrlCache } from "@/lib/audioUrl";
import { safeSessionStorage } from "@/lib/safeStorage";

interface LimitedAudioPlayerProps {
  src: string;
  /** Optional second-play source (content only, without the spoken prompt). */
  src2?: string;
  maxPlays?: number;
  questionKey?: string | number;
}

// Persistent across remounts within one tab session.
// In-memory Map is a fast path; sessionStorage is the source of truth so
// refreshing the page does not reset the play count. Closing the tab clears it.
const SS_PREFIX = "limitedPlays:";
const playCountStore = new Map<string, number>();
const storeKey = (qk: string | number | undefined, src: string) =>
  `${qk ?? "_"}::${src}`;

const readCount = (key: string): number => {
  const mem = playCountStore.get(key);
  if (typeof mem === "number") return mem;
  const raw = safeSessionStorage.getItem(SS_PREFIX + key);
  const n = raw ? parseInt(raw, 10) : 0;
  const val = Number.isFinite(n) ? n : 0;
  if (val) playCountStore.set(key, val);
  return val;
};

const writeCount = (key: string, val: number) => {
  playCountStore.set(key, val);
  safeSessionStorage.setItem(SS_PREFIX + key, String(val));
};

export const resetLimitedAudioPlays = () => {
  // Clear sessionStorage entries too so a new attempt truly starts fresh.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < safeSessionStorage.length; i++) {
      const k = safeSessionStorage.key(i);
      if (k && k.startsWith(SS_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) safeSessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  playCountStore.clear();
};

const LimitedAudioPlayer = ({ src, src2, maxPlays = 2, questionKey }: LimitedAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState<number>(
    () => readCount(storeKey(questionKey, src))
  );
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const retryCountRef = useRef(0);
  const disabled = playCount >= maxPlays && !isPlaying;

  const resolve = useCallback(async (force = false) => {
    if (!src) return;
    if (force) bustAudioUrlCache(src);
    setErrorMsg("");
    try {
      const url = await resolveAudioUrl(src);
      if (!url) {
        setResolvedSrc(src);
        setErrorMsg("Không tải được audio.");
        return;
      }
      setResolvedSrc(url);
    } catch (e) {
      console.error("[LimitedAudioPlayer] resolve failed:", e);
      setResolvedSrc(src);
      setErrorMsg("Không tải được audio.");
    }
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc("");
    retryCountRef.current = 0;
    if (src) {
      (async () => {
        try {
          const url = await resolveAudioUrl(src);
          if (cancelled) return;
          if (!url) {
            console.error("[LimitedAudioPlayer] resolveAudioUrl returned null for:", src);
            setErrorMsg("Không tải được audio.");
          }
          setResolvedSrc(url || src);
        } catch (e) {
          if (cancelled) return;
          console.error("[LimitedAudioPlayer] resolveAudioUrl threw for:", src, e);
          setErrorMsg("Không tải được audio.");
          setResolvedSrc(src);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [src]);

  // Sync playCount from persistent store when question/src changes.
  // Do NOT reset to 0 — remembered per question across navigation.
  useEffect(() => {
    setPlayCount(readCount(storeKey(questionKey, src)));
    setIsPlaying(false);
    setErrorMsg("");
    retryCountRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [questionKey, src]);

  const handleAudioError = useCallback(async () => {
    // Signed URL likely expired / network blip — bust cache and retry.
    if (retryCountRef.current >= 2) {
      setErrorMsg("Không tải được audio. Vui lòng bấm Thử lại hoặc tải lại trang.");
      setIsPlaying(false);
      return;
    }
    retryCountRef.current += 1;
    setErrorMsg("Đang thử tải lại audio...");
    await resolve(true);
    // Auto-resume if user had pressed play
    if (isPlaying && audioRef.current) {
      try {
        audioRef.current.load();
        await audioRef.current.play();
        setErrorMsg("");
      } catch {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
      }
    }
  }, [resolve, isPlaying]);

  const handleRetry = async () => {
    retryCountRef.current = 0;
    setErrorMsg("Đang thử tải lại audio...");
    await resolve(true);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (disabled) return;
      // Pick the source for this play: first play uses `src`, later plays use
      // `src2` when provided (falls back to `src`).
      const activeSrc = playCount >= 1 && src2 ? src2 : src;
      try {
        if (activeSrc !== src) {
          const url = (await resolveAudioUrl(activeSrc)) || activeSrc;
          if (audio.src !== url) {
            audio.src = url;
            audio.load();
          }
        } else if (!resolvedSrc) {
          await resolve(true);
        }
      } catch (e) {
        console.error("[LimitedAudioPlayer] resolve activeSrc failed:", e);
      }
      audio.currentTime = 0;
      try {
        await audio.play();
        setIsPlaying(true);
        setErrorMsg("");
        setPlayCount((prev) => {
          const next = prev + 1;
          writeCount(storeKey(questionKey, src), next);
          return next;
        });
      } catch {
        // First failure → show feedback immediately, then re-sign and retry.
        setErrorMsg("Không phát được audio, đang thử lại...");
        await handleAudioError();
      }
    }
  };

  return (
    <div className="my-3">
      {resolvedSrc && (
        <audio
          ref={audioRef}
          src={resolvedSrc}
          onEnded={() => setIsPlaying(false)}
          onError={handleAudioError}
          preload="auto"
        />
      )}
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
      {disabled && (
        <p className="text-xs text-muted-foreground mt-1">
          Đã dùng hết {maxPlays} lượt nghe cho câu này
        </p>
      )}
      {!resolvedSrc && !errorMsg && (
        <p className="text-xs text-muted-foreground mt-1">Đang tải audio...</p>
      )}
      {errorMsg && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 underline underline-offset-2 text-foreground hover:text-primary"
          >
            <RefreshCw className="w-3 h-3" /> Thử lại
          </button>
        </p>
      )}
    </div>
  );
};

export default LimitedAudioPlayer;
