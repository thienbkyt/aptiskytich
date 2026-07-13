// Worker: claims pending grading_jobs, invokes grade-exam via internal bypass,
// stores the response in raw_response so the client (or a future finalize path)
// can consume it. Safety-net for when live client-side grading fails.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Speaking jobs may store `audioPaths` (bucket paths) instead of `audios`
 * (base64) to keep jsonb payloads small. Resolve paths to base64 before
 * calling grade-exam. Missing/failed downloads become empty strings so
 * grade-exam still runs and grades whatever is available.
 */
async function hydrateAudioPaths(payload: any): Promise<any> {
  if (!payload || payload.type !== "speaking_v2") return payload;
  const paths: Array<string | null | undefined> = Array.isArray(payload.audioPaths)
    ? payload.audioPaths
    : null;
  if (!paths) return payload;

  const audios: string[] = [];
  for (const p of paths) {
    if (!p || typeof p !== "string") {
      audios.push("");
      continue;
    }
    try {
      const { data, error } = await admin.storage
        .from("speaking-recordings")
        .download(p);
      if (error || !data) {
        console.warn("[worker] audio download failed:", p, error?.message);
        audios.push("");
        continue;
      }
      const buf = new Uint8Array(await data.arrayBuffer());
      audios.push(bytesToBase64(buf));
    } catch (e: any) {
      console.warn("[worker] audio download threw:", p, e?.message);
      audios.push("");
    }
  }

  const { audioPaths, ...rest } = payload;
  return { ...rest, audios };
}

async function invokeGradeExam(payload: any, userId: string): Promise<{ ok: boolean; status: number; body: any }> {
  const hydrated = await hydrateAudioPaths(payload);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "x-internal-key": SERVICE_ROLE,
      "x-internal-user-id": userId,
    },
    body: JSON.stringify(hydrated),
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data: jobs, error } = await admin.rpc("claim_grading_jobs", {
      _limit: 5,
      _reclaim_after: "10 minutes",
    });
    if (error) {
      console.error("[worker] claim error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string }> = [];

    for (const job of jobs || []) {
      try {
        const payload = job.payload || {};
        const { ok, status, body } = await invokeGradeExam(payload, job.user_id);

        if (ok && body && !body.error) {
          await admin.from("grading_jobs").update({
            status: "done",
            finished_at: new Date().toISOString(),
            raw_response: body,
            last_error: null,
          }).eq("id", job.id);
          results.push({ id: job.id, status: "done" });
        } else {
          const errMsg = (body && body.error) ? String(body.error) : `HTTP ${status}`;
          const isFinal = (job.attempts || 0) >= (job.max_attempts || 3);
          await admin.from("grading_jobs").update({
            status: isFinal ? "failed" : "pending",
            claimed_at: null,
            last_error: errMsg,
            finished_at: isFinal ? new Date().toISOString() : null,
          }).eq("id", job.id);
          results.push({ id: job.id, status: isFinal ? "failed" : "retry" });
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        const isFinal = (job.attempts || 0) >= (job.max_attempts || 3);
        await admin.from("grading_jobs").update({
          status: isFinal ? "failed" : "pending",
          claimed_at: null,
          last_error: errMsg,
          finished_at: isFinal ? new Date().toISOString() : null,
        }).eq("id", job.id);
        results.push({ id: job.id, status: isFinal ? "failed" : "retry" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[worker] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
