// One-off / on-demand backfill: finalize writing sessions that have all 4 part
// scores but no writing_skill_results row (typically "mixed" attempts where
// some parts were graded client-side and some by the worker).
//
// Service-role only. Does NOT re-grade anything: per-part scores are taken as-is
// and only scale50/CEFR are computed through grade-exam's writing_finalize.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  finalizeWritingSession,
  mapWritingRowsToParts,
  resolveWritingRawParts,
} from "../_shared/writingFinalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function invokeGradeExam(payload: any, userId: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/grade-exam`, {
    method: "POST",
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
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replaceAll("-", "+").replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload));
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const claims = authHeader?.startsWith("Bearer ")
    ? parseJwtClaims(authHeader.slice(7).trim())
    : null;
  if (claims?.role !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let input: any = {};
  try { input = await req.json(); } catch { /* optional body */ }
  const since: string = input?.since || "2026-08-07T00:00:00Z";
  const onlySession: string | null = input?.sessionId || null;
  const dryRun = !!input?.dryRun;

  try {
    // Candidate writing rows in scope.
    let q = admin
      .from("test_results")
      .select("id, user_id, score, total, level, exam_set_id, review_snapshot, created_at, full_test_session_id, skill_scores")
      .eq("skill_scores->>skill", "writing")
      .not("full_test_session_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (onlySession) q = q.eq("full_test_session_id", onlySession);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Group by (user, session)
    const groups = new Map<string, any[]>();
    for (const r of (rows || []) as any[]) {
      const key = `${r.user_id}::${r.full_test_session_id}`;
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    }

    const finalized: any[] = [];
    const skipped: any[] = [];

    for (const [key, partRows] of groups) {
      const [userId, sessionId] = key.split("::");
      if (partRows.length < 4) { skipped.push({ sessionId, reason: `only ${partRows.length} writing rows` }); continue; }

      const { data: settled } = await admin
        .from("writing_skill_results")
        .select("id")
        .eq("user_id", userId)
        .eq("full_test_session_id", sessionId)
        .maybeSingle();
      if (settled?.id) { skipped.push({ sessionId, reason: "already finalized" }); continue; }

      const trids = partRows.map((r: any) => r.id);
      const { data: gradings } = await admin
        .from("writing_question_gradings")
        .select("test_result_id, part, item_index, part_score")
        .in("test_result_id", trids)
        .eq("item_index", 0);

      const rowsByPart = mapWritingRowsToParts(partRows as any[]);
      const rawParts = resolveWritingRawParts((gradings || []) as any[], rowsByPart);
      if (!rawParts) { skipped.push({ sessionId, reason: "missing part score" }); continue; }

      // coreGV from the same session's grammar_vocab attempt.
      let coreGV: string | null = null;
      const { data: gvRows } = await admin
        .from("test_results")
        .select("level")
        .eq("user_id", userId)
        .eq("full_test_session_id", sessionId)
        .eq("skill_scores->>skill", "grammar_vocab")
        .limit(1);
      if (gvRows?.[0]?.level) coreGV = String(gvRows[0].level).toUpperCase();

      let forcedComplexity = false;
      const { data: jobs } = await admin
        .from("grading_jobs")
        .select("raw_response")
        .eq("user_id", userId)
        .in("test_result_id", trids);
      for (const j of (jobs || []) as any[]) {
        if (j?.raw_response?.forcedComplexity) { forcedComplexity = true; break; }
      }

      const last = partRows[partRows.length - 1];
      if (dryRun) {
        finalized.push({ sessionId, userId, rawParts, coreGV, dryRun: true });
        continue;
      }

      try {
        const res = await finalizeWritingSession({
          admin,
          invokeGradeExam,
          userId,
          sessionId,
          rawParts,
          coreGV,
          forcedComplexity,
          examSetId: last.exam_set_id ?? null,
          lastTestResultId: last.id,
        });
        if (!res) { skipped.push({ sessionId, reason: "writing_finalize failed" }); continue; }
        finalized.push({ sessionId, userId, rawParts, ...res });
      } catch (e: any) {
        skipped.push({ sessionId, reason: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ finalized, skipped }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
