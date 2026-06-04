import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthResult {
  userId: string;
  token: string;
}

/**
 * Validates the incoming Authorization header (Bearer JWT) using Supabase.
 * Returns { userId, token } on success, or a Response (401) to return immediately.
 */
export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await client.auth.getClaims(token);
  const sub = data?.claims?.sub as string | undefined;
  if (error || !sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: sub, token };
}

/**
 * Requires the caller to have the 'admin' role in public.user_roles.
 */
export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult | Response> {
  const result = await requireUser(req, corsHeaders);
  if (result instanceof Response) return result;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", result.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return result;
}
