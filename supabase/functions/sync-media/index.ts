// sync-media — read-only signed-URL issuer for satellite sites (Aptis Lab, Aptis One).
//
// POST { "token": string, "files": [{ "bucket": "audio"|"exam-images", "path": string }] }
// - Auth: SHA-256(token) must exist in public.sync_access.token_sha256 (service role check).
// - For each file: creates a 600s signed URL via service role storage client.
// - Never logs or echoes the token. Max 200 files per call. No writes.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 200;
const SIGNED_URL_TTL = 600; // seconds
const ALLOWED_BUCKETS = new Set(["audio", "exam-images"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const token = typeof body?.token === "string" ? body.token : "";
  const files = Array.isArray(body?.files) ? body.files : [];
  if (!token) return json({ error: "missing_token" }, 400);
  if (files.length === 0) return json({ error: "missing_files" }, 400);
  if (files.length > MAX_FILES) return json({ error: "too_many_files", max: MAX_FILES }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Token check — hash only, never log the raw token.
  const tokenHash = await sha256Hex(token);
  const { data: access, error: accessErr } = await admin
    .from("sync_access")
    .select("id")
    .eq("token_sha256", tokenHash)
    .limit(1)
    .maybeSingle();
  if (accessErr) {
    console.error("sync-media: access check failed", accessErr.message);
    return json({ error: "internal" }, 500);
  }
  if (!access) return json({ error: "forbidden" }, 403);

  const results = await Promise.all(
    files.slice(0, MAX_FILES).map(async (f: any) => {
      const bucket = typeof f?.bucket === "string" ? f.bucket : "";
      const path = typeof f?.path === "string" ? f.path : "";
      if (!ALLOWED_BUCKETS.has(bucket)) {
        return { bucket, path, url: null, error: "bucket_not_allowed" };
      }
      if (!path || path.includes("..")) {
        return { bucket, path, url: null, error: "invalid_path" };
      }
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (error || !data?.signedUrl) {
        return { bucket, path, url: null, error: error?.message || "sign_failed" };
      }
      return { bucket, path, url: data.signedUrl };
    }),
  );

  return json({ results });
});
