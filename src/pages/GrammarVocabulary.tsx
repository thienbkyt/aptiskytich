import { useState, useMemo, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookA, Search, Shuffle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import { useSkillFullSets, type SkillFullSetItem } from "@/hooks/useSkillFullSets";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import ProgressBanner from "@/components/practice/ProgressBanner";
import CompletionBadge from "@/components/practice/CompletionBadge";
import { useUserExamProgress } from "@/hooks/useUserExamProgress";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import ParticlesBackground from "@/components/ui/particles-background";
import GradientOrb from "@/components/ui/gradient-orb";
import { useAuth } from "@/hooks/useAuth";
import { useExamAccessGate, ExamTierBadge } from "@/hooks/useExamAccessGate";
import { useExamPriorityLabels, aggregatePriority } from "@/hooks/useExamPriorityLabels";
import PriorityBadge from "@/components/practice/PriorityBadge";
import PriorityFilter, { type PriorityFilterValue } from "@/components/practice/PriorityFilter";

interface FullPracticeState {
  active: boolean;
  fullTestId: string;
  title: string;
  skipIntro?: boolean;
}

const GrammarVocabulary = () => {
  usePageMeta({
    title: "Luyện Grammar & Vocabulary Aptis — 50 câu / 25 phút | Aptis Kỳ Tích",
    description: "Ôn Grammar & Vocabulary Aptis: 25 câu ngữ pháp + 25 câu từ vựng trong 25 phút, có giải thích chi tiết và tra từ ngay tại chỗ.",
    path: "/grammar",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const { sets: fullSets, loading: fullLoading } = useSkillFullSets("grammar_vocab");
  const { progress } = useUserExamProgress();
  const { guard, isLocked, LockModal } = useExamAccessGate();
  const [fullPractice, setFullPractice] = useState<FullPracticeState>({
    active: false, fullTestId: "", title: "",
  });
  const { user: authUser, loading: authLoading } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    const setId = searchParams.get("set");
    const jump = searchParams.get("jump") === "1";
    if (!setId || fullLoading || autoStartedRef.current === setId) return;
    const target = fullSets.find((s) => s.examSetIds.includes(setId) || s.fullTestId === setId);
    if (target) {
      autoStartedRef.current = setId;
      handleStartFullPractice(target, jump);
      const next = new URLSearchParams(searchParams);
      next.delete("set");
      next.delete("jump");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, fullSets, fullLoading]);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>("all");
  const { keySetsBySet, windowSize } = useExamPriorityLabels();
  const setPriority = useMemo(() => {
    const m = new Map<string, "high" | "medium" | "low">();
    fullSets.forEach((s) => {
      const info = aggregatePriority(s.examSetIds, keySetsBySet, windowSize);
      if (info) m.set(s.fullTestId, info.label);
    });
    return m;
  }, [fullSets, keySetsBySet, windowSize]);
  const searchedSets = useMemo(() => {
    if (!searchQuery.trim()) return fullSets;
    const q = searchQuery.toLowerCase();
    return fullSets.filter((s) => s.title.toLowerCase().includes(q));
  }, [searchQuery, fullSets]);
  const priorityCounts = useMemo(() => {
    const c = { all: searchedSets.length, high: 0, medium: 0, low: 0 } as Record<string, number>;
    searchedSets.forEach((s) => { const l = setPriority.get(s.fullTestId); if (l) c[l]++; });
    return c;
  }, [searchedSets, setPriority]);
  const hasPriority = useMemo(() => searchedSets.some((s) => setPriority.get(s.fullTestId) != null), [searchedSets, setPriority]);
  useEffect(() => { if (!hasPriority && priorityFilter !== "all") setPriorityFilter("all"); }, [hasPriority, priorityFilter]);
  const filteredSets = useMemo(() => {
    let list = searchedSets;
    if (priorityFilter !== "all") list = list.filter((s) => setPriority.get(s.fullTestId) === priorityFilter);
    const rank = (id: string) => { const l = setPriority.get(id); return l === "high" ? 0 : l === "medium" ? 1 : l === "low" ? 2 : 3; };
    const num = (t: string) => { const m = (t || "").match(/\d+/); return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER; };
    return [...list].sort((a, b) => {
      const ga = (a as any).access_tier === "free" ? 0 : 1;
      const gb = (b as any).access_tier === "free" ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const ra = rank(a.fullTestId), rb = rank(b.fullTestId);
      if (ra !== rb) return ra - rb;
      const na = num(a.title), nb = num(b.title);
      if (na !== nb) return na - nb;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [searchedSets, priorityFilter, setPriority]);

  const handleStartFullPractice = (set: SkillFullSetItem, skipIntro = false) => {
    setFullPractice({ active: true, fullTestId: set.fullTestId, title: set.title, skipIntro });
  };

  const handleExitFullPractice = () => {
    setFullPractice({ active: false, fullTestId: "", title: "" });
  };

  const handleRandomPractice = () => {
    if (fullSets.length > 0) {
      handleStartFullPractice(fullSets[Math.floor(Math.random() * fullSets.length)]);
    }
  };

  if (fullPractice.active) {
    return (
      <SkillFullPracticeEngine
        fullTestId={fullPractice.fullTestId}
        skill="grammar_vocab"
        testTitle={fullPractice.title}
        onExit={handleExitFullPractice}
        skipFirstIntro={fullPractice.skipIntro}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-[112px] md:pt-16">
        <section className="relative overflow-hidden border-b border-border bg-card">
          <ParticlesBackground className="opacity-60" count={28} />
          <GradientOrb tone="violet" size={420} className="-top-32 -right-24" />
          <GradientOrb tone="red" size={320} className="-bottom-40 -left-20 opacity-70" />
          <div className="section-container py-12 md:py-16 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookA className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-3">Grammar & Vocabulary</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Luyện ngữ pháp và từ vựng thường gặp trong bài thi Aptis. Mỗi đề gồm 25 câu ngữ pháp + 25 câu từ vựng, đúng cấu trúc Aptis.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full border-primary text-primary hover:bg-primary/10 hover:text-primary h-9 px-4 text-sm font-medium">
                <Link to="/meo-thi-aptis/meo-hoc-grammar-aptis">💡 Xem ngay{"\u00a0"}- Mẹo làm bài Grammar & Vocabulary</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="section-container pt-6 md:pt-8">
          <ProgressBanner skill="grammar" skillLabel="Grammar & Vocabulary" />
        </section>

        <section className="section-container py-8 md:py-10">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm kiếm bộ đề Grammar & Vocabulary..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-11 bg-card" />
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-heading font-semibold text-foreground">Bộ đề Grammar & Vocabulary</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {fullLoading ? "Đang tải..." : `${filteredSets.length} bộ đề`}
            </p>
          </div>

          {hasPriority && (
            <div className="mb-4">
              <PriorityFilter value={priorityFilter} onChange={setPriorityFilter} counts={priorityCounts as any} />
            </div>
          )}

          {fullLoading || authLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <TechSkeleton key={i} variant="card" className="h-48" />)}
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              Chưa có bộ đề nào. Vui lòng import đề từ trang Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredSets.map((set, index) => {
                const locked = isLocked(set as any);
                return (
                <motion.div key={set.fullTestId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="group relative tech-card bg-card border border-border rounded-xl p-5 flex flex-col h-full">
                    {(() => {
                      const done = set.examSetIds.filter(id => progress.has(id)).length;
                      if (done === 0 || done !== set.examSetIds.length) return null;
                      let s = 0, t = 0;
                      set.examSetIds.forEach(id => { const p = progress.get(id); if (p) { s += p.bestScore; t += p.total; } });
                      if (t <= 0) return null;
                      return <div className="absolute top-3 right-3 z-10"><CornerResultBadge label={`${Math.round((s / t) * 100)}%`} /></div>;
                    })()}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="w-fit text-[11px] font-medium bg-primary/10 text-primary dark:text-accent border-0">
                        Grammar & Vocab
                      </Badge>
                      <ExamTierBadge tier={(set as any).access_tier} locked={locked} />
                      <PriorityBadge label={setPriority.get(set.fullTestId)} />

                    </div>
                    <h3 className="text-xl font-heading font-bold text-foreground mb-2">{set.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{set.questionCount} câu · {set.partCount} phần</p>
                    <div className="mb-4">{(() => { const done = set.examSetIds.filter(id => progress.has(id)).length; if (done === set.examSetIds.length && done > 0) return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">Đã hoàn thành tất cả {set.partCount} Part</span>; if (done > 0) return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-info bg-info/10 px-2.5 py-1 rounded-full">Đã làm {done}/{set.partCount} Part</span>; return <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Chưa bắt đầu</span>; })()}</div>
                    <div className="flex-1" />
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => guard(set as any, () => handleStartFullPractice(set))} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold gap-1 group-hover:gap-2 transition-all">
                        {locked ? "Mở khóa" : "Luyện tập"}<ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
      <LockModal />
    </div>
  );
};

export default GrammarVocabulary;
