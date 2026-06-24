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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
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
    const userId = String((claims.claims as any).sub || "");

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

      // Daily quota: 10 graded submissions per user
      const quota = await enforceDailyQuota(userId, "grade-exam", 10, corsHeaders);
      if (quota) return quota;
    }

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
        };
        required = ["items", "grammarErrors", "spellingErrors", "feedback"];
      } else if (pt === "task2") {
        props = {
          addressPercent: { type: "number" },
          bonusPercent: { type: "number" },
          relevantWordCount: { type: "number" },
          coherenceLacking: { type: "boolean" },
          grammarErrors: { type: "array", items: errorItemSchema },
          spellingErrors: { type: "array", items: errorItemSchema },
          feedback: { type: "string" },
        };
        required = ["addressPercent", "bonusPercent", "relevantWordCount", "coherenceLacking", "grammarErrors", "spellingErrors", "feedback"];
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
        };
        required = ["items", "coherenceLacking", "grammarErrors", "spellingErrors", "feedback"];
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
        };
        required = ["email1", "email2", "grammarErrors", "spellingErrors", "feedback"];
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
