import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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

const MODEL = "google/gemini-2.5-flash";

const WRITING_WORD_LIMITS: Record<string, number> = {
  task2: 45,
  task3: 60,
  task4: 225,
};

function countWords(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let entryId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    entryId = body?.entry_id ?? null;
    if (!entryId) return json({ error: "entry_id is required" }, 400);

    void logInvocation("showcase-review", { entry_id: entryId });

    const { data: entry, error: entryErr } = await admin
      .from("showcase_entries")
      .select(
        "id, skill, part_type, band, raw_part, content_text, question_texts, exam_set_id, status",
      )
      .eq("id", entryId)
      .maybeSingle();

    if (entryErr) throw entryErr;
    if (!entry) return json({ error: "not_found" }, 404);
    if (entry.status !== "checking") {
      return json({ ok: true, skipped: true, status: entry.status });
    }

    /* ---------- code-side length gate ---------- */
    const words = countWords(entry.content_text || "");
    if (entry.skill === "writing") {
      const limit = WRITING_WORD_LIMITS[entry.part_type] ?? 45;
      if (words < Math.floor(limit * 0.8)) {
        await admin
          .from("showcase_entries")
          .update({
            status: "rejected",
            ai_check: { passed: false, reason: `Bài quá ngắn (${words}/${limit} từ).` },
          })
          .eq("id", entry.id);
        return json({ ok: true, status: "rejected", reason: "too_short" });
      }
    } else if (words < 60) {
      await admin
        .from("showcase_entries")
        .update({
          status: "rejected",
          ai_check: { passed: false, reason: `Transcript quá ngắn (${words} từ).` },
        })
        .eq("id", entry.id);
      return json({ ok: true, status: "rejected", reason: "too_short" });
    }

    /* ---------- reference material ---------- */
    let sampleAnswers: string[] = [];
    if (entry.exam_set_id) {
      const { data: qs } = await admin
        .from("exam_questions")
        .select("question_text, extra_data")
        .eq("exam_set_id", entry.exam_set_id)
        .limit(30);
      for (const q of qs ?? []) {
        const extra = (q as any).extra_data ?? {};
        for (const v of Object.values(extra)) {
          if (typeof v === "string" && v.length > 40) sampleAnswers.push(v);
          else if (v && typeof v === "object") {
            const s = (v as any).sampleAnswer;
            if (typeof s === "string" && s.length > 40) sampleAnswers.push(s);
          }
        }
      }
      sampleAnswers = sampleAnswers.slice(0, 4);
    }

    const { data: approved } = await admin
      .from("showcase_entries")
      .select("content_text")
      .eq("status", "approved")
      .eq("exam_set_id", entry.exam_set_id)
      .eq("part_type", entry.part_type)
      .limit(5);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[showcase-review] missing LOVABLE_API_KEY");
      return json({ error: "missing_api_key" }, 500);
    }

    const prompt = [
      `Bạn là giám khảo APTIS kiểm duyệt bài trưng bày "Bảng Kỳ Tích".`,
      `Kỹ năng: ${entry.skill}. Part: ${entry.part_type}. Band: ${entry.band}. Điểm thô: ${entry.raw_part}/30.`,
      `Đề bài (câu hỏi): ${JSON.stringify(entry.question_texts ?? [])}`,
      `BÀI CỦA HỌC VIÊN:\n"""${entry.content_text}"""`,
      sampleAnswers.length
        ? `BÀI MẪU CỦA ĐỀ:\n"""${sampleAnswers.join("\n---\n")}"""`
        : `Không có bài mẫu.`,
      (approved ?? []).length
        ? `CÁC BÀI ĐÃ DUYỆT CÙNG ĐỀ:\n"""${(approved ?? [])
            .map((a: any) => a.content_text)
            .join("\n---\n")}"""`
        : `Chưa có bài đã duyệt cùng đề.`,
      `Làm 2 việc và chỉ trả về JSON:`,
      `1) KIỂM: on_topic (bài có đúng đề không), sample_similarity (0-100 so với bài mẫu), approved_similarity (0-100 so với bài đã duyệt), inappropriate (có nội dung không phù hợp hoặc lộ thông tin cá nhân như tên thật, số điện thoại, email, địa chỉ).`,
      `   TRƯỢT nếu: off-topic, sample_similarity >= 60, approved_similarity >= 70, hoặc inappropriate = true.`,
      `2) Nếu ĐẠT: trích 10-15 từ vựng/cụm ăn điểm (word, nghĩa tiếng Việt, ví dụ lấy từ bài) và viết 2-3 câu tiếng Việt giải thích vì sao bài này đạt band.`,
      `JSON schema: {"passed":boolean,"reason":string,"on_topic":boolean,"sample_similarity":number,"approved_similarity":number,"inappropriate":boolean,"vocabulary":[{"word":string,"meaning":string,"example":string}],"why_band":string}`,
      `reason: 1 câu ngắn tiếng Việt nêu lý do trượt (rỗng nếu đạt).`,
    ].join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "Bạn trả về JSON thuần, không markdown, không giải thích thêm.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[showcase-review] gateway error", res.status, text);
      // Technical failure: leave status 'checking' for a later retry.
      return json({ error: "ai_unavailable", status: res.status }, res.status === 429 ? 429 : 502);
    }

    const data = await res.json();
    void logAIUsage({
      model: MODEL,
      usage: data?.usage,
      source_function: "showcase-review",
      finishReason: data?.choices?.[0]?.finish_reason ?? null,
      metadata: { entry_id: entry.id, skill: entry.skill, part_type: entry.part_type },
    });

    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch { /* ignore */ }
      }
    }
    if (!parsed) {
      console.error("[showcase-review] unparsable AI response", raw?.slice?.(0, 500));
      return json({ error: "ai_unparsable" }, 502);
    }

    const sampleSim = Number(parsed.sample_similarity ?? 0);
    const approvedSim = Number(parsed.approved_similarity ?? 0);
    const passed =
      parsed.passed === true &&
      parsed.on_topic !== false &&
      parsed.inappropriate !== true &&
      sampleSim < 60 &&
      approvedSim < 70;

    const aiCheck = {
      passed,
      reason: passed ? "" : String(parsed.reason ?? "Bài chưa đạt điều kiện trưng bày."),
      on_topic: parsed.on_topic ?? null,
      sample_similarity: sampleSim,
      approved_similarity: approvedSim,
      inappropriate: parsed.inappropriate ?? null,
      words,
      model: MODEL,
      checked_at: new Date().toISOString(),
    };

    if (!passed) {
      await admin
        .from("showcase_entries")
        .update({ status: "rejected", ai_check: aiCheck })
        .eq("id", entry.id);
      return json({ ok: true, status: "rejected", reason: aiCheck.reason });
    }

    const extraction = {
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.slice(0, 15) : [],
      why_band: String(parsed.why_band ?? ""),
    };

    await admin
      .from("showcase_entries")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        ai_check: aiCheck,
        extraction,
      })
      .eq("id", entry.id);

    return json({ ok: true, status: "approved", extraction });
  } catch (e) {
    console.error("[showcase-review] failed", entryId, e);
    // Technical error → entry stays 'checking'.
    return json({ error: "internal_error" }, 500);
  }
});
