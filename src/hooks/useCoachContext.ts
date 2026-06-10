import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCoachExamContext, type CoachExamContext } from "@/stores/coachStore";

export type DashboardStats = {
  weakestSkill?: string;
  accuracyBySkill?: Record<string, number>;
  totalQuestions?: number;
  streak?: number;
  recentLevel?: string;
};

export type CoachContext = {
  pathname: string;
  pageTitle?: string;
  skill?: string;
  exam?: CoachExamContext | null;
  dashboard?: DashboardStats;
};

const SKILL_MAP: Record<string, { skill: string; title: string }> = {
  "/grammar": { skill: "Grammar & Vocabulary", title: "Luyện Grammar & Vocabulary" },
  "/reading": { skill: "Reading", title: "Luyện Reading" },
  "/listening": { skill: "Listening", title: "Luyện Listening" },
  "/speaking": { skill: "Speaking", title: "Luyện Speaking" },
  "/writing": { skill: "Writing", title: "Luyện Writing" },
  "/vocabulary": { skill: "Vocabulary", title: "Học từ vựng" },
  "/thi-thu": { skill: "Full Test", title: "Thi thử Aptis full test" },
  "/dashboard": { skill: "", title: "Dashboard học tập" },
  "/history": { skill: "", title: "Lịch sử học tập" },
  "/progress": { skill: "", title: "Tiến độ học tập" },
  "/course": { skill: "", title: "Khoá học" },
  "/": { skill: "", title: "Trang chủ Aptis Kỳ Tích" },
};

// Session-level cache so we don't refetch on every panel open
let dashboardCache: { userId: string; stats: DashboardStats; fetchedAt: number } | null = null;
const DASHBOARD_TTL = 5 * 60_000; // 5 min

async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  if (dashboardCache && dashboardCache.userId === userId && Date.now() - dashboardCache.fetchedAt < DASHBOARD_TTL) {
    return dashboardCache.stats;
  }
  const stats: DashboardStats = {};
  try {
    // Per-skill accuracy from exam_question_results (last 200)
    const { data: rows } = await supabase
      .from("exam_question_results")
      .select("skill, is_correct")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (rows && rows.length) {
      const agg: Record<string, { c: number; t: number }> = {};
      for (const r of rows) {
        const s = (r.skill || "other").toLowerCase();
        if (!agg[s]) agg[s] = { c: 0, t: 0 };
        agg[s].t++;
        if (r.is_correct) agg[s].c++;
      }
      const acc: Record<string, number> = {};
      let weakest = "";
      let weakestPct = 101;
      for (const [k, v] of Object.entries(agg)) {
        const pct = Math.round((v.c / Math.max(1, v.t)) * 100);
        acc[k] = pct;
        if (v.t >= 5 && pct < weakestPct) {
          weakest = k;
          weakestPct = pct;
        }
      }
      stats.accuracyBySkill = acc;
      stats.totalQuestions = rows.length;
      if (weakest) stats.weakestSkill = weakest;
    }
    // Streak
    const { data: streak } = await supabase
      .from("learning_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle();
    if (streak?.current_streak != null) stats.streak = streak.current_streak;
    // Most recent overall level
    const { data: g } = await supabase
      .from("exam_gradings")
      .select("overall_level, skill")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (g?.[0]?.overall_level) stats.recentLevel = g[0].overall_level;
  } catch {/* swallow */}
  dashboardCache = { userId, stats, fetchedAt: Date.now() };
  return stats;
}

export function clearCoachDashboardCache() {
  dashboardCache = null;
}

export function useCoachContext(): CoachContext {
  const loc = useLocation();
  const path = loc.pathname;
  const exam = useCoachExamContext();
  const [dashboard, setDashboard] = useState<DashboardStats | undefined>(dashboardCache?.stats);

  let match = SKILL_MAP[path];
  if (!match) {
    const key = Object.keys(SKILL_MAP).find((k) => k !== "/" && path.startsWith(k));
    if (key) match = SKILL_MAP[key];
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancel) return;
      const s = await fetchDashboardStats(user.id);
      if (!cancel) setDashboard(s);
    })();
    return () => { cancel = true; };
  }, [path]);

  return {
    pathname: path,
    pageTitle: match?.title,
    skill: exam?.skill || match?.skill || undefined,
    exam: exam || undefined,
    dashboard,
  };
}

export function getSuggestedPrompts(ctx: CoachContext): string[] {
  // If user is in the middle of a question, suggest contextual prompts first
  if (ctx.exam?.questionText) {
    return [
      "Giải thích câu này giúp mình",
      "Tại sao đáp án đúng lại là đáp án đó?",
      "Cho ví dụ tương tự khác",
      "Mẹo nhận biết dạng câu này",
    ];
  }
  const s = ctx.skill?.toLowerCase() || "";
  if (s.includes("grammar")) return [
    "Mẹo làm Grammar Part 1 nhanh và chính xác",
    "Phân biệt thì hiện tại hoàn thành và quá khứ đơn",
    "Cách đoán nghĩa từ vựng khi không biết từ",
    "Lộ trình ôn Grammar trong 2 tuần",
  ];
  if (s.includes("reading")) return [
    "Chiến thuật làm Reading Part 4 (matching headings)",
    "Cách quản lý thời gian Reading 35 phút",
    "Mẹo skim & scan hiệu quả",
    "Từ nối thường gặp trong Reading",
  ];
  if (s.includes("listening")) return [
    "Mẹo nghe Listening Part 3 (conversation)",
    "Cách luyện nghe khi mất gốc",
    "Bẫy thường gặp trong Listening Aptis",
    "Làm sao nghe được lần đầu tiên?",
  ];
  if (s.includes("speaking")) return [
    "Cấu trúc trả lời Speaking Part 2",
    "Mẫu câu mở đầu cho Speaking Part 4",
    "Cách khắc phục pause khi nói",
    "Từ nối nâng band Speaking",
  ];
  if (s.includes("writing")) return [
    "Cấu trúc email Writing Part 2 (50 từ)",
    "Cách viết Writing Part 4 đạt B2 trở lên",
    "Cụm từ formal vs informal",
    "Sửa lỗi ngữ pháp thường gặp",
  ];
  if (s.includes("full test")) return [
    "Chiến thuật phân bổ thời gian full test",
    "Nên làm phần nào trước trong Aptis?",
    "Cách giữ tâm lý ổn định khi thi",
    "Mẹo tránh mất điểm oan",
  ];
  if (s.includes("vocabulary")) return [
    "Phương pháp 3R học từ vựng",
    "Bao nhiêu từ/ngày là hợp lý?",
    "Cách ôn từ vựng không quên",
    "Từ vựng nào hay xuất hiện trong Aptis?",
  ];
  // If dashboard says weakest skill, prioritise personalised prompts
  if (ctx.dashboard?.weakestSkill) {
    return [
      `Tôi đang yếu ${ctx.dashboard.weakestSkill}, gợi ý lộ trình giúp tôi`,
      "Phân tích điểm mạnh/yếu của tôi dựa vào lịch sử học",
      "Tôi nên ôn gì trong tuần tới?",
      "Cấu trúc đề thi Aptis General gồm những gì?",
    ];
  }
  return [
    "Cấu trúc đề thi Aptis General gồm những gì?",
    "Lộ trình ôn Aptis trong 1 tháng",
    "Aptis bao nhiêu điểm thì đạt B2?",
    "Nên bắt đầu luyện kỹ năng nào trước?",
  ];
}
