import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Flame, Target, TrendingUp, BookOpen, ArrowRight,
  BarChart3, CheckCircle2, Calendar, Zap
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } }),
};

const mockData = {
  streak: 5,
  totalQuestions: 127,
  accuracy: 72,
  grammarPct: 78,
  readingPct: 65,
  listeningPct: 70,
  recentTests: [
    { date: "08/03/2026", score: 16, total: 20, level: "B1" },
    { date: "05/03/2026", score: 14, total: 20, level: "B1" },
    { date: "01/03/2026", score: 11, total: 20, level: "A2" },
  ],
  weeklyActivity: [3, 5, 2, 8, 4, 6, 0],
};

const Dashboard = () => {
  const d = mockData;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-20">
        <div className="section-container">
          <motion.div initial="hidden" animate="visible" className="mb-8">
            <motion.h1 variants={fadeUp} custom={0} className="text-2xl md:text-3xl font-heading font-extrabold text-foreground mb-1">
              Xin chào! 👋
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
              { icon: TrendingUp, label: "Trình độ", value: d.recentTests[0]?.level || "—", accent: "text-info" },
            ].map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i + 2} className="glass-card p-6">
                <s.icon className={`w-6 h-6 ${s.accent} mb-3`} />
                <div className="text-2xl font-heading font-extrabold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="md:col-span-2 space-y-6">
              {/* Streak motivation */}
              <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible"
                className="glass-card p-6 border-primary/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Flame className="w-8 h-8 text-primary streak-fire" />
                  <div>
                    <h3 className="font-heading font-bold text-foreground">Chuỗi {d.streak} ngày! 🔥</h3>
                    <p className="text-sm text-muted-foreground">Tiếp tục học hôm nay để duy trì streak!</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day, i) => (
                    <div key={day} className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground mb-1.5">{day}</div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-xs font-bold ${
                        d.weeklyActivity[i] > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {d.weeklyActivity[i] > 0 ? "✓" : "–"}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Skill progress */}
              <motion.div variants={fadeUp} custom={7} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-heading font-bold text-foreground mb-5 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Tiến bộ theo kỹ năng
                </h3>
                {[
                  { label: "Grammar & Vocabulary", pct: d.grammarPct, color: "bg-primary" },
                  { label: "Reading", pct: d.readingPct, color: "bg-info" },
                  { label: "Listening", pct: d.listeningPct, color: "bg-warning" },
                ].map((s) => (
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
                    Kỹ năng yếu nhất: <strong className="text-foreground">Reading</strong> – Nên luyện thêm!
                  </p>
                </div>
              </motion.div>

              {/* Recent tests */}
              <motion.div variants={fadeUp} custom={8} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-heading font-bold text-foreground mb-5">Kết quả gần đây</h3>
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
              </motion.div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Quick actions */}
              <motion.div variants={fadeUp} custom={9} initial="hidden" animate="visible" className="glass-card p-6">
                <h3 className="font-heading font-bold text-foreground mb-4">Hành động nhanh</h3>
                <div className="space-y-3">
                  <Link to="/practice" className="block">
                    <Button className="w-full bg-primary text-primary-foreground gap-2 justify-start">
                      <Target className="w-4 h-4" /> Luyện tập kỹ năng
                    </Button>
                  </Link>
                  <Link to="/thi-thu" className="block">
                    <Button variant="outline" className="w-full gap-2 justify-start">
                      <BookOpen className="w-4 h-4" /> Thi thử Aptis
                    </Button>
                  </Link>
                  <Link to="/course" className="block">
                    <Button variant="outline" className="w-full gap-2 justify-start text-primary border-primary/30 hover:bg-primary/5">
                      <Flame className="w-4 h-4" /> Khóa học 7 ngày
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Course promo */}
              <motion.div variants={fadeUp} custom={10} initial="hidden" animate="visible"
                className="glass-card p-6 border-primary/20"
              >
                <Flame className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-heading font-bold text-foreground mb-2">Đạt B2 trong 7 ngày?</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Tham gia khóa Aptis Kỳ Tích với lộ trình tối ưu và hỗ trợ 1-1.
                </p>
                <Link to="/course">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
                    Tìm hiểu <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
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
