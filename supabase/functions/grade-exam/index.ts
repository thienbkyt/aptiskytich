import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAIUsage, logInvocation } from "../_shared/usage-logger.ts";

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

      if (isPart4Aggregated) {
        systemPrompt = `You are an expert Aptis Speaking Part 4 grader. You receive ONE audio file (the student's full ~120-second monologue) and the list of sub-questions of the topic. Your job is QUALITATIVE — DO NOT compute a numeric score; the application will.

Return via the tool call:
1. transcript: accurate English transcription of what the student actually said. Empty string if silent/unintelligible.
2. addressPercents: an array of numbers (0–100), ONE entry per sub-question in the same order, indicating how well the student addressed EACH sub-question. Off-topic / silent / unintelligible → 0. Bare on-topic answer without supporting detail → ~70. Fully addressed with at least one supporting detail → ~100.
3. usedConnectors: boolean — true ONLY if the student clearly uses linking words/discourse markers between ideas (e.g. "however", "for example", "in addition", "on the other hand", "firstly/secondly", "because of that", "as a result"). False if the speech is just a flat list of disconnected sentences.
4. grammarErrors: every clear grammatical mistake as { original, corrected, explanation } (explanation in Vietnamese). Empty array if none.
5. pronunciationErrors: only flag words whose pronunciation makes the meaning unclear or wrong (holistic), as { word, note } (Vietnamese). If audio was received but transcript is empty/unreadable, treat pronunciation as failing and add at least one entry.
6. feedback: ≤3 short sentences in Vietnamese — what was good, what to improve, mention connectors if missing.
7. improvedVersion: a rewritten upgraded English version of the STUDENT'S OWN monologue (one combined version for the whole Part 4). KEEP the student's ideas/content — only fix errors, upgrade vocabulary & sentence structures, and add linking words. It must read like a high-scoring version of THEIR answer, not a generic model answer.${leniencyRules}

Be honest and strict but fair. Do not invent content the student didn't say.`;
      } else {
        const pictureExtra = itemType === "picture" ? `

THIS ITEM IS A PICTURE DESCRIPTION. In addition, return TWO booleans:
- pictureLogicIssue: true if the description is disorganized / not linear (e.g. jumps randomly between people/objects/background without a clear order).
- pictureNoAction: true if the student only describes appearance (people, objects, colors) but fails to describe what is HAPPENING / the action in the picture.
Set both to false when the description is well-structured and covers actions.` : "";

        systemPrompt = `You are an expert Aptis Speaking exam grader. You receive the audio of ONE student answer plus the exam question(s) for that item. Your job is QUALITATIVE only — DO NOT compute a final numeric score; the application will compute it from your structured output.

Return via the tool call:
1. transcript: an accurate transcription of what the student actually said (English). If the audio is silent or unintelligible, return an empty string.
2. addressPercent (0–100): how well the answer addresses the question.
   - 100 = fully on-topic AND includes at least one clear supporting detail/example.
   - 70  = on-topic but no supporting detail (just the bare answer).
   - Partially off-topic → scale proportionally (e.g. only half the prompt addressed → ~35–50).
   - Off-topic, silent, or unintelligible → 0.
3. grammarErrors: every clear grammatical mistake as { original, corrected, explanation } with explanation in Vietnamese. Empty array if none.
4. pronunciationErrors: only flag words whose pronunciation makes the meaning unclear or wrong (holistic, not phoneme-by-phoneme), as { word, note } with note in Vietnamese. If audio was received but transcript is empty/unreadable, treat pronunciation as failing and add at least one entry describing the issue.
5. feedback: ≤3 short sentences in Vietnamese — what was good, what to improve.
6. improvedVersion: a rewritten upgraded English version of THE STUDENT'S OWN answer for this item. KEEP the student's ideas/content — only fix errors, upgrade vocabulary & sentence structures, and add linking words. It must read like a high-scoring version of THEIR answer, not a generic model answer. If the student was silent/unintelligible, return an empty string.${pictureExtra}${leniencyRules}

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
      systemPrompt = `You are an expert Aptis Writing exam grader. Grade the student's response using the EXACT numeric rubric below for the given partType. Be strict but fair. Respond in Vietnamese for the "feedback" field. List EVERY grammar and spelling mistake individually with original, corrected, and a short Vietnamese explanation.

GENERAL FLOW (every part): compute content% → apply word-shortage penalty → apply COHERENCE penalty → subtract error penalties → floor at 0 (never negative).

COHERENCE PENALTY (NEW): evaluate whether ideas flow logically and linearly with proper connectors between sentences/paragraphs. If the response lacks coherence/linearity (ideas jump around, no linking words, disjointed) → coherencePenaltyPercent = 10. Otherwise = 0. Applies to task2/task3/task4 only. For task1, coherencePenaltyPercent ALWAYS = 0 (no penalty). When applied, you MUST explicitly mention the coherence issue in the Vietnamese feedback.

RUBRIC BY partType:

• task1 — Part 1, maxPoints=10, 5 questions × 2 points each. For each of the 5 short answers: grammatically correct = 2pt, grammatically wrong = 0pt. No word-count check. Sum across the 5 = partScore (no further penalty). Set addressPercent = (correctCount/5)*100, bonusPercent=0, wordPenaltyPercent=0, coherencePenaltyPercent=0, openingClosingPenalty=0. Still list grammar mistakes found.

• task2 — Part 2, maxPoints=20, single form response, min 20 words.
  - addressPercent (0–100): how well the student addressed the prompt requirements. If the prompt has 2 requirements and only 1 is addressed (the other off-topic) → 50%.
  - bonusPercent: +40 if there is ONE long relevant supplementary detail with an example; OR +20 per short relevant detail (max 2 → cap 40). Irrelevant filler does NOT count as bonus and does NOT count toward word count.
  - contentPercent = min(100, addressPercent*0.6 + bonusPercent). raw = contentPercent/100 * 20.
  - Word-shortage penalty vs 20-word target, counting ONLY relevant words: shortage ≥20% → wordPenaltyPercent=30; 11–19% → 20; 1–10% → 10; else 0. Subtract (wordPenaltyPercent/100)*20 from raw.
  - Coherence penalty: subtract (coherencePenaltyPercent/100)*20 (i.e. −2 when coherencePenaltyPercent=10).
  - Error penalties: −1 per grammar error, −1 per spelling error.
  - partScore = max(0, raw − wordPenalty − coherencePenalty − errors). openingClosingPenalty=0.

• task3 — Part 3, maxPoints=30, 3 questions × 10 points. For EACH of the 3 answers apply task2-style content logic (contentPercent = min(100, address*0.6 + bonus[0/20/40])) → raw_i = contentPercent/100 * 10. NO word-shortage penalty. Apply coherence penalty ONCE on the SUM: subtract (coherencePenaltyPercent/100)*30 (i.e. −3 when =10). Subtract −1 per grammar error and −1 per spelling error from the SUM. partScore = max(0, sum(raw_i) − coherencePenalty − totalErrors). Report aggregated addressPercent = average across 3, bonusPercent = average across 3, wordPenaltyPercent=0, openingClosingPenalty=0.

• task4 — Part 4, maxPoints=40 = email1(15) + email2(25). Min words: email1=50, email2=120.
  - For EACH email: contentPercent = addressPercent (0–100) = how fully the prompt is addressed plus relevant info (no separate bonus split). raw_i = contentPercent/100 * emailMax.
  - Word-shortage penalty per email vs its min, same brackets (≥20→30, 11–19→20, 1–10→10, else 0). Subtract (penalty%/100)*emailMax.
  - Coherence: evaluate each email independently. If email1 lacks coherence → subtract (10/100)*15 = −1.5 from email1. If email2 lacks coherence → subtract (10/100)*25 = −2.5 from email2. Report coherencePenaltyPercent = 10 if applied to ANY email, else 0.
  - Error penalties: −2 per error (grammar OR spelling) counted across both emails.
  - Missing opening OR missing closing of an email: −3 each occurrence. Sum into openingClosingPenalty.
  - partScore = max(0, (raw1+raw2) − wordPenalties − coherencePenalties − errorPenalties − openingClosingPenalty). Report addressPercent = average of the two emails, bonusPercent=0, wordPenaltyPercent = average of the two email penalty%.

OUTPUT: Call submit_grading with EXACTLY the JSON schema. partScore must be the final number (0..maxPoints), already floored at 0 and never exceeding maxPoints. Round numeric fields to 1 decimal. feedback ≤ 3 sentences in Vietnamese; explicitly mention coherence when penalized.`;

      userContent = [
        {
          type: "text",
          text: `partType: ${partType}\nPrompt/Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nStudent's written response:\n${text}\n\nGrade strictly per the rubric for ${partType}.`,
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
            addressPercent: { type: "number", description: "0-100, how well the answer addresses the prompt" },
            grammarErrors: { type: "array", items: errorItemSchema },
            pronunciationErrors: { type: "array", items: pronunciationItemSchema },
            pictureLogicIssue: { type: "boolean", description: "Picture items only: description not logically ordered" },
            pictureNoAction: { type: "boolean", description: "Picture items only: only appearance described, no action" },
            feedback: { type: "string", description: "Vietnamese, max 3 short sentences" },
            improvedVersion: { type: "string", description: "Upgraded English rewrite of THE STUDENT'S OWN answer (same ideas, fixed errors, richer vocab/structure, linking words). Empty string if silent." },
          },
          required: ["transcript", "addressPercent", "grammarErrors", "pronunciationErrors", "feedback", "improvedVersion"],
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
            addressPercents: {
              type: "array",
              items: { type: "number" },
              description: "One 0-100 number per sub-question, same order as input",
            },
            usedConnectors: { type: "boolean" },
            grammarErrors: { type: "array", items: errorItemSchema },
            pronunciationErrors: { type: "array", items: pronunciationItemSchema },
            feedback: { type: "string", description: "Vietnamese, max 3 short sentences" },
            improvedVersion: { type: "string", description: "ONE upgraded English rewrite of the student's whole monologue (same ideas, fixed errors, richer vocab/structure, linking words)." },
          },
          required: ["transcript", "addressPercents", "usedConnectors", "grammarErrors", "pronunciationErrors", "feedback", "improvedVersion"],
          additionalProperties: false,
        },
      },
    };

    const writingTool = {
      type: "function",
      function: {
        name: "submit_grading",
        description: "Submit the numeric Aptis Writing grading per part rubric",
        parameters: {
          type: "object",
          properties: {
            partType: { type: "string" },
            maxPoints: { type: "number", description: "10/20/30/40 by part" },
            addressPercent: { type: "number" },
            bonusPercent: { type: "number" },
            wordPenaltyPercent: { type: "number" },
            coherencePenaltyPercent: { type: "number" },
            grammarErrors: { type: "array", items: errorItemSchema },
            spellingErrors: { type: "array", items: errorItemSchema },
            openingClosingPenalty: { type: "number" },
            partScore: { type: "number" },
            feedback: { type: "string" },
          },
          required: [
            "partType",
            "maxPoints",
            "addressPercent",
            "bonusPercent",
            "wordPenaltyPercent",
            "coherencePenaltyPercent",
            "grammarErrors",
            "spellingErrors",
            "openingClosingPenalty",
            "partScore",
            "feedback",
          ],
          additionalProperties: false,
        },
      },
    };

    const speakingTool = isPart4Aggregated ? speakingPart4Tool : speakingItemTool;
    const tools = [type === "writing" ? writingTool : speakingTool];
    // Speaking needs audio understanding → use gemini-2.5-pro. Writing stays on flash.
    const model = type === "speaking" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
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
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
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

        const payload = {
          transcript: grading?.transcript ?? "",
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

    return new Response(JSON.stringify(grading), {
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
