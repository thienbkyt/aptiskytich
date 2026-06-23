import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight, Flame, BookOpen,
  Target, Sparkles, Cpu, TrendingUp, Check, Layers, Lightbulb,
  GripVertical, Timer,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

import AnimatedGrid from "@/components/ui/animated-grid";
import ParticlesBackground from "@/components/ui/particles-background";
import SpotlightCard from "@/components/ui/spotlight-card";
import BorderBeam from "@/components/ui/border-beam";
import MagneticButton from "@/components/ui/magnetic-button";
import GradientOrb from "@/components/ui/gradient-orb";
import writingResultAsset from "@/assets/writing-result.jpg.asset.json";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const }
  }),
};

const stats = [
  { value: "350+", label: "Đề thi thật" },
  { value: "1.166", label: "Câu hỏi luyện tập" },
  { value: "5", label: "Kỹ năng đầy đủ" },
  { value: "Miễn phí", label: "Toàn bộ tính năng" },
];

const heroChips = [
  { icon: Target, label: "Mô phỏng 100% đề thật" },
  { icon: Cpu, label: "AI chấm Speaking–Writing" },
  { icon: TrendingUp, label: "Có band điểm ngay" },
];

const features = [
  { icon: Target, title: "Mô phỏng giống đề thật 100%", desc: "Giao diện kéo thả, dropdown, timer y hệt bài thi Aptis." },
  { icon: Layers, title: "Đầy đủ đề thật, cập nhật liên tục", desc: "350+ đề bám sát kỳ thi, bổ sung thường xuyên." },
  { icon: Cpu, title: "AI chấm & chữa Speaking–Writing", desc: "Sát thực tế, trả kết quả & nhận xét ngay." },
  { icon: TrendingUp, title: "Nắm rõ band điểm", desc: "Biết chính xác band từng kỹ năng để ôn đúng chỗ yếu." },
  { icon: Lightbulb, title: "Giải thích chi tiết từng câu", desc: "Mỗi câu có đáp án + lý do, hiểu sâu không học vẹt." },
  { icon: Flame, title: "Theo dõi tiến bộ + streak", desc: "Biểu đồ tiến bộ từng kỹ năng, giữ thói quen mỗi ngày." },
];

const showcasePanels = [
  {
    num: "01",
    title: "Thi thử & AI chấm Speaking–Writing",
    desc: "Làm bài mô phỏng đề thật, AI Kỳ Tích chấm cả Speaking & Writing — trả điểm, band và nhận xét chi tiết ngay sau khi nộp.",
    features: ["Chấm theo tiêu chí CEFR", "Chỉ rõ lỗi & cách sửa"],
    bg: "linear-gradient(135deg, #FFF1E6 0%, #FFE2D0 100%)",
    mock: "ai" as const,
  },
  {
    num: "02",
    title: "Luyện theo kỹ năng sát đề thật",
    desc: "5 kỹ năng riêng biệt với đúng thao tác bài thi: kéo thả, dropdown inline, bấm giờ. Luyện từng phần hoặc trọn bộ như thi thật.",
    features: ["Kéo-thả, dropdown, timer y như thật", "Luyện từng part hoặc full test"],
    bg: "linear-gradient(135deg, #FFE9DC 0%, #FFD6BC 100%)",
    mock: "reading" as const,
  },
  {
    num: "03",
    title: "Theo dõi tiến bộ & giữ streak",
    desc: "Xem band tăng theo từng kỹ năng, biểu đồ tiến bộ theo thời gian và giữ chuỗi streak để học đều mỗi ngày.",
    features: ["Biểu đồ tiến bộ từng kỹ năng", "Streak & lịch sử học tập"],
    bg: "linear-gradient(135deg, #FFEFE3 0%, #FFDFC8 100%)",
    mock: "dashboard" as const,
  },
];

const examSections = [
  { skill: "Grammar & Vocabulary", questions: "25 câu", time: "25 phút" },
  { skill: "Reading", questions: "4 phần", time: "30 phút" },
  { skill: "Listening", questions: "25 câu", time: "25 phút" },
  { skill: "Speaking", questions: "4 phần", time: "12 phút" },
  { skill: "Writing", questions: "4 phần", time: "25 phút" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero — light theme (landing only) */}
      <section
        className="relative pt-28 pb-20 md:pt-32 md:pb-24 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #FFF7F0 0%, #FFFBF6 55%, #FFFFFF 100%)",
        }}
      >
        <AnimatedGrid className="opacity-[0.18]" withOrbs={false} />
        <ParticlesBackground color="204, 28, 1" count={18} />
        <GradientOrb tone="red" size={520} className="-top-40 -left-40" />
        <GradientOrb tone="orange" size={460} className="-bottom-40 -right-40" />

        <div className="section-container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left column */}
            <motion.div
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left"
            >
              <motion.div
                variants={fadeUp} custom={0}
                className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-primary/25 text-primary text-xs font-semibold mb-6 shadow-sm overflow-hidden"
              >
                <Sparkles className="w-3.5 h-3.5" /> Nền tảng luyện Aptis có AI Kỳ Tích · Miễn phí
                <BorderBeam size={120} duration={6} colorFrom="#CC1C01" colorTo="#FEAD5F" />
              </motion.div>

              <motion.h1
                variants={fadeUp} custom={1}
                className="font-heading font-extrabold leading-[1.1] mb-6 text-[34px] md:text-[46px]"
                style={{ color: "#4D0D0D" }}
              >
                Luyện thi Aptis{" "}
                <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] via-[#E85A1F] to-[#FEAD5F] animate-gradient-shift">
                  mô phỏng 100% đề thật
                </span>
                , có AI chấm
              </motion.h1>

              <motion.p
                variants={fadeUp} custom={2}
                className="text-base md:text-lg mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
                style={{ color: "#6b4a4a" }}
              >
                Đầy đủ 350+ đề, 5 kỹ năng. AI Kỳ Tích chấm Speaking & Writing và trả band điểm ngay sau khi nộp — biết chính xác bạn đang ở đâu.
              </motion.p>

              <motion.div
                variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
              >
                <MagneticButton>
                  <Link to="/grammar">
                    <Button size="lg" variant="glow" className="text-base px-8 h-12 gap-2 w-full sm:w-auto rounded-full animate-glow-pulse">
                      Bắt đầu luyện tập <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link to="/thi-thu">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-base px-8 h-12 w-full sm:w-auto rounded-full bg-white border-2 border-primary text-primary hover:bg-primary/5"
                    >
                      Thi thử miễn phí
                    </Button>
                  </Link>
                </MagneticButton>
              </motion.div>

              <motion.div
                variants={fadeUp} custom={4}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5"
              >
                {heroChips.map((c) => (
                  <div
                    key={c.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#F2D7C5] text-xs font-medium shadow-sm"
                    style={{ color: "#4D0D0D" }}
                  >
                    <c.icon className="w-3.5 h-3.5 text-primary" /> {c.label}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right column — product window */}
            <motion.div
              variants={fadeUp} custom={2}
              initial="hidden" animate="visible"
              className="relative"
            >
              <div
                className="relative rounded-[20px] overflow-hidden bg-white border border-[#F0D9C8]"
                style={{ boxShadow: "0 30px 60px -20px rgba(204, 28, 1, 0.25), 0 12px 24px -12px rgba(77, 13, 13, 0.12)" }}
              >
                {/* Browser title bar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F2E2D4] bg-[#FFF9F3]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                    <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 rounded-md bg-white border border-[#F0E0D0] text-[11px] text-[#8B6B5C] font-medium">
                      aptiskytich.vn
                    </div>
                  </div>
                  <div className="w-12" />
                </div>
                {/* Screenshot */}
                <img
                  src={writingResultAsset.url}
                  alt="Kết quả Writing 44/50 — Trình độ B2 chấm bởi AI Kỳ Tích"
                  className="block w-full h-auto rounded-b-[20px]"
                  loading="eager"
                />
              </div>

              {/* Floating card — top right */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="hidden md:flex absolute -top-4 -right-4 items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-[#F2D7C5]"
                style={{ boxShadow: "0 12px 24px -12px rgba(204, 28, 1, 0.25)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8B6B5C] font-medium">AI chấm Writing</div>
                  <div className="text-sm font-bold" style={{ color: "#4D0D0D" }}>Band B2</div>
                </div>
              </motion.div>

              {/* Floating card — bottom left */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="hidden md:flex absolute -bottom-4 -left-4 items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-[#F2D7C5]"
                style={{ boxShadow: "0 12px 24px -12px rgba(204, 28, 1, 0.25)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
                  <Flame className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8B6B5C] font-medium">Streak</div>
                  <div className="text-sm font-bold" style={{ color: "#4D0D0D" }}>18 ngày</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative py-10 md:py-14" style={{ background: "#FFFFFF" }}>
        <div className="section-container">
          <motion.div
            variants={fadeUp} custom={0}
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-center p-5 rounded-[20px] bg-white border border-[#F2E2D4] transition-all hover:-translate-y-0.5"
                style={{ boxShadow: "0 8px 20px -12px rgba(204, 28, 1, 0.18)" }}
              >
                <div className="text-2xl md:text-3xl font-heading font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">
                  {s.value}
                </div>
                <div className="text-sm mt-1.5" style={{ color: "#8B6B5C" }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Showcase — 3 panels */}
      <section className="relative py-20 md:py-28" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%)" }}>
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Tính năng nổi bật
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              Trải nghiệm luyện thi cùng <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">Kỳ Tích</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#8B6B5C" }}>
              Mọi công cụ bạn cần để luyện Aptis hiệu quả, ngay trên một nền tảng.
            </motion.p>
          </motion.div>

          <div className="space-y-10 md:space-y-14 max-w-6xl mx-auto">
            {showcasePanels.map((p, i) => {
              const reverse = i % 2 === 1;
              return (
                <motion.div
                  key={p.num}
                  variants={fadeUp} custom={i}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
                  className="rounded-[28px] p-6 md:p-10 lg:p-14 border border-[#F2D7C5]"
                  style={{ background: p.bg, boxShadow: "0 20px 50px -25px rgba(204, 28, 1, 0.22)" }}
                >
                  <div className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
                    {/* Text */}
                    <div>
                      <div className="text-6xl md:text-7xl font-heading font-extrabold leading-none mb-4 select-none" style={{ color: "rgba(204, 28, 1, 0.14)" }}>
                        {p.num}
                      </div>
                      <h3 className="text-2xl md:text-3xl font-heading font-extrabold mb-4 leading-tight" style={{ color: "#4D0D0D" }}>
                        {p.title}
                      </h3>
                      <p className="text-base md:text-lg mb-6 leading-relaxed" style={{ color: "#6b4a4a" }}>
                        {p.desc}
                      </p>
                      <ul className="space-y-3">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-primary/30 flex items-center justify-center mt-0.5" style={{ boxShadow: "0 2px 6px -2px rgba(204, 28, 1, 0.3)" }}>
                              <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
                            </span>
                            <span className="text-sm md:text-base font-medium" style={{ color: "#4D0D0D" }}>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Mock visual */}
                    <div>
                      <div
                        className="relative rounded-[20px] overflow-hidden bg-white border border-[#F0D9C8]"
                        style={{ boxShadow: "0 30px 60px -25px rgba(204, 28, 1, 0.28), 0 12px 24px -12px rgba(77, 13, 13, 0.12)" }}
                      >
                        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#F2E2D4] bg-[#FFF9F3]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                        </div>
                        {p.mock === "ai" && (
                          <img src={writingResultAsset.url} alt="AI chấm Writing — band B2" className="block w-full h-auto" loading="lazy" />
                        )}
                        {p.mock === "reading" && (
                          <div className="p-5 md:p-6 bg-white">
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-xs font-bold text-[#4D0D0D]">Reading · Part 2</div>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                <Timer className="w-3 h-3" /> 18:42
                              </div>
                            </div>
                            <div className="space-y-2 mb-4 text-sm leading-relaxed" style={{ color: "#4D0D0D" }}>
                              <p>The festival begins with a parade through the town centre.</p>
                              <p>People gather early to find the best spots along the route.</p>
                            </div>
                            <div className="space-y-2">
                              {[
                                { label: "Afterwards, there are live music performances.", active: true },
                                { label: "The mayor gives a short welcome speech.", active: false },
                                { label: "Food stalls open in the main square.", active: false },
                              ].map((s, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${s.active ? "border-primary bg-primary/5" : "border-[#F2E2D4] bg-white"}`}
                                >
                                  <GripVertical className="w-4 h-4 text-[#C2A08A] flex-shrink-0" />
                                  <span className="text-sm" style={{ color: "#4D0D0D" }}>{s.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {p.mock === "dashboard" && (
                          <div className="p-5 md:p-6 bg-white">
                            <div className="flex items-center justify-between mb-5">
                              <div>
                                <div className="text-xs font-semibold text-[#8B6B5C] mb-0.5">Tiến độ tuần này</div>
                                <div className="text-2xl font-extrabold" style={{ color: "#4D0D0D" }}>B1+ → B2</div>
                              </div>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white text-xs font-bold">
                                <Flame className="w-3.5 h-3.5" /> 18 ngày
                              </div>
                            </div>
                            <div className="flex items-end gap-2 h-24 mb-4">
                              {[40, 55, 48, 70, 62, 85, 92].map((h, idx) => (
                                <div key={idx} className="flex-1 rounded-t-md bg-gradient-to-t from-[#CC1C01] to-[#FEAD5F]" style={{ height: `${h}%`, opacity: 0.55 + idx * 0.06 }} />
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { k: "Reading", v: "B2" },
                                { k: "Listening", v: "B1+" },
                                { k: "Writing", v: "B2" },
                              ].map((s) => (
                                <div key={s.k} className="text-center py-2 rounded-lg bg-[#FFF7F0] border border-[#F2E2D4]">
                                  <div className="text-[10px] text-[#8B6B5C] font-medium">{s.k}</div>
                                  <div className="text-sm font-bold text-primary">{s.v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* Exam Structure — warm gradient cards */}
      <section className="relative py-20 md:py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%)" }}>
        <div className="section-container relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Cấu trúc bài thi
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              5 kỹ năng trong <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">đề Aptis</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#8B6B5C" }}>
              Hiểu rõ thời lượng từng phần để luyện đúng trọng tâm.
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {[
              { skill: "Grammar & Vocabulary", questions: "25 câu", time: "25 phút", bg: "linear-gradient(135deg, #B81700 0%, #E14A14 100%)" },
              { skill: "Reading", questions: "4 phần", time: "30 phút", bg: "linear-gradient(135deg, #CC1C01 0%, #F26A1F 100%)" },
              { skill: "Listening", questions: "25 câu", time: "25 phút", bg: "linear-gradient(135deg, #E14A14 0%, #FB8B30 100%)" },
              { skill: "Speaking", questions: "4 phần", time: "12 phút", bg: "linear-gradient(135deg, #F26A1F 0%, #FEAD5F 100%)" },
              { skill: "Writing", questions: "4 phần", time: "25 phút", bg: "linear-gradient(135deg, #FB8B30 0%, #FFC684 100%)" },
            ].map((s, i) => (
              <motion.div
                key={s.skill}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="rounded-[22px] p-5 text-center h-full text-white transition-transform hover:-translate-y-1"
                style={{ background: s.bg, boxShadow: "0 18px 36px -18px rgba(204, 28, 1, 0.5), 0 8px 16px -8px rgba(77, 13, 13, 0.25)" }}
              >
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border border-white/30">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-heading font-bold text-sm text-white mb-2 leading-tight">{s.skill}</h3>
                <p className="text-xs text-white/85">{s.questions}</p>
                <p className="text-xs text-white/85">{s.time}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding relative overflow-hidden" style={{ background: "linear-gradient(180deg, #FFF7F0 0%, #FFFFFF 100%)" }}>
        <div className="absolute inset-0 tech-grid-bg opacity-[0.12] pointer-events-none" />
        <div className="section-container relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Điểm mạnh
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              Vì sao chọn <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">Aptis Kỳ Tích</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#8B6B5C" }}>
              Những điều làm nên khác biệt khi luyện thi cùng Kỳ Tích.
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

      {/* Final CTA — feature-focused */}
      <section className="relative py-20 md:py-28" style={{ background: "#FFFFFF" }}>
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="relative max-w-5xl mx-auto rounded-[34px] overflow-hidden text-center px-6 py-16 md:px-12 md:py-20"
            style={{
              background: "linear-gradient(135deg, #CC1C01 0%, #E85A1F 55%, #FEAD5F 100%)",
              boxShadow: "0 40px 80px -30px rgba(204, 28, 1, 0.5), 0 16px 32px -16px rgba(77, 13, 13, 0.3)",
            }}
          >
            <GradientOrb tone="orange" size={420} className="top-1/2 -translate-y-1/2 -left-32" />
            <GradientOrb tone="red" size={420} className="top-1/2 -translate-y-1/2 -right-32" />

            <div className="relative z-10">
              <motion.div
                variants={fadeUp} custom={0}
                className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/40 text-sm font-semibold mb-6 text-white backdrop-blur-sm overflow-hidden"
              >
                <Sparkles className="w-4 h-4" /> Miễn phí 100%
                <BorderBeam size={120} duration={6} colorFrom="#FFFFFF" colorTo="#FEAD5F" />
              </motion.div>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-heading font-extrabold text-white mb-5 leading-tight">
                Sẵn sàng chinh phục Aptis?
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/90 mb-10 leading-relaxed max-w-2xl mx-auto text-base md:text-lg">
                Bắt đầu luyện ngay với bộ đề sát thật và AI chấm Speaking – Writing. Không tốn phí.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
                <MagneticButton>
                  <Link to="/thi-thu">
                    <Button size="lg" className="text-base px-8 h-12 gap-2 rounded-full bg-white text-primary hover:bg-white/90 font-bold animate-glow-pulse">
                      Thi thử miễn phí <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link to="/grammar">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12 gap-2 rounded-full bg-transparent border-2 border-white text-white hover:bg-white/10">
                      Bắt đầu luyện tập
                    </Button>
                  </Link>
                </MagneticButton>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
