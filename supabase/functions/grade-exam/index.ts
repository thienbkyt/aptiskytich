import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, logInvocation } from "../_shared/usage-logger.ts";
import { enforceDailyQuota } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GradingRequest {
  type: "speaking" | "writing";
  audioBase64?: string;
  text?: string;
  questions: string[];
  partType: string;
  // Speaking-only (Phase 2): used by code-side scoring
  actualSpoken?: number;   // seconds the student actually spoke
  speakTime?: number;      // seconds allowed for this item
  maxPoints?: number;      // max points for this item
  itemType?: "question" | "picture";
  // Time-penalty tiers for shortage brackets 10-20% / >20-50% / >50% (<10% => 0)
  timePenaltyTiers?: [number, number, number] | number[];
  // Part 4 aggregated grading
  subQuestions?: string[];
  usedConnectorsRequired?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Fire-and-forget invocation log
  logInvocation("grade-exam").catch(() => {});

  try {
    // --- Authentication ---
    // Internal bypass: process-grading-jobs worker calls with service-role
    // key + x-internal-user-id header (background retry path). Do NOT expose
    // this bypass to end-users — it only works when x-internal-key matches
    // the service role key, which is server-side only.
    const internalKey = req.headers.get("x-internal-key") || "";
    const internalUserId = req.headers.get("x-internal-user-id") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isInternal =
      internalKey.length > 0 &&
      serviceRoleKey.length > 0 &&
      internalKey === serviceRoleKey &&
      /^[0-9a-f-]{36}$/i.test(internalUserId);

    let userId = "";
    let supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (isInternal) {
      userId = internalUserId;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsError } =
        await supabaseClient.auth.getClaims(token);
      if (claimsError || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = String((claims.claims as any).sub || "");
    }

    // Service-role client for cache + quota writes (bypasses RLS).
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Parse & validate input ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body: GradingRequest = await req.json();
    const { type, audioBase64, text, questions, partType } = body;
    const actualSpoken = Number(body.actualSpoken ?? 0);
    const speakTime = Number(body.speakTime ?? 0);
    const maxPoints = Number(body.maxPoints ?? 0);
    const itemType: "question" | "picture" = body.itemType === "picture" ? "picture" : "question";
    const subQuestions: string[] = Array.isArray(body.subQuestions) ? body.subQuestions : [];
    const isPart4Aggregated = type === "speaking" && partType === "part4" && subQuestions.length > 0;
    // Default tiers fall back to original Part-1 question scheme (×2 for picture).
    const defaultTiers: [number, number, number] =
      itemType === "picture" ? [1, 2, 3] : [0.5, 1, 1.5];
    const tiersIn = Array.isArray(body.timePenaltyTiers) && body.timePenaltyTiers.length === 3
      ? (body.timePenaltyTiers.map((n) => Number(n) || 0) as [number, number, number])
      : defaultTiers;

    // ============================================================
    // SPEAKING V2 (new 5-criteria rubric) — runs PARALLEL to legacy.
    // ============================================================
    if ((type as string) === "speaking_finalize") {
      const rawParts = (body as any).rawParts || {};
      const p1 = Number(rawParts.part1 ?? 0);
      const p2 = Number(rawParts.part2 ?? 0);
      const p3 = Number(rawParts.part3 ?? 0);
      const p4 = Number(rawParts.part4 ?? 0);
      const coreGV = (body as any).coreGV;
      const raw_total = p1 + p2 + p3 + p4 * 1.2; // max 126
      const scale50_base = Math.round((raw_total / 126) * 50);
      // LENIENCY: scoring runs strict; apply +20% scaling for user-facing score.
      const LENIENCY = 1.2;
      const scale50 = Math.min(50, Math.round(scale50_base * LENIENCY));
      const CUTS: Array<{ band: string; cut: number }> = [
        { band: "C", cut: 48 },
        { band: "B2", cut: 41 },
        { band: "B1", cut: 34 },
        { band: "A2", cut: 24 },
        { band: "A1", cut: 12 },
        { band: "A0", cut: 0 },
      ];
      const order = ["A0", "A1", "A2", "B1", "B2", "C"];
      const rankOf = (b: string) => order.indexOf(b);
      let baseBand = "A0";
      for (const c of CUTS) {
        if (scale50 >= c.cut) { baseBand = c.band; break; }
      }
      const GREY_WIDTH = 2;
      let greyZone = false;
      let bumpedTo: string | null = null;
      for (const c of CUTS) {
        if (scale50 >= c.cut - GREY_WIDTH && scale50 < c.cut) {
          greyZone = true;
          if (coreGV != null && rankOf(String(coreGV)) >= rankOf(c.band)) {
            bumpedTo = c.band;
          }
          break;
        }
      }
      const cefr = bumpedTo ?? baseBand;
      const flagReview = greyZone;
      const rawTotalRounded = Math.round(raw_total * 100) / 100;
      return new Response(JSON.stringify({
        rawTotal: rawTotalRounded,
        raw_total: rawTotalRounded,
        scale50,
        cefr,
        greyZone,
        flagReview,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((type as string) === "speaking_v2") {
      const audios: string[] = Array.isArray((body as any).audios) ? (body as any).audios : [];
      if (!Array.isArray(questions) || questions.length === 0 || questions.length > 20) {
        return new Response(JSON.stringify({ error: "Invalid questions" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Normalize `questions` to a flat string[]. Callers sometimes pass
      // `{ questionText: "..." }` objects; storing objects into
      // speaking_skill_results.parts[].items[].questionText crashes the React
      // review UI (error #31). Coerce to plain strings here.
      const questionStrings: string[] = (questions as any[]).map((q) => {
        if (typeof q === "string") return q;
        if (q && typeof q === "object") {
          return String(q.questionText ?? q.question_text ?? q.text ?? "");
        }
        return q == null ? "" : String(q);
      });
      (questions as any).length = 0;
      (questions as any).push(...questionStrings);
      if (!audios.length) {
        return new Response(JSON.stringify({ error: "No audios provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const totalBytes = audios.reduce((s, a) => s + (a?.length || 0), 0);
      if (totalBytes > 30_000_000) {
        return new Response(JSON.stringify({ error: "Audio payload too large" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isPart4 = partType === "part4";
      const MIN_AUDIO_LEN = 100;
      // Treat very short / empty base64 strings as "silent" (no recording).
      const spokenMask: boolean[] = audios.map((a) => typeof a === "string" && a.length > MIN_AUDIO_LEN);
      const anySpoken = spokenMask.some(Boolean);
      const itemCount = isPart4 ? Math.max(questions.length, 1) : questions.length;

      // No audio at all → don't call AI, return zeroed grading.
      if (!anySpoken) {
        const emptyPerItem = Array.from({ length: itemCount }, () => ({
          transcript: "", onTopic: false, improvedVersion: "", upgradeTips: "",
        }));
        return new Response(JSON.stringify({
          bands: { tf: 0, gra: 0, vra: 0, pro: 0, fc: 0 },
          rawPart: 0,
          raw_part: 0,
          perItem: emptyPerItem,
          analysis: "Không có bài ghi âm.",
          criteriaAnalysis: { tf: "Không có bài ghi âm.", gra: "Không có bài ghi âm.", vra: "Không có bài ghi âm.", pro: "Không có bài ghi âm.", fc: "Không có bài ghi âm." },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Tier gate — reuse ai_grading_speaking quota. Skip for internal worker
      // retries (quota already consumed on the initial submission).
      if (userId && !isInternal) {
        try {
          const { data: access } = await supabaseClient.rpc("check_feature_access", {
            p_key: "ai_grading_speaking", p_scope: null,
          });
          const a = (access ?? {}) as any;
          if (a && a.allowed === false && (a.reason === "quota_exceeded" || a.reason === "disabled")) {
            const userTier = (a.tier as string) ?? "free";
            const need = userTier === "pro" ? "premium" : "pro";
            return new Response(JSON.stringify({
              error: a.reason === "disabled" ? "disabled" : "quota_exceeded",
              upgrade: true, need, tier: userTier,
              freeQuota: a.free_quota ?? 0, proQuota: a.pro_quota ?? null,
              used: a.used ?? 0, remaining: a.remaining ?? 0,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (e) {
          console.warn("[grade-exam v2] feature access check failed:", (e as any)?.message || e);
        }
      }

      const sysV2 = `You are an expert Aptis Speaking grader. You grade ONE PART at a time using the official 5-criteria rubric (TF, GRA, VRA, PRO, FC), each 0-5 integer.

MASTER BAND ANCHORS (apply to EACH criterion):
5 = C/C1 — natural, accurate, rich.
4 = B2 — generally accurate & developed, occasional slips.
3 = B1 — communicates simply, clear but limited.
2 = A2 — basic, frequent errors that may impede.
1 = A1 — very limited, often unclear.
0 = below A1 — off-topic / silent / parroted / unintelligible.

CRITERIA:
- TF (Task Fulfilment) anchored by ON-TOPIC count of sub-answers:
  5 = all on-topic AND ideas well developed; 4 = all on-topic, adequate ideas;
  3 = 2/3 on-topic; 2 = 1/3 on-topic; 1 = barely touches topic; 0 = totally off / no answer.
  A one-word reply or silence does NOT count as on-topic. Questions with NO audio do NOT count as on-topic and must NOT be invented.
  ${isPart4 ? "For PART 4: ONE monologue audio addresses several sub-questions. Judge on-topic PER SUB-QUESTION over the SAME monologue." : ""}
- GRA (Grammar Range & Accuracy): reward attempts at complex structures even if not perfect. Only deduct band when errors block understanding. Do NOT count errors absolutely.
- VRA (Vocabulary Range & Accuracy): same leniency; reward variety.
- PRO (Pronunciation): JUDGE FROM AUDIO ONLY (intelligibility, rhythm, stress). Do not use spelling.
- FC (Fluency & Coherence): pace, linking, hesitation, organisation.

REWARDS: dám dùng cấu trúc phức tạp / từ vựng cao cấp / kết nối ý → cộng band ngay cả khi còn lỗi nhỏ.
DEDUCTIONS: chỉ trừ band khi lỗi cản trở hiểu hoặc gây mơ hồ.

=== APTIS HIGH-SCORE LOGIC (use this to write criteriaAnalysis & upgradeTips) ===
Band rises come from RANGE + ACCURACY + STRUCTURE + COHESION, NOT from "zero errors". Reward attempts at complex language even with minor slips; only penalize errors that impede meaning.

1) CONTENT (Task Fulfilment): address every part fully; structure = opening → developed points (claim → reason → example/experience → result) → short conclusion. Develop, don't just state. To improve: add a reason + a concrete example/personal experience to each idea.
2) GRAMMAR (range & accuracy): High band = grammatically CORRECT with NO systematic/recurring errors. Do NOT force complexity — a high score does NOT require complex structures. Naturalness + accuracy matter most. A VARIETY of structures should simply APPEAR over the response (not all at once, not mandatory in every sentence) — e.g. passive voice, relative clauses, complex (subordinate-clause) sentences, compound sentences. Define "complex" plainly = sentences joined with subordinating/coordinating links or relative/passive forms, NOT rare or showy grammar. To improve: FIRST correct and standardize the student's actual errors so the sentence is clean and natural; only where it fits naturally, point out one more varied structure they could use — never complexify for its own sake.
3) VOCABULARY (range & accuracy): High band = COMMON, natural words used PRECISELY and correctly in context + accurate collocations + paraphrase to avoid repetition. Do NOT push rare, obscure, or over-complex "fancy" words. The goal is the word a fluent speaker would naturally use, not an impressive one. To improve: replace wrong/awkward/repeated words with the natural, accurate, commonly-used word in context — fix misuse (e.g. "do a mistake" → "make a mistake"), fix wrong collocations, and paraphrase repeated words. Show the natural correct word, NOT a rarer synonym.
4) PRONUNCIATION: clear sounds + correct WORD STRESS and SENTENCE STRESS + varied INTONATION (avoid monotone) + CHUNKING (pause at meaning boundaries) + natural linking. To improve: name the specific feature to drill (e.g., stress on the 2nd syllable of "deVElop", chunk before "however").
5) FLUENCY & COHERENCE: steady pace, few disruptive pauses/fillers, smooth self-reformulation; and a RANGE of cohesive devices — sequence (firstly, then, finally), addition (moreover, in addition), contrast (however, on the other hand, whereas), cause/result (because, therefore, as a result, consequently), example (for instance, such as), conclusion (overall, in conclusion). To improve: INSERT specific linkers between the student's ideas (quote where).

PART-SPECIFIC HIGH-SCORE MOVES:
- Use the FULL allotted time.
- Part 1: answer + 1–2 supporting details + a reason.
- Part 2 (describe picture): systematic order (place → people → actions → atmosphere) + speculation language (they seem to…/might be…); answer opinion Qs with reasons.
- Part 3 (compare 2 pictures): explicit comparison (both…; whereas…; in contrast; similarly) + state a preference WITH justification (I'd rather… because…).
- Part 4 (abstract monologue, ~2 min): intro → personal experience → reasons + examples → wider perspective → conclusion; use discourse markers throughout.

HOW TO APPLY:
- criteriaAnalysis[mỗi tiêu chí]: giải thích band theo các chiều RANGE / ACCURACY / STRUCTURE / COHESION, TRÍCH lại chính lời học viên đã nói (đặt trong dấu ngoặc kép), rồi đưa cách sửa cụ thể (riêng Vocabulary phải nêu rõ cặp swap "từ học viên dùng → từ xịn hơn", riêng Grammar phải show recast câu của học viên thành cấu trúc phức tạp hơn).
- upgradeTips (mỗi item): chọn 1–2 move tác động cao nhất CHO RIÊNG câu này, TRÍCH lời học viên, rồi viết mẫu cách nói lại để đạt band Aptis cao hơn (KHÔNG nói mẹo chung chung).
- Tuyệt đối KHÔNG dùng tip mẫu áp cho mọi bài; mọi đề xuất phải bám vào nội dung thực tế trong transcript của học viên.

SILENT/MISSING ITEMS: Questions explicitly marked "[NO AUDIO]" have no recording. For those items you MUST return transcript="", onTopic=false, improvedVersion="" and NEVER invent content. Bands must reflect only the questions that actually have audio (missing items hurt TF as "no answer").

OUTPUT (via the tool, in this order — write "analysis" and "criteriaAnalysis" BEFORE choosing bands):
- perItem: ${isPart4 ? `EXACTLY ${itemCount} entries — ONE per SUB-QUESTION, IN ORIGINAL ORDER (do NOT skip, do NOT merge two sub-questions into one entry, do NOT return fewer than ${itemCount}). For each sub-question: transcript = the segment of the monologue addressing THIS sub-question (or "" if the monologue does NOT address it); onTopic = true only if the monologue actually addresses THIS sub-question, otherwise false; improvedVersion = upgraded English rewrite of THAT segment (you may put the full upgraded monologue in the FIRST item and leave the rest empty); upgradeTips (Vietnamese, 2-4 sentences) = mẹo cụ thể để câu trả lời này đạt band cao hơn trong kỳ thi Aptis.` : "one entry per QUESTION in ORIGINAL ORDER (including [NO AUDIO] items as empty). Each item: transcript, onTopic, improvedVersion = upgraded English rewrite of THAT SPECIFIC answer (keep the student's ideas, fix grammar/vocab, upgrade structure, add linking words) — empty if silent. upgradeTips (Vietnamese, 2-4 sentences) = mẹo CỤ THỂ để câu trả lời này đạt band cao hơn trong Aptis: cấu trúc ngữ pháp phức tạp nên dùng, từ nối, cách triển khai ý + ví dụ, paraphrase, đa dạng từ vựng. Để rỗng nếu không có audio."}.
- analysis: Vietnamese, 4-6 câu — phân tích tổng quan TRƯỚC khi cho band.
- criteriaAnalysis: object với 5 trường tiếng Việt { tf, gra, vra, pro, fc }. MỖI tiêu chí 2-3 câu: VÌ SAO được band đó + cách CẢI THIỆN CỤ THỂ.
  • vra (Từ vựng): gợi ý từ TỰ NHIÊN, CHÍNH XÁC trong ngữ cảnh (không phải từ hiếm/kêu); tập trung sửa dùng sai + lặp từ (vd: "do a mistake → make a mistake", thay từ lặp bằng paraphrase tự nhiên).
  • gra (Ngữ pháp): chấm theo độ chính xác + không lỗi hệ thống là chính; ghi nhận các cấu trúc đa dạng nếu CÓ xuất hiện trong bài; cải thiện = sửa lỗi cho chuẩn/tự nhiên trước, không bắt phức tạp hóa.
  • pro (Phát âm): nêu âm/trọng âm cụ thể yếu, cách luyện.
  • fc (Trôi chảy): nêu chỗ ngập ngừng/thiếu liên kết + từ nối nên dùng (however, moreover, as a result...).
  • tf (Nội dung): nêu ý còn thiếu/lệch + cách triển khai sâu hơn (lý do + ví dụ).
- bands: { tf, gra, vra, pro, fc } each integer 0..5.

Be honest, strict, fair. Do not invent content the student didn't say.`;

      // For non-Part4: send only spoken audios, but label every question and note which have NO AUDIO.
      // For Part4: single monologue; we already know anySpoken is true here.
      const spokenAudios = audios.filter((_, i) => spokenMask[i]);
      const spokenIdx = audios.map((_, i) => i).filter((i) => spokenMask[i]);
      const questionListText = isPart4
        ? questions.map((q, i) => `${i + 1}. ${q}`).join("\n")
        : questions.map((q, i) => `${i + 1}. ${q}${spokenMask[i] ? "" : "  [NO AUDIO — student did not record]"}`).join("\n");

      const audioOrderNote = isPart4
        ? "ONE monologue audio follows."
        : `${spokenAudios.length} audio file(s) follow, IN ORDER, for question number(s): ${spokenIdx.map((i) => i + 1).join(", ")}. Other questions have NO AUDIO and MUST be returned with empty transcript and onTopic=false.`;

      const userParts: any[] = [
        { type: "text", text: `Exam Part: ${partType}\n${isPart4 ? "Sub-questions" : "Questions"}:\n${questionListText}\n\n${audioOrderNote}` },
      ];
      for (const a of spokenAudios) {
        userParts.push({ type: "input_audio", input_audio: { data: a, format: "webm" } });
      }


      const toolSchemaV2 = {
        type: "function",
        function: {
          name: "submit_speaking_v2",
          description: "Submit 5-criteria Aptis Speaking grading for one part",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              perItem: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    transcript: { type: "string" },
                    onTopic: { type: "boolean" },
                    improvedVersion: { type: "string", description: "Upgraded English rewrite of THIS answer/sub-segment. Empty string if silent." },
                    upgradeTips: { type: "string", description: "Vietnamese, 2-4 sentences. Concrete Aptis-oriented tips to score higher on THIS answer (complex grammar, linking words, idea development, vocabulary upgrades). Empty if silent." },
                  },
                  required: ["transcript", "onTopic", "improvedVersion", "upgradeTips"],
                },
              },
              analysis: { type: "string" },
              criteriaAnalysis: {
                type: "object",
                additionalProperties: false,
                properties: {
                  tf: { type: "string", description: "Vietnamese, 2-3 sentences: why this band + concrete improvement for Task Fulfilment." },
                  gra: { type: "string", description: "Vietnamese, 2-3 sentences: why this band + concrete grammar fix and structure to use." },
                  vra: { type: "string", description: "Vietnamese, 2-3 sentences: why this band + name actual words used and suggest upgrade replacements." },
                  pro: { type: "string", description: "Vietnamese, 2-3 sentences: why this band + concrete pronunciation/stress improvements." },
                  fc: { type: "string", description: "Vietnamese, 2-3 sentences: why this band + linking words and fluency fixes." },
                },
                required: ["tf", "gra", "vra", "pro", "fc"],
              },
              bands: {
                type: "object",
                additionalProperties: false,
                properties: {
                  tf: { type: "integer", minimum: 0, maximum: 5 },
                  gra: { type: "integer", minimum: 0, maximum: 5 },
                  vra: { type: "integer", minimum: 0, maximum: 5 },
                  pro: { type: "integer", minimum: 0, maximum: 5 },
                  fc: { type: "integer", minimum: 0, maximum: 5 },
                },
                required: ["tf", "gra", "vra", "pro", "fc"],
              },
            },
            required: ["perItem", "analysis", "criteriaAnalysis", "bands"],
          },
        },
      };

      const MODEL_V2 = "google/gemini-2.5-flash";
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_V2,
          messages: [
            { role: "system", content: sysV2 },
            { role: "user", content: userParts },
          ],
          tools: [toolSchemaV2],
          tool_choice: { type: "function", function: { name: "submit_speaking_v2" } },
        }),
      });

      if (!aiResp.ok) {
        const txt = await aiResp.text().catch(() => "");
        console.error("[grade-exam v2] AI error", aiResp.status, txt.slice(0, 400));
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "AI đang quá tải, thử lại sau." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "Hết credit AI." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: "Không chấm được, thử lại." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const aiJson = await aiResp.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("[grade-exam v2] no tool call", JSON.stringify(aiJson).slice(0, 500));
        return new Response(JSON.stringify({ error: "Phản hồi AI không hợp lệ" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let parsed: any;
      try { parsed = JSON.parse(toolCall.function.arguments); }
      catch (_e) {
        return new Response(JSON.stringify({ error: "Phản hồi AI không hợp lệ" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const b = parsed.bands || {};
      const tf = Math.max(0, Math.min(5, Math.round(Number(b.tf ?? 0))));
      const gra = Math.max(0, Math.min(5, Math.round(Number(b.gra ?? 0))));
      const vra = Math.max(0, Math.min(5, Math.round(Number(b.vra ?? 0))));
      const pro = Math.max(0, Math.min(5, Math.round(Number(b.pro ?? 0))));
      const fc = Math.max(0, Math.min(5, Math.round(Number(b.fc ?? 0))));
      const raw_part = tf * 2 + gra + vra + pro + fc;

      try {
        await logAIUsage({
          model: MODEL_V2,
          usage: aiJson?.usage,
          source_function: "grade-exam",
          metadata: { mode: "speaking_v2", partType },
        });
      } catch { /* ignore */ }
      try {
        if (userId) {
          await serviceClient.from("feature_usage").insert({
            user_id: userId, feature_key: "ai_grading_speaking", scope: null, ref_id: null,
          });
        }
      } catch { /* ignore */ }

      let perItemOut = Array.isArray(parsed.perItem)
        ? parsed.perItem.map((it: any) => ({
            transcript: it?.transcript ?? "",
            onTopic: !!it?.onTopic,
            improvedVersion: it?.improvedVersion ?? "",
            upgradeTips: it?.upgradeTips ?? "",
          }))
        : [];
      // Hard-enforce exact itemCount (= number of questions / sub-questions), in order.
      if (isPart4) {
        perItemOut = Array.from({ length: itemCount }, (_, i) => {
          const src = perItemOut[i] ?? { transcript: "", onTopic: false, improvedVersion: "", upgradeTips: "" };
          return { ...src, questionText: questions[i] ?? "" };
        });
      } else {
        perItemOut = Array.from({ length: itemCount }, (_, i) => {
          if (!spokenMask[i]) return { transcript: "", onTopic: false, improvedVersion: "", upgradeTips: "", questionText: questions[i] ?? "" };
          const src = perItemOut[i] ?? { transcript: "", onTopic: false, improvedVersion: "", upgradeTips: "" };
          return { ...src, questionText: questions[i] ?? "" };
        });
      }


      const ca = parsed.criteriaAnalysis || {};
      return new Response(JSON.stringify({
        bands: { tf, gra, vra, pro, fc },
        rawPart: raw_part,
        raw_part,
        perItem: perItemOut,
        analysis: parsed.analysis ?? "",
        criteriaAnalysis: {
          tf: ca.tf ?? "",
          gra: ca.gra ?? "",
          vra: ca.vra ?? "",
          pro: ca.pro ?? "",
          fc: ca.fc ?? "",
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ============================================================
    // END SPEAKING V2 BRANCH
    // ============================================================

    // ============================================================
    // WRITING FINALIZE (analytic rubric)
    // raw_total = raw_P1*0.5 + raw_P2 + raw_P3 + raw_P4*1.5   (max 120)
    // scale50   = round(raw_total / 120 * 50)
    // CUTS      = { C:46, B2:40, B1:33, A2:23, A1:12, A0:0 }
    // Grey zone: within 2 pts below a cut → bump if coreGV band >= that band
    // Appropriacy cap: forcedComplexity && cefr === 'C' → cefr=B2, scale50<=45
    // ============================================================
    if ((type as string) === "writing_finalize") {
      const rp = (body as any).rawParts || {};
      const p1 = Number(rp.task1 ?? 0);
      const p2 = Number(rp.task2 ?? 0);
      const p3 = Number(rp.task3 ?? 0);
      const p4 = Number(rp.task4 ?? 0);
      const raw_total = p1 * 0.5 + p2 + p3 + p4 * 1.5;
      const scale50Base = Math.round((raw_total / 120) * 50);
      let scale50 = Math.max(0, Math.min(50, scale50Base));
      const CUTS: Array<{ band: string; cut: number }> = [
        { band: "C", cut: 46 },
        { band: "B2", cut: 40 },
        { band: "B1", cut: 33 },
        { band: "A2", cut: 23 },
        { band: "A1", cut: 12 },
        { band: "A0", cut: 0 },
      ];
      const order = ["A0", "A1", "A2", "B1", "B2", "C"];
      const rankOf = (b: string) => order.indexOf(b);
      let baseBand = "A0";
      for (const c of CUTS) {
        if (scale50 >= c.cut) { baseBand = c.band; break; }
      }
      const coreGV = (body as any).coreGV as string | null | undefined;
      const GREY_WIDTH = 2;
      let greyZone = false;
      let bumpedTo: string | null = null;
      for (const c of CUTS) {
        if (scale50 >= c.cut - GREY_WIDTH && scale50 < c.cut) {
          greyZone = true;
          if (coreGV != null && rankOf(String(coreGV)) >= rankOf(c.band)) {
            bumpedTo = c.band;
          }
          break;
        }
      }
      let cefr = bumpedTo ?? baseBand;
      let flagReview = greyZone;

      // Appropriacy cap
      const forcedComplexity = !!(body as any).forcedComplexity;
      if (forcedComplexity && cefr === "C") {
        cefr = "B2";
        scale50 = Math.min(scale50, 45);
        flagReview = true;
      }

      return new Response(JSON.stringify({
        rawTotal: Math.round(raw_total * 100) / 100,
        raw_total: Math.round(raw_total * 100) / 100,
        scale50,
        cefr,
        greyZone,
        flagReview,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============================================================
    // WRITING V2 BRANCH (analytic rubric per part)
    // ============================================================
    if ((type as string) === "writing_v2") {
      const pt: string = String((body as any).partType || "");
      const qs: string[] = Array.isArray(questions) ? questions.map((q) => String(q ?? "")) : [];
      const studentText: string = String((body as any).text ?? "");
      const partsIn = (body as any).parts || {};

      if (!["task1", "task2", "task3", "task4"].includes(pt)) {
        return new Response(JSON.stringify({ error: "Invalid writing partType" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (studentText.length > 12_000) {
        return new Response(JSON.stringify({ error: "Text too large" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Tier gate — skip on internal worker retries.
      if (userId && !isInternal) {
        try {
          const { data: access } = await supabaseClient.rpc("check_feature_access", {
            p_key: "ai_grading_writing", p_scope: null,
          });
          const a = (access ?? {}) as any;
          if (a && a.allowed === false && (a.reason === "quota_exceeded" || a.reason === "disabled")) {
            const userTier = (a.tier as string) ?? "free";
            const need = userTier === "pro" ? "premium" : "pro";
            return new Response(JSON.stringify({
              error: a.reason === "disabled" ? "disabled" : "quota_exceeded",
              upgrade: true, need, tier: userTier,
              freeQuota: a.free_quota ?? 0, proQuota: a.pro_quota ?? null,
              used: a.used ?? 0, remaining: a.remaining ?? 0,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (e) {
          console.warn("[grade-exam writing_v2] feature access check failed:", (e as any)?.message || e);
        }
      }

      // Word counter (whitespace tokens)
      const wc = (s: string) => (String(s || "").trim().match(/\S+/g) || []).length;
      const capFromRatio = (words: number, minReq: number, maxReq: number): { cap: number; flagOver: boolean } => {
        const r = minReq > 0 ? words / minReq : 1;
        let cap = 5;
        if (r < 0.5) cap = 2;
        else if (r < 0.7) cap = 3;
        else if (r < 1.0) cap = 4;
        let flagOver = false;
        if (words > maxReq * 1.3) { cap = Math.min(cap, 4); flagOver = true; }
        if (words > maxReq * 1.6) { cap = Math.min(cap, 3); flagOver = true; }
        return { cap, flagOver };
      };

      const bandNum = (v: any) => {
        const n = Math.round(Number(v ?? 0));
        return Math.max(0, Math.min(5, isNaN(n) ? 0 : n));
      };

      // Build task-specific prompt
      const REGISTER_GUIDANCE = `
FEEDBACK REGISTER (đúng giọng theo part):
- Part 1: KHÔNG gợi ý nâng cấp — chỉ nhận xét đúng/sai và chính tả.
- Part 2 & 3: giữ giọng informal, thân mật. Part 3 gợi ý kiểu "you should…", KHÔNG dùng "I strongly recommend".
- Part 4 email formal: có thể gợi ý cấu trúc, cụm formal.
FEEDBACK ORDER (bắt buộc): Task fulfilment → Grammar/chính tả → Vocabulary. Không ép cấu trúc phức tạp cho Part thấp.`;

      const SHARED_RUBRIC = `
BAND ANCHORS (0-5, chấm nguyên):
5 = C: tự nhiên, chính xác, phong phú, mạch lạc rõ.
4 = B2: nhìn chung chính xác, phát triển tốt, đôi chỗ sơ suất.
3 = B1: đủ ý cơ bản, còn lỗi rõ nhưng vẫn hiểu, mạch lạc trung bình.
2 = A2: câu đơn giản, nhiều lỗi ảnh hưởng, thiếu phát triển.
1 = A1: rất hạn chế, lỗi lớn, khó theo.
0: không đáp ứng / rời rạc / lạc đề hoàn toàn.

CRITERIA (mỗi tiêu chí một band 0-5):
- TF (Task Fulfilment): đáp đúng yêu cầu, đủ ý, đúng chủ đề. LẠC ĐỀ → TF = 0.
- GRA (Grammar & Accuracy): đúng thời/cấu trúc/chia động từ, đa dạng câu.
- VRA (Vocabulary): dùng từ đúng, đa dạng, tự nhiên, phù hợp ngữ cảnh.
- CC (Coherence & Cohesion): mạch lạc, dùng từ nối hợp lý, ý liên kết.
- REG (Register & Tone): đúng tông (informal/formal) theo yêu cầu.
${REGISTER_GUIDANCE}

FORCED COMPLEXITY DETECTION:
Đặt forcedComplexity = true khi học viên cố ý nhồi cấu trúc/từ vựng "đao to búa lớn" không phù hợp part hay chủ đề (ví dụ Part 1 mà dùng "notwithstanding, in light of the aforementioned…"). Nếu không thì false.

RETURN VIA TOOL CALL. Mọi lỗi liệt kê ĐẦY ĐỦ, mỗi lỗi 1 dòng {original, corrected, explanation (tiếng Việt ngắn)}.`;

      let systemPromptV2 = "";
      let userText = "";
      // Word-count reqs per part
      // P2: 20-30 · P3: 30-40/câu · P4: informal 40-50, formal 120-150 · P1: none

      if (pt === "task1") {
        systemPromptV2 = `You are an expert Aptis Writing Part 1 grader (5 short answers, 1-5 từ mỗi câu). NO word-count cap.
Chấm mỗi câu là "correct" khi VỪA đúng nội dung yêu cầu VỪA đúng chính tả/ngữ pháp. Trả về:
- items: mảng 5 phần tử { correct: boolean, reason: string (tiếng Việt, ngắn) }
- grammarErrors, spellingErrors: liệt kê đầy đủ (không bắt buộc questionIndex).
- feedback: tiếng Việt theo thứ tự Task → Grammar/chính tả → Vocabulary. KHÔNG gợi ý nâng cấp.
- improvedVersion: bản đúng cho 5 câu (mỗi dòng một câu).
- forcedComplexity: boolean.
${SHARED_RUBRIC}`;
        userText = `partType: task1
Prompts:
${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Student's 5 short answers (mỗi câu 1 dòng, đúng thứ tự):
${(partsIn.shortAnswers || []).map((a: string, i: number) => `${i + 1}. ${a ?? ""}`).join("\n")}`;
      } else if (pt === "task2") {
        systemPromptV2 = `You are an expert Aptis Writing Part 2 grader (Social Media Response, 20-30 words).
Trả về:
- bands: { tf, gra, vra, cc, reg } (band 0-5) — CHỈ chấm TF theo NỘI DUNG (chưa áp word-count).
- criteriaAnalysis: giải thích ngắn (VN) cho từng tiêu chí.
- grammarErrors, spellingErrors (liệt kê đầy đủ).
- feedback (VN, thứ tự Task→Grammar/chính tả→Vocabulary; giữ giọng informal).
- improvedVersion: bản viết lại tự nhiên, cùng ý.
- forcedComplexity: boolean.
${SHARED_RUBRIC}`;
        userText = `partType: task2
Prompt:
${qs.join("\n")}

Student's response:
${studentText}`;
      } else if (pt === "task3") {
        systemPromptV2 = `You are an expert Aptis Writing Part 3 grader (3 câu trả lời, 30-40 words/câu, informal).
Trả về:
- items: mảng 3 phần tử { tfContent: band 0-5 (nội dung, chưa áp word-count), reason: VN ngắn }.
- bands: { tf: (sẽ được tính ở app), gra, vra, cc, reg } — chấm gra/vra/cc/reg cho CẢ part 1 lần.
- criteriaAnalysis (VN).
- grammarErrors, spellingErrors: mỗi lỗi có questionIndex (0..2).
- feedback (VN, thứ tự Task→Grammar/chính tả→Vocabulary; giọng informal, dùng "you should…").
- improvedVersion: gộp 3 câu đã sửa.
- forcedComplexity: boolean.
${SHARED_RUBRIC}`;
        userText = `partType: task3
Questions:
${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Student's 3 answers (đúng thứ tự):
${(partsIn.threeAnswers || []).map((a: string, i: number) => `${i + 1}. ${a ?? ""}`).join("\n\n")}`;
      } else {
        systemPromptV2 = `You are an expert Aptis Writing Part 4 grader (2 emails).
Email 1: INFORMAL, 40-50 words. Email 2: FORMAL, 120-150 words. Both PHẢI bám SCENARIO chung.

Trả về:
- emails: mảng 2 phần tử theo thứ tự [informal, formal], mỗi phần tử:
  { bands: { tf, gra, vra, cc, reg } (0-5) — TF theo NỘI DUNG (chưa áp word-count), criteriaAnalysis: {tf,gra,vra,cc,reg}, reason: VN ngắn }.
- grammarErrors, spellingErrors: mỗi lỗi có emailIndex (0 informal, 1 formal).
- feedback (VN, thứ tự Task→Grammar/chính tả→Vocabulary; chỉ email FORMAL mới gợi ý cấu trúc trang trọng).
- improvedVersion: bản viết lại 2 email (đánh dấu rõ "Informal:" và "Formal:").
- forcedComplexity: boolean.

SCENARIO RULE: nếu email trả lời sai scenario → TF của email đó = 0.
${SHARED_RUBRIC}`;
        userText = `partType: task4
Prompts:
${qs.join("\n\n")}

Informal email:
${partsIn.informalText ?? ""}

Formal email:
${partsIn.formalText ?? ""}`;
      }

      // Build tool schema per part
      const bandProp = { type: "integer", minimum: 0, maximum: 5 };
      const errItem = {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
          questionIndex: { type: "integer" },
          emailIndex: { type: "integer" },
        },
        required: ["original", "corrected"],
      };
      const bandsObj = {
        type: "object",
        additionalProperties: false,
        properties: { tf: bandProp, gra: bandProp, vra: bandProp, cc: bandProp, reg: bandProp },
        required: ["tf", "gra", "vra", "cc", "reg"],
      };
      const criteriaAnalysisSchema = {
        type: "object",
        additionalProperties: false,
        properties: { tf: { type: "string" }, gra: { type: "string" }, vra: { type: "string" }, cc: { type: "string" }, reg: { type: "string" } },
        required: ["tf", "gra", "vra", "cc", "reg"],
      };

      let toolParams: any;
      if (pt === "task1") {
        toolParams = {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array", minItems: 5, maxItems: 5,
              items: { type: "object", additionalProperties: false, properties: { correct: { type: "boolean" }, reason: { type: "string" } }, required: ["correct", "reason"] },
            },
            grammarErrors: { type: "array", items: errItem },
            spellingErrors: { type: "array", items: errItem },
            feedback: { type: "string" },
            improvedVersion: { type: "string" },
            forcedComplexity: { type: "boolean" },
          },
          required: ["items", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "forcedComplexity"],
        };
      } else if (pt === "task3") {
        toolParams = {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array", minItems: 3, maxItems: 3,
              items: { type: "object", additionalProperties: false, properties: { tfContent: bandProp, reason: { type: "string" } }, required: ["tfContent", "reason"] },
            },
            bands: bandsObj,
            criteriaAnalysis: criteriaAnalysisSchema,
            grammarErrors: { type: "array", items: errItem },
            spellingErrors: { type: "array", items: errItem },
            feedback: { type: "string" },
            improvedVersion: { type: "string" },
            forcedComplexity: { type: "boolean" },
          },
          required: ["items", "bands", "criteriaAnalysis", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "forcedComplexity"],
        };
      } else if (pt === "task4") {
        const emailObj = {
          type: "object", additionalProperties: false,
          properties: { bands: bandsObj, criteriaAnalysis: criteriaAnalysisSchema, reason: { type: "string" } },
          required: ["bands", "criteriaAnalysis", "reason"],
        };
        toolParams = {
          type: "object", additionalProperties: false,
          properties: {
            emails: { type: "array", minItems: 2, maxItems: 2, items: emailObj },
            grammarErrors: { type: "array", items: errItem },
            spellingErrors: { type: "array", items: errItem },
            feedback: { type: "string" },
            improvedVersion: { type: "string" },
            forcedComplexity: { type: "boolean" },
          },
          required: ["emails", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "forcedComplexity"],
        };
      } else {
        // task2
        toolParams = {
          type: "object", additionalProperties: false,
          properties: {
            bands: bandsObj,
            criteriaAnalysis: criteriaAnalysisSchema,
            grammarErrors: { type: "array", items: errItem },
            spellingErrors: { type: "array", items: errItem },
            feedback: { type: "string" },
            improvedVersion: { type: "string" },
            forcedComplexity: { type: "boolean" },
          },
          required: ["bands", "criteriaAnalysis", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "forcedComplexity"],
        };
      }

      const toolV2 = {
        type: "function",
        function: {
          name: "submit_writing_grading_v2",
          description: "Submit analytic Aptis Writing grading (v2). Do NOT compute final score.",
          parameters: toolParams,
        },
      };

      const model = "google/gemini-2.5-flash";
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPromptV2 },
            { role: "user", content: [{ type: "text", text: userText }] },
          ],
          tools: [toolV2],
          tool_choice: { type: "function", function: { name: "submit_writing_grading_v2" } },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("[grade-exam writing_v2] gateway error", resp.status, errText.slice(0, 500));
        return new Response(JSON.stringify({ error: `AI gateway error: ${resp.status}`, notGraded: true }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rawData = await resp.json();
      logAIUsage({ model, usage: rawData.usage, source_function: "grade-exam", metadata: { type: "writing_v2", partType: pt } }).catch(() => {});

      const tc = rawData.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) {
        console.error("[grade-exam writing_v2] no tool call:", JSON.stringify(rawData).slice(0, 500));
        return new Response(JSON.stringify({ error: "AI did not return structured grading", notGraded: true }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = JSON.parse(tc.function.arguments);
      const grammarErrors = Array.isArray(parsed.grammarErrors) ? parsed.grammarErrors : [];
      const spellingErrors = Array.isArray(parsed.spellingErrors) ? parsed.spellingErrors : [];
      const forcedComplexity = !!parsed.forcedComplexity;
      const feedback: string = String(parsed.feedback ?? "");
      const improvedVersion: string = String(parsed.improvedVersion ?? "");

      let bands: any = { tf: 0, gra: 0, vra: 0, cc: 0, reg: 0 };
      let criteriaAnalysis: any = { tf: "", gra: "", vra: "", cc: "", reg: "" };
      let rawPart = 0;
      let perItem: any[] = [];
      let analysis = "";

      if (pt === "task1") {
        const items: any[] = Array.isArray(parsed.items) ? parsed.items.slice(0, 5) : [];
        while (items.length < 5) items.push({ correct: false, reason: "" });
        const correctCount = items.filter((it) => !!it.correct).length; // 0..5 → band
        bands = { tf: correctCount, gra: 0, vra: 0, cc: 0, reg: 0 }; // Part 1 chỉ dùng TF-aggregate
        rawPart = correctCount * 6; // 0..30
        perItem = items.map((it, i) => ({
          questionText: qs[i] ?? "",
          userAnswer: (partsIn.shortAnswers || [])[i] ?? "",
          tfContent: it.correct ? 5 : 0,
          tfTask: it.correct ? 5 : 0,
        }));
        analysis = items.map((it, i) => `Câu ${i + 1}: ${it.reason || (it.correct ? "OK" : "Sai")}`).join("\n");
      } else if (pt === "task2") {
        const b = parsed.bands || {};
        const tfContent = bandNum(b.tf);
        const words = wc(studentText);
        const { cap, flagOver } = capFromRatio(words, 20, 30);
        const tfTask = Math.min(tfContent, cap);
        bands = { tf: tfTask, gra: bandNum(b.gra), vra: bandNum(b.vra), cc: bandNum(b.cc), reg: bandNum(b.reg) };
        rawPart = bands.tf * 2 + bands.gra + bands.vra + bands.cc + bands.reg; // 0..30
        criteriaAnalysis = parsed.criteriaAnalysis || criteriaAnalysis;
        perItem = [{
          questionText: qs.join("\n"),
          userAnswer: studentText,
          wordCount: words, minReq: 20, maxReq: 30,
          tfCap: cap, tfContent, tfTask, flagOver,
        }];
        analysis = `Words: ${words}/20-30. TF nội dung ${tfContent} → sau word-cap = ${tfTask}.`;
      } else if (pt === "task3") {
        const b = parsed.bands || {};
        const items: any[] = Array.isArray(parsed.items) ? parsed.items.slice(0, 3) : [];
        while (items.length < 3) items.push({ tfContent: 0, reason: "" });
        const answers: string[] = (partsIn.threeAnswers || []).slice(0, 3);
        while (answers.length < 3) answers.push("");
        const perTF: number[] = items.map((it, i) => {
          const words = wc(answers[i] || "");
          const { cap, flagOver } = capFromRatio(words, 30, 40);
          const tfContent = bandNum(it.tfContent);
          const tfTask = Math.min(tfContent, cap);
          perItem.push({
            questionText: qs[i] ?? "",
            userAnswer: answers[i] ?? "",
            wordCount: words, minReq: 30, maxReq: 40,
            tfCap: cap, tfContent, tfTask, flagOver,
          });
          return tfTask;
        });
        const tfAvg = Math.round((perTF.reduce((s, n) => s + n, 0) / 3) * 100) / 100; // keep 2dp
        bands = { tf: tfAvg, gra: bandNum(b.gra), vra: bandNum(b.vra), cc: bandNum(b.cc), reg: bandNum(b.reg) };
        rawPart = tfAvg * 2 + bands.gra + bands.vra + bands.cc + bands.reg;
        criteriaAnalysis = parsed.criteriaAnalysis || criteriaAnalysis;
        analysis = perItem.map((p: any, i: number) => `Câu ${i + 1}: ${p.wordCount} từ, TF ${p.tfContent}→${p.tfTask}`).join("\n");
      } else {
        // task4
        const emails: any[] = Array.isArray(parsed.emails) ? parsed.emails.slice(0, 2) : [];
        while (emails.length < 2) emails.push({ bands: { tf: 0, gra: 0, vra: 0, cc: 0, reg: 0 }, criteriaAnalysis: {} });
        const informalText = String(partsIn.informalText ?? "");
        const formalText = String(partsIn.formalText ?? "");
        const infoWc = wc(informalText);
        const formalWc = wc(formalText);
        const infoCap = capFromRatio(infoWc, 40, 50);
        const formalCap = capFromRatio(formalWc, 120, 150);
        const emailReqs = [
          { minReq: 40, maxReq: 50, words: infoWc, capInfo: infoCap, text: informalText, label: "Informal" },
          { minReq: 120, maxReq: 150, words: formalWc, capInfo: formalCap, text: formalText, label: "Formal" },
        ];
        const rawPerEmail: number[] = [];
        emails.forEach((em: any, i: number) => {
          const b = em.bands || {};
          const tfContent = bandNum(b.tf);
          const tfTask = Math.min(tfContent, emailReqs[i].capInfo.cap);
          const gra = bandNum(b.gra), vra = bandNum(b.vra), cc = bandNum(b.cc), reg = bandNum(b.reg);
          const rawE = tfTask * 2 + gra + vra + cc + reg; // 0..30
          rawPerEmail.push(rawE);
          perItem.push({
            questionText: `${emailReqs[i].label} email`,
            userAnswer: emailReqs[i].text,
            wordCount: emailReqs[i].words,
            minReq: emailReqs[i].minReq,
            maxReq: emailReqs[i].maxReq,
            tfCap: emailReqs[i].capInfo.cap,
            tfContent, tfTask, flagOver: emailReqs[i].capInfo.flagOver,
            bands: { tf: tfTask, gra, vra, cc, reg },
            criteriaAnalysis: em.criteriaAnalysis || {},
          });
        });
        // rawPart = informal*0.4 + formal*0.6  (then finalize multiplies by 1.5)
        rawPart = Math.round((rawPerEmail[0] * 0.4 + rawPerEmail[1] * 0.6) * 100) / 100;
        // Bubble aggregate bands (weighted like raw) for UI
        const wBand = (k: string) => {
          const a = perItem[0]?.bands?.[k] ?? 0;
          const b = perItem[1]?.bands?.[k] ?? 0;
          return Math.round((a * 0.4 + b * 0.6) * 100) / 100;
        };
        bands = { tf: wBand("tf"), gra: wBand("gra"), vra: wBand("vra"), cc: wBand("cc"), reg: wBand("reg") };
        analysis = `Informal ${infoWc}/40-50 · Formal ${formalWc}/120-150. Raw informal=${rawPerEmail[0]}, formal=${rawPerEmail[1]}, weighted=${rawPart}.`;
      }

      const payload = {
        bands,
        rawPart,
        raw_part: rawPart,
        perItem,
        analysis,
        criteriaAnalysis: criteriaAnalysisSchema,
        grammarErrors,
        spellingErrors,
        feedback,
        improvedVersion,
        forcedComplexity,
      };

      // Log usage once
      if (userId) {
        try {
          await serviceClient.from("feature_usage").insert({
            user_id: userId, feature_key: "ai_grading_writing", scope: null, ref_id: null,
          });
        } catch (e) {
          console.warn("[grade-exam writing_v2] feature_usage insert failed:", (e as any)?.message || e);
        }
      }

      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ============================================================
    // END WRITING V2 BRANCH
    // ============================================================

    if (type !== "speaking" && type !== "writing") {

      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(questions) || questions.length > 20) {
      return new Response(
        JSON.stringify({ error: "Invalid or too many questions" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (audioBase64 && audioBase64.length > 10_000_000) {
      return new Response(JSON.stringify({ error: "Audio payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text && text.length > 10_000) {
      return new Response(JSON.stringify({ error: "Text payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Idempotency cache: avoid re-grading identical submissions ---
    const hashInput = JSON.stringify({
      type, partType, itemType, questions, subQuestions,
      text: text ?? null,
      audioLen: audioBase64 ? audioBase64.length : 0,
      audioHead: audioBase64 ? audioBase64.slice(0, 256) : "",
      audioTail: audioBase64 ? audioBase64.slice(-256) : "",
      actualSpoken, speakTime, maxPoints,
      timePenaltyTiers: tiersIn,
      usedConnectorsRequired: !!body.usedConnectorsRequired,
    });
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
    const requestHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (userId) {
      try {
        const { data: cachedRow } = await serviceClient
          .from("grading_cache")
          .select("response")
          .eq("user_id", userId)
          .eq("request_hash", requestHash)
          .maybeSingle();
        if (cachedRow?.response) {
          console.log("[grade-exam] cache hit, skipping AI call");
          return new Response(JSON.stringify(cachedRow.response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.warn("[grade-exam] cache lookup failed:", (e as any)?.message || e);
      }

      // Daily quota: 10 graded submissions per user. Skip on internal retries —
      // quota was already consumed on the initial student submission; retrying
      // must not burn additional daily allowance.
      if (!isInternal) {
        const quota = await enforceDailyQuota(userId, "grade-exam", 10, corsHeaders);
        if (quota) return quota;
      }
    }

    // --- Tier-based gate (ai_grading_writing | ai_grading_speaking) ---
    // premium → unlimited; pro → cap = pro_quota/month; free → cap = free_quota/month.
    // Skip on internal retries.
    const featureKey = type === "writing" ? "ai_grading_writing" : "ai_grading_speaking";
    if (userId && !isInternal) {
      try {
        const { data: access } = await supabaseClient.rpc("check_feature_access", {
          p_key: featureKey,
          p_scope: null,
        });
        const a = (access ?? {}) as any;
        if (a && a.allowed === false && (a.reason === "quota_exceeded" || a.reason === "disabled")) {
          const userTier = (a.tier as string) ?? "free";
          // free out of quota → upgrade to pro; pro out of quota → upgrade to premium
          const need = userTier === "pro" ? "premium" : "pro";
          return new Response(
            JSON.stringify({
              error: a.reason === "disabled" ? "disabled" : "quota_exceeded",
              upgrade: true,
              need,
              tier: userTier,
              freeQuota: a.free_quota ?? 0,
              proQuota: a.pro_quota ?? null,
              used: a.used ?? 0,
              remaining: a.remaining ?? 0,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.warn("[grade-exam] feature access check failed:", (e as any)?.message || e);
      }
    }

    const logFeatureUsageOnce = async () => {
      if (!userId) return;
      try {
        await serviceClient.from("feature_usage").insert({
          user_id: userId,
          feature_key: featureKey,
          scope: null,
          ref_id: null,
        });
      } catch (e) {
        console.warn("[grade-exam] feature_usage insert failed:", (e as any)?.message || e);
      }
    };

    // --- Build AI prompt ---
    let userContent: any[];
    let systemPrompt: string;

    if (type === "speaking") {
      const leniencyRules = `

ERROR-DETECTION LENIENCY (Aptis prioritizes intelligibility over nitpicking — apply STRICTLY):
A. Connected speech — NEVER penalize:
   - Dropped final consonants caused by linking: -ed (/t/,/d/), -t, -d, -s endings. E.g. "asked" heard as "ask", "seats" heard as "seat" → NOT an error.
   - CRITICAL: when an inflectional ending (-ed past, -s plural / 3rd-person) is dropped due to connected speech, do NOT count it as a GRAMMAR error (wrong tense / wrong number) NOR a PRONUNCIATION error.
   - Consonant cluster reduction such as /sts/ → /s/ (e.g. "tourists" → "touris") → NOT an error.
B. Likely transcription mishears (not student errors) — use CONTEXT to ignore:
   - If a word in the transcript doesn't fit the context and is likely a mishearing, do NOT flag a grammar/vocabulary error for it.
   - Be especially lenient with easily-confused pairs: was/were, is/are, a/the, this/these, and nouns that sound similar (e.g. "restaurant" easily misheard as "question"). When in doubt → ignore, no deduction.
C. Self-correction: if the student says something wrong then SELF-CORRECTS it immediately (same sentence or the next), do NOT count the original mistake — this is a positive sign.
D. Filler words: completely ignore "uh, um, er, ah, like" when analyzing grammar. Evaluate the sentence AS IF fillers were removed. E.g. "my mother had me uh deliver the groceries" = "my mother had me deliver the groceries" → grammatically CORRECT, no deduction.`;

      const calibration = `

CALIBRATION ANCHORS (interpolate, do NOT snap):
A) addressPercent ≈ 75 — Q: "Tell me about your favorite hobby." A: "I like reading books. I read every day. It's interesting." → on-topic, names hobby, thin detail, simple sentences; lỗi văn nói chấp nhận được KHÔNG trừ.
B) addressPercent ≈ 92 — Q: same. A: "My favorite hobby is reading novels, especially mystery ones, because they help me relax after work and improve my vocabulary. For example, last weekend I finished a great Agatha Christie book." → on-topic, developed reasons + example, varied structure.

CONTINUOUS RUBRIC for addressPercent (pick ANY integer, do NOT snap to 70/100):
0 silent/off-topic · 30–50 partial/off-topic · 55–65 on-topic but cut short · 72–80 on-topic, sparse detail, simple sentences · 82–88 on-topic with a developed reason/example · 88–95 well-developed, coherent, vocab/structure at expected level · 96–100 exceptional. Quality of expression at the part's expected level is part of this score.

ORDER OF REASONING (mandatory): analyze relevance → idea development → real errors FIRST, write that into "analysis" (Vietnamese, 2–3 short sentences), THEN choose addressPercent. The analysis must justify the score.

ERROR-DETECTION PRIORITY: prioritize errors that BLOCK understanding; do NOT flag minor spoken-language patterns that a fluent listener accepts.`;

      if (isPart4Aggregated) {
        systemPrompt = `You are an expert Aptis Speaking Part 4 grader. You receive ONE audio file (the student's full ~120-second monologue) and the list of sub-questions of the topic. Your job is QUALITATIVE — DO NOT compute a numeric score; the application will.

Return via the tool call:
1. transcript: accurate English transcription. Empty string if silent/unintelligible.
2. analyses: array of Vietnamese strings (2–3 short sentences each), ONE per sub-question in the same order — phân tích relevance + độ phát triển ý + lỗi thật. WRITE THIS BEFORE addressPercents.
3. addressPercents: array of numbers (0–100), one per sub-question, using the CONTINUOUS rubric.
4. usedConnectors: boolean — true ONLY if the student clearly uses linking words/discourse markers between ideas (e.g. "however", "for example", "in addition", "on the other hand", "firstly/secondly", "because of that", "as a result").
5. grammarErrors: every clear grammatical mistake as { original, corrected, explanation } (Vietnamese explanation). Empty array if none.
6. pronunciationErrors: only flag words whose pronunciation makes meaning unclear/wrong (holistic), as { word, note } (Vietnamese). If audio received but transcript empty/unreadable, treat pronunciation as failing and add at least one entry.
7. feedback: ≤3 short sentences in Vietnamese — chỉ 1–2 điểm yếu cụ thể NHẤT + 1 việc làm ngay. Tránh khen chung chung.
8. improvedVersion: a rewritten upgraded English version of the STUDENT'S OWN monologue (one combined version). KEEP ideas, fix errors, upgrade vocab/structure, add linking words.${calibration}${leniencyRules}

Be honest and strict but fair. Do not invent content the student didn't say.`;
      } else {
        const pictureExtra = itemType === "picture" ? `

THIS ITEM IS A PICTURE DESCRIPTION. In addition, return TWO booleans:
- pictureLogicIssue: true if disorganized/not linear.
- pictureNoAction: true if only appearance described, no action.
Set both false when well-structured and covers actions.` : "";

        systemPrompt = `You are an expert Aptis Speaking exam grader. You receive the audio of ONE student answer plus the exam question(s) for that item. Your job is QUALITATIVE only — DO NOT compute a final numeric score; the application will.

Return via the tool call:
1. transcript: accurate English transcription. Empty string if silent/unintelligible.
2. analysis: Vietnamese, 2–3 short sentences — phân tích relevance, độ phát triển ý, lỗi thật sự ảnh hưởng. WRITE THIS BEFORE addressPercent; it must justify the score.
3. addressPercent (0–100, CONTINUOUS): use the rubric below; pick ANY integer; do NOT snap to 70/100.
4. grammarErrors: every clear grammatical mistake as { original, corrected, explanation } (Vietnamese). Empty array if none.
5. pronunciationErrors: only flag words whose pronunciation makes meaning unclear/wrong (holistic), as { word, note } (Vietnamese). If audio received but transcript empty/unreadable, treat pronunciation as failing and add at least one entry.
6. feedback: ≤3 short sentences in Vietnamese — chỉ 1–2 điểm yếu cụ thể NHẤT + 1 việc làm ngay. Tránh khen chung chung.
7. improvedVersion: upgraded English rewrite of THE STUDENT'S OWN answer (same ideas, fixed errors, richer vocab/structure, linking words). Empty if silent.${pictureExtra}${calibration}${leniencyRules}

Be honest and strict but fair. Do not invent content the student didn't say.`;
      }

      if (audioBase64) {
        console.log("[grade-exam] speaking: audioBase64 length =", audioBase64.length, "partType=", partType, "itemType=", itemType, "agg=", isPart4Aggregated);
        const qList = isPart4Aggregated ? subQuestions : questions;
        const promptText = isPart4Aggregated
          ? `Exam Part: part4 (aggregated)\nSub-questions:\n${qList.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nTranscribe the full monologue and return addressPercents (one per sub-question), usedConnectors, plus the other fields.`
          : `Exam Part: ${partType}\nItem type: ${itemType}\nQuestions:\n${qList.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPlease transcribe the audio and grade the student's speaking response.`;
        userContent = [
          { type: "text", text: promptText },
          {
            type: "input_audio",
            input_audio: { data: audioBase64, format: "webm" },
          },
        ];
      } else if (text) {
        userContent = [
          {
            type: "text",
            text: `Exam Part: ${partType}\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nStudent's transcript:\n${text}\n\nGrade this speaking response.`,
          },
        ];
      } else {
        return new Response(
          JSON.stringify({ error: "No audio or text provided for speaking grading. Please record your answer first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      systemPrompt = `You are an expert Aptis Writing exam grader. Your job is QUALITATIVE — list errors and judge content / coherence / length. DO NOT compute any final numeric score, DO NOT return partScore / maxPoints / wordPenaltyPercent / coherencePenaltyPercent / openingClosingPenalty — the application computes them. Respond in Vietnamese for the "feedback" field. List EVERY grammar and spelling mistake individually with original, corrected, and a short Vietnamese explanation.

RELEVANCE GATE (apply BEFORE scoring content for every part / email / question):
Trước khi cho điểm nội dung, xác định bài có ĐÚNG chủ đề và đáp ứng đúng yêu cầu của đề không. Nếu nội dung LẠC ĐỀ / không liên quan đến yêu cầu (dù viết trôi chảy, đúng ngữ pháp, đủ dài) → addressPercent của email/câu/bài đó = 0 (hoặc gần 0). Độ trôi chảy, độ dài, hay từ vựng KHÔNG bù được điểm nội dung khi đã lạc đề. Chỉ cho addressPercent cao khi bài thực sự giải quyết đúng yêu cầu đề bài.

SCENARIO RULE (task4 và bất kỳ part nào có "SCENARIO" trong phần Prompt/Questions):
Phần Prompt/Questions có thể bắt đầu bằng một mục "SCENARIO" — đó là BỐI CẢNH/CHỦ ĐỀ BẮT BUỘC mà mọi email/câu trả lời PHẢI bám sát. Với task4: cả email1 (Informal) và email2 (Formal) PHẢI trả lời đúng scenario chung này, đồng thời tuân thủ instruction riêng của từng email. Nếu nội dung email/câu nói về chủ đề KHÁC với SCENARIO (dù trôi chảy, đủ dài, đúng ngữ pháp) → addressPercent của email/câu đó = 0. Tuyệt đối không cho điểm nội dung cao cho bài lạc scenario.

COHERENCE: coherenceLacking = true if ideas don't flow linearly with linking words (disjointed, jumping). Else false. (For task1 ignored.)

RELEVANT WORD COUNT: count ONLY words that contribute to addressing the prompt — exclude pure filler/off-topic text.

RUBRIC PER partType — return ONLY these qualitative fields via the tool:

• task1 — items: array of EXACTLY 5 objects { tooManyWords: boolean (answer has MORE than 5 words), grammarCorrect: boolean }. Also return grammarErrors[], spellingErrors[], feedback.

• task2 — addressPercent (0–100), bonusPercent (0 / 20 / 40 — +20 per short relevant detail, max 40; or +40 for one long detailed example), relevantWordCount (number), coherenceLacking (boolean), grammarErrors[], spellingErrors[], feedback.

• task3 — items: array of EXACTLY 3 objects { addressPercent (0–100), bonusPercent (0/20/40) } in order of the 3 questions. coherenceLacking (boolean, whole task). grammarErrors[] / spellingErrors[]: each error MUST include questionIndex (0,1,2). feedback.

• task4 — email1 and email2 objects, each { addressPercent (0–100), relevantWordCount (number), coherenceLacking (boolean), missingOpening (boolean), missingClosing (boolean) }. grammarErrors[] / spellingErrors[]: each error MUST include emailIndex (0 = email1 informal, 1 = email2 formal). feedback.

• EVERY task (task1–task4) MUST also return:
  - improvedVersion: upgraded English rewrite of the student's whole submission for this part (keep ideas, fix grammar/vocab, upgrade structure, add linking words). For task4 cover BOTH emails (label clearly). Empty string if the student wrote nothing.
  - upgradeTips: Vietnamese, 2–4 sentences. Mẹo CỤ THỂ để bài này đạt điểm cao hơn trong Aptis (cấu trúc phức tạp, từ nối, triển khai ý + ví dụ, paraphrase, đa dạng từ vựng, đúng register với task4).

FEEDBACK REQUIREMENTS (Vietnamese, detailed, NO length limit):
- Bắt đầu bằng điểm mạnh thực sự của bài. Nếu một hạng mục đạt tối đa hãy khen rõ ràng.
- Giải thích LẦN LƯỢT TỪNG hạng mục bị trừ điểm: nội dung/đáp ứng đề, mạch lạc, số từ (CHỈ phạt khi THIẾU từ — viết dài không bị phạt), ngữ pháp, chính tả. Nếu bài LẠC ĐỀ phải nói rõ.
- Nhận xét phải NHẤT QUÁN với mức độ lỗi đã liệt kê.
- TUYỆT ĐỐI KHÔNG nêu con số điểm trừ thô theo thang /100. Chỉ mô tả định tính.
- Có thể gợi ý cải thiện ngắn gọn ở cuối nếu phù hợp.`;

      userContent = [
        {
          type: "text",
          text: `partType: ${partType}\nPrompt/Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nStudent's written response:\n${text}\n\nReturn qualitative grading per the rubric for ${partType}.`,
        },
      ];
    }

    const errorItemSchema = {
      type: "object",
      properties: {
        original: { type: "string" },
        corrected: { type: "string" },
        explanation: { type: "string" },
      },
      required: ["original", "corrected", "explanation"],
      additionalProperties: false,
    };

    const pronunciationItemSchema = {
      type: "object",
      properties: {
        word: { type: "string" },
        note: { type: "string" },
      },
      required: ["word", "note"],
      additionalProperties: false,
    };

    const speakingItemTool = {
      type: "function",
      function: {
        name: "submit_grading",
        description: "Submit qualitative grading for ONE speaking item. Do NOT compute final numeric score.",
        parameters: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            analysis: { type: "string", description: "Vietnamese 2-3 short sentences explaining relevance, idea development and real errors. MUST be written BEFORE choosing addressPercent." },
            addressPercent: { type: "number", description: "0-100 CONTINUOUS, do not snap to 70/100" },
            grammarErrors: { type: "array", items: errorItemSchema },
            pronunciationErrors: { type: "array", items: pronunciationItemSchema },
            pictureLogicIssue: { type: "boolean", description: "Picture items only: description not logically ordered" },
            pictureNoAction: { type: "boolean", description: "Picture items only: only appearance described, no action" },
            feedback: { type: "string", description: "Vietnamese, max 3 short sentences, 1-2 specific weaknesses + 1 actionable tip" },
            improvedVersion: { type: "string", description: "Upgraded English rewrite of THE STUDENT'S OWN answer (same ideas, fixed errors, richer vocab/structure, linking words). Empty string if silent." },
          },
          required: ["transcript", "analysis", "addressPercent", "grammarErrors", "pronunciationErrors", "feedback", "improvedVersion"],
          additionalProperties: false,
        },
      },
    };

    const speakingPart4Tool = {
      type: "function",
      function: {
        name: "submit_grading",
        description: "Submit qualitative grading for the WHOLE Part 4 monologue. Do NOT compute final numeric score.",
        parameters: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            analyses: {
              type: "array",
              items: { type: "string" },
              description: "One Vietnamese 2-3 short-sentence analysis per sub-question (same order). MUST be written BEFORE addressPercents.",
            },
            addressPercents: {
              type: "array",
              items: { type: "number" },
              description: "One 0-100 number per sub-question, same order as input. CONTINUOUS — do not snap to 70/100.",
            },
            usedConnectors: { type: "boolean" },
            grammarErrors: { type: "array", items: errorItemSchema },
            pronunciationErrors: { type: "array", items: pronunciationItemSchema },
            feedback: { type: "string", description: "Vietnamese, max 3 short sentences, 1-2 specific weaknesses + 1 actionable tip" },
            improvedVersion: { type: "string", description: "ONE upgraded English rewrite of the student's whole monologue (same ideas, fixed errors, richer vocab/structure, linking words)." },
          },
          required: ["transcript", "analyses", "addressPercents", "usedConnectors", "grammarErrors", "pronunciationErrors", "feedback", "improvedVersion"],
          additionalProperties: false,
        },
      },
    };

    const writingErrorItemSchema = (extraField?: { name: string; desc: string }) => {
      const props: any = {
        original: { type: "string" },
        corrected: { type: "string" },
        explanation: { type: "string" },
      };
      const required = ["original", "corrected", "explanation"];
      if (extraField) {
        props[extraField.name] = { type: "number", description: extraField.desc };
        required.push(extraField.name);
      }
      return { type: "object", properties: props, required, additionalProperties: false };
    };

    const buildWritingTool = (pt: string) => {
      let props: any;
      let required: string[];
      if (pt === "task1") {
        props = {
          items: {
            type: "array",
            description: "Exactly 5 items, one per short answer",
            items: {
              type: "object",
              properties: {
                tooManyWords: { type: "boolean" },
                grammarCorrect: { type: "boolean" },
              },
              required: ["tooManyWords", "grammarCorrect"],
              additionalProperties: false,
            },
          },
          grammarErrors: { type: "array", items: errorItemSchema },
          spellingErrors: { type: "array", items: errorItemSchema },
          feedback: { type: "string" },
          improvedVersion: { type: "string", description: "Upgraded English rewrite of the student's whole submission for this part — same ideas, fix grammar/vocab, upgrade structure, add linking words. Empty if blank." },
          upgradeTips: { type: "string", description: "Vietnamese, 2-4 sentences. Concrete Aptis tips to score higher on THIS submission: complex structures, linking words, idea development, vocabulary upgrades." },
        };
        required = ["items", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "upgradeTips"];
      } else if (pt === "task2") {
        props = {
          addressPercent: { type: "number" },
          bonusPercent: { type: "number" },
          relevantWordCount: { type: "number" },
          coherenceLacking: { type: "boolean" },
          grammarErrors: { type: "array", items: errorItemSchema },
          spellingErrors: { type: "array", items: errorItemSchema },
          feedback: { type: "string" },
          improvedVersion: { type: "string", description: "Upgraded English rewrite of the student's whole submission for this part — same ideas, fix grammar/vocab, upgrade structure, add linking words. Empty if blank." },
          upgradeTips: { type: "string", description: "Vietnamese, 2-4 sentences. Concrete Aptis tips to score higher on THIS submission: complex structures, linking words, idea development, vocabulary upgrades." },
        };
        required = ["addressPercent", "bonusPercent", "relevantWordCount", "coherenceLacking", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "upgradeTips"];
      } else if (pt === "task3") {
        const errWithIdx = writingErrorItemSchema({ name: "questionIndex", desc: "0,1,2 — which of the 3 answers" });
        props = {
          items: {
            type: "array",
            description: "Exactly 3 items in question order",
            items: {
              type: "object",
              properties: {
                addressPercent: { type: "number" },
                bonusPercent: { type: "number" },
              },
              required: ["addressPercent", "bonusPercent"],
              additionalProperties: false,
            },
          },
          coherenceLacking: { type: "boolean" },
          grammarErrors: { type: "array", items: errWithIdx },
          spellingErrors: { type: "array", items: errWithIdx },
          feedback: { type: "string" },
          improvedVersion: { type: "string", description: "Upgraded English rewrite of the student's whole submission for this part — same ideas, fix grammar/vocab, upgrade structure, add linking words. Empty if blank." },
          upgradeTips: { type: "string", description: "Vietnamese, 2-4 sentences. Concrete Aptis tips to score higher on THIS submission: complex structures, linking words, idea development, vocabulary upgrades." },
        };
        required = ["items", "coherenceLacking", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "upgradeTips"];
      } else {
        // task4
        const emailSchema = {
          type: "object",
          properties: {
            addressPercent: { type: "number" },
            relevantWordCount: { type: "number" },
            coherenceLacking: { type: "boolean" },
            missingOpening: { type: "boolean" },
            missingClosing: { type: "boolean" },
          },
          required: ["addressPercent", "relevantWordCount", "coherenceLacking", "missingOpening", "missingClosing"],
          additionalProperties: false,
        };
        const errWithIdx = writingErrorItemSchema({ name: "emailIndex", desc: "0 = email1 informal, 1 = email2 formal" });
        props = {
          email1: emailSchema,
          email2: emailSchema,
          grammarErrors: { type: "array", items: errWithIdx },
          spellingErrors: { type: "array", items: errWithIdx },
          feedback: { type: "string" },
          improvedVersion: { type: "string", description: "Upgraded English rewrite of BOTH emails combined (or each clearly labeled) — same ideas, fix grammar/vocab, upgrade structure, add linking words. Empty if blank." },
          upgradeTips: { type: "string", description: "Vietnamese, 2-4 sentences. Concrete Aptis tips to score higher on THIS submission: complex structures, linking words, register (informal/formal), vocabulary upgrades." },
        };
        required = ["email1", "email2", "grammarErrors", "spellingErrors", "feedback", "improvedVersion", "upgradeTips"];
      }
      return {
        type: "function",
        function: {
          name: "submit_grading",
          description: "Submit qualitative Aptis Writing grading. Do NOT compute final score.",
          parameters: { type: "object", properties: props, required, additionalProperties: false },
        },
      };
    };

    const writingTool = buildWritingTool(partType);

    const speakingTool = isPart4Aggregated ? speakingPart4Tool : speakingItemTool;
    const tools = [type === "writing" ? writingTool : speakingTool];
    // Speaking needs audio understanding → use gemini-2.5-pro. Writing stays on flash.
    const model = "google/gemini-2.5-flash";

    // Gateway call with per-type timeout + 1 retry on transient failures (timeout / 5xx / network).
    const timeoutMs = isPart4Aggregated ? 90_000 : (type === "speaking" ? 60_000 : 30_000);
    const callGateway = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              reasoning_effort: type === "speaking" ? (isPart4Aggregated ? "low" : "medium") : "low",
              temperature: 0,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
              ],
              tools,
              tool_choice: {
                type: "function",
                function: { name: "submit_grading" },
              },
            }),
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let response: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await callGateway();
        // Retry only on transient gateway errors (5xx). Pass-through 4xx (429/402/etc) without retrying.
        if (response.status >= 500 && attempt === 0) {
          console.warn(`[grade-exam] gateway ${response.status} on attempt ${attempt + 1}, retrying...`);
          lastErr = new Error(`gateway ${response.status}`);
          response = null;
          continue;
        }
        break;
      } catch (e) {
        lastErr = e;
        const isAbort = (e as any)?.name === "AbortError";
        console.warn(`[grade-exam] gateway call failed on attempt ${attempt + 1}`, isAbort ? "timeout" : (e as any)?.message ?? e);
        if (attempt === 0) continue;
      }
    }

    if (!response) {
      const isAbort = (lastErr as any)?.name === "AbortError";
      return new Response(
        JSON.stringify({
          error: isAbort ? "Hết thời gian chấm bài. Vui lòng thử lại." : "Không liên lạc được dịch vụ chấm bài. Vui lòng thử lại.",
          notGraded: true,
          partType,
        }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later.", notGraded: true, partType }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds.", notGraded: true, partType }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error: `AI gateway error: ${response.status}`,
          notGraded: true,
          partType,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Log AI usage (fire-and-forget)
    logAIUsage({
      model,
      usage: data.usage,
      source_function: "grade-exam",
      metadata: { type, partType },
    }).catch(() => {});

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      throw new Error("AI did not return structured grading");
    }

    const grading = JSON.parse(toolCall.function.arguments);

    if (type === "speaking") {
      console.log(
        "[grade-exam] speaking transcript length =",
        (grading?.transcript ?? "").length,
        "preview:",
        (grading?.transcript ?? "").slice(0, 200)
      );

      const st = Math.max(0, speakTime || 0);
      const sp = Math.max(0, Math.min(st || actualSpoken, actualSpoken || 0));
      const shortagePercent = st > 0 ? Math.max(0, ((st - sp) / st) * 100) : 0;
      const grammarCount = Array.isArray(grading?.grammarErrors) ? grading.grammarErrors.length : 0;
      const pronCount = Array.isArray(grading?.pronunciationErrors) ? grading.pronunciationErrors.length : 0;

      // Tiered time penalty (<10% => 0; 10-20% => t1; >20-50% => t2; >50% => t3)
      const [t1, t2, t3] = tiersIn as [number, number, number];
      let timePenalty = 0;
      if (shortagePercent < 10) timePenalty = 0;
      else if (shortagePercent <= 20) timePenalty = t1;
      else if (shortagePercent <= 50) timePenalty = t2;
      else timePenalty = t3;

      if (isPart4Aggregated) {
        // Part 4: aggregated scoring (max 21 = 3 sub-questions × 7).
        const mpTotal = subQuestions.length * 7;
        const percents: number[] = Array.isArray(grading?.addressPercents) ? grading.addressPercents : [];
        let contentTotal = 0;
        for (let i = 0; i < subQuestions.length; i++) {
          const p = Math.max(0, Math.min(100, Number(percents[i] ?? 0)));
          contentTotal += (p / 100) * 7;
        }
        const usedConnectors = !!grading?.usedConnectors;
        const connectorPenalty = usedConnectors ? 0 : 2;
        const errorPenalty = Math.min(0.5 * mpTotal, 0.5 * (grammarCount + pronCount));
        const rawScore = contentTotal - timePenalty - connectorPenalty - errorPenalty;
        const partScore = Math.round(Math.max(0, Math.min(mpTotal, rawScore)) * 10) / 10;

        const analyses: string[] = Array.isArray(grading?.analyses)
          ? grading.analyses.map((a: any) => String(a ?? ""))
          : [];
        const payload = {
          transcript: grading?.transcript ?? "",
          analyses,
          analysis: analyses.filter(Boolean).join("\n\n"),
          addressPercents: percents.map((p) => Math.round(Math.max(0, Math.min(100, Number(p))) * 10) / 10),
          usedConnectors,
          grammarErrors: grading?.grammarErrors ?? [],
          pronunciationErrors: grading?.pronunciationErrors ?? [],
          contentScore: Math.round(contentTotal * 10) / 10,
          timePenalty: Math.round(timePenalty * 10) / 10,
          connectorPenalty,
          errorPenalty: Math.round(errorPenalty * 10) / 10,
          shortagePercent: Math.round(shortagePercent * 10) / 10,
          partScore,
          maxPoints: mpTotal,
          feedback: grading?.feedback ?? "",
          improvedVersion: grading?.improvedVersion ?? "",
        };
        await logFeatureUsageOnce();
        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Per-item scoring (parts 1/2/3)
      const mp = Math.max(0, maxPoints || 0);
      const addr = Math.max(0, Math.min(100, Number(grading?.addressPercent ?? 0)));
      const contentScore = (addr / 100) * mp;

      // Picture penalty (only when itemType=picture)
      const pictureLogicIssue = itemType === "picture" && !!grading?.pictureLogicIssue;
      const pictureNoAction = itemType === "picture" && !!grading?.pictureNoAction;
      const picturePenalty =
        (pictureLogicIssue ? 1 : 0) + (pictureNoAction ? 1 : 0);

      const errorPenalty = Math.min(0.5 * mp, 0.2 * (grammarCount + pronCount));
      const rawScore = contentScore - timePenalty - picturePenalty - errorPenalty;
      const partScore = Math.round(Math.max(0, Math.min(mp, rawScore)) * 10) / 10;

      const payload = {
        transcript: grading?.transcript ?? "",
        analysis: String(grading?.analysis ?? ""),
        addressPercent: Math.round(addr * 10) / 10,
        grammarErrors: grading?.grammarErrors ?? [],
        pronunciationErrors: grading?.pronunciationErrors ?? [],
        pictureLogicIssue,
        pictureNoAction,
        picturePenalty,
        timePenalty: Math.round(timePenalty * 10) / 10,
        errorPenalty: Math.round(errorPenalty * 10) / 10,
        contentScore: Math.round(contentScore * 10) / 10,
        shortagePercent: Math.round(shortagePercent * 10) / 10,
        partScore,
        maxPoints: mp,
        itemType,
        feedback: grading?.feedback ?? "",
        improvedVersion: grading?.improvedVersion ?? "",
      };

      await logFeatureUsageOnce();
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── WRITING: compute final score from qualitative grading ───
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    const round1 = (n: number) => Math.round(n * 10) / 10;
    const wordShortBracket = (count: number, target: number) => {
      const short = Math.max(0, ((target - count) / target) * 100);
      if (short >= 20) return 30;
      if (short >= 11) return 20;
      if (short >= 1) return 10;
      return 0;
    };
    const stripIdx = (arr: any[]) =>
      (Array.isArray(arr) ? arr : []).map(({ questionIndex, emailIndex, ...rest }: any) => rest);

    const allGrammar: any[] = Array.isArray(grading?.grammarErrors) ? grading.grammarErrors : [];
    const allSpelling: any[] = Array.isArray(grading?.spellingErrors) ? grading.spellingErrors : [];
    const feedback: string = grading?.feedback ?? "";
    let payload: any;

    if (partType === "task1") {
      const items: any[] = Array.isArray(grading?.items) ? grading.items.slice(0, 5) : [];
      while (items.length < 5) items.push({ tooManyWords: false, grammarCorrect: false });
      const correctCount = items.filter((it) => !it.tooManyWords && it.grammarCorrect).length;
      const partScore = round1(clamp(correctCount * 2, 0, 10));
      payload = {
        partType,
        maxPoints: 10,
        addressPercent: round1((correctCount / 5) * 100),
        bonusPercent: 0,
        wordPenaltyPercent: 0,
        coherencePenaltyPercent: 0,
        openingClosingPenalty: 0,
        grammarErrors: stripIdx(allGrammar),
        spellingErrors: stripIdx(allSpelling),
        partScore,
        feedback,
        improvedVersion: grading?.improvedVersion ?? "",
        upgradeTips: grading?.upgradeTips ?? "",
      };
    } else if (partType === "task2") {
      const max = 20;
      const addr = clamp(Number(grading?.addressPercent ?? 0), 0, 100);
      const bonus = clamp(Number(grading?.bonusPercent ?? 0), 0, 40);
      const wc = Math.max(0, Number(grading?.relevantWordCount ?? 0));
      const coh = !!grading?.coherenceLacking;
      const content = Math.min(100, addr * 0.6 + bonus);
      const raw = (content / 100) * max;
      const wordPct = wordShortBracket(wc, 20);
      const wordPenalty = (wordPct / 100) * max;
      const cohPct = coh ? 10 : 0;
      const cohPenalty = (cohPct / 100) * max;
      const errPenalty = (allGrammar.length + allSpelling.length) * 1;
      const partScore = round1(clamp(raw - wordPenalty - cohPenalty - errPenalty, 0, max));
      payload = {
        partType,
        maxPoints: max,
        addressPercent: round1(addr),
        bonusPercent: round1(bonus),
        wordPenaltyPercent: wordPct,
        coherencePenaltyPercent: cohPct,
        openingClosingPenalty: 0,
        grammarErrors: stripIdx(allGrammar),
        spellingErrors: stripIdx(allSpelling),
        partScore,
        feedback,
        improvedVersion: grading?.improvedVersion ?? "",
        upgradeTips: grading?.upgradeTips ?? "",
      };
    } else if (partType === "task3") {
      const max = 30;
      const items: any[] = Array.isArray(grading?.items) ? grading.items.slice(0, 3) : [];
      while (items.length < 3) items.push({ addressPercent: 0, bonusPercent: 0 });
      const coh = !!grading?.coherenceLacking;
      let sumScore = 0;
      const addrs: number[] = [];
      const bons: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = clamp(Number(items[i]?.addressPercent ?? 0), 0, 100);
        const b = clamp(Number(items[i]?.bonusPercent ?? 0), 0, 40);
        addrs.push(a);
        bons.push(b);
        const content = Math.min(100, a * 0.6 + b);
        const raw = (content / 100) * 10;
        const errsI =
          allGrammar.filter((e) => Number(e?.questionIndex) === i).length +
          allSpelling.filter((e) => Number(e?.questionIndex) === i).length;
        sumScore += Math.max(0, raw - errsI * 1);
      }
      const cohPct = coh ? 10 : 0;
      const cohPenalty = (cohPct / 100) * max;
      const partScore = round1(clamp(sumScore - cohPenalty, 0, max));
      payload = {
        partType,
        maxPoints: max,
        addressPercent: round1(addrs.reduce((s, n) => s + n, 0) / 3),
        bonusPercent: round1(bons.reduce((s, n) => s + n, 0) / 3),
        wordPenaltyPercent: 0,
        coherencePenaltyPercent: cohPct,
        openingClosingPenalty: 0,
        grammarErrors: stripIdx(allGrammar),
        spellingErrors: stripIdx(allSpelling),
        partScore,
        feedback,
        improvedVersion: grading?.improvedVersion ?? "",
        upgradeTips: grading?.upgradeTips ?? "",
      };
    } else {
      // task4
      const max = 40;
      const emailMaxes = [15, 25];
      const wordTargets = [50, 120];
      const emails = [grading?.email1, grading?.email2];
      let totalScore = 0;
      const addrs: number[] = [];
      const wordPcts: number[] = [];
      let anyCoh = false;
      let totalOC = 0;
      for (let e = 0; e < 2; e++) {
        const em = emails[e] || {};
        const maxE = emailMaxes[e];
        const addr = clamp(Number(em?.addressPercent ?? 0), 0, 100);
        const wc = Math.max(0, Number(em?.relevantWordCount ?? 0));
        const coh = !!em?.coherenceLacking;
        const missO = !!em?.missingOpening;
        const missC = !!em?.missingClosing;
        addrs.push(addr);
        if (coh) anyCoh = true;
        const raw = (addr / 100) * maxE;
        const wordPct = wordShortBracket(wc, wordTargets[e]);
        wordPcts.push(wordPct);
        const wordPenalty = (wordPct / 100) * maxE;
        const cohPenalty = (coh ? 10 : 0) / 100 * maxE;
        const errCount =
          allGrammar.filter((er) => Number(er?.emailIndex) === e).length +
          allSpelling.filter((er) => Number(er?.emailIndex) === e).length;
        const errPenalty = errCount * 2;
        const ocPenalty = (missO ? 3 : 0) + (missC ? 3 : 0);
        totalOC += ocPenalty;
        const emailScore = Math.max(0, raw - wordPenalty - cohPenalty - errPenalty - ocPenalty);
        totalScore += emailScore;
      }
      const partScore = round1(clamp(totalScore, 0, max));
      payload = {
        partType,
        maxPoints: max,
        addressPercent: round1((addrs[0] + addrs[1]) / 2),
        bonusPercent: 0,
        wordPenaltyPercent: round1((wordPcts[0] + wordPcts[1]) / 2),
        coherencePenaltyPercent: anyCoh ? 10 : 0,
        openingClosingPenalty: totalOC,
        grammarErrors: stripIdx(allGrammar),
        spellingErrors: stripIdx(allSpelling),
        partScore,
        feedback,
        improvedVersion: grading?.improvedVersion ?? "",
        upgradeTips: grading?.upgradeTips ?? "",
      };
    }

    // Persist to cache so identical resubmits don't burn AI again.
    if (userId) {
      try {
        await serviceClient
          .from("grading_cache")
          .upsert(
            { user_id: userId, request_hash: requestHash, response: payload },
            { onConflict: "user_id,request_hash" },
          );
      } catch (e) {
        console.warn("[grade-exam] cache write failed:", (e as any)?.message || e);
      }
    }

    await logFeatureUsageOnce();
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grade-exam error:", e);
    return new Response(
      JSON.stringify({
        error: "An error occurred during grading",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
