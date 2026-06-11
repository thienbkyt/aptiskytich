import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL.
 * - External URL → as-is (unless it's a Storage public URL → re-signed)
 * - Storage file path → 1h signed URL from exam-images
 *
 * Resilience:
 * - In-memory cache (50 min TTL) so re-renders never re-sign
 * - Up to 3 sign attempts with 250ms backoff on transient failure
 * - `bustImageUrlCache(key)` lets <img onError> force a fresh sign
 *   (covers the case where a signed URL expires during a long session)
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

export function bustImageUrlCache(key?: string) {
  if (!key) urlCache.clear();
  else urlCache.delete(key);
}

async function signWithRetry(filePath: string, attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase.storage
      .from("exam-images")
      .createSignedUrl(filePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return null;
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  const cached = getCached(imageUrl);
  if (cached) return cached;

  const work = (async (): Promise<string | null> => {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const storageMatch = imageUrl.match(/\/storage\/v1\/object\/public\/exam-images\/(.+)$/);
      if (storageMatch) {
        const filePath = decodeURIComponent(storageMatch[1]);
        const signed = await signWithRetry(filePath);
        return signed ?? imageUrl;
      }
      return imageUrl;
    }
    return signWithRetry(imageUrl);
  })();

  setCached(imageUrl, work);
  return work;
}
