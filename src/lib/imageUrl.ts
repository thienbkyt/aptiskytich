import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an exam image reference to a short-lived signed URL.
 * The `exam-images` bucket is private, so every display must go through
 * createSignedUrl() and respect the storage RLS policies (tier/opened-item gating).
 *
 * Accepted input formats:
 *   - External http(s) URL        -> returned as-is
 *   - Raw storage path            -> signed
 *   - Supabase public URL         -> path extracted and signed
 */

const EXAM_IMAGES_BUCKET = "exam-images";
const SIGNED_URL_TTL = 3600; // 1 hour

const publicUrlBase = supabase.storage
  .from(EXAM_IMAGES_BUCKET)
  .getPublicUrl("").data.publicUrl;

function extractPath(value: string): string | null {
  if (!value) return null;

  // Full Supabase public URL for this bucket -> extract the path.
  if (value.startsWith(publicUrlBase)) {
    return decodeURIComponent(value.slice(publicUrlBase.length));
  }

  // Any other http(s) URL -> treat as external, not a storage path.
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return null;
  }

  // Raw storage path (may be URL-encoded if it came from a URL copy).
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Kept for backwards compatibility: signed URLs are per-request, so no cache to bust. */
export function bustImageUrlCache(_key?: string) {
  // no-op
}

export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  const path = extractPath(imageUrl);
  if (path === null) {
    // External URL or unrecognised value -> return as-is.
    return imageUrl;
  }

  const { data, error } = await supabase.storage
    .from(EXAM_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    console.error("[resolveImageUrl] failed to create signed URL for", path, error);
    return null;
  }

  return data.signedUrl;
}
