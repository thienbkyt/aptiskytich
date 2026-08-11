// Sweeper: finds Writing attempts that were submitted but never finished
// grading client-side (tab closed / connection dropped) and enqueues them into
// grading_jobs so the process-grading-jobs worker can grade them.
//
// Detection signal: test_results.grade_payload IS NOT NULL AND total = 1.
// The worker clears grade_payload when it persists a result, and the client
// clears it in saveWritingSkillResult — so a lingering payload means unfinished.
//
// Legacy stuck rows (grade_payload NULL) are intentionally out of scope.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildWritingPayloadFromDb } from "../_shared/writingPayloadRebuild.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BATCH_LIMIT = 50;
const MIN_AGE_MINUTES = 5;
const MAX_AGE_HOURS = 24;
// Ignore every attempt that predates this deploy — only sweep new submissions.
const SWEEP_NOT_BEFORE = "2026-08-03T17:00:00Z";



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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const claims = parseJwtClaims(authHeader.slice("Bearer ".length).trim());
  if (claims?.role !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = Date.now();
    const olderThan = new Date(now - MIN_AGE_MINUTES * 60_000).toISOString();
    const newerThan = new Date(now - MAX_AGE_HOURS * 3_600_000).toISOString();

    const { data: rows, error } = await admin
      .from("test_results")
      .select("id, user_id, exam_set_id, full_test_session_id, grade_payload, created_at")
      .not("grade_payload", "is", null)
      .eq("grade_payload->>type", "writing_v2")
      .lt("created_at", olderThan)
      .gt("created_at", newerThan)
      .gt("created_at", SWEEP_NOT_BEFORE)
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);


    if (error) {
      console.error("[sweep-writing] select failed:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates = (rows || []) as any[];
    console.log(`[sweep-writing] candidates: ${candidates.length}`);

    const queuedFor = async (ids: string[]) => {
      if (ids.length === 0) return new Set<string>();
      const { data, error: exErr } = await admin
        .from("grading_jobs")
        .select("test_result_id")
        .in("test_result_id", ids);
      if (exErr) throw new Error(exErr.message);
      return new Set(((data || []) as any[]).map((j) => j.test_result_id).filter(Boolean));
    };

    const enqueueRow = async (row: any, payload: any) => {
      // Quota-blocked submissions remain recoverable, but must never enter
      // the internal-bypass worker until the owner explicitly requests a
      // new grade and passes check_feature_access again.
      if (payload?._quotaBlocked === true) return false;
      const { error: insErr } = await admin.from("grading_jobs").insert({
        user_id: row.user_id,
        test_result_id: row.id,
        skill: "writing",
        part: payload?.partType ?? null,
        status: "pending",
        attempts: 0,
        max_attempts: 3,
        payload: {
          ...payload,
          _meta: {
            examSetId: row.exam_set_id ?? null,
            fullTestSessionId:
              row.full_test_session_id ?? payload?.gradingSessionId ?? null,
          },
        },
      } as any);
      if (insErr) {
        console.error(`[sweep-writing] enqueue failed for ${row.id}:`, insErr.message);
        return false;
      }
      return true;
    };

    let enqueued = 0;

    // ---- Branch 1: attempts that DID persist grade_payload ----
    if (candidates.length > 0) {
      const alreadyQueued = await queuedFor(candidates.map((r) => r.id));
      for (const row of candidates) {
        if (alreadyQueued.has(row.id)) continue;
        try {
          const payload = row.grade_payload;
          if (!payload || typeof payload !== "object") {
            console.warn(`[sweep-writing] row ${row.id}: invalid grade_payload, skipped`);
            continue;
          }
          if (await enqueueRow(row, payload)) enqueued++;
        } catch (e: any) {
          console.error(`[sweep-writing] row ${row.id} error:`, e?.message || e);
        }
      }
    }

    // ---- Branch 2: attempts whose client died BEFORE writing grade_payload ----
    // Rebuild the payload from the persisted answers so the worker can grade it.
    let rebuiltEnqueued = 0;
    let orphanCount = 0;
    try {
      const { data: writingSets } = await admin
        .from("exam_sets").select("id").eq("skill", "writing");
      const writingSetIds = ((writingSets || []) as any[]).map((s) => s.id);
      if (writingSetIds.length > 0) {
        const { data: orphanRows, error: orphanErr } = await admin
          .from("test_results")
          .select("id, user_id, exam_set_id, full_test_session_id, created_at")
          .is("grade_payload", null)
          .in("exam_set_id", writingSetIds)
          .lt("created_at", olderThan)
          .gt("created_at", newerThan)
          .gt("created_at", SWEEP_NOT_BEFORE)
          .order("created_at", { ascending: true })
          .limit(BATCH_LIMIT);
        if (orphanErr) throw new Error(orphanErr.message);

        const orphans = (orphanRows || []) as any[];
        orphanCount = orphans.length;
        if (orphans.length > 0) {
          const ids = orphans.map((r) => r.id);
          const alreadyQueued = await queuedFor(ids);
          const { data: gradedRows } = await admin
            .from("writing_skill_results").select("test_result_id").in("test_result_id", ids);
          const alreadyGraded = new Set(
            ((gradedRows || []) as any[]).map((r) => r.test_result_id).filter(Boolean),
          );
          for (const row of orphans) {
            if (alreadyQueued.has(row.id) || alreadyGraded.has(row.id)) continue;
            try {
              const rebuilt = await buildWritingPayloadFromDb(admin, row);
              if (!rebuilt) continue;
              if (await enqueueRow(row, rebuilt.payload)) rebuiltEnqueued++;
            } catch (e: any) {
              console.error(`[sweep-writing] rebuild ${row.id} failed:`, e?.message || e);
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[sweep-writing] orphan branch failed:", e?.message || e);
    }

    console.log(
      `[sweep-writing] enqueued ${enqueued}/${candidates.length}, rebuilt ${rebuiltEnqueued}/${orphanCount}`,
    );
    return new Response(
      JSON.stringify({
        enqueued,
        candidates: candidates.length,
        rebuilt: rebuiltEnqueued,
        orphans: orphanCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e: any) {
    console.error("[sweep-writing] unexpected error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
