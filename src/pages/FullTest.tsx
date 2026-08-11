import React, { useMemo, useState } from "react";
import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { useIsPro } from "@/hooks/useIsPro";
import { Lock } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Clock, ArrowRight, Mic, Headphones, BookOpen, PenLine, Brain, Plus, Pencil, CheckCircle2 } from "lucide-react";
import DeleteCustomSetButton from "@/components/mysets/DeleteCustomSetButton";
import { motion } from "framer-motion";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import FullTestEngine from "@/components/fulltest/FullTestEngine";
import { useFullTests, type FullTestItem } from "@/hooks/useFullTests";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";
import { useUserFullTestBands } from "@/hooks/useUserFullTestBands";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import CustomSetBuilder from "@/components/mysets/CustomSetBuilder";
import { useCustomSets, useCustomSetPlays, touchCustomSetPlayed, type CustomSetRow } from "@/hooks/useCustomSets";

const SKILL_BREAKDOWN = [
  { label: "Speaking", time: "12 phút", icon: Mic, color: "text-accent" },
  { label: "Listening", time: "40 phút", icon: Headphones, color: "text-blue-500" },
  { label: "Grammar &\nVocabulary", time: "25 phút", icon: Brain, color: "text-purple-500" },
  { label: "Reading", time: "35 phút", icon: BookOpen, color: "text-green-500" },
  { label: "Writing", time: "50 phút", icon: PenLine, color: "text-pink-500" },
];

const FullTest = () => {
  usePageMeta({
    title: "Thi thử Aptis online miễn phí — Aptis Kỳ Tích",
    description: "Làm bài thi thử Aptis General sát đề thật: Speaking, Listening, Grammar & Vocab, Reading, Writing. AI chấm tự động, có giải thích chi tiết.",
    path: "/thi-thu",
  });
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  if (tabParam === "key" || tabParam === "prediction") {
    return <Navigate to="/key-du-doan" replace />;
  }
  const { tests, loading } = useFullTests("aptis");
  const { user: authUser, loading: authLoading } = useAuth();
  const { bands } = useUserFullTestBands();
  const [activeTest, setActiveTest] = useState<FullTestItem | null>(null);
  const { guard, isLocked, LockModal } = useExamAccessGate();

  const { sets: allCustomSets, invalidate } = useCustomSets();
  const { playedIds } = useCustomSetPlays();
  const [doneFilter, setDoneFilter] = useState<"all" | "undone" | "done">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "official" | "mine">("all");
  const [overlay, setOverlay] = useState<
    { kind: "create" } | { kind: "edit"; set: CustomSetRow } | { kind: "play"; set: CustomSetRow } | null
  >(null);

  const mySets = useMemo(
    () => allCustomSets.filter((s) => s.mode === "full_test"),
    [allCustomSets],
  );
  const officialDone = (t: FullTestItem) => !!bands.get(t.fullTestId);

  const officialVisible = useMemo(
    () =>
      tests.filter((t) => {
        if (sourceFilter === "mine") return false;
        if (doneFilter === "done") return officialDone(t);
        if (doneFilter === "undone") return !officialDone(t);
        return true;
      }),
    [tests, sourceFilter, doneFilter, bands],
  );
  const mineVisible = useMemo(
    () =>
      mySets.filter((s) => {
        if (sourceFilter === "official") return false;
        const done = playedIds.has(s.id);
        if (doneFilter === "done") return done;
        if (doneFilter === "undone") return !done;
        return true;
      }),
    [mySets, sourceFilter, doneFilter, playedIds],
  );
  const doneCounts = useMemo(() => {
    const off = sourceFilter === "mine" ? [] : tests;
    const mine = sourceFilter === "official" ? [] : mySets;
    const done = off.filter(officialDone).length + mine.filter((s) => playedIds.has(s.id)).length;
    const total = off.length + mine.length;
    return { all: total, done, undone: total - done };
  }, [tests, mySets, sourceFilter, bands, playedIds]);
  const sourceCounts = useMemo(() => {
    const off = tests.filter((t) =>
      doneFilter === "done" ? officialDone(t) : doneFilter === "undone" ? !officialDone(t) : true,
    ).length;
    const mine = mySets.filter((s) => {
      const d = playedIds.has(s.id);
      return doneFilter === "done" ? d : doneFilter === "undone" ? !d : true;
    }).length;
    return { all: off + mine, official: off, mine };
  }, [tests, mySets, doneFilter, bands, playedIds]);

  const showCreateCard = doneFilter !== "done" && sourceFilter !== "official";

  const chip = (active: boolean) =>
    `text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-foreground border-border hover:bg-muted"
    }`;

  const handleStartTest = (test: FullTestItem) => {
    setActiveTest(test);
  };

  const handleExit = () => {
    setActiveTest(null);
  };

  // Custom set play mode
  if (overlay?.kind === "play") {
    const set = overlay.set;
    return (
      <FullTestEngine
        testId={set.id}
        testTitle={set.title}
        customSetId={set.id}
        onExit={() => { setOverlay(null); invalidate(); }}
      />
    );
  }

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

  // Custom set builder mode
  if (overlay?.kind === "create" || overlay?.kind === "edit") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-[112px] md:pt-16">
          <section className="section-container py-8">
            <h1 className="text-2xl font-heading font-bold text-foreground mb-5">
              {overlay.kind === "edit" ? "Sửa bộ đề của tôi" : "Tạo bộ đề của bạn"}
            </h1>
            <CustomSetBuilder
              editing={overlay.kind === "edit" ? overlay.set : null}
              initialMode="full_test"
              onDone={() => { invalidate(); setOverlay(null); }}
              onCancel={() => setOverlay(null)}
            />
          </section>
        </main>
        <Footer />
      </div>
    );
  }



  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
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
                Làm bài thi thử Aptis
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mb-6 whitespace-pre-line md:text-lg font-medium">
                Mô phỏng{"\u00a0"}giống thi thật 100%.
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
            <p className="text-sm text-muted-foreground">
              {loading ? "Đang tải..." : "​"}
            </p>
          </div>

          {loading || authLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <TechSkeleton key={i} variant="card" className="h-52" />
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
              <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-1">
                Chưa có đề thi Full Test nào được xuất bản
              </p>
              <p className="text-sm text-muted-foreground">
                Đề thi sẽ xuất hiện ở đây khi được import vào hệ thống.
              </p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="space-y-2 mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Trạng thái:</span>
                  {([["all", "Tất cả", doneCounts.all], ["undone", "Chưa làm", doneCounts.undone], ["done", "Đã làm", doneCounts.done]] as const).map(
                    ([k, label, n]) => (
                      <button key={k} type="button" onClick={() => setDoneFilter(k as any)} className={chip(doneFilter === k)}>
                        {label} <span className="opacity-70">({n})</span>
                      </button>
                    ),
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Nguồn:</span>
                  {([["all", "Tất cả", sourceCounts.all], ["official", "Đề web", sourceCounts.official], ["mine", "Bộ đề của tôi", sourceCounts.mine]] as const).map(
                    ([k, label, n]) => (
                      <button key={k} type="button" onClick={() => setSourceFilter(k as any)} className={chip(sourceFilter === k)}>
                        {label} <span className="opacity-70">({n})</span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {showCreateCard && (
                  <button
                    type="button"
                    onClick={() => setOverlay({ kind: "create" })}
                    className="relative text-left bg-[#CC1C01]/5 border-2 border-[#CC1C01] rounded-xl p-5 flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 select-none text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#CC1C01] text-white">
                        <Plus className="w-3 h-3" /> Tự tạo
                      </span>
                    </div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">Tạo bộ đề của bạn</h3>
                    <p className="text-sm text-muted-foreground">
                      Tự ghép các đề lẻ thành một bài thi thử đủ 5 kỹ năng — vẫn được AI chấm và lưu lịch sử.
                    </p>
                    <div className="flex-1" />
                    <div className="flex justify-end mt-4">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-[#CC1C01] text-white">
                        Tạo bộ đề <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </button>

                )}

                {mineVisible.map((s) => (
                  <div key={s.id} className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">
                        Bộ của tôi
                      </Badge>
                    </div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Full test • {s.memberCount} Parts • tự tạo
                    </p>
                    <div className="mb-4">
                      {playedIds.has(s.id) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đã làm
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Chưa bắt đầu</span>
                      )}
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          touchCustomSetPlayed(s.id).then(invalidate);
                          setOverlay({ kind: "play", set: s });
                        }}
                        className="flex-1 bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5"
                      >
                        Bắt đầu thi thử <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setOverlay({ kind: "edit", set: s })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteCustomSetButton setId={s.id} title={s.title} onDeleted={invalidate} />
                    </div>
                  </div>
                ))}

                {officialVisible.map((test, index) => {
                const locked = isLocked(test as any);
                return (
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
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">
                        Full Test
                      </Badge>
                      <ExamTierBadge tier={(test as any).access_tier} locked={locked} />
                    </div>
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
                      onClick={() => guard(test as any, () => handleStartTest(test), { feature: 'full_test', itemKey: test.fullTestId, setIds: test.examSetIds })}
                      disabled={!test.isReady}
                      className="w-full bg-primary hover:bg-brand-brown text-white font-semibold gap-1.5"
                    >
                      {!test.isReady
                        ? `Chưa đủ kỹ năng (${test.skillCount}/5)`
                        : locked ? "Mở khóa Pro" : "Bắt đầu thi thử"}
                      {test.isReady && <ArrowRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </motion.div>
                );
              })}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
      <LockModal />
    </div>
  );
};

export default FullTest;
