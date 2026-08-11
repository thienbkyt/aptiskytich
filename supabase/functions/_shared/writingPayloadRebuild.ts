// Shared: rebuild a writing_v2 grading payload from what is already persisted
// in the database (exam_sets.part + exam_questions + exam_question_results).
// Used by `rebuild-writing-grade` (student-triggered "Chấm ngay") and by
// `sweep-ungraded-writing` (rescue sweeper for attempts whose client died
// before it could write grade_payload).

export type WritingTaskType = "task1" | "task2" | "task3" | "task4";

export const taskFromPart = (part: string): WritingTaskType | null => {
  const match = String(part || "").match(/([1-4])/);
  return match ? (`task${match[1]}` as WritingTaskType) : null;
};

const parseAnswers = (raw: string): string[] =>
  [...raw.matchAll(/A:\s*([\s\S]*?)(?=\n\s*\nQ\d+:|$)/g)].map((m) => m[1].trim());

export type RebuiltWritingPayload = {
  partType: WritingTaskType;
  payload: Record<string, unknown>;
  gradingSessionId: string;
};

/**
 * Returns null when the attempt cannot be rebuilt (no answer text, no
 * questions, or a part that is not writing task1..task4).
 */
export async function buildWritingPayloadFromDb(
  admin: any,
  result: { id: string; exam_set_id: string | null; full_test_session_id?: string | null },
): Promise<RebuiltWritingPayload | null> {
  if (!result.exam_set_id) return null;

  const [{ data: setRow }, { data: questionRows }, { data: answerRows }] = await Promise.all([
    admin.from("exam_sets").select("part").eq("id", result.exam_set_id).maybeSingle(),
    admin.from("exam_questions").select("id,order_index,question_text,extra_data")
      .eq("exam_set_id", result.exam_set_id).order("order_index", { ascending: true }),
    admin.from("exam_question_results").select("exam_question_id,user_answer")
      .eq("test_result_id", result.id).order("created_at", { ascending: true }),
  ]);

  const partType = taskFromPart(String(setRow?.part ?? ""));
  const raw = String(
    (answerRows ?? []).find((row: any) => String(row.user_answer ?? "").trim())?.user_answer ?? "",
  );
  if (!partType || !raw.trim() || !questionRows?.length) return null;

  const first = questionRows[0] as Record<string, unknown> | undefined;
  const extra = (first?.extra_data ?? {}) as Record<string, any>;
  let questions = questionRows.map((row: any) => String(row.question_text ?? "")).filter(Boolean);
  if (partType === "task2") {
    questions = [
      String(extra.instruction ?? first?.question_text ?? ""),
      String(extra.question ?? ""),
    ].filter(Boolean);
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
  return {
    partType,
    gradingSessionId,
    payload: { type: "writing_v2", partType, questions, text: raw, parts, gradingSessionId },
  };
}
