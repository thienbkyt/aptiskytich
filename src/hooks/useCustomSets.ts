import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CustomSetMode = "full_test" | "full_part";

export interface CustomSetRow {
  id: string;
  user_id: string;
  title: string;
  mode: CustomSetMode;
  skill: string | null;
  created_at: string;
  last_played_at: string | null;
  memberCount: number;
}

export const SKILL_LABELS_VI: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  grammar_vocab: "Grammar & Vocabulary",
};

/** Số part bắt buộc cho mỗi kỹ năng (giống kiểm tra ở server). */
export const REQUIRED_PARTS: Record<string, number> = {
  reading: 4,
  listening: 4,
  writing: 4,
  speaking: 4,
  grammar_vocab: 6,
};

/** Thời lượng ước tính (giây) theo kỹ năng. */
export const SKILL_EST_SECONDS: Record<string, number> = {
  speaking: 720,
  listening: 2400,
  grammar_vocab: 1500,
  reading: 2100,
  writing: 3000,
};

export const useCustomSets = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !authLoading && !!user;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customSets", user?.id],
    enabled,
    queryFn: async (): Promise<CustomSetRow[]> => {
      const { data: sets } = await supabase
        .from("custom_sets")
        .select("id, user_id, title, mode, skill, created_at, last_played_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const ids = (sets || []).map((s) => s.id);
      let counts = new Map<string, number>();
      if (ids.length) {
        const { data: members } = await supabase
          .from("custom_set_members")
          .select("custom_set_id")
          .in("custom_set_id", ids);
        (members || []).forEach((m: any) => {
          counts.set(m.custom_set_id, (counts.get(m.custom_set_id) ?? 0) + 1);
        });
      }
      return (sets || []).map((s: any) => ({
        ...s,
        mode: s.mode as CustomSetMode,
        memberCount: counts.get(s.id) ?? 0,
      }));
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["customSets", user?.id] });

  return { sets: data ?? [], loading: enabled ? isLoading : authLoading, refetch, invalidate };
};

/**
 * Tập id các bộ đề tự tạo mà người dùng ĐÃ làm ít nhất một lần.
 * Lấy từ test_results.skill_scores->>'customSetId' (không đổi schema).
 */
export const useCustomSetPlays = () => {
  const { user, loading: authLoading } = useAuth();
  const enabled = !authLoading && !!user;

  const { data } = useQuery({
    queryKey: ["customSetPlays", user?.id],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data } = await supabase
        .from("test_results")
        .select("skill_scores")
        .eq("user_id", user!.id)
        .not("skill_scores->>customSetId", "is", null);
      const out = new Set<string>();
      (data || []).forEach((r: any) => {
        const id = r?.skill_scores?.customSetId;
        if (typeof id === "string" && id) out.add(id);
      });
      return out;
    },
  });

  return { playedIds: data ?? new Set<string>() };
};

/** Xoá bộ đề. Trả về true nếu thực sự có dòng bị xoá (RLS có thể chặn im lặng). */
export const deleteCustomSet = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("custom_sets")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
};

export const touchCustomSetPlayed = async (id: string) => {
  await supabase
    .from("custom_sets")
    .update({ last_played_at: new Date().toISOString() })
    .eq("id", id);
};

export const fetchCustomSetMemberIds = async (id: string): Promise<string[]> => {
  const { data } = await supabase
    .from("custom_set_members")
    .select("exam_set_id, position")
    .eq("custom_set_id", id)
    .order("position", { ascending: true });
  return (data || []).map((m: any) => m.exam_set_id);
};

/** Thông báo lỗi tiếng Việt theo `reason` trả về từ RPC create_custom_set. */
export const CUSTOM_SET_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Bạn cần đăng nhập để tạo bộ đề",
  bad_mode: "Loại bộ đề không hợp lệ",
  bad_skill: "Kỹ năng không hợp lệ",
  empty: "Bạn chưa chọn đề nào",
  pro_only: "Tạo bộ đề là tính năng dành cho tài khoản Pro",
  invalid_sets: "Có đề không tồn tại hoặc chưa được phát hành",
  duplicate_part: "Mỗi part chỉ được chọn 1 đề",
  wrong_skill: "Có đề không thuộc kỹ năng đã chọn",
  tier_locked: "Bộ này có đề dành cho tài khoản Pro",
};

export interface CreateCustomSetResult {
  ok: boolean;
  id?: string;
  reason?: string;
  missing?: string[];
}

export const createCustomSet = async (args: {
  title: string;
  mode: CustomSetMode;
  skill: string | null;
  examSetIds: string[];
}): Promise<CreateCustomSetResult> => {
  const { data, error } = await supabase.rpc("create_custom_set", {
    p_title: args.title,
    p_mode: args.mode,
    p_skill: args.skill,
    p_exam_set_ids: args.examSetIds,
  });
  if (error) return { ok: false, reason: error.message };
  return (data as unknown as CreateCustomSetResult) ?? { ok: false, reason: "unknown" };
};

/** Sửa bộ đề: cập nhật tên + thay toàn bộ đề thành viên. */
export const updateCustomSet = async (args: {
  id: string;
  title: string;
  examSetIds: string[];
}) => {
  const { error: upErr } = await supabase
    .from("custom_sets")
    .update({ title: args.title })
    .eq("id", args.id);
  if (upErr) throw upErr;

  const { error: delErr } = await supabase
    .from("custom_set_members")
    .delete()
    .eq("custom_set_id", args.id);
  if (delErr) throw delErr;

  const rows = args.examSetIds.map((exam_set_id, position) => ({
    custom_set_id: args.id,
    exam_set_id,
    position,
  }));
  const { error: insErr } = await supabase.from("custom_set_members").insert(rows);
  if (insErr) throw insErr;
};
