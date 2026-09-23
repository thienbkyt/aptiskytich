// Internal-only: re-grades already-submitted Writing attempts with the
// experimental stricter rubric (rubricVersion: "v3") and records the result in
// public.writing_calibration. It NEVER writes to any other table — no
// test_results, no *_skill_results, no *_question_gradings, no feature_usage.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BATCH = 6;
const TIMEOUT_MS = 120_000;

// Fetch once per run; grade-exam bills feature_usage against this user
// (an admin) instead of the student, so students keep their quota.
let cachedAdminUserId: string | null = null;
async function getAdminUserId(): Promise<string | null> {
  if (cachedAdminUserId) return cachedAdminUserId;
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);
  cachedAdminUserId = (data?.[0] as any)?.user_id ?? null;
  return cachedAdminUserId;
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type TaskType = "task1" | "task2" | "task3" | "task4";

const taskFromPart = (raw: string): TaskType | null => {
  const m = String(raw || "").match(/([1-4])/);
  return m ? (`task${m[1]}` as TaskType) : null;
};

const parseAnswers = (raw: string): string[] =>
  [...String(raw || "").matchAll(/A:\s*([\s\S]*?)(?=\n\s*\nQ\d+:|$)/g)].map((m) => m[1].trim());

async function buildPayload(
  testResultId: string,
): Promise<{ payload: Record<string, unknown>; userId: string | null; partType: TaskType } | null> {
  const { data: result } = await admin
    .from("test_results")
    .select("id,user_id,score,total_questions,grade_payload,review_snapshot")
    .eq("id", testResultId)
    .maybeSingle();
  if (!result) return null;
  const userId = (result as any).user_id ?? null;

  // a) latest writing grading job payload for this attempt
  const { data: jobRows } = await admin
    .from("grading_jobs")
    .select("payload,created_at")
    .eq("test_result_id", testResultId)
    .eq("skill", "writing")
    .order("created_at", { ascending: false })
    .limit(1);
  const jobPayload = (jobRows?.[0] as any)?.payload;
  if (jobPayload?.partType) {
    const { _meta, ...rest } = jobPayload as Record<string, unknown>;
    const partType = taskFromPart(String(jobPayload.partType));
    if (partType) {
      return { userId, partType, payload: { ...rest, type: "writing_v2", partType, rubricVersion: "v3" } };
    }
  }

  // b) persisted grade_payload
  const gp = (result as any).grade_payload as Record<string, unknown> | null;
  if (gp?.partType) {
    const partType = taskFromPart(String(gp.partType));
    if (partType) {
      return { userId, partType, payload: { ...gp, type: "writing_v2", partType, rubricVersion: "v3" } };
    }
  }

  // c) rebuild from review_snapshot
  const snap = (result as any).review_snapshot as any;
  const partType = taskFromPart(String(snap?.part ?? ""));
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  const text = String(items[0]?.userAnswer ?? "");
  if (!partType || !text.trim()) return null;
  const questions = items
    .map((it) => String(it?.questionText ?? "").trim())
    .filter((q) => q.length > 0);

  let parts: Record<string, unknown> = {};
  if (partType === "task1") parts = { shortAnswers: parseAnswers(text) };
  if (partType === "task3") parts = { threeAnswers: parseAnswers(text) };
  if (partType === "task4") {
    const informal =
      text.match(/Informal Email:\s*\n?([\s\S]*?)(?=\n\s*\nFormal Email:|Formal Email:|$)/i)?.[1]?.trim() ?? "";
    const formal = text.match(/Formal Email:\s*\n?([\s\S]*)$/i)?.[1]?.trim() ?? "";
    parts = { informalText: informal, formalText: formal };
  }

  return {
    userId,
    partType,
    payload: { type: "writing_v2", partType, questions, text, parts, rubricVersion: "v3" },
  };
}

async function callGradeExam(payload: Record<string, unknown>, userId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "x-internal-key": SERVICE_ROLE,
        "x-internal-user-id": userId,
      },
      body: JSON.stringify(payload),
    });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    const isAbort = (e as any)?.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 500,
      body: { error: isAbort ? `timeout after ${TIMEOUT_MS / 1000}s` : String((e as any)?.message || e) },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort lookup of the score this attempt originally received. */
async function lookupOldRaw(testResultId: string, partType: TaskType): Promise<number | null> {
  const { data: rows } = await admin
    .from("writing_question_gradings")
    .select("part,part_score,item_index")
    .eq("test_result_id", testResultId);
  const match = (rows ?? []).find(
    (r: any) => taskFromPart(String(r.part ?? "")) === partType && Number(r.item_index ?? 0) === 0,
  );
  if (match && match.part_score != null) return Number(match.part_score);

  const { data: result } = await admin
    .from("test_results")
    .select("score,total")
    .eq("id", testResultId)
    .maybeSingle();
  if (result && Number((result as any).total) === 30) return Number((result as any).score);
  return null;
}

async function processRow(row: any) {
  try {
    const built = await buildPayload(row.test_result_id);
    if (!built) throw new Error("cannot rebuild writing payload for this attempt");

    // Header user id = admin's user_id (once per run) so grade-exam does not
    // deduct the student's AI quota.
    const adminId = (await getAdminUserId()) ?? built.userId ?? row.test_result_id;
    const { ok, status, body } = await callGradeExam(built.payload, adminId);
    if (!ok || !body || body.error) {
      throw new Error(`grade-exam ${status}: ${body?.error ?? "unknown"}`);
    }

    const rawOld = await lookupOldRaw(row.test_result_id, built.partType);
    await admin
      .from("writing_calibration")
      .update({
        part: built.partType,
        raw_old: rawOld,
        raw_v3: body.rawPart ?? null,
        bands_v3: body.bands ?? null,
        result: body,
        status: "done",
        error: null,
        done_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  } catch (e) {
    await admin
      .from("writing_calibration")
      .update({
        status: "failed",
        error: String((e as any)?.message || e).slice(0, 2000),
        done_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("GRADING_CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && cronHeader === cronSecret;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    const claims = authHeader?.startsWith("Bearer ")
      ? parseJwtClaims(authHeader.slice("Bearer ".length).trim())
      : null;
    if (claims?.role !== "service_role") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { data: pending, error } = await admin
      .from("writing_calibration")
      .select("id,test_result_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH);
    if (error) throw error;

    const rows = pending ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ claimed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claimed } = await admin
      .from("writing_calibration")
      .update({ status: "processing" })
      .in("id", rows.map((r: any) => r.id))
      .eq("status", "pending")
      .select("id,test_result_id");

    const toRun = claimed ?? [];
    await Promise.all(toRun.map((row: any) => processRow(row)));

    return new Response(JSON.stringify({ claimed: toRun.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[writing-calibration]", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
