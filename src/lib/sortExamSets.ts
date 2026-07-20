/**
 * Shared sort rule for exam lists.
 * Priority groups:
 *   0 — FREE (access_tier === "free")
 *   1 — NEW (not free, but currently within new_until window / isNew=true)
 *   2 — everything else
 * Within a group: ascending by number in title ("Đề 01", "Đề 02"...);
 * ties break by title.
 */
export interface SortableExamItem {
  title: string;
  access_tier?: "free" | "pro" | "premium" | null;
  isNew?: boolean;
}

const numOf = (t: string) => {
  const m = (t || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
};

export const examSortGroup = (item: SortableExamItem): 0 | 1 | 2 => {
  if (item.access_tier === "free") return 0;
  if (item.isNew) return 1;
  return 2;
};

export const compareExamItems = (a: SortableExamItem, b: SortableExamItem): number => {
  const ga = examSortGroup(a);
  const gb = examSortGroup(b);
  if (ga !== gb) return ga - gb;
  const na = numOf(a.title);
  const nb = numOf(b.title);
  if (na !== nb) return na - nb;
  return (a.title || "").localeCompare(b.title || "");
};
