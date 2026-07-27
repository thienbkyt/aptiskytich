import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Admin check via user_roles
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional light mode: only user_id, email, display_name
    let mode = "full";
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (body?.mode === "light") mode = "light";
      }
    } catch (_) { /* ignore */ }

    // Fetch users (paginate up to 1000)
    const usersOut: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw error;
      usersOut.push(...(data?.users ?? []));
      if (!data?.users || data.users.length < 1000) break;
      page++;
      if (page > 10) break;
    }

    const userIds = usersOut.map((u) => u.id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ students: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profilesRes = await admin
      .from("profiles")
      .select("user_id,display_name,avatar_url")
      .in("user_id", userIds);

    const profilesMap = new Map<string, any>();
    (profilesRes.data ?? []).forEach((p: any) => profilesMap.set(p.user_id, p));

    if (mode === "light") {
      const students = usersOut.map((u) => ({
        user_id: u.id,
        email: u.email ?? "",
        display_name: profilesMap.get(u.id)?.display_name ?? null,
      }));
      return new Response(JSON.stringify({ students }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [streaksRes, statsRes, rolesRes] = await Promise.all([
      admin
        .from("learning_streaks")
        .select("user_id,current_streak,last_activity_date")
        .in("user_id", userIds),
      admin.rpc("admin_user_test_stats"),
      admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .in("user_id", userIds),
    ]);

    const adminSet = new Set<string>((rolesRes.data ?? []).map((r: any) => r.user_id));

    const streaksMap = new Map<string, any>();
    (streaksRes.data ?? []).forEach((s: any) => streaksMap.set(s.user_id, s));

    const resultsAgg = new Map<
      string,
      { count: number; lastLevel: string | null }
    >();
    (statsRes.data ?? []).forEach((r: any) => {
      resultsAgg.set(r.user_id, {
        count: r.total_attempts ?? 0,
        lastLevel: r.latest_level ?? null,
      });
    });

    const students = usersOut.map((u) => {
      const p = profilesMap.get(u.id);
      const s = streaksMap.get(u.id);
      const r = resultsAgg.get(u.id);
      return {
        user_id: u.id,
        email: u.email ?? "",
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        created_at: u.created_at,
        last_activity_date: s?.last_activity_date ?? null,
        current_streak: s?.current_streak ?? 0,
        total_attempts: r?.count ?? 0,
        latest_level: r?.lastLevel ?? null,
        is_admin: adminSet.has(u.id),
      };
    });



    // Sort by created_at desc
    students.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return new Response(JSON.stringify({ students }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-students error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
