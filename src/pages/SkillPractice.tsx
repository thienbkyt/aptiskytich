import { useLocation, Navigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const SKILL_META: Record<string, { title: string; description: string }> = {
  grammar: {
    title: "Grammar & Vocabulary",
    description: "Luyện tập ngữ pháp và từ vựng theo cấu trúc đề thi Aptis.",
  },
  reading: {
    title: "Reading",
    description: "Luyện đọc hiểu với các dạng bài thi Aptis Reading.",
  },
  listening: {
    title: "Listening",
    description: "Luyện nghe với audio theo format đề thi Aptis Listening.",
  },
  speaking: {
    title: "Speaking",
    description: "Luyện nói theo các chủ đề và format Aptis Speaking.",
  },
  writing: {
    title: "Writing",
    description: "Luyện viết theo các dạng bài thi Aptis Writing.",
  },
  vocabulary: {
    title: "Học từ vựng",
    description: "Học và ôn luyện từ vựng theo chủ đề thường gặp trong đề thi Aptis.",
  },
};

const SkillPractice = () => {
  const { skill } = useParams<{ skill: string }>();

  if (!skill || !SKILL_META[skill]) {
    return <Navigate to="/" replace />;
  }

  const meta = SKILL_META[skill];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <div className="section-container py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-heading font-bold text-foreground mb-4">
              {meta.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              {meta.description}
            </p>
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">
                🚧 Nội dung đang được cập nhật. Hãy quay lại sớm nhé!
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SkillPractice;
