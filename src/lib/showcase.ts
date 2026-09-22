import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeStorage";

export type ShowcaseBand = "B1" | "B2" | "C";

export type ShowcaseCard = {
  id: string;
  band: ShowcaseBand;
  raw_part: number;
  display_name: string | null;
  created_at: string;
  preview: string | null;
};

export type ShowcaseBoardRow = ShowcaseCard & {
  skill: "writing" | "speaking";
  part_type: string;
  exam_set_id: string | null;
  exam_set_title: string | null;
  approved_at: string | null;
  total_count: number;
};

export type ShowcaseVocabItem = { word?: string; meaning?: string; example?: string };

export type ShowcaseDetail = {
  id: string;
  skill: "writing" | "speaking";
  part_type: string;
  band: ShowcaseBand;
  raw_part: number;
  display_name: string | null;
  content_text: string;
  question_texts: unknown;
  extraction: { vocabulary?: ShowcaseVocabItem[]; why_band?: string } | null;
  exam_set_id: string | null;
  exam_set_title: string | null;
  approved_at: string | null;
  created_at: string;
};

/** Band "đỉnh" đủ điều kiện lên Bảng Kỳ Tích (thang điểm thô /30). */
export function showcaseBandFor(raw: number | null | undefined): ShowcaseBand | null {
  const r = Number(raw);
  if (raw == null || !Number.isFinite(r)) return null;
  if (r >= 28) return "C";
  if (r >= 26 && r < 28) return "B2";
  if (r >= 21 && r < 23) return "B1";
  return null;
}

/** Band dùng để xem bài của người khác — dưới B1 thì xem bài B1. */
export function browseBandFor(raw: number | null | undefined): ShowcaseBand {
  const r = Number(raw);
  if (!Number.isFinite(r)) return "B1";
  if (r >= 28) return "C";
  if (r >= 26) return "B2";
  return "B1";
}

export function isShowcasePart(partType: string | null | undefined): boolean {
  if (!partType) return false;
  return /^task[2-4]$/.test(partType) || /^part[2-4]$/.test(partType);
}

export function showcasePartLabel(partType: string): string {
  const n = partType.replace(/^(task|part)/, "");
  return `Part ${n}`;
}

export function showcaseSkillLabel(skill: string): string {
  return skill === "speaking" ? "Speaking" : "Writing";
}

const LATER_KEY = "kt-showcase-later";

export function isShowcaseDismissed(testResultId: string, partType: string): boolean {
  return safeLocalStorage.getItem(`${LATER_KEY}:${testResultId}:${partType}`) === "1";
}

export function dismissShowcase(testResultId: string, partType: string) {
  safeLocalStorage.setItem(`${LATER_KEY}:${testResultId}:${partType}`, "1");
}

export function showcaseErrorMessage(err: unknown): string {
  const msg = String((err as any)?.message || (err as any)?.details || err || "");
  if (msg.includes("forbidden")) return "Bài này không thuộc tài khoản của bạn.";
  if (msg.includes("not_eligible")) return "Bài này chưa đạt mốc điểm đỉnh của band nên chưa lên bảng được.";
  if (msg.includes("already_submitted")) return "Bài này đã được gửi lên Bảng Kỳ Tích trước đó.";
  if (msg.includes("daily_limit")) return "Bạn đã gửi 3 bài trong 24 giờ qua, mai gửi tiếp nhé.";
  return "Chưa gửi được bài lên Bảng Kỳ Tích, bạn thử lại sau nhé.";
}

export async function consentShowcase(
  testResultId: string,
  partType: string,
  displayName: string | null,
): Promise<string> {
  const { data, error } = await (supabase as any).rpc("showcase_consent", {
    p_test_result_id: testResultId,
    p_part_type: partType,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data as string;
}

export type ShowcaseReviewOutcome =
  | { status: "approved" }
  | { status: "rejected"; reason: string }
  | { status: "pending" };

export async function reviewShowcaseEntry(entryId: string): Promise<ShowcaseReviewOutcome> {
  const { data, error } = await supabase.functions.invoke("showcase-review", {
    body: { entry_id: entryId },
  });
  if (error) return { status: "pending" };
  const status = (data as any)?.status;
  if (status === "approved") return { status: "approved" };
  if (status === "rejected") {
    return { status: "rejected", reason: String((data as any)?.reason || "") };
  }
  return { status: "pending" };
}

export async function fetchShowcaseBySet(
  examSetId: string,
  band: ShowcaseBand,
  seed: number,
  skill?: string | null,
  partType?: string | null,
): Promise<ShowcaseCard[]> {
  const { data, error } = await (supabase as any).rpc("get_showcase_by_set", {
    p_exam_set_id: examSetId,
    p_band: band,
    p_seed: seed,
    p_skill: skill ?? null,
    p_part_type: partType ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ShowcaseCard[];
}

export async function fetchShowcaseBandCounts(
  examSetId: string,
  skill: "writing" | "speaking",
  partType: string,
): Promise<Record<ShowcaseBand, number>> {
  const { data, error } = await (supabase as any).rpc("get_showcase_band_counts", {
    p_exam_set_id: examSetId,
    p_skill: skill,
    p_part_type: partType,
  });
  if (error) throw error;

  const counts: Record<ShowcaseBand, number> = { B1: 0, B2: 0, C: 0 };
  for (const row of data ?? []) {
    if (row.band === "B1" || row.band === "B2" || row.band === "C") {
      counts[row.band] = Number(row.n) || 0;
    }
  }
  return counts;
}

export async function fetchShowcaseExamTitle(examSetId: string): Promise<string> {
  const { data, error } = await (supabase as any)
    .from("exam_sets")
    .select("title")
    .eq("id", examSetId)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.title === "string" ? data.title : "";
}

export async function fetchShowcaseBoard(args: {
  skill?: string | null;
  partType?: string | null;
  band?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<ShowcaseBoardRow[]> {
  const { data, error } = await (supabase as any).rpc("get_showcase_board", {
    p_skill: args.skill ?? null,
    p_part_type: args.partType ?? null,
    p_band: args.band ?? null,
    p_search: args.search ?? null,
    p_limit: args.limit ?? 20,
    p_offset: args.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as ShowcaseBoardRow[];
}

export async function fetchShowcaseDetail(id: string): Promise<ShowcaseDetail | null> {
  const { data, error } = await (supabase as any).rpc("get_showcase_detail", { p_id: id });
  if (error) throw error;
  const rows = (data ?? []) as ShowcaseDetail[];
  return rows[0] ?? null;
}

export function showcaseQuestionList(q: unknown): string[] {
  if (Array.isArray(q)) return q.filter((x) => typeof x === "string" && x.trim()) as string[];
  return [];
}

/* ---------- Rút bài khỏi bảng (chủ bài) ---------- */

export type MyShowcaseEntry = {
  id: string;
  test_result_id: string;
  part_type: string;
  skill: string;
  band: string;
  status: string;
};

/** Các bài của chính user đang hiển thị trên bảng (approved). */
export async function fetchMyShowcaseEntries(): Promise<MyShowcaseEntry[]> {
  const { data, error } = await (supabase as any)
    .from("showcase_entries")
    .select("id,test_result_id,part_type,skill,band,status")
    .eq("status", "approved");
  if (error) throw error;
  return (data ?? []) as MyShowcaseEntry[];
}

export async function withdrawShowcase(entryId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("showcase_withdraw", { p_entry_id: entryId });
  if (error) throw error;
}
