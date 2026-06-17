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
      systemPrompt = `You are an expert Aptis Speaking exam grader. You will receive audio of a student's spoken English response along with the exam questions. 

Your task:
1. Transcribe the audio accurately
2. Grade the response on 4 criteria: Fluency, Pronunciation, Grammar, Vocabulary
3. Each criterion is graded on the CEFR scale: A1, A2, B1, B2, C1
4. Identify specific mistakes with corrections
5. Provide improvement suggestions

Be strict but fair. Grade based on actual Aptis exam standards.`;

      if (audioBase64) {
        console.log("[grade-exam] speaking: audioBase64 length =", audioBase64.length);
        userContent = [
          {
            type: "text",
            text: `Exam Part: ${partType}\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPlease transcribe the audio and grade the student's speaking response.`,
          },
          {
            // OpenAI-compatible audio input. Lovable AI Gateway forwards this
            // to Gemini which accepts webm/opus from browser MediaRecorder.
            type: "input_audio",
            input_audio: {
              data: audioBase64,
              format: "webm",
            },
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

    const speakingTool = {
      type: "function",
      function: {
        name: "submit_grading",
        description: "Submit the grading results for the speaking response",
        parameters: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            overallLevel: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
                  feedback: { type: "string" },
                },
                required: ["name", "level", "feedback"],
                additionalProperties: false,
              },
            },
            mistakes: { type: "array", items: errorItemSchema },
            suggestions: { type: "array", items: { type: "string" } },
          },
          required: ["transcript", "overallLevel", "criteria", "mistakes", "suggestions"],
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
