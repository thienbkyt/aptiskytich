import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, logInvocation } from "../_shared/usage-logger.ts";
import { requireUser } from "../_shared/auth.ts";
import { enforceDailyQuota } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req, corsHeaders);
  if (auth instanceof Response) return auth;

  logInvocation("dictionary-lookup").catch(() => {});

  try {
    const { word } = await req.json();
    if (!word || typeof word !== "string") {
      return new Response(JSON.stringify({ error: "Missing word" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clean = word.trim().toLowerCase();

    // Check DB cache first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cached } = await supabase
      .from("dictionary_cache")
      .select("result")
      .eq("word", clean)
      .maybeSingle();

    if (cached?.result) {
      return new Response(JSON.stringify(cached.result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Not cached — enforce daily quota before calling AI
    const quota = await enforceDailyQuota(auth.userId, "dictionary-lookup", 200, corsHeaders);
    if (quota) return quota;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an English-Vietnamese dictionary API. Given an English word, return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "word": "the word",
  "phonetic": "IPA phonetic transcription",
  "meanings": [{"partOfSpeech": "noun/verb/adj/etc", "definition_vi": "Vietnamese definition", "definition_en": "English definition"}],
  "examples": [{"en": "English example sentence using the word", "vi": "Vietnamese translation"}],
  "synonyms": ["synonym1", "synonym2"],
  "wordFamily": [{"word": "related word", "partOfSpeech": "noun/verb/adj/etc"}]
}
Provide 1-3 meanings, 1-2 examples, up to 5 synonyms, and up to 5 word family members. Be accurate and concise.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: clean },
          ],
          max_tokens: 2048,
          response_format: { type: "json_object" },
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
      return new Response(JSON.stringify({ error: "AI lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    logAIUsage({
      model: "google/gemini-2.5-flash-lite",
      usage: data.usage,
      source_function: "dictionary-lookup",
      metadata: { word: clean },
    }).catch(() => {});

    const finishReason = data.choices?.[0]?.finish_reason;
    let content = data.choices?.[0]?.message?.content || "";

    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    if (!content) {
      console.error("Empty AI response. finish_reason:", finishReason, "raw:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned empty response", finishReason }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractJson = (text: string): any => {
      const start = text.search(/[\{\[]/);
      const isArr = start !== -1 && text[start] === "[";
      const end = text.lastIndexOf(isArr ? "]" : "}");
      if (start === -1 || end === -1) throw new Error("no json boundaries");
      let cleaned = text.substring(start, end + 1);
      try { return JSON.parse(cleaned); } catch {
        cleaned = cleaned
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, " ");
        return JSON.parse(cleaned);
      }
    };

    let parsed: any;
    try {
      parsed = extractJson(content);
    } catch (parseErr) {
      console.error("Parse failed. finish_reason:", finishReason, "content:", content.slice(0, 800));
      return new Response(
        JSON.stringify({ error: "AI returned invalid format", finishReason }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to cache (fire-and-forget)
    supabase
      .from("dictionary_cache")
      .upsert({ word: clean, result: parsed }, { onConflict: "word" })
      .then(({ error: cacheErr }) => {
        if (cacheErr) console.error("Cache write error:", cacheErr);
      });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dictionary-lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
