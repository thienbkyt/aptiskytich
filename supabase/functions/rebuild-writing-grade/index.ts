import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BodySchema = z.object({ test_result_id: z.string().uuid() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const taskFromPart = (part: string): "task1" | "task2" | "task3" | "task4" | null => {
  const match = part.match(/([1-4])/);
  return match ? (`task${match[1]}` as "task1" | "task2" | "task3" | "task4") : null;
};

const parseAnswers = (raw: string): string[] =>
  [...raw.matchAll(/A:\s*([\s\S]*?)(?=\n\s*\nQ\d+:|$)/g)].map((m) => m[1].trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const token = authHeader.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

  let parsedBody: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors }, 400);
    parsedBody = parsed.data;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { data: result, error: resultError } = await admin
    .from("test_results")
    .select("id,user_id,exam_set_id,full_test_session_id")
    .eq("id", parsedBody.test_result_id)
    .maybeSingle();
  if (resultError) return json({ error: "result_lookup_failed" }, 500);
  if (!result || result.user_id !== authData.user.id) return json({ error: "not_found" }, 404);
  if (!result.exam_set_id) return json({ error: "missing_exam_set" }, 400);

  const [{ data: existingGrading }, { data: activeJob }] = await Promise.all([
    admin.from("writing_question_gradings").select("id").eq("test_result_id", result.id).limit(1),
    admin.from("grading_jobs").select("id,status").eq("test_result_id", result.id)
      .in("status", ["pending", "processing"]).limit(1),
  ]);
  if (existingGrading?.length) return json({ ok: true, status: "already_graded" });
  if (activeJob?.length) return json({ ok: true, status: "already_queued", job_id: activeJob[0].id });

  const [{ data: setRow }, { data: questionRows }, { data: answerRows }] = await Promise.all([
    admin.from("exam_sets").select("part").eq("id", result.exam_set_id).maybeSingle(),
    admin.from("exam_questions").select("id,order_index,question_text,extra_data")
      .eq("exam_set_id", result.exam_set_id).order("order_index", { ascending: true }),
    admin.from("exam_question_results").select("exam_question_id,user_answer")
      .eq("test_result_id", result.id).order("created_at", { ascending: true }),
  ]);
  const partType = taskFromPart(String(setRow?.part ?? ""));
  const raw = String(answerRows?.find((row) => String(row.user_answer ?? "").trim())?.user_answer ?? "");
  if (!partType || !raw.trim() || !questionRows?.length) return json({ error: "submission_not_rebuildable" }, 400);

  const first = questionRows[0] as Record<string, unknown> | undefined;
  const extra = (first?.extra_data ?? {}) as Record<string, any>;
  let questions = questionRows.map((row) => String(row.question_text ?? "")).filter(Boolean);
  if (partType === "task2") {
    questions = [String(extra.instruction ?? first?.question_text ?? ""), String(extra.question ?? "")].filter(Boolean);
  }
  if (partType === "task4") {
    questions = [
      `SCENARIO (bối cảnh chung cho cả 2 email): ${String(extra.scenarioIntro ?? extra.scenario_intro ?? "")}\n${String(extra.scenarioEmail ?? extra.scenario_email ?? first?.question_text ?? "")}`,
      `Email 1 (Informal) instruction: ${String(extra.informalEmail?.instruction ?? extra.informal_email?.instruction ?? "")}`,
      `Email 2 (Formal) instruction: ${String(extra.formalEmail?.instruction ?? extra.formal_email?.instruction ?? "")}`,
    ].filter((value) => value.replace(/^[^:]+:\s*/, "").trim().length > 0);
  }
  let parts: Record<string, unknown> | undefined;
  if (partType === "task1") parts = { shortAnswers: parseAnswers(raw) };
  if (partType === "task3") parts = { threeAnswers: parseAnswers(raw) };
  if (partType === "task4") {
    const informal = raw.match(/Informal Email:\s*\n?([\s\S]*?)(?=\n\s*\nFormal Email:|$)/i)?.[1]?.trim() ?? "";
    const formal = raw.match(/Formal Email:\s*\n?([\s\S]*)$/i)?.[1]?.trim() ?? "";
    parts = { informalText: informal, formalText: formal };
  }

  const gradingSessionId = result.full_test_session_id ?? result.id;
  const payload = { type: "writing_v2", partType, questions, text: raw, parts, gradingSessionId };

  const { data: priorUsage } = await admin.from("feature_usage").select("id")
    .eq("user_id", authData.user.id).eq("feature_key", "ai_grading_writing")
    .eq("ref_id", gradingSessionId).limit(1);

  const { data: access, error: accessError } = await userClient.rpc("check_feature_access", {
    p_key: "ai_grading_writing",
    p_scope: null,
  });
  if (accessError) return json({ error: "access_check_failed" }, 503);
  const gate = (access ?? {}) as Record<string, unknown>;
  if (gate.allowed === false && !priorUsage?.length) {
    return json({
      error: gate.reason === "disabled" ? "disabled" : "quota_exceeded",
      upgrade: true,
      need: gate.tier === "pro" ? "premium" : "pro",
      tier: gate.tier ?? "free",
      used: gate.used ?? 0,
      remaining: gate.remaining ?? 0,
    });
  }

  const { data: job, error: jobError } = await admin.from("grading_jobs").insert({
    user_id: authData.user.id,
    test_result_id: result.id,
    skill: "writing",
    part: partType,
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    payload: {
      ...payload,
      _meta: { examSetId: result.exam_set_id, fullTestSessionId: result.full_test_session_id },
    },
    last_error: "manually rebuilt from saved submission",
  }).select("id").single();
  if (jobError || !job) return json({ error: "enqueue_failed" }, 500);

  if (!priorUsage?.length) {
    const { error: usageError } = await admin.from("feature_usage").insert({
      user_id: authData.user.id,
      feature_key: "ai_grading_writing",
      scope: null,
      ref_id: gradingSessionId,
      paid_by_credit: Boolean(gate.would_use_credit),
    });
    if (usageError) {
      await admin.from("grading_jobs").delete().eq("id", job.id);
      return json({ error: "usage_reservation_failed" }, 500);
    }
  }

  fetch(`${SUPABASE_URL}/functions/v1/process-grading-jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => undefined);

  return json({ ok: true, status: "queued", job_id: job.id, part: partType });
});