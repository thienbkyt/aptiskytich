import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL.
 * The `exam-images` bucket is private → use signed URLs (TTL 1h) so only
 * authenticated users with a valid session can fetch files.
 *
 * - External http(s) URL → return as-is
 * - Storage file path → createSignedUrl (cached)
 */
const SIGN_TTL_SEC = 3600;
const CACHE_TTL_MS = 55 * 60 * 1000;

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

export function bustImageUrlCache(key?: string) {
  if (!key) { cache.clear(); return; }
  cache.delete(key);
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const now = Date.now();
  const cached = cache.get(imageUrl);
  if (cached && cached.expiresAt > now) return cached.url;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.storage
      .from("exam-images")
      .createSignedUrl(imageUrl, SIGN_TTL_SEC);
    if (!error && data?.signedUrl) {
      cache.set(imageUrl, { url: data.signedUrl, expiresAt: Date.now() + CACHE_TTL_MS });
      return data.signedUrl;
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }

  return null;
}
