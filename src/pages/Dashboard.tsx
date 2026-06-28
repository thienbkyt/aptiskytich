import { Link, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Flame, Target, TrendingUp, BookOpen, ArrowRight,
  BarChart3, CheckCircle2, Calendar, Zap, History,
  GraduationCap, Sparkles, Mic, Crown,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import ProgressChart from "@/components/dashboard/ProgressChart";
import AnimatedGrid from "@/components/ui/animated-grid";
import GradientText from "@/components/ui/gradient-text";
import GlowCard from "@/components/ui/glow-card";
import StatPill from "@/components/dashboard/StatPill";
import TierPill from "@/components/dashboard/TierPill";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import StreakRing from "@/components/dashboard/StreakRing";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { DashboardSkeleton } from "@/components/ui/tech-skeleton";
import { computeHistoryDisplay, SKILL_LABELS } from "@/lib/historyDisplay";
import { parseDateSafe, toTimeSafe } from "@/lib/safeDate";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06 } }),
};

interface RecentTest {
  id: string;
  dateTime: string;
  skill: string;
  skillLabel: string;
  partLabel: string;
  displayScore: string;
  displayBand: string;
}

interface DashboardData {
  displayName: string;
  streak: number;
  totalQuestions: number;
  accuracy: number;
  currentLevel: string;
  grammarPct: number;
  readingPct: number;
  listeningPct: number;
  speakingPct: number;
  writingPct: number;
  recentTests: RecentTest[];
  weeklyActivity: number[];
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const toVNDate = (date: Date) => new Date(date.getTime() + VN_OFFSET_MS);
const vnWeekdayIndex = (date: Date) => {
  const vn = toVNDate(date);
  const day = vn.getUTCDay();
  return day === 0 ? 6 : day - 1;
};
const vnDayKey = (date: Date) => {
  const vn = toVNDate(date);
  return `${vn.getUTCFullYear()}-${vn.getUTCMonth()}-${vn.getUTCDate()}`;
};
const formatDate = (iso: string) => {
  const d = parseDateSafe(iso) ?? new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const TIPS = [
  "Luyện nói 10 phút mỗi ngày hiệu quả hơn 1 tiếng cuối tuần.",
  "Đọc to câu trả lời Speaking để cải thiện phát âm tự nhiên.",
  "Mỗi ngày học 5 từ mới + 2 ví dụ — dễ nhớ hơn nhồi 30 từ.",
  "Làm bài Reading bấm giờ ngay từ đầu để quen áp lực thi thật.",
  "Sau mỗi bài, đọc lại explanation — đó mới là lúc bạn học.",
];

const LEVEL_GRAD: Record<string, string> = {
  A1: "from-slate-500 to-slate-700",
  A2: "from-info to-blue-700",
  B1: "from-warning to-orange-600",
  B2: "from-success to-emerald-700",
  C1: "from-accent to-primary",
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isPro, isPremium, tier, proUntil, loading: tierLoading } = useIsPro();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const tipOfDay = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const [profileRes, streakRes, testsRes, allResultsRes, speakingGradRes, writingGradRes, examGradRes] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("learning_streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
          supabase.from("test_results").select("id,score,total,level,created_at,skill_scores,review_snapshot,exam_set_id,full_test_session_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("test_results").select("skill_scores,created_at").eq("user_id", user.id),
          supabase.from("speaking_question_gradings").select("part_score,max_points").eq("user_id", user.id),
          supabase.from("writing_question_gradings").select("part_score,max_points").eq("user_id", user.id),
          supabase.from("exam_gradings").select("criteria").eq("user_id", user.id).eq("skill", "writing"),
        ]);

        if (cancelled) return;

        const displayName =
          profileRes.data?.display_name ||
          user.email?.split("@")[0] ||
          "bạn";

        const tests = testsRes.data || [];
        const allResults = allResultsRes.data || [];

        // Aggregate skill totals from test_results.skill_scores
        // accuracy only counts MCQ skills (grammar/reading/listening); speaking & writing are AI-graded
        const skillAgg: Record<string, { correct: number; total: number }> = {};
        let mcqCorrect = 0;
        let mcqTotal = 0;
        let grandTotal = 0;
        const MCQ_SKILLS = new Set(["grammar_vocab", "reading", "listening"]);
        allResults.forEach((row: any) => {
          const ss = row.skill_scores;
          if (!ss || typeof ss !== "object") return;
          const skill = ss.skill;
          const correct = Number(ss.correct) || 0;
          const total = Number(ss.total) || 0;
          if (!skill || total <= 0) return;
          if (!skillAgg[skill]) skillAgg[skill] = { correct: 0, total: 0 };
          skillAgg[skill].correct += correct;
          skillAgg[skill].total += total;
          grandTotal += total;
          if (MCQ_SKILLS.has(skill)) {
            mcqCorrect += correct;
            mcqTotal += total;
          }
        });

        const pctOf = (key: string) => {
          const a = skillAgg[key];
          return a && a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0;
        };
        const clampPct = (n: number) => Math.max(0, Math.min(100, n));

        // Speaking % from AI gradings
        let sCorrect = 0, sMax = 0;
        (speakingGradRes.data || []).forEach((r: any) => {
          sCorrect += Number(r.part_score) || 0;
          sMax += Number(r.max_points) || 0;
        });
        const speakingPct = sMax > 0 ? clampPct(Math.round((sCorrect / sMax) * 100)) : 0;

        // Writing % from AI: writing_question_gradings + exam_gradings(writing).criteria
        let wCorrect = 0, wMax = 0;
        (writingGradRes.data || []).forEach((r: any) => {
          wCorrect += Number(r.part_score) || 0;
          wMax += Number(r.max_points) || 0;
        });
        (examGradRes.data || []).forEach((r: any) => {
          const c = r.criteria;
          if (c && typeof c === "object") {
            wCorrect += Number((c as any).partScore) || 0;
            wMax += Number((c as any).maxPoints) || 0;
          }
        });
        const writingPct = wMax > 0 ? clampPct(Math.round((wCorrect / wMax) * 100)) : 0;

        const nowVN = toVNDate(new Date());
        const todayIdx = vnWeekdayIndex(new Date());
        const weekDayKeys: string[] = [];
        for (let i = 0; i < 7; i++) {
          const dayMs = nowVN.getTime() - (todayIdx - i) * 24 * 60 * 60 * 1000;
          const dvn = new Date(dayMs);
          weekDayKeys.push(`${dvn.getUTCFullYear()}-${dvn.getUTCMonth()}-${dvn.getUTCDate()}`);
        }
        const activeDayKeys = new Set<string>();
        allResults.forEach((row: any) => {
          const created = parseDateSafe(row.created_at);
          if (created && created.toISOString() >= weekAgo) {
            activeDayKeys.add(vnDayKey(created));
          }
        });
        const weeklyActivity = weekDayKeys.map((k) => (activeDayKeys.has(k) ? 1 : 0));

        // Build recent tests with proper skill/part labels + display score/band
        const recentRaw = tests as any[];
        const recentSetIds = Array.from(new Set(recentRaw.map((t) => t.exam_set_id).filter(Boolean)));
        const recentIds = recentRaw.map((t) => t.id);
        const setsMap: Record<string, { skill: string; part: string; title: string }> = {};
        const writingAggMap: Record<string, { sum: number; max: number }> = {};
        const speakingAggMap: Record<string, { sum: number; max: number }> = {};
        if (recentSetIds.length > 0 || recentIds.length > 0) {
          const [setsRes, wgRes, sgRes] = await Promise.all([
            recentSetIds.length > 0
              ? supabase.from("exam_sets").select("id,skill,part,title").in("id", recentSetIds)
              : Promise.resolve({ data: [] as any[] }),
            recentIds.length > 0
              ? supabase.from("writing_question_gradings").select("test_result_id,part_score,max_points").in("test_result_id", recentIds)
              : Promise.resolve({ data: [] as any[] }),
            recentIds.length > 0
              ? (supabase as any).from("speaking_question_gradings").select("test_result_id,part_score,max_points").in("test_result_id", recentIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          (setsRes.data || []).forEach((s: any) => {
            setsMap[s.id] = { skill: s.skill, part: s.part, title: s.title };
          });
          (wgRes.data || []).forEach((g: any) => {
            if (!g.test_result_id) return;
            const a = writingAggMap[g.test_result_id] || { sum: 0, max: 0 };
            a.sum += Number(g.part_score || 0);
            a.max += Number(g.max_points || 0);
            writingAggMap[g.test_result_id] = a;
          });
          (sgRes.data || []).forEach((g: any) => {
            if (!g.test_result_id) return;
            const a = speakingAggMap[g.test_result_id] || { sum: 0, max: 0 };
            a.sum += Number(g.part_score || 0);
            a.max += Number(g.max_points || 0);
            speakingAggMap[g.test_result_id] = a;
          });
        }

        const formatDateTime = (iso: string) => {
          const dt = parseDateSafe(iso) ?? new Date(0);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        };

        const recentTests: RecentTest[] = recentRaw.map((t) => {
          const setInfo = t.exam_set_id ? setsMap[t.exam_set_id] : undefined;
          const ss = (t.skill_scores || {}) as any;
          let skill = setInfo?.skill || ss.skill || "unknown";
          if (skill === "grammar_vocab") skill = "grammar";
          const disp = computeHistoryDisplay(
            { skill, score: t.score, total: t.total, level: t.level },
            t.review_snapshot,
            writingAggMap[t.id],
            speakingAggMap[t.id],
          );
          const skillLabel = SKILL_LABELS[skill] || (skill !== "unknown" ? skill : "Bài luyện");
          const partLabel = setInfo?.part ? `Part ${setInfo.part}` : (t.full_test_session_id ? "Full test" : "");
          return {
            id: t.id,
            dateTime: formatDateTime(t.created_at),
            skill,
            skillLabel,
            partLabel,
            displayScore: disp.displayScore,
            displayBand: disp.displayBand,
          };
        });

        setData({
          displayName,
          streak: streakRes.data?.current_streak ?? 0,
          totalQuestions: grandTotal,
          accuracy: mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0,
          currentLevel: tests[0]?.level || "—",
          grammarPct:   pctOf("grammar_vocab"),
          readingPct:   pctOf("reading"),
          listeningPct: pctOf("listening"),
          speakingPct,
          writingPct,
          recentTests,
          weeklyActivity,
        });

      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardSkeleton />
      </div>
    );
  }

  const d = data;
  const todayIdx = vnWeekdayIndex(new Date());
  const practicedToday = d.weeklyActivity[todayIdx] > 0;
  const atRisk = !practicedToday && d.streak > 0;
  const weekDoneCount = d.weeklyActivity.filter(Boolean).length;
  const weekPct = Math.round((weekDoneCount / 7) * 100);

  const skills = [
    { label: "Grammar & Vocab", pct: d.grammarPct, from: "from-primary",   to: "to-[#ff6b4a]" },
    { label: "Reading",         pct: d.readingPct, from: "from-info",      to: "to-blue-400" },
    { label: "Listening",       pct: d.listeningPct, from: "from-warning",  to: "to-yellow-300" },
    { label: "Speaking",        pct: d.speakingPct, from: "from-accent",    to: "to-pink-400" },
    { label: "Writing",         pct: d.writingPct, from: "from-success",   to: "to-emerald-300" },
  ];
  const weakest = skills.reduce((min, s) => (s.pct < min.pct ? s : min), skills[0]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container space-y-6">

          {/* HERO */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-6 md:p-8"
          >
            <AnimatedGrid />
            <ParticlesBackground count={28} />
            <GradientOrb tone="red" size={300} className="-top-20 -right-20" />
            <GradientOrb tone="orange" size={260} className="-bottom-20 -left-20" />
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold mb-3">
                    <Sparkles className="w-3 h-3" /> Dashboard
                  </div>
                  <h1 className="text-3xl md:text-4xl font-heading font-extrabold leading-tight">
                    Xin chào,{" "}
                    <GradientText>{d.displayName}</GradientText> 👋
                  </h1>
                  <p className="text-muted-foreground mt-2 text-sm md:text-base">
                    Bạn đang ở band <strong className="text-foreground">{d.currentLevel}</strong>
                    {d.streak > 0 && <> · Streak <strong className="text-primary">{d.streak} ngày</strong> 🔥</>}
                    {" "}— hôm nay luyện tiếp nhé!
                  </p>
                </div>
                <Button asChild variant="glow" size="lg" className="shrink-0">
                  <Link to="/thi-thu">
                    <Zap className="w-4 h-4 mr-2" /> Thi thử ngay
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatPill icon={Flame} label="Chuỗi ngày" value={`${d.streak} ngày`} accent="red" />
                <StatPill icon={CheckCircle2} label="Câu đã làm" value={d.totalQuestions} accent="orange" />
                <StatPill icon={Target} label="Chính xác" value={`${d.accuracy}%`} accent="success" />
                <StatPill icon={TrendingUp} label="Trình độ" value={d.currentLevel} accent="violet" />
                <TierPill tier={tier} isPremium={isPremium} isPro={isPro} proUntil={proUntil} />
              </div>
            </div>
          </motion.div>

          {/* UPGRADE BANNER (free only) */}
          {!isPro && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-[#CC1C01]/30 bg-gradient-to-r from-[#CC1C01]/10 via-[#FEAD5F]/10 to-transparent p-4 md:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-extrabold text-foreground text-base md:text-lg leading-tight">
                    Nâng cấp Pro — mở toàn bộ kho đề + chấm AI không giới hạn
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    Học không giới hạn Speaking/Writing AI, full đề thi thử & luyện theo kỹ năng.
                  </p>
                </div>
                <Button
                  asChild
                  className="shrink-0 bg-[#CC1C01] hover:bg-[#4D0D0D] text-white font-bold gap-1.5"
                >
                  <Link to="/pricing">
                    <Crown className="w-4 h-4" /> Nâng cấp Pro
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}






          {/* MAIN GRID */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* LEFT (2 cols) */}
            <div className="lg:col-span-2 space-y-6">

              {/* STREAK COMMAND CENTER */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard
                  spotlight
                  className={`p-6 ${atRisk ? "border-primary/60 shadow-glow-red" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row gap-6 items-center">
                    <div className="shrink-0">
                      <StreakRing value={weekPct} label={`${weekDoneCount}/7`} sublabel="Tuần này" />
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <Flame className={`w-6 h-6 ${atRisk ? "text-primary animate-pulse" : "text-primary"}`} />
                        <h2 className="font-heading font-extrabold text-lg text-foreground">
                          {atRisk ? `Sắp mất chuỗi ${d.streak} ngày!` : `Chuỗi ${d.streak} ngày`}
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {atRisk
                          ? "Luyện 1 bài hôm nay là đủ để giữ streak."
                          : practicedToday
                            ? "Tuyệt vời! Hôm nay bạn đã luyện tập."
                            : "Tiếp tục học hôm nay để duy trì streak."}
                      </p>
                      <div className="flex gap-1.5">
                        {["T2","T3","T4","T5","T6","T7","CN"].map((day, i) => {
                          const done = d.weeklyActivity[i] > 0;
                          const isToday = i === todayIdx;
                          return (
                            <div key={day} className="flex-1 flex flex-col items-center gap-1">
                              <div className="text-[10px] text-muted-foreground">{day}</div>
                              <div className={`w-full h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                                done
                                  ? "bg-gradient-to-br from-primary to-[#ff6b4a] text-primary-foreground shadow-glow-soft"
                                  : isToday
                                    ? "bg-primary/15 border border-primary/50 text-primary animate-glow-pulse"
                                    : "bg-muted/40 text-muted-foreground/60"
                              }`}>
                                {done ? "✓" : isToday ? "•" : "·"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {atRisk && (
                        <Button asChild variant="glow" size="sm" className="mt-4 w-full sm:w-auto">
                          <Link to="/grammar">Luyện ngay <ArrowRight className="w-3 h-3 ml-1" /></Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </GlowCard>
              </motion.div>

              {/* SKILL PROGRESS */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard className="p-6">
                  <h2 className="font-heading font-bold text-foreground mb-5 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Tiến bộ theo kỹ năng
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                    {skills.map((s) => (
                      <div key={s.label}>
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-sm text-foreground font-medium">{s.label}</span>
                          <span className="text-lg font-heading font-extrabold text-foreground">{s.pct}<span className="text-xs text-muted-foreground">%</span></span>
                        </div>
                        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.pct}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className={`h-full bg-gradient-to-r ${s.from} ${s.to} rounded-full`}
                            style={{ boxShadow: "0 0 10px hsl(var(--primary) / 0.3)" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-border flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Kỹ năng yếu nhất: <strong className="text-foreground">{weakest.label}</strong> — nên luyện thêm!
                    </p>
                  </div>
                </GlowCard>
              </motion.div>

              {/* PROGRESS CHART */}
              <ProgressChart userId={user.id} />
            </div>

            {/* RIGHT (1 col) */}
            <div className="space-y-6">

              {/* RECENT RESULTS */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-heading font-bold text-foreground">Lịch sử học tập</h2>
                    <Link to="/history" className="text-xs font-bold text-primary hover:text-primary-glow inline-flex items-center gap-1">
                      Tất cả <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  {d.recentTests.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-3">
                        <BookOpen className="w-7 h-7 text-primary" />
                      </div>
                      <p className="text-sm text-foreground font-medium mb-1">Chưa có kết quả</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Làm bài thi thử đầu tiên để đo trình độ.
                      </p>
                      <Button asChild variant="glow" size="sm" className="w-full">
                        <Link to="/thi-thu">Thi thử miễn phí <ArrowRight className="w-3 h-3 ml-1" /></Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {d.recentTests.map((t, i) => {
                        const grad = LEVEL_GRAD[t.displayBand] || "from-muted to-muted";
                        return (
                          <Link
                            to={`/history/${t.id}?review=1`}
                            key={t.id || i}
                            className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/40 hover:bg-muted/50 transition-all"
                          >
                            <div className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-extrabold shadow-md`}>
                              {t.displayBand}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">
                                {t.skillLabel}{t.partLabel ? ` · ${t.partLabel}` : ""}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" /> {t.dateTime}
                                <span className="text-muted-foreground/60">·</span>
                                <span className="font-semibold text-foreground/80">{t.displayScore}</span>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </GlowCard>
              </motion.div>

              {/* CONTINUE CTA */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard className="p-6 overflow-hidden relative" spotlight>
                  <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                  <div className="relative">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[#7a0f00] text-primary-foreground mb-3 shadow-glow-soft">
                      <Mic className="w-5 h-5" />
                    </div>
                    <h2 className="font-heading font-extrabold text-foreground mb-1">Tăng tốc Speaking</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      AI Kỳ Tích chấm + feedback chi tiết. Chỉ 12 phút mỗi ngày.
                    </p>
                    <Button asChild variant="glow" size="sm" className="w-full">
                      <Link to="/speaking">Luyện Speaking <ArrowRight className="w-3 h-3 ml-1" /></Link>
                    </Button>
                  </div>
                </GlowCard>
              </motion.div>

              {/* TIP CARD */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard className="p-5 border-accent/30">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-accent font-bold mb-1">Mẹo hôm nay</div>
                      <p className="text-sm text-foreground leading-relaxed">{tipOfDay}</p>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
