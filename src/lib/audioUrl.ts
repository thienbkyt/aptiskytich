import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio_url value to a playable URL.
 * - External http(s) → returned as-is (unless it's a Storage public URL → re-signed)
 * - Storage file path → 1h signed URL
 *
 * Resilience:
 * - In-memory cache (50 min TTL) so repeated mounts don't re-sign
 * - Up to 2 retries with 250ms backoff on transient failure
 * - `bustAudioUrlCache(key)` lets the player force a fresh sign on <audio> error
 *   (handles the case where a signed URL expires mid-session)
 */
const urlCache = new Map<string, { promise: Promise<string | null>; expiresAt: number }>();
const CACHE_TTL_MS = 50 * 60 * 1000;

function getCached(key: string): Promise<string | null> | null {
  const hit = urlCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    urlCache.delete(key);
    return null;
  }
  return hit.promise;
}

function setCached(key: string, promise: Promise<string | null>) {
  urlCache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  promise.then((v) => { if (v === null) urlCache.delete(key); }).catch(() => urlCache.delete(key));
}

export function bustAudioUrlCache(key?: string) {
  if (!key) urlCache.clear();
  else urlCache.delete(key);
}

async function signWithRetry(filePath: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(filePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return null;
}

export async function resolveAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl) return null;

  const cached = getCached(audioUrl);
  if (cached) return cached;

  const work = (async (): Promise<string | null> => {
    if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
      const storageMatch = audioUrl.match(/\/storage\/v1\/object\/public\/audio\/(.+)$/);
      if (storageMatch) {
        const filePath = decodeURIComponent(storageMatch[1]);
        const signed = await signWithRetry(filePath);
        // Fallback to the original URL if signing keeps failing — better than silence.
        return signed ?? audioUrl;
      }
      return audioUrl;
    }
    return signWithRetry(audioUrl);
  })();

  setCached(audioUrl, work);
  return work;
}
