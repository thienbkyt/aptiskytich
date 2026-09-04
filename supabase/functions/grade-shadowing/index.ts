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

type WordStatus = "correct" | "close" | "wrong" | "missing";
type WordResult = { expected: string; spoken: string | null; status: WordStatus; ipa?: string };

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1).fill(0);
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a: string, b: string) {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * LCS theo từ để cố định các mốc khớp tuyệt đối, sau đó ghép các đoạn chưa khớp
 * theo thứ tự và chấm bằng Levenshtein chuẩn hoá.
 */
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
  // Truy vết ra danh sách cặp khớp tuyệt đối (theo thứ tự tăng).
  const anchors: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] && a[i - 1] === b[j - 1]) {
      anchors.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  anchors.reverse();

  const words: WordResult[] = new Array(m);
  const extra: string[] = [];

  let expCursor = 0;
  let gotCursor = 0;

  const handleGap = (expEnd: number, gotEnd: number) => {
    const expIdx: number[] = [];
    for (let k = expCursor; k < expEnd; k++) expIdx.push(k);
    const gotIdx: number[] = [];
    for (let k = gotCursor; k < gotEnd; k++) gotIdx.push(k);

    const pairCount = Math.min(expIdx.length, gotIdx.length);
    for (let p = 0; p < pairCount; p++) {
      const e = expIdx[p];
      const g = gotIdx[p];
      const sim = similarity(a[e], b[g]);
      const status: WordStatus = sim >= 0.99 ? "correct" : sim >= 0.6 ? "close" : "wrong";
      words[e] = { expected: expRaw[e], spoken: gotRaw[g], status };
    }
    for (let p = pairCount; p < expIdx.length; p++) {
      const e = expIdx[p];
      words[e] = { expected: expRaw[e], spoken: null, status: "missing" };
    }
    for (let p = pairCount; p < gotIdx.length; p++) {
      extra.push(gotRaw[gotIdx[p]]);
    }
  };

  for (const [ei, gi] of anchors) {
    handleGap(ei, gi);
    words[ei] = { expected: expRaw[ei], spoken: gotRaw[gi], status: "correct" };
    expCursor = ei + 1;
    gotCursor = gi + 1;
  }
  handleGap(m, n);

  const correctCount = words.filter((w) => w?.status === "correct").length;
  const closeCount = words.filter((w) => w?.status === "close").length;
  const score = m > 0 ? Math.round(((correctCount + 0.5 * closeCount) / m) * 100) : 0;

  return { score, words, extra };
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
/* IPA lookup (text-only, best effort — never breaks grading)          */
/* ------------------------------------------------------------------ */
const IPA_TOOL = {
  type: "function",
  function: {
    name: "submit_ipa",
    description: "Return British English (RP) IPA transcriptions for the given words.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              ipa: { type: "string" },
            },
            required: ["word", "ipa"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

async function fetchIpa(words: string[]): Promise<Record<string, string>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || words.length === 0) return {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You provide British English (Received Pronunciation) IPA transcriptions. " +
              "Return IPA characters only, without slashes or brackets. Keep each input word unchanged in the `word` field.",
          },
          {
            role: "user",
            content: `Give the RP IPA for each of these words: ${words.join(", ")}`,
          },
        ],
        tools: [IPA_TOOL],
        tool_choice: { type: "function", function: { name: "submit_ipa" } },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    logAIUsage({
      model: MODEL,
      usage: data?.usage,
      source_function: "grade-shadowing-ipa",
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
    }).catch(() => {});
    const raw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof raw !== "string") return {};
    const parsed = JSON.parse(raw);
    const out: Record<string, string> = {};
    for (const it of Array.isArray(parsed?.items) ? parsed.items : []) {
      const w = typeof it?.word === "string" ? it.word : "";
      const ipa = typeof it?.ipa === "string" ? it.ipa.replace(/[/[\]]/g, "").trim() : "";
      if (w && ipa) out[normWord(w)] = ipa;
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
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
    if (approxBytes < 2000) {
      return json({
        transcript: "",
        score: 0,
        words: tokenize(text).map((w) => ({ expected: w, spoken: null, status: "missing" })),
        extra: [],
      });
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

    try {
      await userClient.rpc("log_feature_usage", { p_key: "ai_shadowing" });
    } catch (logErr) {
      console.error("[grade-shadowing] log_feature_usage failed:", logErr);
      // vẫn trả kết quả chấm cho học viên, không chặn vì lỗi ghi usage
    }


    return json({ transcript, score, missed, extra });
  } catch (e) {
    console.error("[grade-shadowing] error:", e);
    return json({ error: "Không chấm được bản thu, vui lòng thử lại." }, 500);
  }
});
