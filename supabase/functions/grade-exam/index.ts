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
        userContent = [
          {
            type: "text",
            text: `Exam Part: ${partType}\nQuestions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPlease transcribe the audio and grade the student's speaking response.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:audio/webm;base64,${audioBase64}`,
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
      systemPrompt = `You are an expert Aptis Writing exam grader. You will receive a student's written response along with the exam prompt.

Your task:
1. Grade the response on 4 criteria: Task Response, Grammar, Vocabulary, Coherence
2. Each criterion is graded on the CEFR scale: A1, A2, B1, B2, C1
3. Identify specific mistakes with corrections and explanations
4. Provide improvement suggestions with better sentence structures and vocabulary

Be strict but fair. Grade based on actual Aptis exam standards.`;

      userContent = [
        {
          type: "text",
          text: `Exam Part: ${partType}\nPrompt/Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nStudent's written response:\n${text}\n\nGrade this writing response.`,
        },
      ];
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "submit_grading",
          description: "Submit the grading results for the exam response",
          parameters: {
            type: "object",
            properties: {
              transcript: {
                type: "string",
                description:
                  "Transcription of audio (speaking only, empty string for writing)",
              },
              overallLevel: {
                type: "string",
                enum: ["A1", "A2", "B1", "B2", "C1"],
                description: "Overall CEFR level",
              },
              criteria: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    level: {
                      type: "string",
                      enum: ["A1", "A2", "B1", "B2", "C1"],
                    },
                    feedback: { type: "string" },
                  },
                  required: ["name", "level", "feedback"],
                  additionalProperties: false,
                },
              },
              mistakes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: {
                      type: "string",
                      description: "The incorrect text",
                    },
                    corrected: {
                      type: "string",
                      description: "The corrected version",
                    },
                    explanation: {
                      type: "string",
                      description: "Why it's wrong and the grammar rule",
                    },
                  },
                  required: ["original", "corrected", "explanation"],
                  additionalProperties: false,
                },
              },
              suggestions: {
                type: "array",
                items: { type: "string" },
                description:
                  "Improvement suggestions (better structures, vocabulary, tips)",
              },
            },
            required: [
              "transcript",
              "overallLevel",
              "criteria",
              "mistakes",
              "suggestions",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      throw new Error("AI did not return structured grading");
    }

    const grading = JSON.parse(toolCall.function.arguments);

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
