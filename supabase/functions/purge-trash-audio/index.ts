import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAdmin(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pull the verified list of orphaned audio paths.
  const { data: rows, error: qErr } = await admin
    .from("trash_audio_20260826")
    .select("f");
  if (qErr) {
    return new Response(
      JSON.stringify({ step: "read_trash", error: qErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const paths = (rows ?? [])
    .map((r: any) => r.f)
    .filter((p: unknown): p is string => typeof p === "string" && p.length > 0);

  const chunk = <T,>(arr: T[], n: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  let removed = 0;
  const errs: string[] = [];
  for (const batch of chunk(paths, 100)) {
    const { data, error } = await admin.storage.from("audio").remove(batch);
    if (error) errs.push(error.message);
    removed += data?.length ?? 0;
  }

  return new Response(
    JSON.stringify({
      requested: paths.length,
      removed,
      errors: errs,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
