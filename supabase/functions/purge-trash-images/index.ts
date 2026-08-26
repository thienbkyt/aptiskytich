import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAdmin(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rows, error } = await supabase
    .from("trash_images_20260826")
    .select("b, f");
  if (error) {
    return new Response(JSON.stringify({ step: "query", error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const groups: Record<string, string[]> = {};
  for (const r of rows ?? []) {
    const bucket = (r as any).b as string;
    const path = (r as any).f as string;
    if (!bucket || !path) continue;
    (groups[bucket] ||= []).push(path);
  }

  const result: Record<string, { total: number; removed: number }> = {};
  const errors: string[] = [];

  for (const [bucket, names] of Object.entries(groups)) {
    result[bucket] = { total: names.length, removed: 0 };
    for (let i = 0; i < names.length; i += 100) {
      const batch = names.slice(i, i + 100);
      const { data, error: rmErr } = await supabase.storage.from(bucket).remove(batch);
      if (rmErr) errors.push(`${bucket}: ${rmErr.message}`);
      result[bucket].removed += data?.length ?? 0;
    }
  }

  return new Response(JSON.stringify({ result, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
