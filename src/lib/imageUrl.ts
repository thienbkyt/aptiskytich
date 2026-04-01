import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an image_url value to a displayable URL.
 * - If it's an external URL (http), returns as-is
 * - If it's a storage file path, creates a signed URL from exam-images bucket
 */
export async function resolveImageUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  // External URL - return as-is (but check for Supabase public URL pattern)
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

  // Storage file path - create signed URL
  const { data, error } = await supabase.storage
    .from("exam-images")
    .createSignedUrl(imageUrl, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
