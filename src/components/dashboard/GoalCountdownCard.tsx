import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Pencil, Zap, MessageSquareHeart } from "lucide-react";
import { useUserGoal } from "@/hooks/useUserGoal";
import { vnDaysUntil } from "@/lib/vnDate";
import GoalSetupModal from "./GoalSetupModal";

const Ring = ({ value, max, done }: { value: number; max: number; done: boolean }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} className="stroke-muted" strokeWidth="6" fill="none" />
        <circle
          cx="32" cy="32" r={r}
          className={done ? "stroke-success" : "stroke-primary"}
          strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</div>
    </div>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-4 md:p-5">{children}</div>
);

const GoalCountdownCard = () => {
  const { goal, hasFullTest, todayCount, loading, saveGoal } = useUserGoal();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="h-24 rounded-2xl border border-border bg-muted/30 animate-pulse" />;

  const modal = (
    <GoalSetupModal open={open} onOpenChange={setOpen} goal={goal} onSave={saveGoal} />
  );

  // Gate: no goal and no full test yet.
  if (!goal && !hasFullTest) {
    return (
      <Shell>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-extrabold text-base md:text-lg">Bắt đầu đúng cách</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Làm 1 bài thi thử full test trước để biết band hiện tại của bạn — rồi hãy đặt mục tiêu.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/thi-thu">Vào thi thử</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  // Has full test but no goal yet.
  if (!goal) {
    return (
      <>
        <Shell>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/20 text-primary flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-extrabold text-base md:text-lg">🎯 Set up mục tiêu của bạn</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Chọn ngày thi, aim và số bài mỗi ngày.
              </p>
            </div>
            <Button className="shrink-0" onClick={() => setOpen(true)}>Đặt ngay</Button>
          </div>
        </Shell>
        {modal}
      </>
    );
  }

  const days = vnDaysUntil(goal.exam_date);

  // Exam date already passed.
  if (days < 0) {
    return (
      <>
        <Shell>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-extrabold text-base md:text-lg">Bạn thi thế nào rồi?</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Chia sẻ lại đề bạn gặp để giúp các bạn thi sau nhé.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button asChild>
                <Link to="/reviews">Chia sẻ lại đề — Review tích đức</Link>
              </Button>
              <Button variant="outline" onClick={() => setOpen(true)}>Đặt mục tiêu mới</Button>
            </div>
          </div>
        </Shell>
        {modal}
      </>
    );
  }

  const done = todayCount >= goal.daily_target;

  return (
    <>
      <Shell>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-heading font-extrabold text-base md:text-lg">
                {days === 0
                  ? "🎯 Hôm nay thi rồi — giữ tinh thần thoải mái nhé!"
                  : <>🎯 Còn {days} ngày tới ngày thi · Aim {goal.aim}</>}
              </h3>
              {days > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Hôm nay: {todayCount}/{goal.daily_target} bài
                  {done && <span className="text-success font-semibold"> · Xong chỉ tiêu hôm nay 🎉</span>}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="shrink-0 gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Sửa
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {days > 0 && <Ring value={todayCount} max={goal.daily_target} done={done} />}
            <div className="flex-1 min-w-0 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
              <DailySuggestionList dailyTarget={goal.daily_target} done={done} />
            </div>
          </div>
        </div>
      </Shell>
      {modal}
    </>
  );
};

export default GoalCountdownCard;
