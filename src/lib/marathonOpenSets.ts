import { supabase } from "@/integrations/supabase/client";

/**
 * Marathon runs must record access for every exam_set they contain, otherwise
 * RLS on exam_questions / audio objects (which matches user_opened_items.item_key
 * against exam_set_id) blocks questions and audio.
 *
 * Reuses the existing quota-aware RPC `try_open_item` — one call per set, using a
 * stable item_key per skill+part so a marathon run consumes at most one quota slot.
 * Quota refusals are ignored on purpose: marathon quota is enforced separately by
 * useExamAccessGate before the engine starts, so this must never block practice.
 */
export async function recordMarathonOpenedSets(
  skill: string,
  part: string,
  setIds: string[],
): Promise<void> {
  const ids = Array.from(new Set(setIds.filter(Boolean)));
  if (ids.length === 0) return;
  const itemKey = `marathon:${skill}:${part}`;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await supabase.rpc("try_open_item", {
          p_feature: "marathon",
          p_item_key: itemKey,
          p_skill: null,
          p_set_ids: [id],
        } as any);
      } catch {
        /* ignore — never block the run */
      }
    }),
  );
}
