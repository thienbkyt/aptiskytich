import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { vnTodayRangeUTC } from "@/lib/vnDate";

export interface UserGoal {
  user_id: string;
  exam_date: string;
  aim: "B1" | "B2" | "C";
  daily_target: number;
}

export function useUserGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const goalQuery = useQuery({
    queryKey: ["user-goal", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_goals")
        .select("user_id,exam_date,aim,daily_target")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UserGoal | null) ?? null;
    },
  });

  // Gate: the student must have completed at least one full test first.
  const fullTestQuery = useQuery({
    queryKey: ["user-has-full-test", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("test_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .not("full_test_session_id", "is", null)
        .is("skill_scores->>fullPartSession", null);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const todayQuery = useQuery({
    queryKey: ["user-tests-today", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { startISO, endISO } = vnTodayRangeUTC();
      const { data, error } = await supabase
        .from("test_results")
        .select("id, full_test_session_id, skill_scores")
        .eq("user_id", user!.id)
        .gte("created_at", startISO)
        .lt("created_at", endISO);
      if (error) throw error;
      const seen = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.skill_scores?.mode === "marathon") return;
        if (row.full_test_session_id && row.skill_scores?.fullPartSession == null) {
          seen.add(row.full_test_session_id);
        } else {
          seen.add(row.id);
        }
      });
      return seen.size;
    },
  });

  const saveGoal = async (input: { exam_date: string; aim: string; daily_target: number }) => {
    if (!user) throw new Error("not signed in");
    const { error } = await (supabase as any)
      .from("user_goals")
      .upsert({ user_id: user.id, ...input, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["user-goal"] });
  };

  return {
    goal: goalQuery.data ?? null,
    hasFullTest: !!fullTestQuery.data,
    todayCount: todayQuery.data ?? 0,
    loading: goalQuery.isLoading || fullTestQuery.isLoading || todayQuery.isLoading,
    saveGoal,
  };
}
