import { supabase } from "@/integrations/supabase/client";

type Lang = "en" | "vi";

// In-memory URL cache to avoid re-invoking the function for the same text
const urlCache = new Map<string, string>();

// Track currently playing audio so a new speak() call cancels the previous one
let currentAudio: HTMLAudioElement | null = null;

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

  // Prefer voices whose name suggests male / known male voice IDs
  const malePatterns = [
    /male/i,
    /\b(daniel|alex|fred|david|mark|george|james|google uk english male|google us english.*male)\b/i,
  ];
  const male = sameLang.find((v) => malePatterns.some((p) => p.test(v.name)));
  if (male) return male;

  // Avoid obviously-female voices when possible
  const femalePatterns = [/female/i, /\b(samantha|victoria|karen|tessa|moira|fiona|susan|zira|hazel)\b/i];
  const nonFemale = sameLang.find((v) => !femalePatterns.some((p) => p.test(v.name)));
  return nonFemale || sameLang[0];
}

function browserFallback(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "en" ? "en-US" : "vi-VN";
    u.rate = 0.9;
    const voice = pickMaleVoice(lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
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
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
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

/**
 * Fire-and-forget speak. Replaces previous browser `speak()` helpers.
 */
export async function speakWithTTS(text: string, lang: Lang): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return;
  stopCurrent();

  try {
    const url = await fetchUrl(trimmed, lang);
    if (!url) {
      await browserFallback(trimmed, lang);
      return;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch(() => {
      // Autoplay or network issue → fall back
      browserFallback(trimmed, lang);
    });
  } catch (e) {
    console.warn("[tts] speakWithTTS error, falling back:", e);
    await browserFallback(trimmed, lang);
  }
}

/**
 * Awaitable speak — resolves when audio finishes (or fails). Use inside playlists.
 */
export function speakAsync(text: string, lang: Lang): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return Promise.resolve();
  stopCurrent();

  return new Promise(async (resolve) => {
    try {
      const url = await fetchUrl(trimmed, lang);
      if (!url) {
        await browserFallback(trimmed, lang);
        resolve();
        return;
      }
      const audio = new Audio(url);
      currentAudio = audio;
      audio.onended = () => resolve();
      audio.onerror = () => {
        browserFallback(trimmed, lang).then(resolve);
      };
      audio.play().catch(() => {
        browserFallback(trimmed, lang).then(resolve);
      });
    } catch (e) {
      console.warn("[tts] speakAsync error, falling back:", e);
      await browserFallback(trimmed, lang);
      resolve();
    }
  });
}

/** Stop any TTS currently playing */
export function stopTTS() {
  stopCurrent();
}
