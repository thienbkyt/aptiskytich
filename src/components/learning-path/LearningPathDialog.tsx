import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PATH_SKILLS, SKILL_VI, STEP_ORDER, type LearningPathData, type PathSkill, type StepKey } from "@/hooks/useLearningPath";
import { STEP_LABEL, ddmm, examKeyOpenDate, stepState } from "./pathText";
import { NextItem, TierBars } from "./PathBits";
import PathGuideDialog from "./PathGuideDialog";

const GLYPH: Record<StepKey, string> = {
  goal: "1", placement: "2", reading: "R", listening: "L", writing: "W", speaking: "S", examKey: "🔑", finish: "🏁",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: LearningPathData;
  onEditGoal: () => void;
}

/** Màn "Lộ trình của bạn": dòng thời gian 8 bước, từng kỹ năng chia Cao/Vừa/Thấp. */
const LearningPathDialog = ({ open, onOpenChange, data: d, onEditGoal }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  return (
  <>
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] w-[calc(100vw-16px)] max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl p-4 sm:p-6">
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center justify-between gap-2 pr-6 font-heading">
          Lộ trình của bạn
          <span className="rounded-full bg-exam-accent/10 px-2.5 py-1 text-xs font-extrabold text-exam-accent">
            {d.totals.done}/{d.totals.total} đề key
          </span>
        </DialogTitle>
      </DialogHeader>

      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-left transition-colors hover:bg-primary/[0.08]"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80">8 bước ôn từ nay tới ngày thi</span>
        <span className="shrink-0 text-xs font-bold text-primary">Đọc hướng dẫn ›</span>
      </button>

      <ol className="mt-1">
        {STEP_ORDER.map((k, i) => {
          const st = stepState(d, k);
          const last = i === STEP_ORDER.length - 1;
          const isSkill = PATH_SKILLS.includes(k as PathSkill);
          return (
            <li key={k} className="relative grid grid-cols-[34px_1fr] gap-2.5 pb-3.5">
              {!last && <span className={cn("absolute left-[16px] top-[34px] bottom-0 w-0.5", st === "done" ? "bg-success" : "bg-muted")} />}
              <span
                className={cn(
                  "relative z-10 grid h-[34px] w-[34px] place-items-center rounded-full border-2 bg-card text-[13px] font-extrabold",
                  st === "done" && "border-success bg-success text-white",
                  st === "cur" && "border-primary text-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]",
                  st === "todo" && "border-border text-muted-foreground",
                )}
              >
                {st === "done" ? <Check className="h-4 w-4" /> : GLYPH[k]}
              </span>
              <div className={cn("min-w-0 rounded-xl border bg-card px-3 py-2.5", st === "cur" ? "border-primary/30 shadow-sm" : "border-border")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold">{STEP_LABEL[k]}</p>
                  {k === "goal" && d.goal && (
                    <button type="button" onClick={onEditGoal} className="text-xs font-bold text-muted-foreground">Sửa</button>
                  )}
                  {isSkill && (
                    <span className={cn("text-xs font-bold", st === "cur" ? "text-primary" : "text-muted-foreground")}>
                      {st === "cur" ? "Đang ôn · " : ""}{d.skills[k as PathSkill].done}/{d.skills[k as PathSkill].total}
                    </span>
                  )}
                  {k === "examKey" && st !== "cur" && d.goal && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold text-muted-foreground">Mở {examKeyOpenDate(d.goal.exam_date)}</span>
                  )}
                </div>

                {k === "goal" && (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {d.goal ? `Thi ${ddmm(d.goal.exam_date)} · Aim ${d.goal.aim} · ${d.goal.daily_target} bài/ngày` : "Chưa đặt mục tiêu"}
                  </p>
                )}
                {k === "placement" && (
                  d.placement ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-[12px] text-muted-foreground">Bài {d.placement.date}:</span>
                      {d.placement.chips.map((c) => (
                        <span key={c.label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold">{c.label} {c.value}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {d.placementSkipped ? "Đã bỏ qua — có thể làm thi thử bất cứ lúc nào." : "Biết band hiện tại, nắm format, thấy kỹ năng yếu."}
                    </p>
                  )
                )}
                {isSkill && (
                  <div className="mt-2">
                    <TierBars stat={d.skills[k as PathSkill]} compact />
                    {st === "cur" && d.skills[k as PathSkill].next.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {d.skills[k as PathSkill].next.slice(0, 2).map((it, j) => (
                          <NextItem key={it.examSetId ?? j} item={it} primary={j === 0} />
                        ))}
                      </div>
                    )}
                    {!d.isPro && d.skills[k as PathSkill].locked > 0 && (
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">🔒 {d.skills[k as PathSkill].locked} đề trong gói Pro</p>
                    )}
                    {st === "done" && d.skills[k as PathSkill].done > 0 && (
                      <Link to={`/${k}?tab=full`} className="mt-1.5 inline-block text-[12px] font-bold text-primary">Thử Full Part {SKILL_VI[k as PathSkill]} →</Link>
                    )}
                  </div>
                )}
                {k === "examKey" && (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {st === "cur" && d.examKey
                      ? d.examKey.published ? `Key ngày ${ddmm(d.examKey.date)} còn ${d.examKey.open + d.examKey.locked} đề bạn chưa làm.` : "Key ngày thi đang cập nhật."
                      : "Trước ngày thi 1 ngày: hiện số đề key của ngày thi bạn chưa làm để ôn nước rút."}
                  </p>
                )}
                {k === "finish" && (
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">Xong 4 kỹ năng → làm thi thử full để đo band trước ngày thi.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </DialogContent>
  </Dialog>
  <PathGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
  </>
  );
};

export default LearningPathDialog;
