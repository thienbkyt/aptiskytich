import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL using PUBLIC URLs.
 * The `exam-images` bucket is public, so we never need to sign — signing
 * would require a SELECT policy on storage.objects which is not granted
 * to regular users, causing images to break for non-admins.
 *
 * - Already a public storage URL → return as-is
 * - External http(s) URL → return as-is
 * - Storage file path → getPublicUrl
 */
export function bustImageUrlCache(_key?: string) {
  // No-op kept for backward compatibility with callers (e.g. <img onError>).
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const { data } = supabase.storage.from("exam-images").getPublicUrl(imageUrl);
  return data?.publicUrl ?? null;
}
