import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Star, MessageCircle, Shield, Clock,
  Users, Flame, Calendar, BookOpen, Trophy, Zap
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }),
};

const roadmap = [
  { day: 1, title: "Nền tảng Grammar", desc: "Ôn lại 12 thì, câu điều kiện, câu bị động." },
  { day: 2, title: "Vocabulary Builder", desc: "500 từ vựng Aptis phổ biến nhất, phương pháp nhớ nhanh." },
  { day: 3, title: "Reading Strategies", desc: "Kỹ thuật skimming, scanning, matching headings." },
  { day: 4, title: "Listening Skills", desc: "Luyện nghe với các dạng bài Aptis thường gặp." },
  { day: 5, title: "Speaking Practice", desc: "Mẫu câu trả lời cho Part 1-4, luyện phát âm." },
  { day: 6, title: "Writing Mastery", desc: "Email, essay, formal/informal writing templates." },
  { day: 7, title: "Mock Test & Review", desc: "Thi thử full test, review kết quả, chiến lược phòng thi." },
];

const benefits = [
  { icon: Clock, text: "7 ngày lộ trình tối ưu" },
  { icon: Users, text: "Hỗ trợ 1-1 từ giảng viên" },
  { icon: Shield, text: "Cam kết đầu ra B1–B2" },
  { icon: BookOpen, text: "Tài liệu độc quyền" },
  { icon: Trophy, text: "Thi thử không giới hạn" },
  { icon: Zap, text: "Phản hồi chi tiết từng bài" },
];

const Course = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* Hero */}
    <section className="gradient-hero pt-28 pb-20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-15">
        <div className="absolute top-10 right-20 w-80 h-80 bg-accent/30 rounded-full blur-3xl" />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <motion.div initial="hidden" animate="visible" className="max-w-3xl mx-auto text-center">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent text-sm font-medium mb-6">
            <Flame className="w-4 h-4" /> Khóa học #1 về Aptis
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-heading font-extrabold text-on-dark leading-tight mb-6">
            Aptis Kỳ Tích –<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(35 95% 60%), hsl(25 90% 55%))" }}>
              Đạt Aptis trong 7 ngày
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-on-dark-muted mb-8 max-w-xl mx-auto">
            Lộ trình học tập tối ưu, cam kết đầu ra B1–B2, hỗ trợ 1-1 từ giảng viên kinh nghiệm.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://zalo.me" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 gap-2 w-full sm:w-auto">
                <MessageCircle className="w-5 h-5" /> Đăng ký qua Zalo
              </Button>
            </a>
            <a href="https://m.me" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-on-dark/20 text-on-dark hover:bg-on-dark/10 text-base px-8 w-full sm:w-auto">
                Đăng ký qua Messenger
              </Button>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>

    {/* Benefits */}
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {benefits.map((b, i) => (
            <motion.div
              key={b.text}
              variants={fadeUp} custom={i}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="glass-card p-5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <b.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{b.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* 7-Day Roadmap */}
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-heading font-extrabold text-foreground mb-4">
            Lộ trình 7 ngày
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
            Mỗi ngày 1 chủ đề, tập trung và hiệu quả
          </motion.p>
        </motion.div>

        <div className="space-y-4">
          {roadmap.map((day, i) => (
            <motion.div
              key={day.day}
              variants={fadeUp} custom={i}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="glass-card p-5 flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-heading font-extrabold">D{day.day}</span>
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground mb-1">{day.title}</h3>
                <p className="text-sm text-muted-foreground">{day.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Guarantee */}
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="glass-card p-8 text-center border-secondary/30 bg-secondary/5"
        >
          <motion.div variants={fadeUp} custom={0}>
            <Shield className="w-12 h-12 text-secondary mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-extrabold text-foreground mb-3">Cam kết đầu ra</h2>
            <p className="text-muted-foreground mb-4">
              Nếu bạn hoàn thành đầy đủ lộ trình 7 ngày mà không đạt B1, chúng tôi sẽ hỗ trợ học lại <strong className="text-foreground">miễn phí</strong>.
            </p>
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-5 h-5 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Được tin tưởng bởi 5,000+ học viên</p>
          </motion.div>
        </motion.div>
      </div>
    </section>

    {/* Success stories */}
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-3xl font-heading font-extrabold text-foreground text-center mb-12">
          Câu chuyện thành công
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { name: "Phạm Minh Tuấn", job: "Sinh viên ĐH Bách Khoa", text: "Cần pass Aptis B1 để tốt nghiệp. Chỉ có 1 tuần chuẩn bị. Aptis Kỳ Tích giúp mình đạt B2 ngay lần đầu!", avatar: "PT" },
            { name: "Nguyễn Hạnh Nguyên", job: "Nhân viên văn phòng", text: "Công ty yêu cầu B1 để thăng chức. Sau 7 ngày học, mình đã tự tin đi thi và pass B1 dễ dàng.", avatar: "NH" },
            { name: "Trần Đức Anh", job: "Giáo viên tiểu học", text: "Lộ trình rất rõ ràng, giảng viên hỗ trợ tận tình. Đạt B2 – kết quả ngoài mong đợi!", avatar: "TA" },
            { name: "Lê Thị Hương", job: "Sinh viên năm cuối", text: "Mình chỉ còn 5 ngày trước kỳ thi. Nhờ khóa học mà đạt B1, kịp nộp hồ sơ tốt nghiệp.", avatar: "LH" },
          ].map((t, i) => (
            <motion.div key={t.name} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass-card p-6">
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-accent text-accent" />)}
              </div>
              <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{t.avatar}</div>
                <div>
                  <div className="font-heading font-semibold text-sm text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.job}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-20 gradient-hero relative">
      <div className="container mx-auto px-4 max-w-2xl text-center relative z-10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-on-dark mb-4">
            Sẵn sàng đạt Aptis B2?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-on-dark-muted mb-8">
            Đăng ký ngay hôm nay. Bắt đầu hành trình 7 ngày của bạn.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://zalo.me" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 gap-2 w-full sm:w-auto">
                <MessageCircle className="w-5 h-5" /> Đăng ký qua Zalo
              </Button>
            </a>
            <Link to="/mock-test">
              <Button size="lg" variant="outline" className="border-on-dark/20 text-on-dark hover:bg-on-dark/10 text-base px-8 w-full sm:w-auto">
                Thi thử trước
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Course;
