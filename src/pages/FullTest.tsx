import React, { useState, useMemo } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Clock, ArrowRight, Loader2, Mic, Headphones, BookOpen, PenLine, Brain } from "lucide-react";
import { motion } from "framer-motion";
import ExamPagination from "@/components/ExamPagination";
import { useExamSets, type ExamSetRow } from "@/hooks/useExamSets";
import { Skeleton } from "@/components/ui/skeleton";
import FullTestEngine from "@/components/fulltest/FullTestEngine";

const SKILL_BREAKDOWN = [
  { label: "Speaking", time: "12 phút", icon: Mic, color: "text-accent" },
  { label: "Listening", time: "40 phút", icon: Headphones, color: "text-blue-500" },
  { label: "Grammar &\nVocabulary", time: "25 phút", icon: Brain, color: "text-purple-500" },
  { label: "Reading", time: "35 phút", icon: BookOpen, color: "text-green-500" },
  { label: "Writing", time: "50 phút", icon: PenLine, color: "text-pink-500" },
];

const FullTest = () => {
  const { examSets, loading, page, setPage, totalPages } = useExamSets("full_test", 12);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeTestTitle, setActiveTestTitle] = useState("");

  const handleStartTest = (set: ExamSetRow) => {
    setActiveTestId(set.id);
    setActiveTestTitle(set.title);
  };

  const handleExit = () => {
    setActiveTestId(null);
    setActiveTestTitle("");
  };

  // Full test engine mode
  if (activeTestId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-20">
          <div className="section-container max-w-3xl">
            <FullTestEngine
              testId={activeTestId}
              testTitle={activeTestTitle}
              onExit={handleExit}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="border-b border-border bg-card">
          <div className="section-container py-12 md:py-16">
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
                Thi thử bài thi Aptis giống đề thì thật 100% với tổng thời gian 162 phút. 
                Thứ tự của các phần thi trong bài thi:
              </p>

              {/* Skill breakdown */}
              <div className="flex items-center justify-start flex-wrap gap-2">
                {SKILL_BREAKDOWN.map((skill, index) => (
                  <React.Fragment key={skill.label}>
                    <div className="flex flex-col items-center gap-1.5 bg-muted/50 dark:bg-muted/20 rounded-lg p-3 border border-border min-w-[90px]">
                      <skill.icon className={`w-5 h-5 ${skill.color}`} />
                      <span className="text-xs font-semibold text-foreground text-center leading-tight whitespace-pre-line">{skill.label}</span>
                      <span className="text-[11px] text-muted-foreground">{skill.time}</span>
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
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Thi thử đề Aptis ngẫu nhiên
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Đang tải..." : `${examSets.length} bộ đề thi thử`}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : examSets.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-1">Chưa có đề thi thử nào</p>
              <p className="text-sm text-muted-foreground">Đề thi sẽ xuất hiện ở đây khi được import vào hệ thống.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {examSets.map((set, index) => (
                <motion.div
                  key={set.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                >
                  <div className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                    <Badge variant="secondary" className="w-fit text-[11px] font-medium mb-3 bg-primary/10 text-primary dark:text-accent border-0">
                      Full Test
                    </Badge>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                      {set.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {set.description || "Đề thi thử Aptis Full Test – 5 kỹ năng"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      <span>162 phút • 5 kỹ năng</span>
                    </div>
                    <div className="flex-1" />
                    <Button
                      onClick={() => handleStartTest(set)}
                      className="w-full bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5"
                    >
                      Bắt đầu thi thử
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <ExamPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FullTest;
