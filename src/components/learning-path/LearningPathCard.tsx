import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Crown, MessageSquareHeart, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import GoalSetupModal from "@/components/dashboard/GoalSetupModal";
import {
  PATH_SKILLS, SKILL_VI, STEP_ORDER, useLearningPath,
  type LearningPathData, type PathSkill, type StepKey,
} from "@/hooks/useLearningPath";
import { POSE, STEP_LABEL, STEP_SHORT, bubbleFor, ddmm, examKeyOpenDate, mascotSrc, stepIndex, stepState } from "./pathText";
import { Bubble, NextItem, TierBars } from "./PathBits";
import LearningPathDialog from "./LearningPathDialog";
import MilestoneDialog from "./MilestoneDialog";

function stepSub(d: LearningPathData, k: StepKey): string {
  if (k === "goal") return d.goal ? `Aim ${d.goal.aim}` : "Ngày thi · aim";
  if (k === "placement") return d.placement ? d.placement.date : d.placementSkipped ? "Đã bỏ qua" : "Biết band";
  if (PATH_SKILLS.includes(k as PathSkill)) {
    const s = d.skills[k as PathSkill];
    return `${s.done}/${s.total} đề`;
  }
  if (k === "examKey") return d.goal ? `Mở ${examKeyOpenDate(d.goal.exam_date)}` : "Trước ngày thi";
  return "Thi thử full";
}

function skillProgress(d: LearningPathData, k: StepKey): number {
  const st = stepState(d, k);
  if (st === "done") return 100;
  if (PATH_SKILLS.includes(k as PathSkill)) {
    const s = d.skills[k as PathSkill];
    return s.total ? Math.round((s.done / s.total) * 100) : 0;
  }
  if (k === "examKey" && d.examKey && d.examKey.total) return Math.round(((d.examKey.total - d.examKey.open - d.examKey.locked) / d.examKey.total) * 100);
  return 0;
}

const DESK_GLYPH: Record<StepKey, string> = {
  goal: "1", placement: "2", reading: "R", listening: "L", writing: "W", speaking: "S", examKey: "🔑", finish: "🏁",
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">{children}</section>
);

export const LearningPathView = ({ data: d }: { data: LearningPathData }) => {
  const [goalOpen, setGoalOpen] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);

  // Mốc hoàn thành: kỹ năng xong (có làm ít nhất 1 đề) mà chưa chúc mừng.
  const pendingMilestones = useMemo(() => {
    if (d.loading || !d.goal || !d.placementDone) return [] as string[];
    const out: string[] = [];
    for (const sk of PATH_SKILLS) {
      const s = d.skills[sk];
      if (s.complete && s.done > 0 && !d.milestones.includes(`skill:${sk}`)) out.push(`skill:${sk}`);
    }
    if (d.current === "finish" && d.totals.done > 0 && !d.milestones.includes("finish")) out.push("finish");
    return out;
  }, [d.loading, d.goal, d.placementDone, d.skills, d.milestones, d.current, d.totals.done]);
  const [milestone, setMilestone] = useState<string | null>(null);
  useEffect(() => {
    if (!milestone && pendingMilestones.length) setMilestone(pendingMilestones[pendingMilestones.length - 1]);
  }, [pendingMilestones, milestone]);
  const closeMilestone = () => {
    pendingMilestones.forEach((m) => void d.markMilestone(m));
    setMilestone(null);
  };

  if (d.loading) return <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/30" />;

  const goalModal = <GoalSetupModal open={goalOpen} onOpenChange={setGoalOpen} goal={d.goal} onSave={d.saveGoal} />;

  // Đã qua ngày thi → giữ màn "Bạn thi thế nào rồi?" như ô mục tiêu cũ.
  if (d.goal && d.daysToExam !== null && d.daysToExam < 0) {
    return (
      <>
        <Shell>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <MessageSquareHeart className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-base font-extrabold md:text-lg">Bạn thi thế nào rồi?</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Chia sẻ lại đề bạn gặp để giúp các bạn thi sau nhé.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild><Link to="/reviews">Chia sẻ lại đề — Review tích đức</Link></Button>
              <Button variant="outline" onClick={() => setGoalOpen(true)}>Đặt mục tiêu mới</Button>
            </div>
          </div>
        </Shell>
        {goalModal}
      </>
    );
  }

  const cur = d.current;
  const idx = stepIndex(cur);
  const isSkill = PATH_SKILLS.includes(cur as PathSkill);
  const examToday = d.daysToExam === 0;
  const pose = examToday ? "cheer" : POSE[cur];

  const goalChip = d.goal ? (
    <button
      type="button"
      onClick={() => setGoalOpen(true)}
      className="flex w-full items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-left text-[12.5px] dark:border-orange-900/50 dark:bg-orange-950/30"
    >
      <span className="min-w-0 flex-1">
        {examToday ? (
          <>🎯 <b className="text-primary">Hôm nay thi</b> · Aim <b className="text-primary">{d.goal.aim}</b></>
        ) : (
          <>🎯 Còn <b className="text-primary">{d.daysToExam} ngày</b> tới ngày thi · Aim <b className="text-primary">{d.goal.aim}</b> · Hôm nay {d.todayCount}/{d.goal.daily_target} bài</>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground"><Pencil className="h-3 w-3" /> Sửa</span>
    </button>
  ) : null;

  const lockStrip = !d.isPro && d.totals.locked > 0 ? (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-[12.5px] text-muted-foreground">
      <span className="min-w-0 flex-1">🔒 Còn <b className="text-foreground">{d.totals.locked} đề key</b> trong gói Pro</span>
      <Link to="/pricing" className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground">
        <Crown className="h-3.5 w-3.5" /> Nâng cấp
      </Link>
    </div>
  ) : null;

  // ───────── nội dung theo bước ─────────
  let body: React.ReactNode = null;
  if (examToday) {
    body = <p className="text-sm text-muted-foreground">Giữ tinh thần thoải mái, đọc kỹ đề và quản lý thời gian. Chúc bạn thi thật tốt! 🍀</p>;
  } else if (cur === "goal") {
    body = (
      <div className="space-y-2.5">
        <div className="rounded-xl border border-primary/20 bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold">1 · Đặt mục tiêu</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">30 giây</span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Chọn ngày thi, band mục tiêu và số bài mỗi ngày.</p>
          <Button className="mt-2.5 w-full" onClick={() => setGoalOpen(true)}>Đặt mục tiêu</Button>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2.5 text-[12.5px] text-muted-foreground">
          🔒 Sau đó: thi thử đầu vào → Reading → Listening → Writing → Speaking theo đề key Cao → Vừa → Thấp → Key ngày thi → thi thử về đích.
        </div>
      </div>
    );
  } else if (cur === "placement") {
    body = (
      <div className="rounded-xl border border-primary/20 bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold">2 · Thi thử đầu vào</p>
          <span className="rounded-full bg-exam-accent/10 px-2 py-0.5 text-[11px] font-extrabold text-exam-accent">~2,5 giờ</span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Biết band hiện tại · nắm format bài thi · thấy kỹ năng yếu để tập trung.</p>
        <div className="mt-2.5 flex gap-2">
          <Button asChild className="flex-1"><Link to="/thi-thu">Làm bài thi thử</Link></Button>
          <Button variant="outline" onClick={() => void d.skipPlacement()}>Bỏ qua</Button>
        </div>
      </div>
    );
  } else if (isSkill) {
    const sk = cur as PathSkill;
    const s = d.skills[sk];
    body = (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start">
        <div className="hidden min-w-0 md:block">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-sm font-extrabold">Đang ôn: {SKILL_VI[sk]}</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">Ưu tiên Cao trước</span>
          </div>
          <TierBars stat={s} />
          <p className="mt-2.5 text-xs text-muted-foreground">Ôn từng part trong Luyện tập từng kỹ năng — chưa cần Full Part.</p>
        </div>
        <div className="min-w-0 space-y-2">
          <p className="hidden text-sm font-extrabold md:block">Làm tiếp</p>
          {s.next.slice(0, 2).map((it, i) => (
            <div key={it.examSetId ?? i} className={i > 0 ? "hidden md:block" : ""}><NextItem item={it} primary={i === 0} /></div>
          ))}
        </div>
      </div>
    );
  } else if (cur === "examKey") {
    const ek = d.examKey;
    body = ek?.published ? (
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {PATH_SKILLS.map((sk) => {
            const n = ek.items.filter((i) => i.skill === sk && !i.done).length;
            return (
              <span key={sk} className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", n ? "bg-primary/10 text-primary" : "bg-success/10 text-success")}>
                {SKILL_VI[sk]} {n}
              </span>
            );
          })}
        </div>
        {ek.items.filter((i) => !i.done && !i.locked).slice(0, 3).map((it, i) => (
          <NextItem key={it.examSetId ?? i} item={it} primary={i === 0} />
        ))}
        <Button variant="outline" className="w-full" asChild><Link to="/thi-thu">Xong rồi → Thi thử về đích 🏁</Link></Button>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Key ngày {ddmm(d.goal?.exam_date)} sẽ có trong tối nay. Trong lúc chờ, ôn lại câu sai ở mục Lịch sử nhé.</p>
    );
  } else if (cur === "finish") {
    body = (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1"><Link to="/thi-thu">Làm thi thử full 🏁</Link></Button>
        <Button asChild variant="outline" className="flex-1"><Link to="/reading?tab=full">Luyện Full Part</Link></Button>
      </div>
    );
  }

  const strip = (
    <>
      {/* Điện thoại: thanh 8 chặng gọn */}
      <div className="flex items-end gap-1.5 md:hidden">
        {STEP_ORDER.map((k) => {
          const st = stepState(d, k);
          return (
            <div key={k} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 text-[10.5px] font-extrabold", st === "cur" ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", st === "cur" && "ring-2 ring-primary/20")}>
                <span className={cn("block h-full rounded-full", st === "cur" ? "bg-primary" : "bg-success")} style={{ width: `${skillProgress(d, k)}%` }} />
              </span>
              {STEP_SHORT[k]}
            </div>
          );
        })}
      </div>
      {/* Máy tính: stepper có nhãn */}
      <div className="hidden items-start md:flex">
        {STEP_ORDER.map((k, i) => {
          const st = stepState(d, k);
          return (
            <div key={k} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span className={cn("absolute right-1/2 top-[19px] h-[3px] w-full", st !== "todo" ? "bg-success" : "bg-muted")} />
              )}
              <span
                className={cn(
                  "relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 bg-card text-[15px] font-extrabold",
                  st === "done" && "border-success bg-success text-white",
                  st === "cur" && "border-primary text-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.1)]",
                  st === "todo" && "border-border text-muted-foreground",
                )}
              >
                {st === "done" ? <Check className="h-5 w-5" /> : DESK_GLYPH[k]}
              </span>
              <span className={cn("mt-1.5 text-[12.5px] font-extrabold", st === "cur" && "text-primary")}>{STEP_LABEL[k]}</span>
              <span className="text-[11.5px] text-muted-foreground">{stepSub(d, k)}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      <Shell>
        <div className="flex items-end gap-3 bg-gradient-to-b from-primary/[0.07] to-transparent px-4 pt-4 md:px-5">
          <img src={mascotSrc(pose)} alt="Kỳ Kỳ" className="h-[76px] w-auto shrink-0 md:h-[92px]" loading="lazy" />
          <div className="mb-3.5 min-w-0 flex-1">
            <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-primary">
              🧭 Lộ trình Kỳ Tích · Bước {Math.min(idx + 1, 8)}/8
            </p>
            <div className="rounded-2xl rounded-bl-md border border-primary/15 bg-card px-3 py-2.5 shadow-sm">
              {examToday ? <Bubble parts={[{ b: "Hôm nay thi rồi!" }, " Hít thở sâu, làm chắc từng câu. Kỳ Kỳ tin bạn 💪"]} /> : <Bubble parts={bubbleFor(d)} />}
            </div>
          </div>
          {goalChip && <div className="mb-3.5 hidden w-[330px] shrink-0 md:block">{goalChip}</div>}
        </div>

        <div className="space-y-3 px-4 pb-4 pt-1 md:px-5 md:pb-5">
          {d.goal && strip}
          {goalChip && <div className="md:hidden">{goalChip}</div>}
          {body}
          {lockStrip}
          {d.goal && (
            <button
              type="button"
              onClick={() => setPathOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-sm font-bold text-foreground hover:border-primary/40 md:w-auto md:border-0 md:bg-transparent md:p-0 md:text-primary"
            >
              Xem lộ trình của bạn <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </Shell>
      {goalModal}
      <LearningPathDialog open={pathOpen} onOpenChange={setPathOpen} data={d} onEditGoal={() => { setPathOpen(false); setGoalOpen(true); }} />
      <MilestoneDialog milestone={milestone} data={d} onClose={closeMilestone} />
    </>
  );
};

const LearningPathCard = () => <LearningPathView data={useLearningPath()} />;

export default LearningPathCard;
