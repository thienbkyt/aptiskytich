import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL.
 * The `exam-images` bucket is public → use getPublicUrl (synchronous, no network
 * call, no expiry) so exam images render instantly.
 *
 * - External http(s) URL → return as-is
 * - Storage file path → getPublicUrl
 */

/** Kept for backwards compatibility: there is no cache to bust anymore. */
export function bustImageUrlCache(_key?: string) {
  // no-op: public URLs never expire
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const { data } = supabase.storage.from("exam-images").getPublicUrl(imageUrl);
  return data?.publicUrl ?? null;
}
