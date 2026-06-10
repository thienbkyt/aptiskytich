// AI Coach - streaming chat assistant for Aptis Kỳ Tích
// Features:
// - SSE streaming via Lovable AI Gateway
// - Smart model routing (Pro for images/long context, Flash otherwise)
// - Tool calling loop (lookup_vocabulary, get_user_progress)
// - Per-user in-memory rate limit (30/min) with Retry-After header
// - Analytics insertion into usage_events

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  pageText?: string;
};
type CoachContext = {
  pathname?: string;
  pageTitle?: string;
  skill?: string;
  part?: string | number;
  exam?: {
    skill?: string;
    part?: string | number;
    questionIndex?: number;
    totalQuestions?: number;
    questionText?: string;
    options?: string[];
    userAnswer?: string | null;
    correctAnswer?: string | null;
    explanation?: string | null;
    isSubmitted?: boolean;
  };
  dashboard?: {
    weakestSkill?: string;
    accuracyBySkill?: Record<string, number>;
    totalQuestions?: number;
    streak?: number;
    recentLevel?: string;
  };
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------- Rate limiting ----------
const rlMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(userId: string, limit = 30, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rlMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rlMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true, retryAfter: 0 };
}

// ---------- System prompt ----------
function buildSystemPrompt(ctx: CoachContext | undefined): string {
  const base = `Bạn là "Coach Kỳ Tích" - chuyên gia luyện thi APTIS General cho học viên Việt Nam (A2-B2).

NGUYÊN TẮC TRẢ LỜI (BẮT BUỘC TUÂN THỦ):
- Tiếng Việt, thân thiện nhưng CỰC NGẮN GỌN. Không lan man, không lời chào dài, không "Cùng xem nhé".
- KHÔNG dùng heading (#, ##), KHÔNG đánh số mục (1. 2. 3.), KHÔNG mục "Mẹo nhớ" riêng, KHÔNG bullet list trừ khi user yêu cầu chi tiết.

**FORMAT CHO CÂU TRẮC NGHIỆM (MCQ) — BẮT BUỘC theo đúng mẫu này, không thêm gì khác:**
✅ (X) <đáp án> — <lý do cốt lõi trong 1 câu>.
❌ <đáp án sai 1>: <lý do cực ngắn>
❌ <đáp án sai 2>: <lý do cực ngắn>

Ví dụ mẫu:
✅ (C) have — chủ ngữ "I" + thì hiện tại đơn → động từ nguyên mẫu.
❌ having: cần "be" đi trước (I am having...)
❌ has: chỉ dùng cho He / She / It

**FORMAT CHO CÂU HỎI KHÁC (không phải MCQ)**: tối đa 3–5 câu văn xuôi, không bullet, không heading. Chỉ giải thích chi tiết khi user hỏi rõ "giải thích chi tiết / kỹ hơn".

CHỐNG BỊA ĐỀ: Nếu ảnh mờ/cắt/không đọc được rõ → trả lời ĐÚNG NGUYÊN VĂN: "Mình chưa đọc rõ được đề trong ảnh. Bạn gõ lại đề + các đáp án giúp mình nhé 🙏" rồi DỪNG. KHÔNG đoán, KHÔNG bịa câu khác.
- KHÔNG hỏi lại "bạn gửi đề đi" khi đã có ảnh/context.
- Khi context có sẵn questionText: dùng đúng dữ liệu đó.
- User hỏi lộ trình/điểm yếu → gọi get_user_progress nếu chưa có dashboard.
- User hỏi nghĩa 1 từ tiếng Anh → gọi lookup_vocabulary.
- Chỉ trả lời về APTIS / tiếng Anh / cách dùng web Aptis Kỳ Tích.`;



  if (!ctx) return base;
  const lines: string[] = ["\n\n### NGỮ CẢNH"];
  if (ctx.pathname) lines.push(`- Trang: ${ctx.pathname}${ctx.pageTitle ? ` (${ctx.pageTitle})` : ""}`);
  if (ctx.skill) lines.push(`- Kỹ năng: ${ctx.skill}${ctx.part ? `, Part ${ctx.part}` : ""}`);

  if (ctx.exam?.questionText) {
    const q = ctx.exam;
    lines.push("- Câu hỏi đang làm:");
    lines.push(`  • Đề: ${q.questionText}`);
    if (q.options?.length) lines.push(`  • Lựa chọn: ${q.options.map((o, i) => `(${String.fromCharCode(65 + i)}) ${o}`).join(" | ")}`);
    if (q.userAnswer != null) lines.push(`  • User chọn: ${q.userAnswer}`);
    if (q.correctAnswer != null) lines.push(`  • Đáp án đúng: ${q.correctAnswer}`);
    if (q.explanation) lines.push(`  • Giải thích có sẵn: ${q.explanation}`);
    if (q.isSubmitted) lines.push(`  • Trạng thái: đã nộp bài`);
  }
  if (ctx.dashboard) {
    const d = ctx.dashboard;
    lines.push("- Tiến độ học (cached):");
    if (d.weakestSkill) lines.push(`  • Yếu nhất: ${d.weakestSkill}`);
    if (d.accuracyBySkill) {
      const parts = Object.entries(d.accuracyBySkill).map(([k, v]) => `${k}: ${v}%`).join(", ");
      lines.push(`  • Accuracy: ${parts}`);
    }
    if (typeof d.totalQuestions === "number") lines.push(`  • Tổng câu đã làm: ${d.totalQuestions}`);
    if (typeof d.streak === "number") lines.push(`  • Streak: ${d.streak} ngày`);
    if (d.recentLevel) lines.push(`  • Band gần nhất: ${d.recentLevel}`);
  }
  return base + lines.join("\n");
}

// ---------- Tools ----------
const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "lookup_vocabulary",
      description: "Tra cứu một từ tiếng Anh trong từ điển Aptis (phiên âm, nghĩa, ví dụ, họ từ).",
      parameters: {
        type: "object",
        properties: { word: { type: "string", description: "từ tiếng Anh cần tra cứu" } },
        required: ["word"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_progress",
      description: "Lấy số liệu chi tiết về tiến độ học của user hiện tại (accuracy theo từng kỹ năng và Part, các bài chấm Speaking/Writing gần nhất).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function execLookupVocab(word: string) {
  const w = (word || "").trim().toLowerCase();
  if (!w) return { error: "missing word" };
  try {
    // 1) project vocab DB
    const url = `${SUPABASE_URL}/rest/v1/system_vocab_words?word=ilike.${encodeURIComponent(w)}&select=word,phonetic,meaning,example_en,example_vi,word_family,word_type&limit=3`;
    const r = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const rows = r.ok ? await r.json() : [];
    if (rows?.length) return { source: "system_vocab", results: rows };
    // 2) cache fallback
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/dictionary_cache?word=eq.${encodeURIComponent(w)}&select=word,result&limit=1`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const cache = r2.ok ? await r2.json() : [];
    if (cache?.[0]) return { source: "dictionary_cache", results: cache };
    return { source: "none", results: [], note: "Không tìm thấy trong DB. Hãy tự giải thích từ kiến thức của bạn." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function execUserProgress(userId: string) {
  if (!userId || userId === "anon") return { error: "Cần đăng nhập để xem tiến độ chi tiết." };
  try {
    const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const [qrRes, gRes, sRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/exam_question_results?user_id=eq.${userId}&select=skill,is_correct&order=created_at.desc&limit=500`, { headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/exam_gradings?user_id=eq.${userId}&select=skill,part_type,overall_level,criteria,created_at&order=created_at.desc&limit=10`, { headers: h }),
      fetch(`${SUPABASE_URL}/rest/v1/learning_streaks?user_id=eq.${userId}&select=current_streak,longest_streak`, { headers: h }),
    ]);
    const qr = qrRes.ok ? await qrRes.json() : [];
    const g = gRes.ok ? await gRes.json() : [];
    const s = sRes.ok ? await sRes.json() : [];

    const agg: Record<string, { c: number; t: number }> = {};
    for (const r of qr) {
      const k = (r.skill || "other").toLowerCase();
      agg[k] ||= { c: 0, t: 0 };
      agg[k].t++;
      if (r.is_correct) agg[k].c++;
    }
    const accuracy: Record<string, { correct: number; total: number; pct: number }> = {};
    for (const [k, v] of Object.entries(agg)) {
      accuracy[k] = { correct: v.c, total: v.t, pct: Math.round((v.c / Math.max(1, v.t)) * 100) };
    }
    return {
      accuracy_by_skill: accuracy,
      total_questions_answered: qr.length,
      streak: s?.[0] || null,
      recent_gradings: g.map((x: any) => ({
        skill: x.skill, part: x.part_type, band: x.overall_level,
        date: x.created_at, criteria: x.criteria,
      })),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function executeTool(name: string, args: any, userId: string) {
  if (name === "lookup_vocabulary") return execLookupVocab(args?.word);
  if (name === "get_user_progress") return execUserProgress(userId);
  return { error: `unknown tool ${name}` };
}

// ---------- Analytics ----------
async function logUsage(userId: string, model: string, eventType: string, metadata: any) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/usage_events`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId === "anon" ? null : userId,
        service: "ai-coach",
        event_type: eventType,
        model,
        units: 1,
        unit_type: "request",
        source_function: "ai-coach",
        metadata,
      }),
    });
  } catch {/* swallow */}
}

// ---------- Streaming with tool loop ----------
async function callGateway(payload: any, apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId = "anon";
    if (token && token.split(".").length === 3) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload?.sub) userId = String(payload.sub);
      } catch {/* ignore */}
    }

    const rl = rateLimit(userId);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: `Bạn đã hỏi quá nhanh. Thử lại sau ${rl.retryAfter}s.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = await req.json().catch(() => null) as
      | { messages?: ChatMessage[]; context?: CoachContext }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages. Only keep images on the LAST user turn (saves context, avoids confusion from stale screenshots).
    const lastUserIdx = (() => {
      for (let i = body.messages.length - 1; i >= 0; i--) if (body.messages[i].role === "user") return i;
      return -1;
    })();
    const recent = body.messages.slice(-20).map((m, idx) => {
      const absoluteIdx = body.messages.length - Math.min(body.messages.length, 20) + idx;
      const role = m.role === "assistant" ? "assistant" : "user";
      const text = String(m.content ?? "").slice(0, 4000);
      const isLastUser = absoluteIdx === lastUserIdx;
      const imgs = isLastUser && Array.isArray(m.images)
        ? m.images.filter((u) => typeof u === "string" && u.startsWith("data:image") && u.length < 6_000_000).slice(0, 4)
        : [];
      const pageText = isLastUser && typeof m.pageText === "string" ? m.pageText.slice(0, 6000) : "";

      if (role === "user" && (imgs.length > 0 || pageText)) {
        const parts: any[] = [];
        // Put IMAGES FIRST — Gemini vision performs better when image precedes the question.
        for (const url of imgs) parts.push({ type: "image_url", image_url: { url } });
        let textBlock = text || "Hãy đọc đề trong ảnh và giải thích câu hỏi cho mình.";
        if (imgs.length > 0) {
          textBlock = `Phía trên là ảnh chụp câu hỏi APTIS. Đọc kỹ rồi trả lời THEO ĐÚNG FORMAT MCQ trong system prompt (✅/❌, KHÔNG trích nguyên văn đề, KHÔNG heading, KHÔNG mẹo nhớ riêng). Nếu không đọc rõ → câu từ chối chuẩn.\n\nUser hỏi: ${textBlock}`;
        }

        if (pageText) textBlock += `\n\n--- NỘI DUNG TRANG USER ĐANG XEM (đã trích tự động) ---\n${pageText}\n--- HẾT ---`;
        parts.push({ type: "text", text: textBlock });
        return { role, content: parts };
      }
      return { role, content: text };
    });


    // Smart model routing: pro when images present or large page text
    const hasImage = body.messages.some((m, i) => i === lastUserIdx && Array.isArray(m.images) && m.images.length > 0);
    const longContext = body.messages.some((m) => (m.pageText?.length || 0) > 2000);
    const model = hasImage || longContext ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const messages: any[] = [
      { role: "system", content: buildSystemPrompt(body.context) },
      ...recent,
    ];

    // When user attached an image, skip the tool loop entirely — go straight to a single vision call.
    // Tools (vocab/progress lookup) only make sense for pure text Q&A.
    const useTools = !hasImage;

    // Tool loop: do up to 2 non-streaming tool rounds, then stream final.
    let toolRounds = 0;
    let toolsUsed: string[] = [];
    const maxRounds = useTools ? 2 : 1;
    while (toolRounds < maxRounds) {
      const payload: any = { model, stream: false, messages };
      if (useTools) { payload.tools = TOOL_DEFS; payload.tool_choice = "auto"; }
      const probe = await callGateway(payload, LOVABLE_API_KEY);
      if (!probe.ok) {
        const text = await probe.text().catch(() => "");
        const status = probe.status === 429 || probe.status === 402 ? probe.status : 400;
        const msg = probe.status === 429 ? "Hệ thống AI đang quá tải, thử lại sau ít phút."
          : probe.status === 402 ? "Đã hết credit AI. Liên hệ admin để nạp thêm."
          : `AI Gateway lỗi: ${text.slice(0, 200)}`;
        return new Response(JSON.stringify({ error: msg }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json", ...(probe.status === 429 ? { "Retry-After": "30" } : {}) },
        });
      }
      const data = await probe.json();
      const choice = data?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // No tool needed: stream final answer (re-request streaming so tokens flow to client)
        // To avoid double-billing, we just stream the already-generated text via SSE.
        const finalText: string = choice?.content || "";
        const sse = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            // Emit in chunks of ~40 chars to feel streamed
            const chunkSize = 40;
            let i = 0;
            const tick = () => {
              if (i >= finalText.length) {
                controller.enqueue(enc.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
              const chunk = finalText.slice(i, i + chunkSize);
              i += chunkSize;
              const payload = { choices: [{ delta: { content: chunk } }] };
              controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
              setTimeout(tick, 12);
            };
            tick();
          },
        });
        logUsage(userId, model, "chat", { toolsUsed, hasImage, longContext, messageCount: body.messages.length });
        return new Response(sse, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      }

      // Execute tool calls
      messages.push(choice);
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {/* ignore */}
        const name = tc.function?.name || "";
        toolsUsed.push(name);
        const result = await executeTool(name, args, userId);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 6000),
        });
      }
      toolRounds++;
    }

    // Fallback: stream after tool exhaustion
    const final = await callGateway({ model, stream: true, messages }, LOVABLE_API_KEY);
    if (!final.ok || !final.body) {
      const text = await final.text().catch(() => "");
      return new Response(JSON.stringify({ error: `AI Gateway lỗi: ${text.slice(0, 200)}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logUsage(userId, model, "chat", { toolsUsed, hasImage, longContext, fallback: true });
    return new Response(final.body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (e) {
    console.error("ai-coach error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
