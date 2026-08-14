import { useState, useRef, useEffect, useCallback } from "react";
import { CircleDot, CirclePlay, RefreshCw } from "lucide-react";
import { resolveAudioUrl, bustAudioUrlCache } from "@/lib/audioUrl";
import { safeSessionStorage } from "@/lib/safeStorage";
import { speakAsync, stopTTS, unlockAudio, prefetchTTS } from "@/lib/tts";
import { logClientError } from "@/lib/clientErrorLog";


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
  /** Review / after-submit: never read the spoken prompt aloud. */
  reviewMode?: boolean;
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

const LimitedAudioPlayer = ({ src, src2, maxPlays = 2, questionKey, introText, introPauseMs = 400, reviewMode = false }: LimitedAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState<number>(
    () => readCount(storeKey(questionKey, src))
  );
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const [introSpeaking, setIntroSpeaking] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [blocked, setBlocked] = useState(false);
  const retryCountRef = useRef(0);
  // Bumped on every stop / new play so a pending intro sequence can bail out.
  const introTokenRef = useRef(0);
  const disabled = playCount >= maxPlays && !isPlaying;

  // Mutable snapshot of log metadata so logAudioError can be identity-stable.
  const metaRef = useRef({ questionKey, playCount, maxPlays, reviewMode });
  metaRef.current = { questionKey, playCount, maxPlays, reviewMode };

  /**
   * Fire-and-forget diagnostics for audio failures (never throws, never awaited).
   * Identity MUST stay stable ([] deps) — it is never a playback dependency.
   */
  const logAudioError = useCallback(
    (
      stage: string,
      err: unknown,
      audio: HTMLAudioElement | null,
      activeSrc: string,
      isFirstPlay?: boolean,
      outcome?: string,
      extra?: Record<string, unknown>,
    ) => {
      try {
        const m = metaRef.current;
        logClientError("audio_playback", err, {
          stage,
          questionKey: String(m.questionKey ?? ""),
          src: activeSrc,
          readyState: audio?.readyState ?? null,
          networkState: audio?.networkState ?? null,
          currentTime: audio?.currentTime ?? null,
          isFirstPlay: isFirstPlay ?? null,
          outcome: outcome ?? null,
          playCount: m.playCount,
          maxPlays: m.maxPlays,
          reviewMode: m.reviewMode,
          ...(extra ?? {}),
        });
      } catch {
        /* never break playback */
      }
    },
    [],
  );




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
            logAudioError(
              "preload_sign_url_null",
              new Error("resolveAudioUrl returned null"),
              audioRef.current,
              src,
            );
          }
          setResolvedSrc(url || src);
        } catch (e) {
          if (cancelled) return;
          console.error("[LimitedAudioPlayer] resolveAudioUrl threw for:", src, e);
          setErrorMsg("Không tải được audio.");
          logAudioError("preload_sign_threw", e, audioRef.current, src);
          setResolvedSrc(src);
        }

      })();
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Sync playCount from persistent store when question/src changes.
  // Do NOT reset to 0 — remembered per question across navigation.
  useEffect(() => {
    setPlayCount(readCount(storeKey(questionKey, src)));
    setIsPlaying(false);
    setErrorMsg("");
    setBlocked(false);
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
    if (t && playCount === 0 && !reviewMode) prefetchTTS(t, "en", "exam");
  }, [introText, questionKey, playCount, reviewMode]);

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

  // Which source is currently loaded in the element (src vs src2).
  const activeSrcRef = useRef<string>(src);
  // Max 2 in-place resumes per play press.
  const resumeCountRef = useRef(0);
  const resumingRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);

  /** Waits until the element has data (or 8s). Same pattern as playActiveSource. */
  const waitForReady = (audio: HTMLAudioElement) =>
    new Promise<void>((resolve) => {
      if (audio.readyState >= 2) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        audio.removeEventListener("loadeddata", finish);
        audio.removeEventListener("canplay", finish);
        resolve();
      };
      const t = setTimeout(finish, 8000);
      audio.addEventListener("loadeddata", finish);
      audio.addEventListener("canplay", finish);
    });

  /**
   * Re-signs the URL and continues playback from the exact position.
   * Used when the signed URL dies mid-playback (stall or media error).
   * Never counts a play — this is the same listen, not a new one.
   */
  const resumeAtPosition = useCallback(async (audio: HTMLAudioElement): Promise<boolean> => {
    if (resumingRef.current) return true;
    resumingRef.current = true;
    try {
      if (resumeCountRef.current >= 2) {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
        logAudioError(
          "resume_exhausted",
          new Error("resume limit reached"),
          audio,
          activeSrcRef.current || src,
          undefined,
          "error",
          { position: audio.currentTime, resumeCount: resumeCountRef.current },
        );
        return false;
      }
      resumeCountRef.current += 1;
      const pos = audio.currentTime;
      const activeSrc = activeSrcRef.current || src;
      setErrorMsg("Đang nối lại audio...");
      bustAudioUrlCache(activeSrc);
      const url = await resolveAudioUrl(activeSrc);
      if (!url) {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
        logAudioError(
          "resume_sign_url_null",
          new Error("resolveAudioUrl returned null"),
          audio,
          activeSrc,
          undefined,
          "error",
          { position: pos, resumeCount: resumeCountRef.current },
        );
        return false;
      }
      if (activeSrc === src) setResolvedSrc(url);
      audio.src = url;
      audio.load();
      await waitForReady(audio);
      try {
        audio.currentTime = pos;
      } catch {
        /* noop */
      }
      try {
        stopOthers(audio);
        await audio.play();
        lastTimeUpdateRef.current = Date.now();
        setErrorMsg("");
        return true;
      } catch (e) {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
        logAudioError("resume_play_failed", e, audio, activeSrc, undefined, "error", {
          position: pos,
          resumeCount: resumeCountRef.current,
        });
        return false;
      }
    } finally {
      resumingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);


  const handleAudioError = useCallback(async () => {
    // Ignore errors raised by the silent priming play — the main play flow owns recovery.
    if (primingRef.current) return;
    const el = audioRef.current;
    // Mid-playback failure → resume in place instead of restarting the file.
    if (isPlaying && el && el.currentTime > 1) {
      await resumeAtPosition(el);
      return;
    }
    // Signed URL likely expired / network blip — bust cache and retry.
    if (retryCountRef.current >= 2) {
      setErrorMsg("Không tải được audio. Vui lòng bấm Thử lại hoặc tải lại trang.");
      setIsPlaying(false);
      logAudioError(
        "retry_exhausted",
        (el?.error as unknown) ?? new Error("audio retry limit reached"),
        el,
        activeSrcRef.current || src,
        undefined,
        "error",
        { retryCount: retryCountRef.current, mediaErrorCode: el?.error?.code ?? null },
      );
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
      } catch (e) {
        setIsPlaying(false);
        setErrorMsg("Không phát được audio. Bấm Thử lại.");
        logAudioError("retry_play_failed", e, audioRef.current, activeSrcRef.current || src, undefined, "error", {
          retryCount: retryCountRef.current,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolve, isPlaying, countThisPlay, resumeAtPosition, src]);


  // Watchdog: playback that goes 5s without a timeupdate is stalled.
  useEffect(() => {
    if (!isPlaying) return;
    lastTimeUpdateRef.current = Date.now();
    const id = setInterval(() => {
      const el = audioRef.current;
      if (!el || el.paused || el.ended || resumingRef.current) return;
      if (el.currentTime <= 1) return;
      if (Date.now() - lastTimeUpdateRef.current < 5000) return;
      lastTimeUpdateRef.current = Date.now();
      void resumeAtPosition(el);
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, resumeAtPosition]);


  const handleRetry = async () => {
    retryCountRef.current = 0;
    setErrorMsg("Đang thử tải lại audio...");
    await resolve(true);
  };

  /**
   * Marks the exam <audio> element as user-activated. MUST run synchronously
   * inside the click handler, before any `await`, otherwise Chrome/Safari treat
   * the later play() as autoplay and block it.
   */
  const primingRef = useRef(false);
  const primeExamAudio = (audio: HTMLAudioElement) => {
    primingRef.current = true;
    const finish = () => { primingRef.current = false; };
    try {
      audio.muted = true;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try {
            // If the real playback already took over (it sets muted=false),
            // do NOT pause — that would silence the actual audio.
            if (audio.muted) {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            }
          } catch { /* noop */ }
          finish();
        }).catch(() => {
          try { audio.muted = false; } catch { /* noop */ }
          finish();
        });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        finish();
      }
    } catch {
      try { audio.muted = false; } catch { /* noop */ }
      finish();
    }
  };

  /**
   * Signs + attaches the upcoming source while the intro TTS is still speaking,
   * so there is no dead air between the spoken question and the recording.
   * Never plays — playActiveSource still owns playback.
   */
  const prewarmActiveSource = async (audio: HTMLAudioElement, isFirstPlay: boolean) => {
    const activeSrc = !isFirstPlay && src2 ? src2 : src;
    try {
      const url = await resolveAudioUrl(activeSrc);
      if (!url) return;
      // Don't fight the silent priming play for the element.
      for (let i = 0; i < 40 && primingRef.current; i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
      if (activeSrc === src) setResolvedSrc(url);
      if (audio.src !== url) {
        audio.src = url;
        audio.load();
      }
    } catch {
      /* playActiveSource will retry and report */
    }
  };


  /** Resolves + plays the right source. Returns "ok" | "blocked" | "error". */
  const playActiveSource = async (
    audio: HTMLAudioElement,
    isFirstPlay: boolean,
    token?: number,
  ): Promise<"ok" | "blocked" | "error" | "stale"> => {
    // Pick the source for this play: first play uses `src`, later plays use
    // `src2` when provided (falls back to `src`).
    const activeSrc = !isFirstPlay && src2 ? src2 : src;
    activeSrcRef.current = activeSrc;
    // Always re-sign right before playing: signed URLs live only 5 minutes, and
    // a student may replay long after the part was batch-signed. The cache in
    // audioUrl.ts makes this free when the URL is still fresh.
    let reloaded = false;
    try {
      let url = await resolveAudioUrl(activeSrc);
      if (!url) {
        // Bust cache and try once more (expired / transient failure).
        bustAudioUrlCache(activeSrc);
        url = await resolveAudioUrl(activeSrc);
      }
      if (!url) {
        logAudioError(
          "sign_url_null",
          new Error("resolveAudioUrl returned null"),
          audio,
          activeSrc,
          isFirstPlay,
          "error",
        );
        return "error";
      }
      if (activeSrc === src) setResolvedSrc(url);
      reloaded = audio.src !== url;
      if (reloaded) {
        audio.src = url;
        audio.load();
      }
    } catch (e) {
      console.error("[LimitedAudioPlayer] resolve activeSrc failed:", e);
      logAudioError("resolve_threw", e, audio, activeSrc, isFirstPlay, "error");
      return "error";
    }

    if (token !== undefined && token !== introTokenRef.current) return "stale";
    audio.muted = false;
    // After load() the browser already resets currentTime; touching it while
    // readyState === 0 throws InvalidStateError.
    if (!reloaded) {
      try {
        audio.currentTime = 0;
      } catch {
        /* noop */
      }
    } else {
      // Wait until the freshly signed source has data, else play() may fail.
      await new Promise<void>((resolve) => {
        if (audio.readyState >= 2) return resolve();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(t);
          audio.removeEventListener("loadeddata", finish);
          audio.removeEventListener("canplay", finish);
          resolve();
        };
        const t = setTimeout(finish, 8000);
        audio.addEventListener("loadeddata", finish);
        audio.addEventListener("canplay", finish);
      });
      if (token !== undefined && token !== introTokenRef.current) return "stale";
    }
    try {
      // Only one audio may sound at a time across the whole page.
      stopOthers(audio);
      await audio.play();
      return "ok";
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        logAudioError("play_blocked", e, audio, activeSrc, isFirstPlay, "blocked");
        return "blocked";
      }
      logAudioError("play_failed", e, audio, activeSrc, isFirstPlay, "error");
      return "error";
    }
  };


  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // Also cancels a spoken prompt / pause that is still in progress.
      introTokenRef.current += 1;
      stopTTS();
      setIntroSpeaking(false);
      setLoadingAudio(false);
      audio.pause();
      releaseIfMine(audio);
      setIsPlaying(false);
    } else {
      if (disabled) return;
      const isFirstPlay = playCount === 0;
      const needIntro = isFirstPlay && !!introText?.trim() && !reviewMode;
      // Must run synchronously inside the user gesture (mobile autoplay).
      // Prime ONLY when a TTS intro will sit between the click and audio.play()
      // — otherwise the real play() is already inside the gesture and priming
      // would race with it (pausing the audio that just started).
      if (needIntro) {
        unlockAudio();
        primeExamAudio(audio);
      }

      const token = ++introTokenRef.current;
      countedRef.current = false;
      resumeCountRef.current = 0;
      lastTimeUpdateRef.current = Date.now();
      retryCountRef.current = 0;
      setIsPlaying(true);
      setErrorMsg("");
      setBlocked(false);

      if (needIntro) {
        setIntroSpeaking(true);
        // Sign + load the recording IN PARALLEL with the spoken question.
        void prewarmActiveSource(audio, isFirstPlay);
        let timedOut = false;
        try {
          // Safety net only: guards against speechSynthesis never firing onend.
          await Promise.race([
            speakAsync(introText!.trim(), "en", { surface: "exam" }),
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

      setLoadingAudio(true);
      const outcome = await playActiveSource(audio, isFirstPlay, token);
      setLoadingAudio(false);
      if (outcome === "stale") return;
      if (outcome === "ok") {
        // Only now the student actually hears the audio → count the play.
        countThisPlay();
        return;
      }
      if (outcome === "blocked") {
        // Autoplay blocked → no audio was heard, so do NOT spend a play.
        setIsPlaying(false);
        setBlocked(true);
        setErrorMsg("Trình duyệt chặn phát tự động — bấm Nghe ngay");
        return;
      }
      // Load/network failure → re-sign and retry.
      setErrorMsg("Không phát được audio, đang thử lại...");
      await handleAudioError();
    }
  };

  /** Direct play from a fresh user gesture after an autoplay block. */
  const handlePlayNow = async () => {
    const audio = audioRef.current;
    if (!audio || disabled) return;
    const token = ++introTokenRef.current;
    stopTTS();
    setIntroSpeaking(false);
    countedRef.current = false;
    resumeCountRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    setBlocked(false);
    setErrorMsg("");
    setIsPlaying(true);
    const outcome = await playActiveSource(audio, playCount === 0, token);
    if (outcome === "stale") return;
    if (outcome === "ok") {
      countThisPlay();
      return;
    }
    setIsPlaying(false);
    if (outcome === "blocked") {
      setBlocked(true);
      setErrorMsg("Trình duyệt chặn phát tự động — bấm Nghe ngay");
    } else {
      setErrorMsg("Không tải được audio. Bấm Thử lại.");
    }
  };




  return (
    <div className="my-3">
      <audio
        ref={audioRef}
        {...(resolvedSrc ? { src: resolvedSrc } : {})}
        onEnded={() => { releaseIfMine(audioRef.current); setIsPlaying(false); }}
        onTimeUpdate={() => { lastTimeUpdateRef.current = Date.now(); }}
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
          {blocked ? (
            <button
              type="button"
              onClick={handlePlayNow}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 border border-primary text-primary hover:bg-primary/10"
            >
              <CirclePlay className="w-3 h-3" /> Nghe ngay
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 underline underline-offset-2 text-foreground hover:text-primary"
            >
              <RefreshCw className="w-3 h-3" /> Thử lại
            </button>
          )}
        </p>
      )}

    </div>
  );
};

export default LimitedAudioPlayer;
