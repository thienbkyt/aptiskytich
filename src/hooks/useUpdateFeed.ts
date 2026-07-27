import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePart } from "@/hooks/useExamSets";

export type FeedKind = "exam" | "key";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  date: Date;
  /** filter bucket: "key" | "reading" | "listening" | "writing" | "speaking" | "grammar_vocab" */
  bucket: string;
  badge: string;
  title: string;
  subtitle: string;
  href: string;
}

const SKILL_LABEL: Record<string, string> = {
  reading: "READING",
  listening: "LISTENING",
  writing: "WRITING",
  speaking: "SPEAKING",
  grammar_vocab: "GRAMMAR & VOCAB",
};

const SKILL_PATH: Record<string, string> = {
  reading: "/reading",
  listening: "/listening",
  writing: "/writing",
  speaking: "/speaking",
  grammar_vocab: "/grammar",
};

/** "Part 2 - Text Cohesion" → { label: "Part 2", desc: "Text Cohesion" } */
const splitPart = (part: string) => {
  const [rawLabel, ...rest] = part.split(" - ");
  return { label: (rawLabel || part).trim(), desc: rest.join(" - ").trim() };
};

const tabIdFor = (skill: string, part: string) => {
  const p = normalizePart(part); // part1..part5
  if (skill === "writing") return p.replace("part", "task");
  return p;
};

export const formatVNDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export const relativeLabel = (d: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff <= 0) return "hôm nay";
  if (diff === 1) return "hôm qua";
  if (diff < 30) return `${diff} ngày trước`;
  return `ngày ${formatVNDate(d)}`;
};

export const isToday = (d: Date) => relativeLabel(d) === "hôm nay";

export function useUpdateFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["homepageUpdateFeed"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: rows, error } = await supabase.rpc("homepage_update_feed" as any, { p_limit: 200 });
      if (error) throw error;
      const items: FeedItem[] = [];
      (rows ?? []).forEach((r: any, i: number) => {
        const date = new Date(`${r.day}T00:00:00`);
        if (isNaN(date.getTime())) return;
        if (r.kind === "key") {
          items.push({
            id: `key-${r.key_id}`,
            kind: "key",
            date,
            bucket: "key",
            badge: "KEY DỰ ĐOÁN",
            title: `Key ngày ${formatVNDate(date)} đã có`,
            subtitle: `${r.item_count ?? 0} đề dự đoán · ${r.high_count ?? 0} đề ưu tiên cao`,
            href: `/key-du-doan?keyId=${r.key_id}`,
          });
          return;
        }
        const skill = String(r.skill ?? "");
        const part = String(r.part ?? "");
        const { label, desc } = splitPart(part);
        const path = SKILL_PATH[skill];
        if (!path) return;
        items.push({
          id: `exam-${r.day}-${skill}-${part}-${i}`,
          kind: "exam",
          date,
          bucket: skill,
          badge: SKILL_LABEL[skill] ?? skill.toUpperCase(),
          title: `Thêm ${r.cnt} đề ${label}`,
          subtitle: desc ? `${SKILL_LABEL[skill] ?? skill} · ${desc}` : SKILL_LABEL[skill] ?? skill,
          href: `${path}?tab=${tabIdFor(skill, part)}`,
        });
      });
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      return items;
    },
  });

  return { items: data ?? [], loading: isLoading };
}
