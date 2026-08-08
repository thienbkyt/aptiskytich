import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio_url value to a playable URL.
 * The `audio` bucket is private → use signed URLs (TTL 5 phút — link ký copy ra ngoài sẽ nhanh hết hạn)
 * so only authenticated users with a valid session can fetch files.
 *
 * - External http(s) URL → return as-is
 * - Storage file path → createSignedUrl (cached)
 */
const SIGN_TTL_SEC = 300;
const CACHE_TTL_MS = 120 * 1000; // die well before the 5-min TTL
const SIGN_TIMEOUT_MS = 5000;

function withTimeout<T>(p: PromiseLike<T>, ms = SIGN_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("createSignedUrl timeout")), ms)
    ),
  ]);
}

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

export function bustAudioUrlCache(key?: string) {
  if (!key) { cache.clear(); return; }
  cache.delete(key);
}

/**
 * Batch-signs a list of storage paths in ONE request and warms the shared cache.
 * External http(s) URLs are ignored (they need no signing).
 */
export async function resolveAudioUrls(paths: (string | null | undefined)[]): Promise<void> {
  const now = Date.now();
  const todo = Array.from(
    new Set(
      paths.filter(
        (p): p is string =>
          !!p &&
          !p.startsWith("http://") &&
          !p.startsWith("https://") &&
          !(cache.get(p) && cache.get(p)!.expiresAt > now)
      )
    )
  );
  if (todo.length === 0) return;

  try {
    const { data, error } = await withTimeout(
      supabase.storage.from("audio").createSignedUrls(todo, SIGN_TTL_SEC)
    );
    if (error || !data) return;
    const at = Date.now() + CACHE_TTL_MS;
    for (const item of data) {
      if (item?.signedUrl && item?.path) cache.set(item.path, { url: item.signedUrl, expiresAt: at });
    }
  } catch {
    /* batch sign failed — individual players will fall back to single signing */
  }
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
      const { data, error } = await withTimeout(
        supabase.storage.from("audio").createSignedUrl(audioUrl, SIGN_TTL_SEC)
      );
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
