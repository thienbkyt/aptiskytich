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

  const cl = req.headers.get("content-length");
  if (req.method === "POST" && (cl === "0" || cl === null)) {
    return new Response(JSON.stringify({ ok: true, warm: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    const encoder = new TextEncoder();
    const sseHeaders = { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

    const { data: cached } = await supabase
      .from("sentence_translation_cache")
      .select("translation_vi")
      .eq("text_hash", textHash)
      .maybeSingle();

    if (cached?.translation_vi) {
      const s = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ t: cached.translation_vi })}\n\n`));
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          c.close();
        },
      });
      return new Response(s, { headers: sseHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: "You are a professional English-to-Vietnamese translator. Translate the given English text into natural, fluent Vietnamese suitable for learners. Return ONLY the Vietnamese translation, no quotes, no notes, no English." },
          { role: "user", content: trimmed },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok || !response.body) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Hết lượt sử dụng AI, vui lòng nạp thêm." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI translate failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let full = "";
    const outStream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              const payload = l.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const token = j.choices?.[0]?.delta?.content || "";
                if (token) {
                  full += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: token })}\n\n`));
                }
              } catch { /* chunk chưa đủ, bỏ qua */ }
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "stream error" })}\n\n`));
        } finally {
          controller.close();
          if (full.trim()) {
            supabase.from("sentence_translation_cache").upsert({ text_hash: textHash, source_text: trimmed, translation_vi: full.trim() }, { onConflict: "text_hash" }).then(({ error }) => { if (error) console.error("Cache write error:", error); });
            logAIUsage({ model, usage: undefined, source_function: "translate-text", metadata: { len: trimmed.length, streamed: true } }).catch(() => {});
          }
        }
      },
    });
    return new Response(outStream, { headers: sseHeaders });
  } catch (e) {
    console.error("translate-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
