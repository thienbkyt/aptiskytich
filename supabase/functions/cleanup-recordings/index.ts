import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BUCKET = "speaking-recordings";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: cron secret OR admin JWT
  const cronHeader = req.headers.get("x-cron-secret");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = !!cronHeader && !!cronSecret && cronHeader === cronSecret;
  if (!isCron) {
    const auth = await requireAdmin(req, corsHeaders);
    if (auth instanceof Response) return auth;
  }

  let body: { dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun !== false; // default true

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: string[] = [];
  const nowIso = new Date().toISOString();
  const cutoffOrphan = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const cutoffExpired = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  // Fetch all graded test_result_ids (to exclude from orphan set)
  const gradedSet = new Set<string>();
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("speaking_question_gradings")
        .select("test_result_id")
        .not("test_result_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error) { errors.push("graded_query: " + error.message); break; }
      if (!data || data.length === 0) break;
      for (const r of data) if (r.test_result_id) gradedSet.add(r.test_result_id as string);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  // Fetch candidates from speaking_recordings
  type Rec = { id: string; audio_url: string; test_result_id: string | null; created_at: string };
  const orphan: Rec[] = [];
  const expired: Rec[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("speaking_recordings")
        .select("id, audio_url, test_result_id, created_at")
        .lt("created_at", cutoffOrphan)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { errors.push("rec_query: " + error.message); break; }
      if (!data || data.length === 0) break;
      for (const r of data as Rec[]) {
        if (!r.audio_url) continue;
        if (r.created_at < cutoffExpired) {
          expired.push(r);
        } else if (!r.test_result_id || !gradedSet.has(r.test_result_id)) {
          orphan.push(r);
        }
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  const toDelete = [...orphan, ...expired];
  const orphanCount = orphan.length;
  const expiredCount = expired.length;

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dryRun: true,
        now: nowIso,
        orphanCount,
        expiredCount,
        storageDeleted: 0,
        rowsDeleted: 0,
        sample: toDelete.slice(0, 20).map((r) => r.audio_url),
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Delete storage in batches of 100
  let storageDeleted = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const paths = batch.map((r) => r.audio_url).filter(Boolean);
    if (paths.length === 0) continue;
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) errors.push("storage_remove: " + error.message);
    storageDeleted += data?.length ?? 0;
  }

  // Delete rows by id
  let rowsDeleted = 0;
  const ids = toDelete.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { error, count } = await supabase
      .from("speaking_recordings")
      .delete({ count: "exact" })
      .in("id", batch);
    if (error) errors.push("row_delete: " + error.message);
    rowsDeleted += count ?? 0;
  }

  return new Response(
    JSON.stringify({
      dryRun: false,
      now: nowIso,
      orphanCount,
      expiredCount,
      storageDeleted,
      rowsDeleted,
      errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
