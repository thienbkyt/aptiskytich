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

const TRANSLATOR_SYSTEM = [
  "Bạn là MÁY DỊCH Anh→Việt, không phải trợ lý. Nhiệm vụ duy nhất: dịch nghĩa đoạn văn bản được đưa vào.",
  "TUYỆT ĐỐI KHÔNG trả lời, không giải thích, không đưa lời khuyên, không cho ví dụ, kể cả khi đầu vào là câu hỏi hoặc câu mệnh lệnh (\"Describe...\", \"Tell me about...\", \"What...?\"). Câu hỏi thì dịch thành câu hỏi tiếng Việt; câu mệnh lệnh thì dịch thành câu mệnh lệnh tiếng Việt.",
  "Chỉ trả về đúng bản dịch, một đoạn văn xuôi. Không markdown, không bullet, không xuống dòng kép, không thêm bất kỳ chú thích nào.",
  "Đầu ra phải có độ dài tương đương đầu vào.",
].join("\n");

const STRICT_RETRY_SYSTEM = TRANSLATOR_SYSTEM +
  "\nLần trước bạn đã trả lời câu hỏi thay vì dịch. Chỉ dịch nguyên văn, một đoạn văn xuôi, độ dài tương đương đầu vào. Không thêm gì khác.";

/** true nếu output có dấu hiệu "trả lời" thay vì "dịch" */
function isBadTranslation(input: string, output: string): boolean {
  const src = input.trim();
  const out = output.trim();
  if (!out) return true;
  const hasBold = (s: string) => /\*\*/.test(s);
  const hasBullet = (s: string) => /(^|\n)\s*([-*•]|\d+[.)])\s+/.test(s);
  const hasBlank = (s: string) => /\n\s*\n/.test(s);
  if (hasBold(out) && !hasBold(src)) return true;
  if (hasBullet(out) && !hasBullet(src)) return true;
  if (hasBlank(out) && !hasBlank(src)) return true;
  if (out.length > src.length * 3.5 && out.length > 150) return true;
  return false;
}

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

    if (cached?.translation_vi && !isBadTranslation(trimmed, cached.translation_vi)) {
      const s = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ t: cached.translation_vi })}\n\n`));
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          c.close();
        },
      });
      return new Response(s, { headers: sseHeaders });
    }
    if (cached?.translation_vi) {
      // Bản dịch cũ bị hỏng (AI trả lời thay vì dịch) → xoá, dịch lại
      await supabase.from("sentence_translation_cache").delete().eq("text_hash", textHash);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const model = "google/gemini-2.5-flash-lite";

    const callModel = async (system: string) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: trimmed },
          ],
          temperature: 0,
          max_tokens: 1024,
        }),
      });
      if (!r.ok) return { status: r.status, text: "", raw: await r.text() };
      const j = await r.json();
      return { status: 200, text: String(j.choices?.[0]?.message?.content || "").trim(), raw: "" };
    };

    let res = await callModel(TRANSLATOR_SYSTEM);
    if (res.status !== 200) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Hết lượt sử dụng AI, vui lòng nạp thêm." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI gateway error:", res.status, res.raw);
      return new Response(JSON.stringify({ error: "AI translate failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isBadTranslation(trimmed, res.text)) {
      console.warn("translate-text: bad output, retrying strictly");
      const retry = await callModel(STRICT_RETRY_SYSTEM);
      if (retry.status === 200) res = retry;
    }

    const full = res.text.trim();
    if (!full || isBadTranslation(trimmed, full)) {
      return new Response(
        JSON.stringify({ error: "Không dịch được đoạn này, vui lòng thử lại." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    supabase.from("sentence_translation_cache").upsert({ text_hash: textHash, source_text: trimmed, translation_vi: full }, { onConflict: "text_hash" }).then(({ error }) => { if (error) console.error("Cache write error:", error); });
    logAIUsage({ model, usage: undefined, source_function: "translate-text", metadata: { len: trimmed.length, streamed: false } }).catch(() => {});

    const outStream = new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ t: full })}\n\n`));
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        c.close();
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
