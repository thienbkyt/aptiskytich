// AI Coach - streaming chat assistant for Aptis Kỳ Tích
// Uses Lovable AI Gateway directly with SSE streaming.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // data URLs (image/jpeg base64) or https URLs
  pageText?: string;
};
type CoachContext = {
  pathname?: string;
  pageTitle?: string;
  skill?: string;
  part?: string | number;
  question?: {
    prompt?: string;
    options?: string[];
    userAnswer?: string;
    correctAnswer?: string;
    explanation?: string;
  };
  dashboard?: {
    weakestSkill?: string;
    accuracyBySkill?: Record<string, number>;
    totalQuestions?: number;
    streak?: number;
  };
  userLevelGoal?: string;
};

// Per-instance in-memory rate limiter (best-effort).
const rlMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(userId: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = rlMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rlMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function buildSystemPrompt(ctx: CoachContext | undefined): string {
  const base = `Bạn là "Coach Kỳ Tích" - chuyên gia luyện thi APTIS General cho học viên Việt Nam (trình độ A2-B2).

NGUYÊN TẮC:
- Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, thân thiện như một người thầy/anh chị đi trước.
- Dùng markdown: heading nhỏ, bullet, **bold** từ khoá, ví dụ cụ thể bằng tiếng Anh kèm dịch.
- Khi giải thích ngữ pháp/từ vựng: cho công thức/định nghĩa ngắn → ví dụ → mẹo nhớ.
- Khi user hỏi về câu hỏi đang làm: dựa vào CONTEXT, giải thích vì sao đáp án đúng và vì sao các đáp án khác sai.
- Khi user hỏi lộ trình: dựa vào điểm yếu trong CONTEXT để đề xuất kế hoạch tuần cụ thể.
- KHÔNG bịa đáp án. Nếu thiếu thông tin, hỏi lại user.
- Chỉ trả lời về APTIS, tiếng Anh, hoặc cách dùng web Aptis Kỳ Tích. Câu hỏi ngoài lề: lịch sự từ chối.
- Cuối câu trả lời dài (>200 từ) có thể kèm 1 câu gợi ý hành động tiếp theo.`;

  if (!ctx) return base;
  const lines: string[] = ["\n\n### NGỮ CẢNH USER ĐANG XEM"];
  if (ctx.pathname) lines.push(`- Trang: ${ctx.pathname}${ctx.pageTitle ? ` (${ctx.pageTitle})` : ""}`);
  if (ctx.skill) lines.push(`- Kỹ năng: ${ctx.skill}${ctx.part ? `, Part ${ctx.part}` : ""}`);
  if (ctx.userLevelGoal) lines.push(`- Mục tiêu: ${ctx.userLevelGoal}`);
  if (ctx.question) {
    const q = ctx.question;
    lines.push("- Câu hỏi hiện tại:");
    if (q.prompt) lines.push(`  • Đề: ${q.prompt}`);
    if (q.options?.length) lines.push(`  • Lựa chọn: ${q.options.join(" | ")}`);
    if (q.userAnswer) lines.push(`  • User chọn: ${q.userAnswer}`);
    if (q.correctAnswer) lines.push(`  • Đáp án đúng: ${q.correctAnswer}`);
    if (q.explanation) lines.push(`  • Giải thích có sẵn: ${q.explanation}`);
  }
  if (ctx.dashboard) {
    const d = ctx.dashboard;
    lines.push("- Tiến độ học:");
    if (d.weakestSkill) lines.push(`  • Kỹ năng yếu nhất: ${d.weakestSkill}`);
    if (d.accuracyBySkill) {
      const parts = Object.entries(d.accuracyBySkill).map(([k, v]) => `${k}: ${v}%`).join(", ");
      lines.push(`  • Accuracy: ${parts}`);
    }
    if (typeof d.totalQuestions === "number") lines.push(`  • Tổng câu đã làm: ${d.totalQuestions}`);
    if (typeof d.streak === "number") lines.push(`  • Streak: ${d.streak} ngày`);
  }
  return base + lines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lightweight user id from JWT (sub claim) for rate limiting; allow anon.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId = "anon";
    if (token && token.split(".").length === 3) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload?.sub) userId = String(payload.sub);
      } catch {/* ignore */}
    }

    if (!rateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Bạn đã hỏi quá nhanh, vui lòng đợi 1 phút rồi thử lại." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null) as
      | { messages?: ChatMessage[]; context?: CoachContext }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep last 20 messages to bound token usage
    const recent = body.messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 4000),
    }));

    const payload = {
      model: "google/gemini-2.5-flash",
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(body.context) },
        ...recent,
      ],
    };

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 400;
      const msg = upstream.status === 429
        ? "Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút."
        : upstream.status === 402
        ? "Đã hết credit AI. Vui lòng liên hệ admin để nạp thêm."
        : `AI Gateway lỗi: ${text.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pass through SSE stream
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("ai-coach error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
