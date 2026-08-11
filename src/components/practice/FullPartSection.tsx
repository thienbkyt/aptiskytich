import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers, CheckCircle2, Lock, Plus, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillFullSetItem } from "@/hooks/useSkillFullSets";
import type { ExamProgressMap } from "@/hooks/useUserExamProgress";
import { toScaledScore, getSkillBand } from "@/data/questions";
import CornerResultBadge from "@/components/practice/CornerResultBadge";
import { ExamTierBadge } from "@/hooks/useExamAccessGate";
import CustomSetBuilder from "@/components/mysets/CustomSetBuilder";
import SkillFullPracticeEngine from "@/components/practice/SkillFullPracticeEngine";
import {
  useCustomSets,
  useCustomSetPlays,
  touchCustomSetPlayed,
  type CustomSetRow,
} from "@/hooks/useCustomSets";

interface FullPartSectionProps {
  skillName: string;
  sets: SkillFullSetItem[];
  loading: boolean;
  onStart: (set: SkillFullSetItem) => void;
  progress?: ExamProgressMap;
  skillKey?: "listening" | "reading" | "writing" | "speaking";
  isLocked?: (set: SkillFullSetItem) => boolean;
  onLockedClick?: (set: SkillFullSetItem) => void;
  /** Optional: per-exam-set CEFR band map. When provided, band badge is derived
   *  from this map (best CEFR across the set's parts). If no band is available,
   *  the badge is hidden. Used by writing/speaking where progress values are not
   *  raw scores. Reading/Listening keep the legacy score-based band calculation. */
  bandBySetId?: Map<string, string>;
}

const CEFR_RANK: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C: 5 };

type DoneFilter = "all" | "undone" | "done";
type SourceFilter = "all" | "official" | "mine";

const FullPartSection = ({ skillName, sets, loading, onStart, progress, skillKey, isLocked, onLockedClick, bandBySetId }: FullPartSectionProps) => {
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [overlay, setOverlay] = useState<
    | { kind: "create" }
    | { kind: "edit"; set: CustomSetRow }
    | { kind: "play"; set: CustomSetRow }
    | null
  >(null);

  const { sets: allCustomSets, invalidate } = useCustomSets();
  const { playedIds } = useCustomSetPlays();

  const mySets = useMemo(
    () => allCustomSets.filter((s) => s.mode === "full_part" && s.skill === skillKey),
    [allCustomSets, skillKey],
  );

  const officialDone = (set: SkillFullSetItem) => {
    if (!progress) return false;
    const done = set.examSetIds.filter((id) => progress.has(id)).length;
    return done > 0 && done === set.examSetIds.length;
  };

  const officialVisible = useMemo(
    () =>
      sets.filter((s) => {
        if (sourceFilter === "mine") return false;
        if (doneFilter === "done") return officialDone(s);
        if (doneFilter === "undone") return !officialDone(s);
        return true;
      }),
    [sets, sourceFilter, doneFilter, progress],
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
    const pool = sourceFilter === "mine" ? [] : sets;
    const minePool = sourceFilter === "official" ? [] : mySets;
    const done = pool.filter(officialDone).length + minePool.filter((s) => playedIds.has(s.id)).length;
    const total = pool.length + minePool.length;
    return { all: total, done, undone: total - done };
  }, [sets, mySets, sourceFilter, progress, playedIds]);

  const sourceCounts = useMemo(() => {
    const off = sets.filter((s) =>
      doneFilter === "done" ? officialDone(s) : doneFilter === "undone" ? !officialDone(s) : true,
    ).length;
    const mine = mySets.filter((s) => {
      const done = playedIds.has(s.id);
      return doneFilter === "done" ? done : doneFilter === "undone" ? !done : true;
    }).length;
    return { all: off + mine, official: off, mine };
  }, [sets, mySets, doneFilter, progress, playedIds]);

  const showCreateCard = doneFilter !== "done" && sourceFilter !== "official";

  /* ---------- overlays ---------- */
  if (overlay?.kind === "play" && skillKey) {
    const set = overlay.set;
    return (
      <SkillFullPracticeEngine
        fullTestId={set.id}
        customSetId={set.id}
        skill={skillKey as any}
        testTitle={set.title}
        onExit={() => { setOverlay(null); invalidate(); }}
      />
    );
  }

  if (overlay?.kind === "create" || overlay?.kind === "edit") {
    return (
      <div className="fixed inset-0 z-[70] bg-background overflow-y-auto">
        <div className="section-container py-8">
          <h2 className="text-xl font-heading font-bold text-foreground mb-5">
            {overlay.kind === "edit" ? "Sửa bộ đề của tôi" : "Tạo bộ đề của bạn"}
          </h2>
          <CustomSetBuilder
            editing={overlay.kind === "edit" ? overlay.set : null}
            initialMode="full_part"
            initialSkill={skillKey}
            onDone={() => { invalidate(); setOverlay(null); }}
            onCancel={() => setOverlay(null)}
          />
        </div>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card text-foreground border-border hover:bg-muted"
    }`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Luyện tập full part kỹ năng {skillName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hoàn thành tất cả các Part của kỹ năng này trong một lượt thi liên tục để đánh giá năng lực chính xác nhất.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Trạng thái:</span>
          {([["all", "Tất cả", doneCounts.all], ["undone", "Chưa làm", doneCounts.undone], ["done", "Đã làm", doneCounts.done]] as const).map(
            ([k, label, n]) => (
              <button key={k} type="button" onClick={() => setDoneFilter(k as DoneFilter)} className={chip(doneFilter === k)}>
                {label} <span className="opacity-70">({n})</span>
              </button>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Nguồn:</span>
          {([["all", "Tất cả", sourceCounts.all], ["official", "Đề web", sourceCounts.official], ["mine", "Bộ đề của tôi", sourceCounts.mine]] as const).map(
            ([k, label, n]) => (
              <button key={k} type="button" onClick={() => setSourceFilter(k as SourceFilter)} className={chip(sourceFilter === k)}>
                {label} <span className="opacity-70">({n})</span>
              </button>
            ),
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-8">
          {/* Create-your-own card */}
          {showCreateCard && (
            <button
              type="button"
              onClick={() => setOverlay({ kind: "create" })}
              className="text-left bg-card border-2 border-dashed border-[#CC1C01] rounded-xl p-5 flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-[#CC1C01]/10 flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-[#CC1C01]" />
              </div>
              <h3 className="text-xl font-heading font-bold text-foreground mb-2">Tạo bộ đề của bạn</h3>
              <p className="text-sm text-muted-foreground">
                Tự ghép các đề lẻ thành một bộ full part {skillName} theo ý bạn — vẫn được chấm và lưu lịch sử.
              </p>
              <div className="flex-1" />
              <span className="text-sm font-semibold text-[#CC1C01] inline-flex items-center gap-1 mt-4">
                Bắt đầu tạo <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          )}

          {/* My custom sets */}
          {mineVisible.map((s) => {
            const played = playedIds.has(s.id);
            return (
              <div
                key={s.id}
                className="group relative bg-card border-2 border-[#CC1C01] rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="w-fit text-[11px] font-medium bg-[#CC1C01]/10 text-[#CC1C01] border-0">
                    Bộ của tôi
                  </Badge>
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Full {skillName} • {s.memberCount} Parts • tự tạo
                </p>
                <div className="mb-4 mt-2">
                  {played ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã làm
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Chưa bắt đầu
                    </span>
                  )}
                </div>
                <div className="flex-1" />
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOverlay({ kind: "edit", set: s })}
                    className="text-muted-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <DeleteCustomSetButton
                    setId={s.id}
                    title={s.title}
                    onDeleted={invalidate}
                    size="sm"
                    variant="ghost"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      touchCustomSetPlayed(s.id).then(invalidate);
                      setOverlay({ kind: "play", set: s });
                    }}
                    className="text-[#CC1C01] hover:text-[#CC1C01] hover:bg-[#CC1C01]/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                  >
                    Bắt đầu luyện tập
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Official full part sets */}
          {officialVisible.map((set) => {
            const doneCount = progress
              ? set.examSetIds.filter((id) => progress.has(id)).length
              : 0;
            const allDone = doneCount > 0 && doneCount === set.examSetIds.length;
            let bandLabel: string | null = null;
            if (allDone && skillKey) {
              if (bandBySetId) {
                // Writing/Speaking: derive band from real graded results (best CEFR across parts).
                let best: string | null = null;
                set.examSetIds.forEach((id) => {
                  const b = bandBySetId.get(id);
                  if (b && (!best || (CEFR_RANK[b] ?? -1) > (CEFR_RANK[best] ?? -1))) best = b;
                });
                bandLabel = best; // null → badge hidden
              } else if (progress) {
                let sumScore = 0, sumTotal = 0;
                set.examSetIds.forEach((id) => {
                  const p = progress.get(id);
                  if (p) { sumScore += p.bestScore; sumTotal += p.total; }
                });
                if (sumTotal > 0) bandLabel = getSkillBand(toScaledScore(sumScore, sumTotal), skillKey);
              }
            }
            return (
            <motion.div
              key={set.fullTestId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="group relative bg-card border-2 border-[#CC1C01] rounded-xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                {bandLabel && (
                  <div className="absolute top-3 right-3 z-10">
                    <CornerResultBadge label={bandLabel} />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="w-fit text-[11px] font-medium bg-[#CC1C01]/10 text-[#CC1C01] border-0">
                    Full Part
                  </Badge>
                  <ExamTierBadge tier={set.access_tier} locked={isLocked ? isLocked(set) : false} />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                  {set.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-1">
                  Full {skillName} • {set.partCount} Parts
                </p>
                {set.reusedParts && set.reusedParts.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Có Part dùng lại đề cũ: {set.reusedParts.map((s) => s.replace("Dùng lại từ ", "")).join(", ")}
                  </p>
                )}
                <div className="mb-2" />
                <div className="mb-4">
                  {allDone ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã hoàn thành tất cả {set.partCount} Part
                    </span>
                  ) : doneCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-info bg-info/10 px-2.5 py-1 rounded-full">
                      Đã làm {doneCount}/{set.partCount} Part
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Chưa bắt đầu
                    </span>
                  )}
                </div>

                <div className="flex-1" />
                <div className="flex justify-end">
                  {isLocked && isLocked(set) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLockedClick?.(set)}
                      className="text-[#CC1C01] hover:text-[#CC1C01] hover:bg-[#CC1C01]/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                    >
                      <Lock className="w-4 h-4" />
                      Mở khóa
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStart(set)}
                      className="text-[#CC1C01] hover:text-[#CC1C01] hover:bg-[#CC1C01]/10 font-semibold gap-1 group-hover:gap-2 transition-all"
                    >
                      Bắt đầu luyện tập
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );})}

          {!showCreateCard && officialVisible.length === 0 && mineVisible.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 text-center py-10 bg-card border border-dashed border-border rounded-xl">
              <Layers className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium text-sm">Không có bộ đề nào khớp bộ lọc</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FullPartSection;
