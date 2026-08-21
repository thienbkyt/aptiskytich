import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import UpdateFeedDock from "@/components/home/UpdateFeedDock";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight, Flame,
  Target, Sparkles, Cpu, TrendingUp, Check, Layers, Lightbulb,
  GripVertical, Timer, ShieldCheck,
  Ear, BookText, Star, History, type LucideIcon,

} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LatestBlogSection from "@/components/blog/LatestBlogSection";

import AnimatedGrid from "@/components/ui/animated-grid";
import ParticlesBackground from "@/components/ui/particles-background";
import SpotlightCard from "@/components/ui/spotlight-card";
import BorderBeam from "@/components/ui/border-beam";
import MagneticButton from "@/components/ui/magnetic-button";
import GradientOrb from "@/components/ui/gradient-orb";
import writingResultAsset from "@/assets/writing-result.jpg.asset.json";
import heroAiFeedbackAsset from "@/assets/hero-ai-feedback.png.asset.json";
import InstallAppCard from "@/components/pwa/InstallAppCard";
import FeedbackMarquee, { hasFeedbackImages } from "@/components/home/FeedbackMarquee";
import { useSiteStats } from "@/hooks/useSiteStats";


const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const }
  }),
};

const toolCards: { icon: LucideIcon; title: string; desc: string; path: string; pro?: boolean }[] = [
  { icon: Layers, title: "Bộ đề tự tạo", desc: "Tự bốc đề thành full test hoặc full part riêng của bạn, chọn từng part từng kỹ năng.", path: "/my-sets", pro: true },
  { icon: Timer, title: "Marathon từng part", desc: "Cày liên tục một part cho tới khi quen tay.", path: "/key-du-doan" },
  { icon: Ear, title: "Nghe chép chính tả", desc: "Nghe rồi chép lại từng câu, luyện nghe chi tiết.", path: "/nghe-chep" },
  { icon: BookText, title: "Học từ vựng", desc: "Kho từ vựng Aptis kèm flashcard.", path: "/vocabulary" },
  { icon: Star, title: "Review tích đức", desc: "Người thi trước chia sẻ lại đề, người thi sau đỡ mò.", path: "/reviews" },
  { icon: History, title: "Xem lại từng câu", desc: "Lịch sử học tập lưu nguyên bài đã làm, soi lại chỗ sai.", path: "/history" },
];


const heroChips = [
  { icon: Target, label: "Mô phỏng 100% đề thật." },
  { icon: Cpu, label: "AI chấm Speaking–Writing." },
  { icon: TrendingUp, label: "Có band điểm ngay." },
];

const features = [
  { icon: Target, title: "Mô phỏng giống đề thật 100%", desc: "Giao diện kéo thả, dropdown, timer y hệt bài thi Aptis." },
  { icon: Layers, title: "Đầy đủ đề thật, cập nhật liên tục", desc: "596+ đề bám sát kỳ thi, bổ sung thường xuyên." },
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


const Index = () => {
  usePageMeta({
    title: "Aptis Kỳ Tích — Luyện thi Aptis & Thi thử miễn phí",
    description: "Luyện thi Aptis với ngân hàng đề sát thi thật, AI chấm Speaking & Writing, lộ trình 7 ngày đạt B1–B2. Thi thử miễn phí ngay.",
    path: "/",
  });
  const { deCount, userCount, attemptCount } = useSiteStats();
  const stats = [
    { value: deCount, label: "Đề thi Aptis" },
    { value: userCount, label: "Học viên đang luyện" },
    { value: attemptCount, label: "Lượt làm bài" },
    { value: "Đề Key", label: "Cập nhật hằng ngày" },
  ];
  return (

    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero — light theme (landing only) */}
      <section
        className="relative pt-28 pb-14 md:pt-36 md:pb-20 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #FFF7F0 0%, #FFFBF6 55%, #FFFFFF 100%)",
        }}
      >
        <ParticlesBackground color="204, 28, 1" count={18} />
        <GradientOrb tone="red" size={540} className="-top-48 -left-48" />
        <GradientOrb tone="orange" size={480} className="-bottom-48 -right-48" />

        <div className="section-container relative z-10">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            {/* Left column */}
            <motion.div
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left"
            >
              <motion.div
                variants={fadeUp} custom={0}
                className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-primary/25 text-primary text-xs font-semibold mb-8 shadow-sm overflow-hidden"
              >
                <Sparkles className="w-3.5 h-3.5" /> Nền tảng luyện thi Aptis có AI chấm điểm
                <BorderBeam size={120} duration={6} colorFrom="#CC1C01" colorTo="#FEAD5F" />
              </motion.div>

              <motion.h1
                variants={fadeUp} custom={1}
                className="font-heading font-extrabold leading-[1.08] mb-7 text-[34px] md:text-[46px] lg:text-[54px]"
                style={{ color: "#4D0D0D" }}
              >
                Luyện thi Aptis&nbsp;
                <br />
                giống bài thi thật
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] via-[#E85A1F] to-[#FEAD5F] animate-gradient-shift">
                  AI chấm điểm ngay
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp} custom={2}
                className="text-base md:text-lg lg:text-xl mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed"
                style={{ color: "#6b4a4a" }}
              >
                {deCount} đề thi sát kỳ thi thật, AI chấm Speaking & Writing, trả band điểm và gợi ý cải thiện chỉ sau vài phút.
              </motion.p>

              <motion.div
                variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
              >
                <MagneticButton>
                  <Link to="/thi-thu">
                    <Button size="lg" variant="glow" className="text-base px-8 h-12 gap-2 w-full sm:w-auto rounded-full animate-glow-pulse">
                      Thi thử miễn phí <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <Link to="/grammar">
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-base px-8 h-12 w-full sm:w-auto rounded-full bg-white border-2 border-primary text-primary hover:bg-primary/5"
                    >
                      Bắt đầu luyện tập
                    </Button>
                  </Link>
                </MagneticButton>
              </motion.div>

              <motion.div
                variants={fadeUp} custom={4}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-3"
              >
                {heroChips.map((c) => (
                  <div
                    key={c.label}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#F2D7C5] text-sm font-medium shadow-sm"
                    style={{ color: "#4D0D0D" }}
                  >
                    <c.icon className="w-4 h-4 text-primary" />{c.label}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right column — product window */}
            <motion.div
              variants={fadeUp} custom={2}
              initial="hidden" animate="visible"
              className="relative lg:pl-4"
            >
              <div
                className="relative rounded-[24px] overflow-hidden bg-white border border-[#F0D9C8]"
                style={{ boxShadow: "0 40px 80px -24px rgba(204, 28, 1, 0.28), 0 16px 32px -16px rgba(77, 13, 13, 0.14)" }}
              >
                {/* Browser title bar */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F2E2D4] bg-[#FFF9F3]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                    <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 rounded-md bg-white border border-[#F0E0D0] text-[11px] text-[#6B4A3B] font-medium">
                      aptiskytich.vn
                    </div>
                  </div>
                  <div className="w-12" />
                </div>
                {/* Screenshot */}
                <img
                  src={writingResultAsset.url}
                  alt="Kết quả Writing 44/50 — Trình độ B2 chấm bởi AI Kỳ Tích"
                  className="block w-full h-auto rounded-b-[24px]"
                  width={1236}
                  height={672}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>

              {/* Floating card — top right */}
              <div
                className="hidden md:flex absolute -top-5 -right-5 items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#F2D7C5]"
                style={{ boxShadow: "0 16px 32px -12px rgba(204, 28, 1, 0.25)" }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-[#6B4A3B] font-medium">AI chấm Writing</div>
                  <div className="text-sm font-bold" style={{ color: "#4D0D0D" }}>Band B2</div>
                </div>
              </div>

              {/* Floating card — bottom left */}
              <div
                className="hidden md:flex absolute -bottom-5 -left-5 items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#F2D7C5]"
                style={{ boxShadow: "0 16px 32px -12px rgba(204, 28, 1, 0.25)" }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[11px] text-[#6B4A3B] font-medium">Streak</div>
                  <div className="text-sm font-bold" style={{ color: "#4D0D0D" }}>18 ngày</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats strip + Trust bar */}
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
                <div className="text-sm mt-1.5" style={{ color: "#6B4A3B" }}>{s.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            variants={fadeUp} custom={0}
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="max-w-6xl mx-auto rounded-[22px] bg-white border border-[#F2E2D4] px-4 py-5 md:px-6 md:py-6 mt-5 md:mt-6"
            style={{ boxShadow: "0 10px 24px -16px rgba(204, 28, 1, 0.2)" }}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-2">
              {[
                { icon: ShieldCheck, title: "Sát đề thật", sub: "Mô phỏng giao diện thi thật" },
                { icon: Cpu, title: "AI chấm Speaking", sub: "Band + gợi ý sửa" },
                { icon: Sparkles, title: "AI chấm Writing", sub: "Nhận xét từng tiêu chí" },
                { icon: Layers, title: `${deCount} đề luyện`, sub: "Cập nhật liên tục" },
                { icon: TrendingUp, title: "Theo dõi tiến độ", sub: "Biểu đồ & streak" },
              ].map((t, i) => (
                <div key={i} className="flex md:flex-col items-center md:text-center gap-3 md:gap-2 md:px-3 md:py-1">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFE9DC] to-[#FFD6BC] flex items-center justify-center">
                    <t.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-sm md:text-[15px] leading-tight" style={{ color: "#4D0D0D" }}>{t.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6B4A3B" }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Getting started — 4 steps */}
      <section className="relative py-12 md:py-16" style={{ background: "#FFFFFF" }}>
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-8 md:mb-10 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Bắt đầu từ đâu
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              Bắt đầu học với&nbsp;
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">4 bước này</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#6B4A3B" }}>
              Lộ trình cho người mới
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              { num: "01", title: "Làm 1 bài thi thử full test", desc: "Vào Thi thử làm trọn một đề như thi thật để biết mình đang ở đâu.", to: "/thi-thu", cta: "Vào thi thử" },
              { num: "02", title: "Xem band điểm AI chấm", desc: "AI chấm cả Speaking và Writing, trả band từng kỹ năng ngay sau khi nộp." },
              { num: "03", title: "Luyện kỹ năng yếu", desc: "Nhìn band, kỹ năng nào thấp nhất thì vào luyện từng part của kỹ năng đó.", to: "/speaking", cta: "Chọn kỹ năng" },
              { num: "04", title: "Học theo đề Key dự đoán", desc: "Làm đề ưu tiên Cao trước, rồi tới Vừa, Thấp, cuối cùng là Backup.", to: "/key-du-doan", cta: "Xem key hôm nay" },
            ].map((s, i, arr) => (
              <motion.div
                key={s.num}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="relative rounded-[22px] bg-white border border-[#F2E2D4] p-6 md:p-7 flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-lg"
                style={{ boxShadow: "0 8px 20px -14px rgba(204, 28, 1, 0.18)" }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center mb-5 font-heading font-extrabold text-white">
                  {s.num}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-9 -right-4 w-6 h-6 text-primary/40" aria-hidden />
                )}
                <h3 className="font-heading font-extrabold text-base md:text-lg leading-tight mb-2 whitespace-nowrap" style={{ color: "#4D0D0D" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "#6b4a4a" }}>{s.desc}</p>
                {s.to && (
                  <div className="mt-auto">
                    <Link to={s.to}>
                      <Button className="w-full rounded-full h-11 font-semibold gap-2 bg-white border-2 border-primary text-primary hover:bg-primary/5">
                        {s.cta} <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <p className="text-center text-sm mt-8" style={{ color: "#6B4A3B" }}>
            Lặp lại bước 3 và 4 mỗi ngày cho tới sát ngày thi.
          </p>
        </div>
      </section>


      {/* Showcase — 3 panels */}
      <section className="relative py-14 md:py-20" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF7F0 100%)" }}>
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Tính năng nổi bật
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              Trải nghiệm luyện thi cùng{"\u00A0"}<span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">Kỳ Tích</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#6B4A3B" }}>
              Mọi công cụ bạn cần để luyện Aptis hiệu quả, ngay trên một nền tảng.
            </motion.p>
          </motion.div>

          <div className="space-y-8 md:space-y-10 max-w-6xl mx-auto">
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
                          <img src={heroAiFeedbackAsset.url} alt="AI chấm Writing — band B2" className="block w-full h-auto" width={616} height={537} loading="lazy" decoding="async" />
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
                                <div className="text-xs font-semibold text-[#6B4A3B] mb-0.5">Tiến độ tuần này</div>
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
                                  <div className="text-[10px] text-[#6B4A3B] font-medium">{s.k}</div>
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


      {/* Features */}
      <section className="py-14 md:py-20 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #FFF7F0 0%, #FFFFFF 100%)" }}>
        <div className="absolute inset-0 tech-grid-bg opacity-[0.12] pointer-events-none" />
        <div className="section-container relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Điểm mạnh
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold mb-4" style={{ color: "#4D0D0D" }}>
              Vì sao chọn <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">Aptis Kỳ Tích</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg" style={{ color: "#6B4A3B" }}>
              Những điều làm nên khác biệt khi luyện thi cùng Kỳ Tích.
            </motion.p>
          </motion.div>

          {/* Highlight: Đề Key Dự Đoán — Pro exclusive */}
          <motion.div
            variants={fadeUp} custom={0}
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="max-w-5xl mx-auto mb-6"
          >
            <div className="relative rounded-2xl p-[2px] bg-gradient-to-r from-[#CC1C01] via-[#FEAD5F] to-[#CC1C01] shadow-lg">
              <div className="rounded-2xl bg-white p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CC1C01] to-[#FEAD5F] flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white shadow-sm">
                      <Sparkles className="w-3 h-3" /> PRO
                    </span>
                    <h3 className="font-heading font-extrabold text-lg md:text-xl" style={{ color: "#4D0D0D" }}>
                      Đề Key Dự Đoán
                    </h3>
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    Cập nhật hằng ngày bộ đề dự đoán theo topic khả năng ra thi, phân mức ưu tiên. Marathon từng part để cày đúng trọng tâm, tiết kiệm thời gian ôn.
                  </p>
                </div>
                <Link to="/key-du-doan" className="shrink-0">
                  <Button className="bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white hover:brightness-110 font-semibold gap-2 shadow-md">
                    <Sparkles className="w-4 h-4" /> Xem key hôm nay
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="h-full"
              >
                <SpotlightCard className="p-7 h-full flex flex-col group transition-transform duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors duration-300">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-2 leading-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>

          {/* Divider */}
          <div className="relative mt-10 mb-8 max-w-5xl mx-auto">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#F2E2D4]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                CÔNG CỤ ÔN TẬP
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {toolCards.map((t, i) => (
              <motion.div
                key={t.title}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="h-full"
              >
                <Link to={t.path} className="block h-full">
                  <SpotlightCard className="p-7 h-full flex flex-col group transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors duration-300">
                        <t.icon className="w-6 h-6 text-primary" />
                      </div>
                      {t.pro && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F] text-white shadow-sm">
                          PRO
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-foreground mb-2 leading-tight">{t.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                  </SpotlightCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* Student feedback — image marquee */}
      {hasFeedbackImages && (
      <section className="relative py-14 md:py-20 overflow-hidden" style={{ background: "#FFFFFF" }}>
        <div className="section-container">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10 max-w-2xl mx-auto">
            <motion.div variants={fadeUp} custom={0} className="inline-block text-xs font-bold tracking-widest uppercase mb-3 text-primary">
              Học viên nói gì
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold" style={{ color: "#4D0D0D" }}>
              Feedback của học viên{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#CC1C01] to-[#FEAD5F]">Kỳ Tích</span>
            </motion.h2>
          </motion.div>
        </div>
        <FeedbackMarquee />
      </section>
      )}



      {/* Final CTA — feature-focused */}

      <section className="relative py-14 md:py-20" style={{ background: "#FFFFFF" }}>
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="relative max-w-5xl mx-auto rounded-[34px] overflow-hidden text-center px-6 py-12 md:px-12 md:py-16"
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
                <Sparkles className="w-4 h-4" /> Thi thử miễn phí
                <BorderBeam size={120} duration={6} colorFrom="#FFFFFF" colorTo="#FEAD5F" />
              </motion.div>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-heading font-extrabold text-white mb-5 leading-tight">
                Sẵn sàng chinh phục Aptis?
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/90 mb-10 leading-relaxed max-w-2xl mx-auto text-base md:text-lg">
                Bắt đầu với bài thi thử miễn phí, có AI chấm Speaking – Writing và trả band ngay.
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

      <LatestBlogSection />
      <Footer />

      <InstallAppCard />
      <UpdateFeedDock />
    </div>
  );
};

export default Index;
