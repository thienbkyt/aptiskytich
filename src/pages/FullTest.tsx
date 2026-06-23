import React, { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Clock, ArrowRight, Mic, Headphones, BookOpen, PenLine, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import FullTestEngine from "@/components/fulltest/FullTestEngine";
import { useFullTests, type FullTestItem } from "@/hooks/useFullTests";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import LoginToPracticePrompt from "@/components/exam/LoginToPracticePrompt";
import { useUserFullTestBands } from "@/hooks/useUserFullTestBands";
import CornerResultBadge from "@/components/practice/CornerResultBadge";

const SKILL_BREAKDOWN = [
  { label: "Speaking", time: "12 phút", icon: Mic, color: "text-accent" },
  { label: "Listening", time: "40 phút", icon: Headphones, color: "text-blue-500" },
  { label: "Grammar &\nVocabulary", time: "25 phút", icon: Brain, color: "text-purple-500" },
  { label: "Reading", time: "35 phút", icon: BookOpen, color: "text-green-500" },
  { label: "Writing", time: "50 phút", icon: PenLine, color: "text-pink-500" },
];

type TabKey = "aptis" | "key";

const FullTest = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("aptis");
  const { tests, loading } = useFullTests(activeTab);
  const { user: authUser, loading: authLoading } = useAuth();
  const { bands } = useUserFullTestBands();
  const [activeTest, setActiveTest] = useState<FullTestItem | null>(null);

  const handleStartTest = (test: FullTestItem) => {
    setActiveTest(test);
  };

  const handleExit = () => {
    setActiveTest(null);
  };

  // Full test engine mode
  if (activeTest) {
    return (
      <FullTestEngine
        testId={activeTest.fullTestId}
        testTitle={activeTest.title}
        onExit={handleExit}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="red" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium gap-1.5">
                  <Clock className="w-3 h-3" />
                  162 phút
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">
                Thi thử bài thi Aptis
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mb-6 whitespace-pre-line md:text-lg font-medium">
                Thi thử đề Aptis với format mô phỏng giống thi thật 100%.
                {"\n"}Tổng thời gian 162 phút.{"\u00a0"}Thứ tự của các phần thi trong bài thi:
              </p>

              {/* Skill breakdown */}
              <div className="flex items-center justify-start flex-wrap gap-2">
                {SKILL_BREAKDOWN.map((skill, index) => (
                  <React.Fragment key={skill.label}>
                    <div className="flex flex-col items-center gap-1.5 bg-muted/50 dark:bg-muted/20 rounded-lg p-3 border border-border min-w-[90px]">
                      <skill.icon className={`w-5 h-5 ${skill.color}`} />
                      <span className="text-xs font-semibold text-foreground text-center leading-tight whitespace-pre-line">{skill.label}</span>
                      <span className="text-[11px] text-muted-foreground font-extrabold">{skill.time}</span>
                    </div>
                    {index < SKILL_BREAKDOWN.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Test list */}
        <section className="section-container py-8 md:py-10">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1 p-1 bg-muted/60 dark:bg-muted/30 rounded-lg border border-border">
              <button
                onClick={() => setActiveTab("aptis")}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === "aptis"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bộ đề thi Aptis
              </button>
              <button
                onClick={() => setActiveTab("key")}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  activeTab === "key"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bộ đề Key Aptis
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {loading ? "Đang tải..." : "​"}
            </p>
          </div>

          {loading || authLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <TechSkeleton key={i} variant="card" className="h-52" />
              ))}
            </div>
          ) : !authUser ? (
            <LoginToPracticePrompt message="Đăng nhập để làm full bộ đề Aptis với giao diện giống đề thi thật 100%" />
          ) : tests.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-1">
                {activeTab === "aptis"
                  ? "Chưa có đề thi Full Test nào được xuất bản"
                  : "Bộ đề Key Aptis đang được cập nhật"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeTab === "aptis"
                  ? "Đề thi sẽ xuất hiện ở đây khi được import vào hệ thống."
                  : "Các đề sẽ xuất hiện sớm."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {tests.map((test, index) => (
                <motion.div
                  key={test.fullTestId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                >
                  <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                    {bands.get(test.fullTestId) && (
                      <div className="absolute top-3 right-3 z-10">
                        <CornerResultBadge label={bands.get(test.fullTestId)} />
                      </div>
                    )}
                    <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">
                      Full Test
                    </Badge>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      {test.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Đề thi thử Aptis Full Test – {test.skillCount} kỹ năng
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      <span>162 phút • {test.skillCount} kỹ năng</span>
                    </div>
                    <div className="flex-1" />
                    <Button
                      onClick={() => handleStartTest(test)}
                      disabled={!test.isReady}
                      className="w-full bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5"
                    >
                      {test.isReady ? "Bắt đầu thi thử" : `Chưa đủ kỹ năng (${test.skillCount}/5)`}
                      {test.isReady && <ArrowRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FullTest;
