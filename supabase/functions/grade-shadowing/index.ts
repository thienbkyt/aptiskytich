import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";
import { logAIUsage, logInvocation } from "../_shared/usage-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/* ------------------------------------------------------------------ */
/* Scoring (code-side only — the AI never scores)                      */
/* ------------------------------------------------------------------ */
function normWord(w: string) {
  return w.toLowerCase().replace(/[^a-z0-9']/gi, "");
}

function tokenize(s: string) {
  return s.split(/\s+/).filter(Boolean);
}

/** LCS by word (case & punctuation insensitive). */
function scoreShadowing(expected: string, got: string) {
  const expRaw = tokenize(expected);
  const gotRaw = tokenize(got);
  const a = expRaw.map(normWord);
  const b = gotRaw.map(normWord);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] && a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matchedExp = new Array<boolean>(m).fill(false);
  const matchedGot = new Array<boolean>(n).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] && a[i - 1] === b[j - 1]) {
      matchedExp[i - 1] = true;
      matchedGot[j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  const hit = matchedExp.filter(Boolean).length;
  const score = m > 0 ? Math.round((hit / m) * 100) : 0;
  return {
    score,
    missed: expRaw.filter((_, k) => !matchedExp[k]),
    extra: gotRaw.filter((_, k) => !matchedGot[k]),
  };
}

/* ------------------------------------------------------------------ */
/* AI transcription                                                    */
/* ------------------------------------------------------------------ */
const MODEL = "google/gemini-2.5-flash";

const TRANSCRIBE_TOOL = {
  type: "function",
  function: {
    name: "submit_transcript",
    description: "Return the verbatim transcript of the audio.",
    parameters: {
      type: "object",
      properties: {
        transcript: {
          type: "string",
          description: "Exactly what the speaker says, verbatim. Empty string if nothing intelligible.",
        },
      },
      required: ["transcript"],
      additionalProperties: false,
    },
  },
};

async function transcribe(audioBase64: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a strict speech transcriber. Transcribe the audio EXACTLY as spoken, word for word. " +
          "Do NOT correct grammar, do NOT complete unfinished words, do NOT guess or reconstruct any target sentence, " +
          "do NOT translate, do NOT score or judge. If a word is unclear, write your best literal guess. " +
          "If there is no intelligible speech, return an empty transcript.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this recording verbatim." },
          { type: "input_audio", input_audio: { data: audioBase64, format: "webm" } },
        ],
      },
    ],
    tools: [TRANSCRIBE_TOOL],
    tool_choice: { type: "function", function: { name: "submit_transcript" } },
  };

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let resp: Response | null = null;
  let lastErr: unknown = null;
  for (let tries = 0; tries < 2; tries++) {
    try {
      const r = await attempt();
      if (r.ok) {
        resp = r;
        break;
      }
      // 429/5xx are retryable; everything else is terminal.
      const text = await r.text();
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error(`AI ${r.status}: ${text}`);
        if (tries === 0) {
          await new Promise((res) => setTimeout(res, 1200));
          continue;
        }
      }
      throw new Error(`AI ${r.status}: ${text}`);
    } catch (e) {
      lastErr = e;
      if (tries === 1) throw e;
    }
  }
  if (!resp) throw lastErr ?? new Error("AI request failed");

  const data = await resp.json();
  logAIUsage({
    model: MODEL,
    usage: data?.usage,
    source_function: "grade-shadowing",
    finishReason: data?.choices?.[0]?.finish_reason ?? null,
  }).catch(() => {});

  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const raw = call?.function?.arguments;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.transcript === "string" ? parsed.transcript : "";
    } catch {
      return "";
    }
  }
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

/* ------------------------------------------------------------------ */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  logInvocation("grade-shadowing").catch(() => {});

  try {
    const auth = await requireUser(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const bodyRaw = await req.json().catch(() => null);
    const audio = typeof bodyRaw?.audio === "string" ? bodyRaw.audio : "";
    const text = typeof bodyRaw?.text === "string" ? bodyRaw.text.trim() : "";
    if (!audio || !text) {
      return json({ error: "Thiếu audio hoặc câu gốc." }, 400);
    }
    if (text.length > 1000) {
      return json({ error: "Câu quá dài." }, 400);
    }

    // Approximate decoded byte length of the base64 payload.
    const approxBytes = Math.floor((audio.length * 3) / 4);
    if (approxBytes > 10 * 1024 * 1024) {
      return json({ error: "Bản thu quá lớn." }, 400);
    }

    // Too short / silent → no AI call, no usage logged.
    if (approxBytes < 20000) {
      return json({ transcript: "", score: 0, missed: tokenize(text), extra: [] });
    }

    // --- Feature gate (Pro / quota) ---
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${auth.token}` } } },
    );
    const { data: access, error: accessError } = await userClient.rpc("check_feature_access", {
      p_key: "ai_shadowing",
    });
    if (accessError) {
      console.error("[grade-shadowing] check_feature_access failed:", accessError);
      return json({ error: "pro_required" }, 403);
    }
    const a = (access ?? {}) as Record<string, unknown>;
    if (a.allowed !== true) {
      const reason = String(a.reason ?? "");
      const isQuota = reason.includes("quota");
      return json({ error: isQuota ? "quota_exceeded" : "pro_required", reason }, 403);
    }

    const transcript = (await transcribe(audio)).trim();
    const { score, missed, extra } = scoreShadowing(text, transcript);

    userClient.rpc("log_feature_usage", { p_key: "ai_shadowing" }).then(
      () => undefined,
      () => undefined,
    );

    return json({ transcript, score, missed, extra });
  } catch (e) {
    console.error("[grade-shadowing] error:", e);
    return json({ error: "Không chấm được bản thu, vui lòng thử lại." }, 500);
  }
});
