import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Flame, Target, TrendingUp, BookOpen, ArrowRight,
  BarChart3, CheckCircle2, Calendar, Zap, History
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProgressChart from "@/components/dashboard/ProgressChart";


const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } }),
};

interface RecentTest {
  date: string;
  score: number;
  total: number;
  level: string;
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

// Vietnam timezone offset: UTC+7
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Convert any Date to a "Vietnam wall-clock" Date (values reflect VN local time when read in UTC)
const toVNDate = (date: Date) => new Date(date.getTime() + VN_OFFSET_MS);

// Returns 0..6 where 0 = Monday ... 6 = Sunday, based on Vietnam local time
const vnWeekdayIndex = (date: Date) => {
  const vn = toVNDate(date);
  const day = vn.getUTCDay(); // 0=Sun ... 6=Sat in VN local
  return day === 0 ? 6 : day - 1;
};

// YYYY-MM-DD key for a date in Vietnam local time
const vnDayKey = (date: Date) => {
  const vn = toVNDate(date);
  return `${vn.getUTCFullYear()}-${vn.getUTCMonth()}-${vn.getUTCDate()}`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const calcAccuracy = (rows: { is_correct: boolean }[]) => {
  if (!rows.length) return 0;
  const correct = rows.filter((r) => r.is_correct).length;
  return Math.round((correct / rows.length) * 100);
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Only need a week of practice_history rows for weekday activity dots.
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        const headCount = (skill?: string, correctOnly = false) => {
          let q = supabase
            .from("practice_history")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
          if (skill) q = q.eq("skill", skill);
          if (correctOnly) q = q.eq("is_correct", true);
          return q;
        };

        const [
          profileRes, streakRes, weekRes, testsRes,
          totalRes, correctRes,
          gT, gC, rT, rC, lT, lC, sT, sC, wT, wC,
        ] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("learning_streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
          supabase.from("practice_history").select("created_at").eq("user_id", user.id).gte("created_at", weekAgo),
          supabase.from("test_results").select("score,total,level,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
          headCount(), headCount(undefined, true),
          headCount("grammar"),   headCount("grammar", true),
          headCount("reading"),   headCount("reading", true),
          headCount("listening"), headCount("listening", true),
          headCount("speaking"),  headCount("speaking", true),
          headCount("writing"),   headCount("writing", true),
        ]);

        if (cancelled) return;

        const displayName =
          profileRes.data?.display_name ||
          user.email?.split("@")[0] ||
          "bạn";

        const tests = testsRes.data || [];

        // Weekly activity (Mon -> Sun) in Vietnam timezone
        const nowVN = toVNDate(new Date());
        const todayIdx = vnWeekdayIndex(new Date());
        const weekDayKeys: string[] = [];
        for (let i = 0; i < 7; i++) {
          const dayMs = nowVN.getTime() - (todayIdx - i) * 24 * 60 * 60 * 1000;
          const dvn = new Date(dayMs);
          weekDayKeys.push(`${dvn.getUTCFullYear()}-${dvn.getUTCMonth()}-${dvn.getUTCDate()}`);
        }
        const activeDayKeys = new Set<string>();
        (weekRes.data || []).forEach((row) => activeDayKeys.add(vnDayKey(new Date(row.created_at))));
        const weeklyActivity = weekDayKeys.map((k) => (activeDayKeys.has(k) ? 1 : 0));

        const pct = (correct: number | null, total: number | null) =>
          total && total > 0 ? Math.round(((correct ?? 0) / total) * 100) : 0;

        const recentTests: RecentTest[] = tests.map((t) => ({
          date: formatDate(t.created_at),
          score: t.score,
          total: t.total,
          level: t.level,
        }));

        setData({
          displayName,
          streak: streakRes.data?.current_streak ?? 0,
          totalQuestions: totalRes.count ?? 0,
          accuracy: pct(correctRes.count, totalRes.count),
          currentLevel: tests[0]?.level || "—",
          grammarPct:   pct(gC.count, gT.count),
          readingPct:   pct(rC.count, rT.count),
          listeningPct: pct(lC.count, lT.count),
          speakingPct:  pct(sC.count, sT.count),
          writingPct:   pct(wC.count, wT.count),
          recentTests,
          weeklyActivity,
        });

      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96 mb-8" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96 mb-8" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container">
          <motion.div initial="hidden" animate="visible" className="mb-8">
            <motion.h1 variants={fadeUp} custom={0} className="text-2xl md:text-3xl font-heading font-extrabold text-foreground mb-1">
              Xin chào, {d.displayName}! 👋
            </motion.h1>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
              Tiếp tục luyện tập để đạt mục tiêu Aptis của bạn.
            </motion.p>
          </motion.div>

          {/* Top stats */}
          <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[
              { icon: Flame, label: "Chuỗi ngày", value: `${d.streak} ngày`, accent: "text-primary" },
              { icon: CheckCircle2, label: "Tổng câu hỏi", value: d.totalQuestions.toString(), accent: "text-primary" },
              { icon: Target, label: "Độ chính xác", value: `${d.accuracy}%`, accent: "text-success" },
              { icon: TrendingUp, label: "Trình độ", value: d.currentLevel, accent: "text-info" },
            ].map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i + 2} className="glass-card p-6">
                <s.icon className={`w-6 h-6 ${s.accent} mb-3`} />
                <div className="text-2xl font-heading font-extrabold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="space-y-6">
            {/* Main content */}
            <div className="space-y-6">
              {/* Streak motivation */}
              {(() => {
                const todayIdx = vnWeekdayIndex(new Date());
                const practicedToday = d.weeklyActivity[todayIdx] > 0;
                const atRisk = !practicedToday && d.streak > 0;
                return (
                  <motion.div
                    variants={fadeUp}
                    custom={6}
                    initial="hidden"
                    animate="visible"
                    className={`glass-card p-6 ${atRisk ? "border-2 border-primary/60 bg-primary/5" : "border-primary/20"}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Flame className={`w-8 h-8 ${atRisk ? "text-primary animate-pulse" : "text-primary streak-fire"}`} />
                      <div className="flex-1">
                        <h3 className="font-heading font-bold text-foreground">
                          {atRisk ? `⚠️ Sắp mất chuỗi ${d.streak} ngày!` : `Chuỗi ${d.streak} ngày! 🔥`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {atRisk
                            ? "Luyện tập ngay hôm nay để giữ streak — chỉ cần 1 bài là đủ."
                            : practicedToday
                              ? "Hôm nay bạn đã luyện tập — tuyệt vời!"
                              : "Tiếp tục học hôm nay để duy trì streak!"}
                        </p>
                      </div>
                      {atRisk && (
                        <Link
                          to="/practice"
                          className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                        >
                          Luyện ngay <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day, i) => (
                        <div key={day} className="flex-1 text-center">
                          <div className="text-xs text-muted-foreground mb-1.5">{day}</div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-xs font-bold ${
                            d.weeklyActivity[i] > 0
                              ? "bg-primary text-primary-foreground"
                              : i === todayIdx
                                ? "bg-primary/20 text-primary border border-primary/40"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {d.weeklyActivity[i] > 0 ? "✓" : i === todayIdx ? "•" : "–"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}


              {/* Skill progress */}
              <motion.div variants={fadeUp} custom={7} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-heading font-bold text-foreground mb-5 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Tiến bộ theo kỹ năng
                </h3>
                {(() => {
                  const skills = [
                    { label: "Grammar & Vocabulary", pct: d.grammarPct, color: "bg-primary" },
                    { label: "Reading", pct: d.readingPct, color: "bg-info" },
                    { label: "Listening", pct: d.listeningPct, color: "bg-warning" },
                    { label: "Speaking", pct: d.speakingPct, color: "bg-accent" },
                    { label: "Writing", pct: d.writingPct, color: "bg-success" },
                  ];

                  const weakest = skills.reduce((min, s) => (s.pct < min.pct ? s : min), skills[0]);
                  return (
                    <>
                      {skills.map((s) => (
                        <div key={s.label} className="mb-5 last:mb-0">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-foreground font-medium">{s.label}</span>
                            <span className="text-muted-foreground">{s.pct}%</span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.pct}%` }}
                              transition={{ duration: 1, delay: 0.3 }}
                              className={`h-full ${s.color} rounded-full`}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="mt-5 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          <Zap className="w-4 h-4 inline text-primary mr-1" />
                          Kỹ năng yếu nhất: <strong className="text-foreground">{weakest.label}</strong> – Nên luyện thêm!
                        </p>
                      </div>
                    </>
                  );
                })()}
              </motion.div>

              {/* Progress over time */}
              <ProgressChart userId={user.id} />

              {/* Recent tests */}

              <motion.div variants={fadeUp} custom={8} initial="hidden" animate="visible" className="glass-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-heading font-bold text-foreground">Kết quả gần đây</h3>
                  <Link to="/history" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                    Xem tất cả <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {d.recentTests.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-foreground font-medium mb-1">Bạn chưa có kết quả thi nào</p>
                    <p className="text-xs text-muted-foreground mb-5">
                      Bắt đầu bằng 1 bài thi thử ngắn để đo trình độ hiện tại.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button asChild className="bg-primary hover:bg-[#4D0D0D]">
                        <Link to="/thi-thu">Thi thử miễn phí <ArrowRight className="w-4 h-4 ml-1" /></Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/practice">Luyện theo kỹ năng</Link>
                      </Button>
                    </div>
                  </div>
                ) : (

                  <div className="space-y-3">
                    {d.recentTests.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{t.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground">{t.score}/{t.total}</span>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-primary/10 text-primary">{t.level}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
