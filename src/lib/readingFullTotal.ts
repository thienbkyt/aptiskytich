import { supabase } from "@/integrations/supabase/client";
import { fetchExamQuestions, normalizePart } from "@/hooks/useExamSets";
import {
  toReadingPart1,
  toReadingPart2,
  toReadingPart3,
  toReadingPart4,
} from "@/lib/examTransformers";

/**
 * Compute T = total scored questions across ALL 4 Reading parts that belong to
 * the same full_test_id. Used so part-lẻ score scaling matches the per-part
 * breakdown shown in ReadingFullResults (mỗi câu = 50/T điểm).
 *
 * Returns null when full_test_id is missing or no sibling data is available;
 * caller should fall back to the part's own total in that case.
 */
export const computeReadingFullTotal = async (
  fullTestId: string | null | undefined,
): Promise<number | null> => {
  if (!fullTestId) return null;
  const { data, error } = await supabase
    .from("exam_sets")
    .select("id, part")
    .eq("skill", "reading")
    .eq("full_test_id", fullTestId)
    .eq("is_published", true);
  if (error || !data || data.length === 0) return null;

  let T = 0;
  for (const row of data) {
    const partType = normalizePart(row.part);
    const qs = await fetchExamQuestions(row.id);
    let total = 0;
    if (partType === "part1") {
      const q = toReadingPart1(qs);
      if (q) {
        const used = [...q.passage.matchAll(/\{(\d+)\}/g)]
          .map((m) => Number(m[1]))
          .filter((idx) => q.gaps[idx]);
        total = used.length;
      }
    } else if (partType === "part2") {
      const q = toReadingPart2(qs);
      if (q) {
        q.sections.forEach((sec, sIdx) => {
          sec.sentences.forEach((s) => {
            if (sIdx === 0 && s.correctPosition === 1) return;
            total += 1;
          });
        });
      }
    } else if (partType === "part3") {
      const q = toReadingPart3(qs);
      if (q) total = q.statements.length;
    } else if (partType === "part4") {
      const q = toReadingPart4(qs);
      if (q) total = q.paragraphs?.length || q.questions.length || 0;
    }
    T += total;
  }
  return T > 0 ? T : null;
};
