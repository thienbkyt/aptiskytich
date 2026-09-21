import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Sparkles } from "lucide-react";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import PredictionKeyView from "@/components/prediction/PredictionKeyView";

const KeyPrediction = () => {
  usePageMeta({
    title: "Đề Key Dự Đoán Aptis update hằng ngày — Aptis Kỳ Tích",
    description:
      "Key dự đoán đề thi Aptis theo ngày: Speaking, Reading, Writing. Lọc theo kỹ năng và ưu tiên, luyện thẳng từng đề.",
    path: "/key-du-doan",
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="red" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
                Đề Key Dự Đoán
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl md:text-lg font-medium">
                Key dự đoán đề thi Aptis update hằng ngày — luyện đúng đề trọng tâm trước ngày thi.
              </p>
            </div>
          </div>
        </section>

        <section className="section-container py-8 md:py-10">
          <PredictionKeyView />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default KeyPrediction;
