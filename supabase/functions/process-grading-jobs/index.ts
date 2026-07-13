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

async function invokeGradeExam(payload: any, userId: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "x-internal-key": SERVICE_ROLE,
      "x-internal-user-id": userId,
    },
    body: JSON.stringify(payload),
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
