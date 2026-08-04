import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio_url value to a playable URL.
 * The `audio` bucket is private → use signed URLs (TTL 1h) so only
 * authenticated users with a valid session can fetch files.
 *
 * - External http(s) URL → return as-is
 * - Storage file path → createSignedUrl (cached)
 */
const SIGN_TTL_SEC = 3600;
const CACHE_TTL_MS = 55 * 60 * 1000; // refresh a bit before expiry

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

export function bustAudioUrlCache(key?: string) {
  if (!key) { cache.clear(); return; }
  cache.delete(key);
}

export async function resolveAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl) return null;

  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }

  const now = Date.now();
  const cached = cache.get(audioUrl);
  if (cached && cached.expiresAt > now) return cached.url;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from("audio")
        .createSignedUrl(audioUrl, SIGN_TTL_SEC);
      if (!error && data?.signedUrl) {
        cache.set(audioUrl, { url: data.signedUrl, expiresAt: Date.now() + CACHE_TTL_MS });
        return data.signedUrl;
      }
    } catch {
      /* network blip — retry */
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }

  return null;
}
