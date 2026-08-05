import { useState, useRef, useEffect, useCallback } from "react";
import { CircleDot, CirclePlay, RefreshCw } from "lucide-react";
import { resolveAudioUrl, bustAudioUrlCache } from "@/lib/audioUrl";
import { safeSessionStorage } from "@/lib/safeStorage";
import { speakAsync, stopTTS, unlockAudio, prefetchTTS } from "@/lib/tts";

interface LimitedAudioPlayerProps {
  src: string;
  /** Optional second-play source (content only, without the spoken prompt). */
  src2?: string;
  maxPlays?: number;
  questionKey?: string | number;
  /** Spoken prompt read aloud by TTS before the first play only. */
  introText?: string;
  /** Silence between the spoken prompt and the audio file (ms). */
  introPauseMs?: number;
}

// Persistent across remounts within one tab session.
// In-memory Map is a fast path; sessionStorage is the source of truth so
// refreshing the page does not reset the play count. Closing the tab clears it.
const SS_PREFIX = "limitedPlays:";
const playCountStore = new Map<string, number>();

// Module-level registry: only ONE audio element may play per page.
// Must be module-level (not state) so we can pause a player whose component
// never re-renders (e.g. all 13 Listening Part 1 players mounted at once).
let currentlyPlaying: HTMLAudioElement | null = null;
const stopOthers = (keep: HTMLAudioElement | null) => {
  if (currentlyPlaying && currentlyPlaying !== keep) {
    try {
      currentlyPlaying.pause();
      currentlyPlaying.currentTime = 0;
    } catch {
      /* noop */
    }
  }
  currentlyPlaying = keep;
};
const releaseIfMine = (el: HTMLAudioElement | null) => {
  if (el && currentlyPlaying === el) currentlyPlaying = null;
};
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

const LimitedAudioPlayer = ({ src, src2, maxPlays = 2, questionKey, introText, introPauseMs = 1000 }: LimitedAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState<number>(
    () => readCount(storeKey(questionKey, src))
  );
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [introSpeaking, setIntroSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const retryCountRef = useRef(0);
  // Bumped on every stop / new play so a pending intro sequence can bail out.
  const introTokenRef = useRef(0);
  const disabled = playCount >= maxPlays && !isPlaying;

  const resolve = useCallback(async (force = false): Promise<string | null> => {
    if (!src) return null;
    if (force) bustAudioUrlCache(src);
    setErrorMsg("");
    try {
      const url = await resolveAudioUrl(src);
      if (!url) {
        setResolvedSrc(src);
        setErrorMsg("Không tải được audio.");
        return null;
      }
      setResolvedSrc(url);
      return url;
    } catch (e) {
      console.error("[LimitedAudioPlayer] resolve failed:", e);
      setResolvedSrc(src);
      setErrorMsg("Không tải được audio.");
      return null;
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
    setIntroSpeaking(false);
    retryCountRef.current = 0;
    // Cancel any pending intro sequence for the previous question.
    introTokenRef.current += 1;
    stopTTS();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [questionKey, src]);

  // Hard stop on unmount (e.g. navigating to the next question).
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      introTokenRef.current += 1; // cancel any pending intro sequence
      stopTTS();
      try {
        el?.pause();
        if (el) el.currentTime = 0;
      } catch {
        /* noop */
      }
      releaseIfMine(el);
    };
  }, []);

  // Warm the TTS URL cache so pressing Play starts the intro almost instantly.
  useEffect(() => {
    const t = introText?.trim();
    if (t && playCount === 0) prefetchTTS(t, "en");
  }, [introText, questionKey, playCount]);

  // Counts the current Play press exactly once (intro + audio + retries).
  const countedRef = useRef(false);
  const countThisPlay = useCallback(() => {
    if (countedRef.current) return;
    countedRef.current = true;
    setPlayCount((prev) => {
      const next = prev + 1;
      writeCount(storeKey(questionKey, src), next);
      return next;
    });
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
        countThisPlay();
      } catch {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
      }
    }
  }, [resolve, isPlaying, countThisPlay]);

  const handleRetry = async () => {
    retryCountRef.current = 0;
    setErrorMsg("Đang thử tải lại audio...");
    await resolve(true);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // Also cancels a spoken prompt / pause that is still in progress.
      introTokenRef.current += 1;
      stopTTS();
      setIntroSpeaking(false);
      audio.pause();
      releaseIfMine(audio);
      setIsPlaying(false);
    } else {
      if (disabled) return;
      const isFirstPlay = playCount === 0;
      const needIntro = isFirstPlay && !!introText?.trim();
      // Must run synchronously inside the user gesture (mobile autoplay).
      if (needIntro) unlockAudio();

      const token = ++introTokenRef.current;
      countedRef.current = false;
      setIsPlaying(true);
      setErrorMsg("");

      if (needIntro) {
        setIntroSpeaking(true);
        let timedOut = false;
        try {
          // Safety net only: guards against speechSynthesis never firing onend.
          await Promise.race([
            speakAsync(introText!.trim(), "en"),
            new Promise<void>((r) => setTimeout(() => { timedOut = true; r(); }, 20000)),
          ]);
        } catch (e) {
          console.error("[LimitedAudioPlayer] intro TTS failed:", e);
        }
        if (timedOut) stopTTS();
        if (token !== introTokenRef.current) return;
        await new Promise((r) => setTimeout(r, introPauseMs));
        setIntroSpeaking(false);
        if (token !== introTokenRef.current) return;
      }


      // Pick the source for this play: first play uses `src`, later plays use
      // `src2` when provided (falls back to `src`).
      const activeSrc = !isFirstPlay && src2 ? src2 : src;
      try {
        if (activeSrc !== src) {
          const url = (await resolveAudioUrl(activeSrc)) || activeSrc;
          if (audio.src !== url) {
            audio.src = url;
            audio.load();
          }
        } else if (!resolvedSrc) {
          // Not signed yet (batch prefetch pending / failed) → sign on demand now.
          const url = await resolve(true);
          if (url) {
            audio.src = url;
            audio.load();
          } else {
            setIsPlaying(false);
            setErrorMsg("Không tải được audio. Bấm Thử lại.");
            return;
          }
        } else if (resolvedSrc && audio.src !== resolvedSrc) {
          // Restore the primary source (e.g. after a previous play used src2).
          audio.src = resolvedSrc;
          audio.load();
        }
      } catch (e) {
        console.error("[LimitedAudioPlayer] resolve activeSrc failed:", e);
      }
      if (token !== introTokenRef.current) return;
      audio.currentTime = 0;
      try {
        // Only one audio may sound at a time across the whole page.
        stopOthers(audio);
        await audio.play();
        // Only now the student actually hears the audio → count the play.
        countThisPlay();
      } catch {
        // First failure → show feedback immediately, then re-sign and retry.
        setErrorMsg("Không phát được audio, đang thử lại...");
        await handleAudioError();
      }
    }
  };



  return (
    <div className="my-3">
      <audio
        ref={audioRef}
        {...(resolvedSrc ? { src: resolvedSrc } : {})}
        onEnded={() => setIsPlaying(false)}
        onError={resolvedSrc ? handleAudioError : undefined}
        preload="auto"
      />
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 text-sm underline underline-offset-2 transition-colors ${
          disabled
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
