import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "speaking-recordings";
const RETENTION_DAYS = 45;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const toDelete: string[] = [];
  const errors: string[] = [];
  const PAGE = 1000;
  let offset = 0;
  let scanned = 0;

  // Query storage.objects directly (service role has access)
  while (true) {
    const { data, error } = await (supabase as any)
      .schema("storage")
      .from("objects")
      .select("name")
      .eq("bucket_id", BUCKET)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      errors.push("query: " + error.message);
      break;
    }
    if (!data || data.length === 0) break;
    scanned += data.length;
    for (const row of data) if (row.name) toDelete.push(row.name);
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 200_000) break; // safety
  }

  let removed = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) errors.push("remove: " + error.message);
    removed += data?.length ?? 0;
  }

  return new Response(
    JSON.stringify({ cutoff, scanned, candidates: toDelete.length, removed, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
