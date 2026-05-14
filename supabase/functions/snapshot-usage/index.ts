import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logUsage, logInvocation } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  logInvocation("snapshot-usage").catch(() => {});

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DB size
    const { data: dbSizeData, error: dbErr } = await adminClient.rpc("get_db_size_mb");
    if (dbErr) {
      console.error("get_db_size_mb error:", dbErr);
    }
    const dbSizeMb = Number(dbSizeData ?? 0);

    // Storage size per bucket
    const { data: storageRows, error: stErr } = await adminClient.rpc("get_storage_size_mb");
    if (stErr) {
      console.error("get_storage_size_mb error:", stErr);
    }

    const storageBuckets = (storageRows || []) as Array<{ bucket_id: string; size_mb: number }>;
    const totalStorageMb = storageBuckets.reduce((s, b) => s + Number(b.size_mb || 0), 0);

    // Log snapshots
    await Promise.all([
      logUsage({
        service: "supabase_db",
        event_type: "storage_snapshot",
        units: dbSizeMb,
        unit_type: "mb_month",
        source_function: "snapshot-usage",
        metadata: { snapshot_at: new Date().toISOString() },
      }),
      logUsage({
        service: "supabase_storage",
        event_type: "storage_snapshot",
        units: totalStorageMb,
        unit_type: "mb_month",
        source_function: "snapshot-usage",
        metadata: { buckets: storageBuckets, snapshot_at: new Date().toISOString() },
      }),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        db_size_mb: dbSizeMb,
        storage_mb: totalStorageMb,
        buckets: storageBuckets,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("snapshot-usage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
