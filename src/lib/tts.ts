import { supabase } from "@/integrations/supabase/client";

type Lang = "en" | "vi";

// In-memory URL cache to avoid re-invoking the function for the same text
const urlCache = new Map<string, string>();

// Shared audio element unlocked by a real user gesture (iOS/Android require
// the very first play() to originate from a synchronous user gesture — any
// `await` before `new Audio().play()` loses that gesture and gets blocked).
let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioUnlocked = false;

// Track currently playing audio so a new speak() call cancels the previous one
let currentAudio: HTMLAudioElement | null = null;
// Monotonically increasing token — every new speak invocation gets a new one.
// Any older callbacks compare against this and bail out if they're stale.
let playToken = 0;

/**
 * MUST be called from a real user gesture (onClick) before the first TTS
 * playback on mobile. Primes a shared <audio> element so subsequent
 * asynchronous play() calls are allowed.
 */
export function unlockAudio() {
  try {
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.muted = true;
    // Tiny silent MP3 data URI — enough for Safari/Chrome mobile to mark the
    // element as user-activated.
    sharedAudio.src =
      "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";
    const p = sharedAudio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        try {
          sharedAudio!.pause();
          sharedAudio!.currentTime = 0;
          sharedAudio!.muted = false;
          sharedAudioUnlocked = true;
        } catch { /* noop */ }
      }).catch(() => { /* user hasn't clicked yet, ignore */ });
    }
  } catch { /* noop */ }
}

function cacheKey(text: string, lang: Lang) {
  return `${lang}::${text.trim().toLowerCase()}`;
}

/** Pick a male English voice from the browser's installed voices, if available. */
function pickMaleVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices?.length) return null;

  const langPrefix = lang === "en" ? "en" : "vi";
  const sameLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(langPrefix));
  if (!sameLang.length) return null;

  const malePatterns = [
    /male/i,
    /\b(daniel|alex|fred|david|mark|george|james|google uk english male|google us english.*male)\b/i,
  ];
  const male = sameLang.find((v) => malePatterns.some((p) => p.test(v.name)));
  if (male) return male;

  const femalePatterns = [/female/i, /\b(samantha|victoria|karen|tessa|moira|fiona|susan|zira|hazel)\b/i];
  const nonFemale = sameLang.find((v) => !femalePatterns.some((p) => p.test(v.name)));
  return nonFemale || sameLang[0];
}

function browserFallback(text: string, lang: Lang, token: number): Promise<void> {
  console.warn("[tts] fallback sang giọng máy");
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    // Cancel anything queued in browser TTS first
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }

    // If a newer speak request came in already, abort.
    if (token !== playToken) {
      resolve();
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "en" ? "en-US" : "vi-VN";
    u.rate = 0.9;
    const voice = pickMaleVoice(lang);
    if (voice) u.voice = voice;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

async function fetchUrl(text: string, lang: Lang): Promise<string | null> {
  const key = cacheKey(text, lang);
  const cached = urlCache.get(key);
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke("tts", {
    body: { text, lang },
  });
  if (error || !data?.url) {
    console.warn("[tts] invoke failed, falling back:", error || data);
    return null;
  }
  urlCache.set(key, data.url as string);
  return data.url as string;
}

function stopCurrent() {
  // Bump token so any pending callbacks/awaiters know they're stale.
  playToken++;
  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      // Don't clear src on the shared element — that can invalidate the
      // gesture unlock on some browsers. Just detach handlers.
      if (currentAudio !== sharedAudio) {
        currentAudio.src = "";
        currentAudio.load();
      }
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }
}

function ensureShared(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/**
 * Fire-and-forget speak. Replaces previous browser `speak()` helpers.
 */
export async function speakWithTTS(text: string, lang: Lang): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return;
  stopCurrent();
  const token = playToken;

  try {
    const url = await fetchUrl(trimmed, lang);
    if (token !== playToken) return; // a newer speak request superseded us

    if (!url) {
      await browserFallback(trimmed, lang, token);
      return;
    }
    const audio = ensureShared();
    audio.muted = false;
    audio.src = url;
    currentAudio = audio;
    audio.play().catch(() => {
      if (token !== playToken) return;
      browserFallback(trimmed, lang, token);
    });
  } catch (e) {
    console.warn("[tts] speakWithTTS error, falling back:", e);
    if (token === playToken) await browserFallback(trimmed, lang, token);
  }
}

/**
 * Awaitable speak — resolves when audio finishes (or fails / is superseded).
 */
export function speakAsync(text: string, lang: Lang): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return Promise.resolve();
  stopCurrent();
  const token = playToken;

  return new Promise(async (resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    try {
      const url = await fetchUrl(trimmed, lang);
      if (token !== playToken) {
        // We were superseded while fetching the URL — bail out cleanly.
        finish();
        return;
      }
      if (!url) {
        await browserFallback(trimmed, lang, token);
        finish();
        return;
      }

      const audio = ensureShared();
      audio.muted = false;
      audio.src = url;
      currentAudio = audio;

      audio.onended = () => {
        if (token !== playToken) { finish(); return; }
        finish();
      };
      audio.onerror = () => {
        if (token !== playToken) { finish(); return; }
        // Single fallback path — never run twice for the same segment.
        browserFallback(trimmed, lang, token).then(finish);
      };

      try {
        await audio.play();
      } catch {
        if (token !== playToken) { finish(); return; }
        browserFallback(trimmed, lang, token).then(finish);
      }
    } catch (e) {
      console.warn("[tts] speakAsync error, falling back:", e);
      if (token === playToken) await browserFallback(trimmed, lang, token);
      finish();
    }
  });
}

/** Stop any TTS currently playing */
export function stopTTS() {
  stopCurrent();
}

/** For diagnostics/tests. */
export function isAudioUnlocked() {
  return sharedAudioUnlocked;
}
