import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsage, logInvocation } from "../_shared/usage-logger.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOICE_CONFIG = {
  en: { languageCode: "en-US", name: "en-US-Neural2-J" },
  vi: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
} as const;

// Simple stable hash (FNV-1a 32-bit) — fine for cache key
function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function buildCacheKey(text: string, lang: string, voice: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return `${hash(normalized + "|" + lang + "|" + voice)}_${normalized.slice(0, 24).replace(/[^a-z0-9]+/g, "-")}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require authenticated user to prevent unauthenticated cost abuse of the
  // paid Google TTS API. Unique-text requests bypass cache and are billed
  // per character, so open access would let anyone drive up costs.
  const auth = await requireUser(req, corsHeaders);
  if (auth instanceof Response) return auth;
  logInvocation("tts").catch(() => {});

  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const lang = body.lang === "vi" ? "vi" : "en";
    const cfg = VOICE_CONFIG[lang];
    const voice = typeof body.voice === "string" && body.voice ? body.voice : cfg.name;

    if (!text || text.length > 1000) {
      return new Response(JSON.stringify({ error: "Invalid text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cacheKey = buildCacheKey(text, lang, voice);
    const path = `${lang}/${cacheKey}.mp3`;

    // Check cache via public URL (HEAD)
    const { data: pub } = supabase.storage.from("tts-cache").getPublicUrl(path);
    const url = pub.publicUrl;

    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      return new Response(JSON.stringify({ url, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Not cached — call Google TTS
    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_TTS_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: cfg.languageCode, name: voice },
          audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("Google TTS error:", ttsRes.status, errText);
      return new Response(JSON.stringify({ error: "TTS service temporarily unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await ttsRes.json();
    const audioContent = json.audioContent as string | undefined;
    if (!audioContent) {
      return new Response(JSON.stringify({ error: "No audio returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log Google TTS usage (chars)
    logUsage({
      service: "google_tts",
      event_type: "tts_synthesis",
      units: text.length,
      unit_type: "chars",
      source_function: "tts",
      metadata: { lang, voice },
    }).catch(() => {});

    const bytes = base64ToBytes(audioContent);
    const { error: upErr } = await supabase.storage
      .from("tts-cache")
      .upload(path, bytes, {
        contentType: "audio/mpeg",
        upsert: true,
        cacheControl: "31536000",
      });

    if (upErr) {
      console.error("Upload error:", upErr);
      // Still return inline so client can play (data URL fallback could be added)
      return new Response(JSON.stringify({ error: "Upload failed", detail: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("tts function error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
