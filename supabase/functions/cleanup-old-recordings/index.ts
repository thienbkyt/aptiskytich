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

  const objects = (supabase as any).schema("storage").from("objects");

  // ── 1) Everything past the 45-day retention window ────────────────────────
  const toDelete: string[] = [];
  let scanned = 0;
  {
    const { data, error } = await objects
      .select("name")
      .eq("bucket_id", BUCKET)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_DELETE_PER_RUN);
    if (error) errors.push("query: " + error.message);
    for (const row of (data || []) as any[]) {
      scanned += 1;
      if (row.name) toDelete.push(row.name);
    }
  }

  // ── 2) V2 grading uploads older than 7 days with no live grading job ──────
  let v2Candidates = 0;
  if (toDelete.length < MAX_DELETE_PER_RUN) {
    const room = MAX_DELETE_PER_RUN - toDelete.length;
    const { data, error } = await objects
      .select("name")
      .eq("bucket_id", BUCKET)
      .lt("created_at", cutoffV2)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(room * 2);
    if (error) errors.push("v2_query: " + error.message);

    const names = ((data || []) as any[]).map((r) => r.name).filter((n: string) => n && isV2Path(n));
    // Never touch a file whose owner still has grading work in flight.
    const userIds = [...new Set(names.map((n: string) => n.split("/")[0]))];
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
    for (let i = 0; i < names.length; i += 200) {
      const batch = names.slice(i, i + 200);
      const { data: recs } = await supabase
        .from("speaking_recordings")
        .select("audio_url")
        .in("audio_url", batch);
      for (const r of ((recs || []) as any[])) if (r.audio_url) tracked.add(r.audio_url);
    }

    for (const n of names) {
      if (toDelete.length >= MAX_DELETE_PER_RUN) break;
      if (tracked.has(n)) continue;
      if (busyUsers.has(n.split("/")[0])) continue;
      v2Candidates += 1;
      scanned += 1;
      toDelete.push(n);
    }
  }

  // ── 3) Remove via the storage API (never DELETE storage.objects) ──────────
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) { errors.push("remove: " + error.message); continue; }
    deleted += data?.length ?? 0;

    const { error: rowErr } = await supabase
      .from("speaking_recordings")
      .delete()
      .in("audio_url", batch);
    if (rowErr) errors.push("row_delete: " + rowErr.message);
  }

  // ── 4) How much of the backlog is left for the next hourly run ───────────
  let remaining = 0;
  {
    const { count, error } = await objects
      .select("id", { count: "exact", head: true })
      .eq("bucket_id", BUCKET)
      .lt("created_at", cutoff);
    if (error) errors.push("remaining: " + error.message);
    remaining = count ?? 0;
  }

  return new Response(
    JSON.stringify({ cutoff, cutoffV2, scanned, v2Candidates, deleted, remaining, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
