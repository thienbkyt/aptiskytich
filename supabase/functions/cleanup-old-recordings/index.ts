import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BUCKET = "speaking-recordings";
const RETENTION_DAYS = 45;
/** V2 grading uploads (<user>/<session>/<part>/<idx>.webm) are short-lived. */
const V2_RETENTION_DAYS = 7;
/** Hard cap per run so the request always finishes inside its budget. */
const MAX_DELETE_PER_RUN = 2000;

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True for the V2 grading layout: <user>/<session>/<part>/<idx>.webm */
function isV2Path(name: string): boolean {
  const segs = name.split("/");
  return segs.length === 4 && segs[0].length >= 32 && name.endsWith(".webm");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only the internal scheduler can trigger destructive sweeps: cron shared
  // secret (x-cron-secret) or a service_role JWT.
  const cronSecret = Deno.env.get("GRADING_CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (!(cronSecret && cronHeader === cronSecret)) {
    const authHeader = req.headers.get("Authorization");
    const claims = authHeader?.startsWith("Bearer ")
      ? parseJwtClaims(authHeader.slice("Bearer ".length).trim())
      : null;
    if (claims?.role !== "service_role") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: string[] = [];
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const cutoffV2 = new Date(Date.now() - V2_RETENTION_DAYS * 86400_000).toISOString();

  // ── 1) Candidates come from a SECURITY DEFINER RPC: PostgREST does not
  //       expose the storage schema, so direct table reads always fail.
  //       PostgREST caps a response at 1000 rows, so run several passes until
  //       the per-run cap is reached (deleted files never come back).
  let scanned = 0;
  let v2Candidates = 0;
  let deleted = 0;

  for (let pass = 0; pass < 4 && deleted < MAX_DELETE_PER_RUN; pass++) {
    const room = MAX_DELETE_PER_RUN - deleted;
    const toDelete: string[] = [];

    const { data, error } = await supabase.rpc("list_old_speaking_recordings", {
      _cutoff: cutoff,
      _cutoff_v2: cutoffV2,
      _limit: Math.min(room * 2, 1000),
    });
    if (error) { errors.push("list: " + error.message); break; }

    const rows = ((data || []) as any[]).filter((r) => r?.name);
    if (!rows.length) break;
    const oldNames: string[] = rows.filter((r) => !r.is_v2).map((r) => r.name as string);
    const v2Names: string[] = rows
      .filter((r) => r.is_v2)
      .map((r) => r.name as string)
      .filter((n) => isV2Path(n));

    for (const n of oldNames) {
      if (toDelete.length >= room) break;
      scanned += 1;
      toDelete.push(n);
    }

    if (toDelete.length < room && v2Names.length) {
      // Never touch a file whose owner still has grading work in flight.
      const userIds = [...new Set(v2Names.map((n) => n.split("/")[0]))];
      const busyUsers = new Set<string>();
      if (userIds.length) {
        const { data: jobs, error: jobErr } = await supabase
          .from("grading_jobs")
          .select("user_id")
          .in("status", ["pending", "processing"])
          .in("user_id", userIds)
          .gte("created_at", cutoffV2);
        if (jobErr) errors.push("jobs_query: " + jobErr.message);
        for (const j of ((jobs || []) as any[])) if (j.user_id) busyUsers.add(j.user_id);
      }

      // Rows tracked in speaking_recordings are handled by the 45-day rule only.
      const tracked = new Set<string>();
      for (let i = 0; i < v2Names.length; i += 200) {
        const batch = v2Names.slice(i, i + 200);
        const { data: recs } = await supabase
          .from("speaking_recordings")
          .select("audio_url")
          .in("audio_url", batch);
        for (const r of ((recs || []) as any[])) if (r.audio_url) tracked.add(r.audio_url);
      }

      for (const n of v2Names) {
        if (toDelete.length >= room) break;
        if (tracked.has(n)) continue;
        if (busyUsers.has(n.split("/")[0])) continue;
        v2Candidates += 1;
        scanned += 1;
        toDelete.push(n);
      }
    }

    if (!toDelete.length) break;

    // ── 2) Remove via the storage API (never DELETE storage.objects) ─────────
    let deletedThisPass = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { data: removed, error: remErr } = await supabase.storage.from(BUCKET).remove(batch);
      if (remErr) { errors.push("remove: " + remErr.message); continue; }
      deletedThisPass += removed?.length ?? 0;

      const { error: rowErr } = await supabase
        .from("speaking_recordings")
        .delete()
        .in("audio_url", batch);
      if (rowErr) errors.push("row_delete: " + rowErr.message);
    }
    deleted += deletedThisPass;
    if (!deletedThisPass) break;
  }


  // ── 4) How much of the backlog is left for the next hourly run ───────────
  let remaining = 0;
  {
    const { data, error } = await supabase.rpc("count_old_speaking_recordings", {
      _cutoff: cutoff,
    });
    if (error) errors.push("remaining: " + error.message);
    remaining = typeof data === "number" ? data : 0;
  }


  return new Response(
    JSON.stringify({ cutoff, cutoffV2, scanned, v2Candidates, deleted, remaining, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
