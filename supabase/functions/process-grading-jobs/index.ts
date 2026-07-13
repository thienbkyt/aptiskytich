// Worker: claims pending grading_jobs, invokes grade-exam via internal bypass,
// then persists the AI verdict into *_question_gradings + test_results, and
// (when all 4 parts of a session are done) upserts *_skill_results.
//
// Persistence uses CANONICAL part keys shared with the client:
//   writing: task1..task4
//   speaking: part1..part4
// Any legacy long labels ("Part 1 – Short Answers", ...) were normalized by
// the accompanying migration, so ON CONFLICT (test_result_id, part, item_index)
// is unambiguous.

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

async function persistWritingPart(job: any, body: any): Promise<{ rawPart: number }> {
  const partType: string = String(job.part || body.partType);
  const rawPart = Number(body.rawPart ?? body.raw_part ?? 0);
  const meta = job.payload?._meta || {};

  if (!job.test_result_id) {
    // Nothing to link back to → cannot persist deterministically. Treat as
    // hard failure so the job doesn't get marked done silently.
    throw new Error("writing job missing test_result_id");
  }

  const { error: upErr } = await admin.from("writing_question_gradings").upsert([{
    user_id: job.user_id,
    test_result_id: job.test_result_id,
    exam_set_id: meta.examSetId ?? null,
    part: partType,
    item_index: 0,
    max_points: 30,
    part_score: rawPart,
    grammar_errors: (body.grammarErrors || []) as any,
    spelling_errors: (body.spellingErrors || []) as any,
    feedback: body.feedback || "",
  }], { onConflict: "test_result_id,part,item_index" });
  if (upErr) throw new Error(`writing_question_gradings upsert failed: ${upErr.message}`);

  const { error: trErr } = await admin.from("test_results").update({
    score: Math.round(rawPart),
    total: 30,
    correct_answers: Math.round(rawPart),
  } as any).eq("id", job.test_result_id);
  if (trErr) throw new Error(`test_results update failed: ${trErr.message}`);

  return { rawPart };
}

async function persistSpeakingPart(job: any, body: any): Promise<{ rawPart: number }> {
  const partType: string = String(job.part || body.partType);
  const rawPart = Number(body.rawPart ?? body.raw_part ?? 0);
  const meta = job.payload?._meta || {};
  const perItem: any[] = Array.isArray(body.perItem) ? body.perItem : [];

  if (!job.test_result_id) {
    throw new Error("speaking job missing test_result_id");
  }

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

  const { error: upErr } = await admin.from("speaking_question_gradings").upsert(rows, {
    onConflict: "test_result_id,part,item_index",
  });
  if (upErr) throw new Error(`speaking_question_gradings upsert failed: ${upErr.message}`);

  const { error: trErr } = await admin.from("test_results").update({
    score: Math.round(rawPart),
    total: 30,
    correct_answers: Math.round(rawPart),
  } as any).eq("id", job.test_result_id);
  if (trErr) throw new Error(`test_results update failed: ${trErr.message}`);

  return { rawPart };
}

// ─── finalize (all 4 parts of a session) ────────────────────────────────────

async function tryFinalizeSession(job: any, skill: "writing" | "speaking") {
  const meta = job.payload?._meta || {};
  const sessionId: string | null = meta.fullTestSessionId ?? null;
  if (!sessionId || !job.test_result_id) return;

  // test_results has no top-level `skill` column — the skill lives in the
  // `skill_scores` JSONB. Also match tolerantly on legacy rows where the
  // session id is only present in skill_scores.fullPartSession/fullTestSession.
  const { data: rows, error } = await admin
    .from("test_results")
    .select("id, score, total, level, skill_scores, exam_set_id, full_test_session_id")
    .eq("user_id", job.user_id)
    .or(
      `full_test_session_id.eq.${sessionId},skill_scores->>fullPartSession.eq.${sessionId},skill_scores->>fullTestSession.eq.${sessionId}`,
    );
  if (error || !rows) return;

  const partRows = rows.filter((r: any) => {
    const sk = r?.skill_scores?.skill;
    return sk === skill;
  });

  const partKeys = skill === "writing"
    ? ["task1", "task2", "task3", "task4"]
    : ["part1", "part2", "part3", "part4"];

  const trids = partRows.map((r: any) => r.id);
  if (trids.length < 4) return;

  const gradingsTable = skill === "writing" ? "writing_question_gradings" : "speaking_question_gradings";
  const { data: gradings } = await admin
    .from(gradingsTable)
    .select("test_result_id, part, item_index, part_score")
    .in("test_result_id", trids)
    .eq("item_index", 0);

  if (!gradings || gradings.length < 4) return;

  // Canonical part keys — client + worker both write them post-migration.
  const rawParts: Record<string, number> = {};
  for (const g of gradings as any[]) {
    if (partKeys.includes(g.part)) rawParts[g.part] = Number(g.part_score || 0);
  }
  if (!partKeys.every((k) => typeof rawParts[k] === "number")) return;

  // ── Aggregate finalize inputs across the whole session ──
  // forcedComplexity: true if ANY graded job in the session flagged it.
  let forcedComplexity = false;
  try {
    const { data: sessionJobs } = await admin
      .from("grading_jobs")
      .select("raw_response")
      .eq("user_id", job.user_id)
      .in("test_result_id", trids);
    for (const j of (sessionJobs || []) as any[]) {
      if (j?.raw_response?.forcedComplexity) { forcedComplexity = true; break; }
    }
  } catch (e) {
    console.warn("[worker] forcedComplexity aggregate failed:", (e as any)?.message || e);
  }

  // coreGV: grammar_vocab CEFR band from the same session (string like "A2"/"B1"/"B2"/"C"), else null.
  let coreGV: string | null = null;
  const gv = rows.find((r: any) => r?.skill_scores?.skill === "grammar_vocab");
  if (gv?.level) coreGV = String(gv.level).toUpperCase();

  const finalizeType = skill === "writing" ? "writing_finalize" : "speaking_finalize";
  const finalizePayload: any = { type: finalizeType, rawParts, coreGV, forcedComplexity };
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

  const { error: srErr } = await admin.from(skillTable).upsert({
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
  if (srErr) throw new Error(`${skillTable} upsert failed: ${srErr.message}`);

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
  // Finalize is best-effort — if it errors, we still consider the per-part
  // persist successful (skill_results row will be filled in when the last
  // part's job runs / retries).
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
          // Persist BEFORE marking done. If persist throws, the job goes back
          // to pending (or failed on last attempt) with last_error set — never
          // marked done silently, so students cannot end up with 0 scores.
          try {
            await persistJobResult(job, body);
            await admin.from("grading_jobs").update({
              status: "done",
              finished_at: new Date().toISOString(),
              raw_response: body,
              last_error: null,
            }).eq("id", job.id);
            results.push({ id: job.id, status: "done" });
          } catch (persistErr: any) {
            const errMsg = `persist: ${persistErr?.message || String(persistErr)}`;
            console.error("[worker] persist error:", errMsg);
            const isFinal = (job.attempts || 0) >= (job.max_attempts || 3);
            await admin.from("grading_jobs").update({
              status: isFinal ? "failed" : "pending",
              claimed_at: null,
              last_error: errMsg,
              // Keep raw_response so operators can inspect / retry persist manually.
              raw_response: body,
              finished_at: isFinal ? new Date().toISOString() : null,
            }).eq("id", job.id);
            results.push({ id: job.id, status: isFinal ? "failed" : "retry" });
          }
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
