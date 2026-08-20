import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an exam image reference to a displayable URL.
 * The `exam-images` bucket is public by design, so a public URL is used
 * (synchronous, never expires).
 */

const EXAM_IMAGES_BUCKET = "exam-images";

/** Kept for backwards compatibility: public URLs are stable, so no cache to bust. */
export function bustImageUrlCache(_key?: string) {
  // no-op
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  // Any http(s) URL -> return as-is.
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const { data } = supabase.storage.from(EXAM_IMAGES_BUCKET).getPublicUrl(imageUrl);
  return data?.publicUrl || null;
}
