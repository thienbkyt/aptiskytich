import { Link, Navigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Flame, Target, TrendingUp, BookOpen, ArrowRight,
  BarChart3, CheckCircle2, Calendar, Zap, History,
  GraduationCap, Sparkles, Mic,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProgressChart from "@/components/dashboard/ProgressChart";
import AnimatedGrid from "@/components/ui/animated-grid";
import GradientText from "@/components/ui/gradient-text";
import GlowCard from "@/components/ui/glow-card";
import StatPill from "@/components/dashboard/StatPill";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import StreakRing from "@/components/dashboard/StreakRing";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { DashboardSkeleton } from "@/components/ui/tech-skeleton";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06 } }),
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
  const d = new Date(iso);
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
          supabase.from("test_results").select("score,total,level,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
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

    return () => { cancelled = true; };
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

  if (!user) return <Navigate to="/auth" replace />;

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-20">
          <div className="section-container space-y-6">
            <Skeleton className="h-48 rounded-3xl" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-48 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          </div>
        </div>
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill icon={Flame} label="Chuỗi ngày" value={`${d.streak} ngày`} accent="red" />
                <StatPill icon={CheckCircle2} label="Câu đã làm" value={d.totalQuestions} accent="orange" />
                <StatPill icon={Target} label="Chính xác" value={`${d.accuracy}%`} accent="success" />
                <StatPill icon={TrendingUp} label="Trình độ" value={d.currentLevel} accent="violet" />
              </div>
            </div>
          </motion.div>

          {/* QUICK ACTIONS */}
          <motion.div
            initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            {[
              { to: "/thi-thu",   icon: Zap,            title: "Thi thử Aptis",  desc: "Làm full test sát đề thật", tone: "red" as const },
              { to: "/grammar",   icon: Target,         title: "Luyện kỹ năng",  desc: "5 kỹ năng theo từng part",   tone: "orange" as const },
              { to: "/vocab",     icon: BookOpen,       title: "Học từ vựng",    desc: "Flashcard + 3R technique",    tone: "teal" as const },
              { to: "/history",   icon: History,        title: "Lịch sử bài",    desc: "Xem lại & rút kinh nghiệm",   tone: "info" as const },
              { to: "/course",    icon: GraduationCap,  title: "Khóa 7 ngày",    desc: "Lộ trình chinh phục Aptis",  tone: "violet" as const },
            ].map((a, i) => (
              <motion.div key={a.to} variants={fadeUp} custom={i}>
                <QuickActionCard {...a} description={a.desc} />
              </motion.div>
            ))}
          </motion.div>

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
                        <h3 className="font-heading font-extrabold text-lg text-foreground">
                          {atRisk ? `Sắp mất chuỗi ${d.streak} ngày!` : `Chuỗi ${d.streak} ngày`}
                        </h3>
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
                  <h3 className="font-heading font-bold text-foreground mb-5 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Tiến bộ theo kỹ năng
                  </h3>
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
                    <h3 className="font-heading font-bold text-foreground">Lịch sử học tập</h3>
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
                        const grad = LEVEL_GRAD[t.level] || "from-muted to-muted";
                        const pct = t.total > 0 ? Math.round((t.score / t.total) * 100) : 0;
                        return (
                          <div
                            key={i}
                            className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/40 hover:bg-muted/50 transition-all"
                          >
                            <div className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-extrabold shadow-md`}>
                              {t.level}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" /> {t.date}
                              </div>
                              <div className="text-sm font-bold text-foreground">{t.score}/{t.total} <span className="text-xs text-muted-foreground font-normal">· {pct}%</span></div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </div>
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
                    <h3 className="font-heading font-extrabold text-foreground mb-1">Tăng tốc Speaking</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      AI chấm + feedback chi tiết. Chỉ 12 phút mỗi ngày.
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
