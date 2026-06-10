import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL.
 * - External URL → returned as-is (unless it's actually a Storage public URL).
 * - Storage file path → creates a 1-hour signed URL from exam-images.
 *
 * Signed URLs are cached in-memory per session keyed by the raw input,
 * so repeated renders of the same component never re-sign.
 * The cached promise expires after 50 minutes (10-min safety margin vs 1h TTL).
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
  // Evict on rejection so the next render can retry.
  promise.catch(() => urlCache.delete(key));
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
        const { data, error } = await supabase.storage
          .from("exam-images")
          .createSignedUrl(filePath, 3600);
        if (error || !data?.signedUrl) return null;
        return data.signedUrl;
      }
      return imageUrl;
    }

    const { data, error } = await supabase.storage
      .from("exam-images")
      .createSignedUrl(imageUrl, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  })();

  setCached(imageUrl, work);
  return work;
}
