import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight, Clock, BarChart3, Flame, BookOpen,
  GraduationCap, Star, MessageCircle, Zap, Target,
  Sparkles, ShieldCheck, Cpu,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import GlowCard from "@/components/ui/glow-card";
import GradientText from "@/components/ui/gradient-text";
import AnimatedGrid from "@/components/ui/animated-grid";
import ParticlesBackground from "@/components/ui/particles-background";
import SpotlightCard from "@/components/ui/spotlight-card";
import BorderBeam from "@/components/ui/border-beam";
import MagneticButton from "@/components/ui/magnetic-button";
import GradientOrb from "@/components/ui/gradient-orb";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const }
  }),
};

const stats = [
  { value: "10,000+", label: "Câu hỏi luyện tập" },
  { value: "95%", label: "Tỉ lệ đạt B1–B2" },
  { value: "5,000+", label: "Học viên tin dùng" },
  { value: "7 ngày", label: "Lộ trình tối ưu" },
];

const features = [
  { icon: Cpu, title: "AI chấm Speaking & Writing", desc: "Phân tích phát âm, ngữ pháp, từ vựng theo CEFR." },
  { icon: Clock, title: "Thi thử 10 phút", desc: "Kiểm tra trình độ nhanh với bài thi mini Aptis." },
  { icon: BarChart3, title: "Theo dõi tiến bộ", desc: "Biểu đồ chi tiết theo từng kỹ năng." },
  { icon: Flame, title: "Chuỗi học tập", desc: "Duy trì streak hàng ngày để tạo thói quen." },
  { icon: Target, title: "Luyện theo kỹ năng", desc: "5 kỹ năng Aptis riêng biệt + Vocab 3R." },
  { icon: Zap, title: "Giải thích chi tiết", desc: "Mỗi câu hỏi đều có đáp án & giải thích." },
];

const testimonials = [
  { name: "Nguyễn Thị Mai", score: "B2", text: "Chỉ luyện 7 ngày mà đạt B2, không tin nổi! Cảm ơn Aptis Kỳ Tích.", avatar: "NM" },
  { name: "Trần Văn Hùng", score: "B1", text: "Giao diện dễ dùng, câu hỏi sát đề thi thật. Mình đã pass Aptis lần đầu.", avatar: "TH" },
  { name: "Lê Phương Anh", score: "B2", text: "Tính năng streak giúp mình duy trì học mỗi ngày. Đạt B2 chỉ sau 2 tuần.", avatar: "LA" },
];

const examSections = [
  { skill: "Grammar & Vocabulary", questions: "25 câu", time: "25 phút" },
  { skill: "Reading", questions: "4 phần", time: "30 phút" },
  { skill: "Listening", questions: "25 câu", time: "25 phút" },
  { skill: "Speaking", questions: "4 phần", time: "12 phút" },
  { skill: "Writing", questions: "4 phần", time: "25 phút" },
];

const trustBadges = [
  { icon: Cpu, label: "AI chấm tự động" },
  { icon: ShieldCheck, label: "Sát đề thi thật 100%" },
  { icon: Sparkles, label: "5,000+ học viên" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-gradient-hero">
        <AnimatedGrid />
        <ParticlesBackground />
        <GradientOrb tone="red" size={520} className="-top-40 -left-40" />
        <GradientOrb tone="violet" size={460} className="-bottom-40 -right-40" />
        <div className="section-container relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={fadeUp} custom={0}
              className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-on-dark text-xs font-semibold mb-6 backdrop-blur-sm overflow-hidden"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-glow" /> Nền tảng luyện Aptis có AI · Miễn phí
              <BorderBeam size={120} duration={6} />
            </motion.div>
            <motion.h1
              variants={fadeUp} custom={1}
              className="text-4xl md:text-6xl font-heading font-extrabold text-on-dark leading-[1.1] mb-6"
            >
              Thi thử Aptis miễn phí –{" "}
              <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary-glow animate-gradient-shift">
                Kiểm tra trình độ
              </span>{" "}
              trong 10 phút
            </motion.h1>
            <motion.p
              variants={fadeUp} custom={2}
              className="text-lg md:text-xl text-on-dark/70 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Luyện tập với hơn 10,000 câu hỏi sát đề thi Aptis thật. AI chấm Speaking & Writing. Đạt B1–B2 nhanh nhất.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton>
                <Link to="/grammar">
                  <Button size="lg" variant="glow" className="text-base px-8 h-12 gap-2 w-full sm:w-auto rounded-full animate-glow-pulse">
                    Bắt đầu luyện tập <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link to="/course">
                  <Button size="lg" variant="glow-outline" className="text-base px-8 h-12 w-full sm:w-auto rounded-full">
                    Xem khóa học 7 ngày
                  </Button>
                </Link>
              </MagneticButton>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              variants={fadeUp} custom={4}
              className="flex flex-wrap items-center justify-center gap-3 mt-8"
            >
              {trustBadges.map((b) => (
                <div
                  key={b.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-on-dark/5 border border-on-dark/10 text-xs text-on-dark/80 backdrop-blur-sm"
                >
                  <b.icon className="w-3.5 h-3.5 text-primary-glow" /> {b.label}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp} custom={5}
            initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-3xl mx-auto"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-center p-4 rounded-2xl bg-on-dark/5 backdrop-blur-md border border-on-dark/10 hover:border-primary/40 hover:shadow-glow-soft transition-all"
              >
                <div className="text-2xl md:text-3xl font-heading font-extrabold gradient-text">{s.value}</div>
                <div className="text-sm text-on-dark/60 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Exam Structure */}
      <section className="section-padding bg-background relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="section-container relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Cấu trúc bài thi <GradientText>Aptis</GradientText>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-xl mx-auto">
              Hiểu rõ các phần thi để chuẩn bị tốt nhất
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {examSections.map((s, i) => (
              <motion.div
                key={s.skill}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <SpotlightCard className="p-5 text-center h-full group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center mx-auto mb-3 shadow-glow-soft transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <BookOpen className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-foreground mb-2">{s.skill}</h3>
                  <p className="text-xs text-muted-foreground">{s.questions}</p>
                  <p className="text-xs text-muted-foreground">{s.time}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 tech-grid-bg opacity-30 pointer-events-none" />
        <div className="section-container relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Tại sao chọn <GradientText>Aptis Kỳ Tích?</GradientText>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-xl mx-auto">
              Mọi thứ bạn cần để vượt qua kỳ thi Aptis
            </motion.p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <SpotlightCard className="p-6 h-full group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:shadow-glow-soft group-hover:scale-110 transition-all duration-300">
                    <f.icon className="w-6 h-6 text-primary group-hover:rotate-6 transition-transform" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-background">
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Học viên <GradientText>nói gì?</GradientText>
            </motion.h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <GlowCard className="p-6 h-full">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 italic leading-relaxed">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-sm font-bold text-primary-foreground shadow-glow-soft">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-heading font-semibold text-sm text-foreground">{t.name}</div>
                      <div className="text-xs text-primary font-bold">Đạt {t.score}</div>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Course CTA */}
      <section className="section-padding relative overflow-hidden bg-gradient-hero">
        <AnimatedGrid />
        <div className="section-container relative z-10">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-sm font-semibold mb-6 text-accent backdrop-blur-sm">
              <Flame className="w-4 h-4" /> Khóa học hot nhất
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold text-on-dark mb-4">
              <GradientText>Aptis Kỳ Tích</GradientText> – Đạt Aptis trong 7 ngày
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-on-dark/70 mb-8 leading-relaxed">
              Lộ trình học tập tối ưu, cam kết đầu ra B1–B2. Hỗ trợ 1-1 từ giảng viên.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/course">
                <Button size="lg" variant="glow" className="text-base px-8 gap-2 rounded-full">
                  Xem chi tiết khóa học <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://zalo.me/0867833227" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="glow-outline" className="text-base px-8 gap-2 rounded-full">
                  <MessageCircle className="w-5 h-5" /> Đăng ký qua Zalo
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
