import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a speaking recording blob to the private `speaking-recordings`
 * bucket under `<user_id>/<sessionId>/<partType>/<idx>.<ext>`. This path
 * shape satisfies existing RLS policies (folder[1] === auth.uid()).
 *
 * Returns the storage `path` on success (relative to the bucket), or `null`
 * on failure. Callers should tolerate `null` — the primary grading path still
 * ships the blob as base64; the returned path is only used by the queue
 * fallback so the worker can retrieve audio without huge jsonb payloads.
 */
export async function uploadSpeakingBlob(
  blob: Blob,
  sessionId: string,
  partType: string,
  idx: number
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const mime = blob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4"
      : mime.includes("ogg") ? "ogg"
      : mime.includes("wav") ? "wav"
      : mime.includes("mpeg") ? "mp3"
      : "webm";

    const safePart = String(partType || "part").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeSession = String(sessionId || "adhoc").replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${user.id}/${safeSession}/${safePart}/${idx}.${ext}`;

    const { error } = await supabase.storage
      .from("speaking-recordings")
      .upload(path, blob, { upsert: true, contentType: mime });

    if (error) {
      console.warn("[uploadSpeakingBlob] upload failed:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.warn("[uploadSpeakingBlob] unexpected:", e);
    return null;
  }
}

/**
 * Upload an array of blobs in parallel. Preserves index positions; a `null`
 * blob or upload failure yields `null` at that slot.
 */
export async function uploadSpeakingBlobs(
  blobs: Array<Blob | null | undefined>,
  sessionId: string,
  partType: string
): Promise<Array<string | null>> {
  return Promise.all(
    blobs.map((b, i) => (b ? uploadSpeakingBlob(b, sessionId, partType, i) : Promise.resolve(null)))
  );
}

/**
 * Upload every recording of a part with up to `attempts` tries each (1s, 2s
 * backoff). Slots that already have a known path are skipped.
 *
 * `missing` lists the question indexes that HAVE a recording but could not be
 * uploaded — the caller must NOT enqueue a grading job in that case, otherwise
 * the worker grades a part with silent gaps.
 */
export async function uploadSpeakingBlobsWithRetry(
  blobs: Array<Blob | null | undefined>,
  sessionId: string,
  partType: string,
  known: Array<string | null> = [],
  attempts = 3
): Promise<{ paths: Array<string | null>; missing: number[] }> {
  const paths: Array<string | null> = blobs.map((_, i) => known[i] ?? null);

  await Promise.all(
    blobs.map(async (b, idx) => {
      if (!b || paths[idx]) return;
      for (let a = 0; a < attempts; a++) {
        if (a > 0) await new Promise((r) => setTimeout(r, a * 1000));
        const p = await uploadSpeakingBlob(b, sessionId, partType, idx);
        if (p) { paths[idx] = p; return; }
      }
    })
  );

  const missing: number[] = [];
  blobs.forEach((b, i) => { if (b && !paths[i]) missing.push(i); });
  return { paths, missing };
}
