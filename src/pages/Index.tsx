import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Clock, BarChart3, Flame, BookOpen,
  GraduationCap, Star, MessageCircle, Users, Zap, Target
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
  }),
};

const stats = [
  { value: "10,000+", label: "Câu hỏi luyện tập" },
  { value: "95%", label: "Tỉ lệ đạt B1–B2" },
  { value: "5,000+", label: "Học viên tin dùng" },
  { value: "7 ngày", label: "Lộ trình tối ưu" },
];

const features = [
  { icon: Clock, title: "Thi thử 10 phút", desc: "Kiểm tra trình độ nhanh với bài thi mini Aptis." },
  { icon: BarChart3, title: "Theo dõi tiến bộ", desc: "Biểu đồ chi tiết theo từng kỹ năng." },
  { icon: Flame, title: "Chuỗi học tập", desc: "Duy trì streak hàng ngày để tạo thói quen." },
  { icon: Target, title: "Luyện theo kỹ năng", desc: "Grammar, Reading, Listening riêng biệt." },
  { icon: Zap, title: "Giải thích chi tiết", desc: "Mỗi câu hỏi đều có đáp án & giải thích." },
  { icon: GraduationCap, title: "Đánh giá trình độ", desc: "Biết level A1–C2 sau mỗi bài thi." },
];

const testimonials = [
  { name: "Nguyễn Thị Mai", score: "B2", text: "Chỉ luyện 7 ngày mà đạt B2, không tin nổi! Cảm ơn Aptis Kỳ Tích.", avatar: "NM" },
  { name: "Trần Văn Hùng", score: "B1", text: "Giao diện dễ dùng, câu hỏi sát đề thi thật. Mình đã pass Aptis lần đầu.", avatar: "TH" },
  { name: "Lê Phương Anh", score: "B2", text: "Tính năng streak giúp mình duy trì học mỗi ngày. Đạt B2 chỉ sau 2 tuần.", avatar: "LA" },
];

const examSections = [
  { skill: "Grammar & Vocabulary", questions: "25 câu", time: "25 phút", color: "bg-primary" },
  { skill: "Reading", questions: "4 phần", time: "30 phút", color: "bg-secondary" },
  { skill: "Listening", questions: "25 câu", time: "25 phút", color: "bg-info" },
  { skill: "Speaking", questions: "4 phần", time: "12 phút", color: "bg-accent" },
  { skill: "Writing", questions: "4 phần", time: "25 phút", color: "bg-warning" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="gradient-hero pt-28 pb-20 md:pt-36 md:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary-foreground/90 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" /> Miễn phí · Không cần đăng ký
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-heading font-extrabold text-background leading-tight mb-6">
              Thi thử Aptis miễn phí –{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(155 60% 55%), hsl(170 55% 50%))" }}>
                Kiểm tra trình độ
              </span>{" "}
              trong 10 phút
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-background/70 mb-8 max-w-2xl mx-auto">
              Luyện tập với hơn 10,000 câu hỏi sát đề thi Aptis thật. Theo dõi tiến bộ. Đạt B1–B2 nhanh nhất.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/mock-test">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 btn-glow text-base px-8 h-13 gap-2 w-full sm:w-auto">
                  Bắt đầu thi thử <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/course">
                <Button size="lg" variant="outline" className="border-background/20 text-background hover:bg-background/10 text-base px-8 h-13 w-full sm:w-auto">
                  Xem khóa học 7 ngày
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp} custom={4}
            initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto"
          >
            {stats.map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl bg-background/5 backdrop-blur-sm border border-background/10">
                <div className="text-2xl md:text-3xl font-heading font-extrabold text-background">{s.value}</div>
                <div className="text-sm text-background/60 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Exam Structure */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Cấu trúc bài thi Aptis
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-xl mx-auto">
              Hiểu rõ các phần thi để chuẩn bị tốt nhất
            </motion.p>
          </motion.div>
          <div className="grid md:grid-cols-5 gap-4 max-w-4xl mx-auto">
            {examSections.map((s, i) => (
              <motion.div
                key={s.skill}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-5 text-center hover:scale-105 transition-transform"
              >
                <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-3`}>
                  <BookOpen className="w-5 h-5 text-background" />
                </div>
                <h3 className="font-heading font-bold text-sm text-foreground mb-2">{s.skill}</h3>
                <p className="text-xs text-muted-foreground">{s.questions}</p>
                <p className="text-xs text-muted-foreground">{s.time}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Tại sao chọn Aptis Kỳ Tích?
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-xl mx-auto">
              Mọi thứ bạn cần để vượt qua kỳ thi Aptis
            </motion.p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-6 hover:shadow-lg transition-shadow group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-14">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
              Học viên nói gì?
            </motion.h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-heading font-semibold text-sm text-foreground">{t.name}</div>
                    <div className="text-xs text-secondary font-medium">Đạt {t.score}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Course CTA */}
      <section className="py-20 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-medium mb-6">
              <Flame className="w-4 h-4" /> Khóa học hot nhất
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-heading font-extrabold text-background mb-4">
              Aptis Kỳ Tích – Đạt Aptis trong 7 ngày
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-background/70 mb-8">
              Lộ trình học tập tối ưu, cam kết đầu ra B1–B2. Hỗ trợ 1-1 từ giảng viên.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/course">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 gap-2">
                  Xem chi tiết khóa học <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://zalo.me" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-background/20 text-background hover:bg-background/10 text-base px-8 gap-2">
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
