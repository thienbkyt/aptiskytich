import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ComingSoon = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-[112px] md:pt-16">
      <div className="max-w-xl mx-auto px-4 py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <ClipboardCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Thi thử Aptis</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Tính năng thi thử Full Test sắp ra mắt! Bạn sẽ được làm bài thi mô phỏng 100% đề thi Aptis thật.
        </p>
        <Link to="/">
          <Button variant="outline" size="lg">
            Quay về trang chủ
          </Button>
        </Link>
      </div>
    </main>
    <Footer />
  </div>
);

export default ComingSoon;
