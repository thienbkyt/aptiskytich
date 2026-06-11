import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio_url value to a playable URL using PUBLIC URLs.
 * The `audio` bucket is public, so we never need to sign — signing would
 * require a SELECT policy on storage.objects which is not granted to
 * regular users, causing audio to break for non-admins.
 *
 * - Already a public storage URL → return as-is
 * - External http(s) URL → return as-is
 * - Storage file path → getPublicUrl
 */
export function bustAudioUrlCache(_key?: string) {
  // No-op kept for backward compatibility with callers (e.g. <audio onError>).
}

export async function resolveAudioUrl(audioUrl: string): Promise<string | null> {
  if (!audioUrl) return null;

  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }

  const { data } = supabase.storage.from("audio").getPublicUrl(audioUrl);
  return data?.publicUrl ?? null;
}
