import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio_url value to a playable URL.
 * - If it's an external URL (http), returns as-is
 * - If it's a storage file path, creates a signed URL
 */
export async function resolveAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl) return null;
  
  // External URL - return as-is
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    // Check if it's a Supabase storage public URL - extract path and create signed URL
    const storageMatch = audioUrl.match(/\/storage\/v1\/object\/public\/audio\/(.+)$/);
    if (storageMatch) {
      const filePath = decodeURIComponent(storageMatch[1]);
      const { data, error } = await supabase.storage
        .from("audio")
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    }
    return audioUrl;
  }
  
  // Storage file path - create signed URL
  const { data, error } = await supabase.storage
    .from("audio")
    .createSignedUrl(audioUrl, 3600); // 1 hour expiry
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
