// Gọi AI dạng chat cho các tính năng CHỮ: ưu tiên Claude (Anthropic API), lỗi/hết tiền → tự quay về Gemini qua Lovable AI Gateway.
//
// Dùng thay cho fetch("https://ai.gateway.lovable.dev/v1/chat/completions", ...):
//   const res = await aiChatFetch(body, { source: "dictionary-lookup" });
//   const model = res.headers.get("x-ai-model");   // model thật đã trả lời (để ghi usage)
// `body` giữ nguyên định dạng OpenAI/Gateway như cũ; kết quả trả về cũng đúng định dạng Gateway
// (choices[0].message.content / tool_calls, usage.prompt_tokens / completion_tokens) nên phần xử lý phía sau không phải sửa.
//
// Biến môi trường:
//   ANTHROPIC_API_KEY        — bắt buộc để dùng Claude (không có → luôn dùng Gemini)
//   CLAUDE_TEXT_FEATURES     — "off" để tắt hết; hoặc danh sách source cho phép, vd "dictionary-lookup,ai-coach"; mặc định: bật tất cả
//   CLAUDE_TEXT_MODEL        — mặc định "claude-haiku-5-5"
//
// Những gì Claude KHÔNG nhận (âm thanh input_audio, stream: true) → tự đi thẳng Gemini.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type AnyObj = Record<string, any>;

export interface AiChatOptions {
  /** Tên function gọi (dùng cho công tắc CLAUDE_TEXT_FEATURES + log). */
  source: string;
  /** Thời gian chờ Claude tối đa (ms). Quá giờ → dùng Gemini. Mặc định 30s. */
  claudeTimeoutMs?: number;
  /** Không thử Claude cho lần gọi này (vd. câu hỏi có ảnh muốn giữ Gemini Pro). */
  skipClaude?: boolean;
  /** Huỷ lượt gọi Gemini dự phòng (timeout của nơi gọi). */
  signal?: AbortSignal;
}

class Unsupported extends Error {}

function claudeEnabled(source: string): boolean {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return false;
  const cfg = (Deno.env.get("CLAUDE_TEXT_FEATURES") || "on").trim().toLowerCase();
  if (cfg === "off" || cfg === "0" || cfg === "false") return false;
  if (cfg === "on" || cfg === "all" || cfg === "1" || cfg === "true") return true;
  return cfg.split(",").map((s) => s.trim()).includes(source.toLowerCase());
}

function pausedUntil(): number {
  return (globalThis as AnyObj).__claudeTextPausedUntil || 0;
}
function pause(ms: number, why: string, source: string) {
  (globalThis as AnyObj).__claudeTextPausedUntil = Date.now() + ms;
  console.warn(`[aiChat:${source}] Claude lỗi (${why}) → dùng Gemini, tạm nghỉ Claude ${Math.round(ms / 1000)}s`);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p: AnyObj) => (p?.type === "text" ? String(p.text ?? "") : "")).join("\n");
  return content == null ? "" : String(content);
}

function convertPart(p: AnyObj): AnyObj | null {
  if (!p || typeof p !== "object") return null;
  if (p.type === "text") return { type: "text", text: String(p.text ?? "") };
  if (p.type === "image_url") {
    const url = String(p.image_url?.url ?? p.image_url ?? "");
    const m = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (m) return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
    if (/^https?:\/\//.test(url)) return { type: "image", source: { type: "url", url } };
    throw new Unsupported("image format");
  }
  throw new Unsupported(`content part ${p.type}`);
}

function toAnthropic(body: AnyObj, model: string): AnyObj {
  if (body.stream) throw new Unsupported("stream");
  const sys: string[] = [];
  const msgs: AnyObj[] = [];
  const push = (role: "user" | "assistant", blocks: AnyObj[]) => {
    if (blocks.length === 0) return;
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else msgs.push({ role, content: [...blocks] });
  };
  for (const m of body.messages || []) {
    if (m.role === "system" || m.role === "developer") { sys.push(textOf(m.content)); continue; }
    if (m.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: String(m.tool_call_id ?? ""), content: textOf(m.content) || "(empty)" }]);
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    const blocks: AnyObj[] = [];
    if (typeof m.content === "string") { if (m.content) blocks.push({ type: "text", text: m.content }); }
    else if (Array.isArray(m.content)) for (const p of m.content) { const b = convertPart(p); if (b) blocks.push(b); }
    if (role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        let input: AnyObj = {};
        try { input = JSON.parse(tc.function?.arguments || "{}"); } catch { /* bỏ qua */ }
        blocks.push({ type: "tool_use", id: String(tc.id || crypto.randomUUID()), name: String(tc.function?.name || ""), input });
      }
    }
    push(role, blocks);
  }
  if (msgs.length === 0 || msgs[0].role !== "user") msgs.unshift({ role: "user", content: [{ type: "text", text: "(bắt đầu)" }] });

  const out: AnyObj = {
    model,
    max_tokens: Math.min(Number(body.max_tokens || body.max_completion_tokens || 4096), 32000),
    messages: msgs,
  };
  // Lưu ý: Haiku 5.5 không nhận temperature, tool_choice dạng {type:"tool"} không ổn định → chỉ dùng "auto" + dặn trong system.
  const notes: string[] = [];
  if (Array.isArray(body.tools) && body.tools.length && body.tool_choice !== "none") {
    out.tools = body.tools
      .filter((t: AnyObj) => t?.type === "function" && t.function?.name)
      .map((t: AnyObj) => ({ name: t.function.name, description: t.function.description || "", input_schema: t.function.parameters || { type: "object", properties: {} } }));
    out.tool_choice = { type: "auto" };
    const forced = body.tool_choice?.function?.name;
    if (forced) notes.push(`BẮT BUỘC: trả kết quả bằng cách gọi tool \`${forced}\` đúng 1 lần, không viết thêm văn bản ngoài tool.`);
    else if (body.tool_choice === "required") notes.push("BẮT BUỘC: phải gọi một tool.");
  }
  const rf = body.response_format?.type;
  if (rf === "json_object" || rf === "json_schema") {
    notes.push("BẮT BUỘC: chỉ trả về đúng MỘT object JSON hợp lệ, không markdown, không ```.");
  }
  const systemText = [...sys, ...notes].filter(Boolean).join("\n\n");
  if (systemText) out.system = [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }];
  return out;
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function fromAnthropic(j: AnyObj, wantJson: boolean): AnyObj {
  const blocks: AnyObj[] = Array.isArray(j.content) ? j.content : [];
  let text = blocks.filter((b) => b.type === "text").map((b) => String(b.text || "")).join("");
  if (wantJson) text = stripFences(text);
  const toolCalls = blocks.filter((b) => b.type === "tool_use").map((b) => ({
    id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
  }));
  const stop = j.stop_reason;
  const finish = stop === "tool_use" ? "tool_calls" : stop === "max_tokens" ? "length" : "stop";
  const u = j.usage || {};
  const message: AnyObj = { role: "assistant", content: toolCalls.length && !text ? null : text };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id: j.id,
    object: "chat.completion",
    model: j.model,
    choices: [{ index: 0, finish_reason: finish, message }],
    usage: {
      prompt_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      completion_tokens: u.output_tokens || 0,
    },
  };
}

function looksLikeJson(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  try { JSON.parse(t); return true; } catch { /* thử cắt */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return false;
  try { JSON.parse(m[0]); return true; } catch { return false; }
}

async function tryClaude(body: AnyObj, opts: AiChatOptions): Promise<Response | null> {
  if (opts.skipClaude || !claudeEnabled(opts.source)) return null;
  if (Date.now() < pausedUntil()) return null;
  const model = Deno.env.get("CLAUDE_TEXT_MODEL") || "claude-haiku-5-5";
  let req: AnyObj;
  try { req = toAnthropic(body, model); } catch (e) {
    if (e instanceof Unsupported) return null;
    throw e;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.claudeTimeoutMs ?? 30_000);
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(req),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      const longPause = r.status === 401 || r.status === 403 || /credit|billing|balance/i.test(t);
      // 400 do định dạng yêu cầu: không tạm nghỉ, chỉ bỏ qua lượt này
      if (r.status === 400 && !longPause) { console.warn(`[aiChat:${opts.source}] Claude 400: ${t.slice(0, 200)} → Gemini`); return null; }
      pause(longPause ? 10 * 60_000 : 60_000, `${r.status} ${t.slice(0, 160)}`, opts.source);
      return null;
    }
    const j = await r.json();
    const wantJson = ["json_object", "json_schema"].includes(body.response_format?.type);
    const data = fromAnthropic(j, wantJson);
    const msg = data.choices[0].message;
    const forced = body.tool_choice?.function?.name;
    if (forced && !(msg.tool_calls || []).some((t: AnyObj) => t.function?.name === forced)) {
      console.warn(`[aiChat:${opts.source}] Claude không gọi tool ${forced} → Gemini`);
      return null;
    }
    if (wantJson && !msg.tool_calls && !looksLikeJson(msg.content || "")) {
      console.warn(`[aiChat:${opts.source}] Claude không trả JSON hợp lệ → Gemini`);
      return null;
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json", "x-ai-model": `anthropic/${model}`, "x-ai-provider": "claude" },
    });
  } catch (e) {
    pause(60_000, (e as AnyObj)?.name === "AbortError" ? "timeout" : String((e as AnyObj)?.message || e), opts.source);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Gọi AI chat: Claude trước, Gemini (Lovable Gateway) dự phòng. Trả về Response giống Gateway. */
export async function aiChatFetch(body: AnyObj, opts: AiChatOptions): Promise<Response> {
  const viaClaude = await tryClaude(body, opts);
  if (viaClaude) return viaClaude;
  const key = Deno.env.get("LOVABLE_API_KEY") || "";
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  const headers = new Headers(r.headers);
  headers.set("x-ai-model", String(body.model || ""));
  headers.set("x-ai-provider", "gemini");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
}
