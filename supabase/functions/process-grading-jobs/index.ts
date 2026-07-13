// Worker: claims pending grading_jobs, invokes grade-exam via internal bypass,
// then persists the AI verdict into *_question_gradings + test_results, and
// (when all 4 parts of a session are done) upserts *_skill_results.
//
// The client-side safety-net enqueues here on failure — the worker is the
// single place that guarantees results reach the DB, independent of whether
// the student comes back to the page.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── audio path hydration (speaking) ────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function hydrateAudioPaths(payload: any): Promise<any> {
  if (!payload || payload.type !== "speaking_v2") return payload;
  const paths: Array<string | null | undefined> = Array.isArray(payload.audioPaths)
    ? payload.audioPaths
    : null;
  if (!paths) return payload;

  const audios: string[] = [];
  for (const p of paths) {
    if (!p || typeof p !== "string") { audios.push(""); continue; }
    try {
      const { data, error } = await admin.storage.from("speaking-recordings").download(p);
      if (error || !data) { audios.push(""); continue; }
      const buf = new Uint8Array(await data.arrayBuffer());
      audios.push(bytesToBase64(buf));
    } catch { audios.push(""); }
  }
  const { audioPaths, ...rest } = payload;
  return { ...rest, audios };
}

// ─── grade-exam invocation ──────────────────────────────────────────────────

async function invokeGradeExam(
  payload: any,
  userId: string,
): Promise<{ ok: boolean; status: number; body: any }> {
  const hydrated = await hydrateAudioPaths(payload);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "x-internal-key": SERVICE_ROLE,
      "x-internal-user-id": userId,
    },
    body: JSON.stringify(hydrated),
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
}

// ─── permanent-failure detection ────────────────────────────────────────────
// Never retry quota / rate / credit / validation errors — they never succeed
// on retry and only burn AI credits.
function isPermanentFailure(status: number, body: any): boolean {
  if (status === 402) return true;               // credits exhausted
  if (status === 429) return true;               // quota/rate limited
  if (status === 400) return true;               // validation
  if (body?.quotaExceeded || body?.quotaError) return true;
  const err = String(body?.error || "").toLowerCase();
  if (err.includes("quota")) return true;
  if (err.includes("invalid") && err.includes("input")) return true;
  return false;
}

// ─── result persistence ─────────────────────────────────────────────────────

const WRITING_PART_LABELS: Record<string, string> = {
  task1: "Part 1",
  task2: "Part 2",
  task3: "Part 3",
  task4: "Part 4",
};

async function persistWritingPart(job: any, body: any) {
  const partType: string = job.part || body.partType;
  const partLabel = WRITING_PART_LABELS[partType] || partType;
  const rawPart = Number(body.rawPart ?? body.raw_part ?? 0);
  const meta = job.payload?._meta || {};

  if (!job.test_result_id) {
    console.warn("[worker] writing job missing test_result_id, cannot persist rows:", job.id);
    return { rawPart };
  }

  await admin.from("writing_question_gradings").upsert([{
    user_id: job.user_id,
    test_result_id: job.test_result_id,
    exam_set_id: meta.examSetId ?? null,
    part: partLabel,
    item_index: 0,
    max_points: 30,
    part_score: rawPart,
    grammar_errors: (body.grammarErrors || []) as any,
    spelling_errors: (body.spellingErrors || []) as any,
    feedback: body.feedback || "",
  }], { onConflict: "test_result_id,part,item_index" });

  // Update per-part test_results row with raw score (out of 30).
  await admin.from("test_results").update({
    score: Math.round(rawPart),
    total: 30,
    correct_answers: Math.round(rawPart),
  } as any).eq("id", job.test_result_id);

  return { rawPart };
}

async function persistSpeakingPart(job: any, body: any) {
  const partType: string = job.part || body.partType;
  const rawPart = Number(body.rawPart ?? body.raw_part ?? 0);
  const meta = job.payload?._meta || {};
  const perItem: any[] = Array.isArray(body.perItem) ? body.perItem : [];

  if (!job.test_result_id) {
    console.warn("[worker] speaking job missing test_result_id, cannot persist rows:", job.id);
    return { rawPart };
  }

  // Distribute rawPart across items (or store aggregate at index 0).
  const rows = perItem.length > 0
    ? perItem.map((it, i) => ({
        user_id: job.user_id,
        test_result_id: job.test_result_id,
        exam_set_id: meta.examSetId ?? null,
        part: partType,
        item_index: i,
        max_points: Math.round(30 / perItem.length),
        part_score: i === 0 ? Math.round(rawPart) : 0,
        question_text: it.questionText ?? null,
        transcript: it.transcript ?? null,
        grammar_errors: [] as any,
        pronunciation_errors: [] as any,
        improved_version: it.improvedVersion ?? null,
        feedback: body.feedback || body.analysis || "",
      }))
    : [{
        user_id: job.user_id,
        test_result_id: job.test_result_id,
        exam_set_id: meta.examSetId ?? null,
        part: partType,
        item_index: 0,
        max_points: 30,
        part_score: Math.round(rawPart),
        grammar_errors: [] as any,
        pronunciation_errors: [] as any,
        feedback: body.feedback || body.analysis || "",
      }];

  await admin.from("speaking_question_gradings").upsert(rows, {
    onConflict: "test_result_id,part,item_index",
  });

  await admin.from("test_results").update({
    score: Math.round(rawPart),
    total: 30,
    correct_answers: Math.round(rawPart),
  } as any).eq("id", job.test_result_id);

  return { rawPart };
}

// ─── finalize (all 4 parts of a session) ────────────────────────────────────

async function tryFinalizeSession(job: any, skill: "writing" | "speaking") {
  const meta = job.payload?._meta || {};
  const sessionId: string | null = meta.fullTestSessionId ?? null;
  if (!sessionId || !job.test_result_id) return;

  // Collect all test_results in the same session for this user.
  const { data: rows, error } = await admin
    .from("test_results")
    .select("id, score, total, skill, exam_set_id")
    .eq("user_id", job.user_id)
    .eq("full_test_session_id", sessionId);
  if (error || !rows) return;

  const partRows = rows.filter((r: any) => r.skill === skill);

  const partKeys = skill === "writing"
    ? ["task1", "task2", "task3", "task4"]
    : ["part1", "part2", "part3", "part4"];

  // Look up per-part scores from *_question_gradings for all trids in session.
  const trids = partRows.map((r: any) => r.id);
  if (trids.length < 4) return;

  const gradingsTable = skill === "writing" ? "writing_question_gradings" : "speaking_question_gradings";
  const { data: gradings } = await admin
    .from(gradingsTable)
    .select("test_result_id, part, item_index, part_score")
    .in("test_result_id", trids)
    .eq("item_index", 0);

  if (!gradings || gradings.length < 4) return;

  // Map back to task1/part1 keys.
  const rawParts: Record<string, number> = {};
  for (const g of gradings as any[]) {
    if (skill === "writing") {
      // stored as "Part 1"/"Part 2" — reverse-lookup.
      const entry = Object.entries(WRITING_PART_LABELS).find(([, v]) => v === g.part);
      if (entry) rawParts[entry[0]] = Number(g.part_score || 0);
    } else {
      rawParts[g.part] = Number(g.part_score || 0);
    }
  }
  if (!partKeys.every((k) => typeof rawParts[k] === "number")) return;

  // Call finalize.
  const finalizeType = skill === "writing" ? "writing_finalize" : "speaking_finalize";
  const finalizePayload: any = { type: finalizeType, rawParts };
  if (skill === "speaking") finalizePayload.skill = "speaking";
  const { body: finBody, ok: finOk } = await invokeGradeExam(finalizePayload, job.user_id);
  if (!finOk || !finBody) return;

  const scale50 = Number(finBody.scale50 ?? 0);
  const cefr = String(finBody.cefr ?? "A0");
  const rawTotal = Number(finBody.rawTotal ?? finBody.raw_total ?? 0);
  const greyZone = !!finBody.greyZone;
  const flagReview = !!finBody.flagReview;

  const skillTable = skill === "writing" ? "writing_skill_results" : "speaking_skill_results";
  const partsPayload: Record<string, any> = {};
  for (const k of partKeys) partsPayload[k] = { rawPart: rawParts[k] };

  await admin.from(skillTable).upsert({
    user_id: job.user_id,
    test_result_id: job.test_result_id,
    exam_set_id: meta.examSetId ?? null,
    full_test_session_id: sessionId,
    parts: partsPayload,
    raw_total: rawTotal,
    scale50,
    cefr,
    grey_zone: greyZone,
    flag_review: flagReview,
  }, { onConflict: "user_id,full_test_session_id" });

  // Patch the last test_results row with scale50/cefr so history/summary reflect it.
  await admin.from("test_results").update({
    score: scale50,
    total: 50,
    correct_answers: scale50,
    level: cefr,
  } as any).eq("id", job.test_result_id);
}

async function persistJobResult(job: any, body: any) {
  const skill: "writing" | "speaking" = job.skill;
  if (skill === "writing") {
    await persistWritingPart(job, body);
  } else {
    await persistSpeakingPart(job, body);
  }
  try {
    await tryFinalizeSession(job, skill);
  } catch (e: any) {
    console.warn("[worker] finalize failed (non-fatal):", e?.message || e);
  }
}

// ─── main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data: jobs, error } = await admin.rpc("claim_grading_jobs", {
      _limit: 5,
      _reclaim_after: "10 minutes",
    });
    if (error) {
      console.error("[worker] claim error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: string }> = [];

    for (const job of (jobs || []) as any[]) {
      try {
        const payload = job.payload || {};
        const { ok, status, body } = await invokeGradeExam(payload, job.user_id);

        if (ok && body && !body.error) {
          // Persist to writing/speaking tables and try to finalize.
          try {
            await persistJobResult(job, body);
          } catch (e: any) {
            console.error("[worker] persist error (still marking done):", e?.message || e);
          }
          await admin.from("grading_jobs").update({
            status: "done",
            finished_at: new Date().toISOString(),
            raw_response: body,
            last_error: null,
          }).eq("id", job.id);
          results.push({ id: job.id, status: "done" });
        } else {
          const errMsg = (body && body.error) ? String(body.error) : `HTTP ${status}`;
          const permanent = isPermanentFailure(status, body);
          const isFinal = permanent || (job.attempts || 0) >= (job.max_attempts || 3);
          await admin.from("grading_jobs").update({
            status: isFinal ? "failed" : "pending",
            claimed_at: null,
            last_error: permanent ? `[permanent] ${errMsg}` : errMsg,
            finished_at: isFinal ? new Date().toISOString() : null,
          }).eq("id", job.id);
          results.push({ id: job.id, status: isFinal ? "failed" : "retry" });
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        const isFinal = (job.attempts || 0) >= (job.max_attempts || 3);
        await admin.from("grading_jobs").update({
          status: isFinal ? "failed" : "pending",
          claimed_at: null,
          last_error: errMsg,
          finished_at: isFinal ? new Date().toISOString() : null,
        }).eq("id", job.id);
        results.push({ id: job.id, status: isFinal ? "failed" : "retry" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[worker] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
