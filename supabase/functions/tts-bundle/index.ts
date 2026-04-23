import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VOICE_CONFIG = {
  en: { languageCode: "en-US", name: "en-US-Neural2-J" },
  vi: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
} as const;

type Lang = "en" | "vi";

interface Segment {
  text: string;
  lang: Lang;
  rate?: number;
  // Silence (ms) to append after this segment
  pauseMs?: number;
}

interface RequestBody {
  segments: Segment[];
  // Optional: name used for the output file
  filename?: string;
}

function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function segmentCacheKey(seg: Segment): string {
  const voice = VOICE_CONFIG[seg.lang].name;
  const rate = seg.rate ?? 0.95;
  const normalized = seg.text.trim().toLowerCase().replace(/\s+/g, " ");
  const slug = normalized.slice(0, 24).replace(/[^a-z0-9]+/g, "-");
  return `${hash(`${normalized}|${seg.lang}|${voice}|${rate}`)}_${slug}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** A small valid MP3 silent frame (MPEG1 Layer3, 44.1kHz, 32kbps, mono) */
const SILENT_FRAME = new Uint8Array([
  0xff, 0xfb, 0x10, 0xc4, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
// Each frame ≈ 26ms at 32kbps/44.1kHz mono (1152 samples / 44100Hz)
const FRAME_MS = 26;

function silenceBytes(ms: number): Uint8Array {
  if (!ms || ms <= 0) return new Uint8Array(0);
  const frames = Math.max(1, Math.round(ms / FRAME_MS));
  const out = new Uint8Array(SILENT_FRAME.length * frames);
  for (let i = 0; i < frames; i++) {
    out.set(SILENT_FRAME, i * SILENT_FRAME.length);
  }
  return out;
}

async function fetchOrGenerateSegment(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  seg: Segment,
): Promise<Uint8Array> {
  const cfg = VOICE_CONFIG[seg.lang];
  const cacheKey = segmentCacheKey(seg);
  const path = `${seg.lang}/${cacheKey}.mp3`;

  // Try cache via download (we need bytes, not URL)
  const { data: dl } = await supabase.storage.from("tts-cache").download(path);
  if (dl) {
    const buf = await dl.arrayBuffer();
    return new Uint8Array(buf);
  }

  // Generate via Google TTS
  const ttsRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: seg.text },
        voice: { languageCode: cfg.languageCode, name: cfg.name },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: seg.rate ?? 0.95,
        },
      }),
    },
  );

  if (!ttsRes.ok) {
    const errText = await ttsRes.text();
    throw new Error(`Google TTS error: ${errText}`);
  }

  const json = await ttsRes.json();
  const audioContent = json.audioContent as string | undefined;
  if (!audioContent) throw new Error("Google TTS returned no audio");

  const bytes = base64ToBytes(audioContent);

  // Cache it (best-effort, don't block on errors)
  supabase.storage
    .from("tts-cache")
    .upload(path, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "31536000",
    })
    .then(({ error }) => {
      if (error) console.warn("[tts-bundle] cache upload failed:", error.message);
    });

  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const segments = Array.isArray(body.segments) ? body.segments : [];

    if (!segments.length) {
      return new Response(JSON.stringify({ error: "No segments provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (segments.length > 600) {
      return new Response(JSON.stringify({ error: "Too many segments (max 600)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate segments
    for (const s of segments) {
      if (!s || typeof s.text !== "string" || !s.text.trim()) {
        return new Response(JSON.stringify({ error: "Invalid segment text" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (s.text.length > 1000) {
        return new Response(JSON.stringify({ error: "Segment text too long (max 1000 chars)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (s.lang !== "en" && s.lang !== "vi") {
        return new Response(JSON.stringify({ error: "Invalid lang (en|vi)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_TTS_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Generate bundle key from all segments
    const bundleSig = segments
      .map((s) => `${segmentCacheKey(s)}|${s.pauseMs ?? 0}`)
      .join("~");
    const bundleHash = hash(bundleSig);
    const safeName = (body.filename || "audio-3r").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
    const bundlePath = `bundles/${safeName}-${bundleHash}.mp3`;

    // Check if bundle already cached
    const { data: pub } = supabase.storage.from("tts-cache").getPublicUrl(bundlePath);
    const head = await fetch(pub.publicUrl, { method: "HEAD" });
    if (head.ok) {
      return new Response(JSON.stringify({ url: pub.publicUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch / generate each segment in parallel (cap concurrency)
    const concurrency = 6;
    const results: Uint8Array[] = new Array(segments.length);
    let cursor = 0;
    async function worker() {
      while (cursor < segments.length) {
        const i = cursor++;
        const seg = segments[i];
        const audio = await fetchOrGenerateSegment(supabase, apiKey, seg);
        const pause = silenceBytes(seg.pauseMs ?? 0);
        results[i] = pause.length ? concatBytes([audio, pause]) : audio;
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));

    const merged = concatBytes(results);

    const { error: upErr } = await supabase.storage
      .from("tts-cache")
      .upload(bundlePath, merged, {
        contentType: "audio/mpeg",
        upsert: true,
        cacheControl: "31536000",
      });

    if (upErr) {
      console.error("Bundle upload error:", upErr);
      return new Response(JSON.stringify({ error: "Bundle upload failed", detail: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: pub.publicUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("tts-bundle error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
