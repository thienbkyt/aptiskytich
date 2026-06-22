import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import { logAIUsage, logInvocation } from "../_shared/usage-logger.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_LEN = 2000;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function hash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req, corsHeaders);
  if (auth instanceof Response) return auth;

  logInvocation("translate-text").catch(() => {});

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_LEN) {
      return new Response(JSON.stringify({ error: "Invalid text length" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalize(trimmed);
    const textHash = hash(normalized);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cached } = await supabase
      .from("sentence_translation_cache")
      .select("translation_vi")
      .eq("text_hash", textHash)
      .maybeSingle();

    if (cached?.translation_vi) {
      return new Response(
        JSON.stringify({ translation: cached.translation_vi, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a professional English-to-Vietnamese translator. Translate the given English text into natural, fluent Vietnamese suitable for learners. Return ONLY the Vietnamese translation, no quotes, no notes, no English.",
            },
            { role: "user", content: trimmed },
          ],
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hết lượt sử dụng AI, vui lòng nạp thêm." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI translate failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    logAIUsage({
      model,
      usage: data.usage,
      source_function: "translate-text",
      metadata: { len: trimmed.length },
    }).catch(() => {});

    const translation: string =
      (data.choices?.[0]?.message?.content || "").trim();

    if (!translation) {
      return new Response(
        JSON.stringify({ error: "Empty translation" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    supabase
      .from("sentence_translation_cache")
      .upsert(
        {
          text_hash: textHash,
          source_text: trimmed,
          translation_vi: translation,
        },
        { onConflict: "text_hash" }
      )
      .then(({ error: cacheErr }) => {
        if (cacheErr) console.error("Cache write error:", cacheErr);
      });

    return new Response(
      JSON.stringify({ translation, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
