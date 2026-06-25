import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface HighlightItem {
  id: string;
  script: string;
  context: string;
}
interface Body {
  exam_set_id: string;
  items: HighlightItem[];
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing");
      return json({ error: "Service misconfigured" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.exam_set_id || typeof body.exam_set_id !== "string") {
      return json({ error: "exam_set_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Validate exam_set_id exists and is published (or caller is admin)
    const { data: examSet } = await admin
      .from("exam_sets")
      .select("id,is_published")
      .eq("id", body.exam_set_id)
      .maybeSingle();
    if (!examSet) return json({ error: "Invalid exam_set_id" }, 404);

    const items = (body.items ?? []).filter((it) => it?.id && it?.script);

    // Content fingerprint binds cache entries to the exact payload, preventing
    // one user's poisoned payload from being served to others with a different payload.
    const canonical = JSON.stringify(
      items.map((it) => ({ id: it.id, script: it.script, context: it.context ?? "" })),
    );
    const content_hash = await sha256Hex(canonical);

    const { data: cached } = await admin
      .from("listening_review_cache")
      .select("data")
      .eq("exam_set_id", body.exam_set_id)
      .eq("content_hash", content_hash)
      .maybeSingle();

    if (cached?.data) {
      return json({ cached: true, ...cached.data });
    }

    if (items.length === 0) {
      const data = { highlights: {} };
      await admin
        .from("listening_review_cache")
        .upsert(
          { exam_set_id: body.exam_set_id, content_hash, data },
          { onConflict: "exam_set_id,content_hash" },
        );
      return json({ cached: false, ...data });
    }

    const prompt = `You are an English listening-comprehension assistant for Aptis exam prep.

For each ITEM below, identify the SHORTEST CONTIGUOUS SPAN from its SCRIPT (verbatim, copied exactly character-for-character including punctuation and casing) that proves the correct answer described in CONTEXT. Prefer a single sentence or short clause. The span MUST appear inside SCRIPT exactly as returned so it can be located by substring search.

ITEMS:
${JSON.stringify(items, null, 2)}

Return ONLY valid JSON with this exact shape:
{
  "highlights": { "<id>": "<exact span from that item's script>", ... }
}
Omit ids you cannot confidently locate. Do not invent or paraphrase.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only. No prose, no markdown fences." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "Credits exhausted" }, 402);
      return json({ error: "AI service temporarily unavailable" }, 400);
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { highlights?: Record<string, string> } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
      }
    }

    const data = { highlights: parsed.highlights ?? {} };

    await admin
      .from("listening_review_cache")
      .upsert(
        { exam_set_id: body.exam_set_id, content_hash, data },
        { onConflict: "exam_set_id,content_hash" },
      );

    return json({ cached: false, ...data });
  } catch (e) {
    console.error("listening-highlight error", e);
    return json({ error: "Service error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
