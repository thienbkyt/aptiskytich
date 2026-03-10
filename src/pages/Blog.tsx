import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Tag } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } }),
};

const posts = [
  {
    id: 1, title: "5 mẹo thi Aptis Grammar đạt điểm cao", category: "Grammar Tips",
    excerpt: "Nắm vững 5 chiến lược quan trọng giúp bạn trả lời nhanh và chính xác phần Grammar & Vocabulary.",
    date: "08/03/2026", readTime: "5 phút"
  },
  {
    id: 2, title: "Chiến lược Reading: Skimming vs Scanning", category: "Reading Strategies",
    excerpt: "Phân biệt 2 kỹ thuật đọc quan trọng nhất và cách áp dụng vào từng dạng bài Aptis Reading.",
    date: "05/03/2026", readTime: "7 phút"
  },
  {
    id: 3, title: "Luyện nghe Aptis hiệu quả tại nhà", category: "Listening Strategies",
    excerpt: "Hướng dẫn từng bước để cải thiện kỹ năng nghe, từ cơ bản đến nâng cao.",
    date: "01/03/2026", readTime: "6 phút"
  },
  {
    id: 4, title: "Aptis vs IELTS: Nên chọn kỳ thi nào?", category: "Aptis Tips",
    excerpt: "So sánh chi tiết giữa Aptis và IELTS về cấu trúc, độ khó, chi phí và thời gian chuẩn bị.",
    date: "25/02/2026", readTime: "8 phút"
  },
  {
    id: 5, title: "Từ vựng Aptis: 100 từ phải biết", category: "Grammar Tips",
    excerpt: "Tổng hợp 100 từ vựng xuất hiện nhiều nhất trong các đề thi Aptis gần đây.",
    date: "20/02/2026", readTime: "10 phút"
  },
  {
    id: 6, title: "Cách đạt B2 Aptis chỉ trong 7 ngày", category: "Aptis Tips",
    excerpt: "Lộ trình học tập chi tiết từng ngày để đạt B2 Aptis trong thời gian ngắn nhất.",
    date: "15/02/2026", readTime: "6 phút"
  },
];

const categoryColors: Record<string, string> = {
  "Grammar Tips": "bg-primary/10 text-primary",
  "Reading Strategies": "bg-secondary/10 text-secondary",
  "Listening Strategies": "bg-info/10 text-info",
  "Aptis Tips": "bg-accent/10 text-accent",
};

const Blog = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div initial="hidden" animate="visible" className="text-center mb-12">
          <motion.h1 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-heading font-extrabold text-foreground mb-4">
            Blog & Mẹo thi Aptis
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
            Chiến lược và tips giúp bạn đạt điểm cao
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {posts.map((post, i) => (
            <motion.article
              key={post.id}
              variants={fadeUp} custom={i}
              initial="hidden" animate="visible"
              className="glass-card p-6 hover:shadow-lg transition-shadow group cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColors[post.category] || "bg-muted text-muted-foreground"}`}>
                  {post.category}
                </span>
              </div>
              <h2 className="font-heading font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{post.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
    <Footer />
  </div>
);

export default Blog;
