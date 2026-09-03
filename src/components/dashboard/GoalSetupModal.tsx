import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { vnTodayISO, vnDaysUntil } from "@/lib/vnDate";
import type { UserGoal } from "@/hooks/useUserGoal";

const AIMS = ["B1", "B2", "C1"] as const;

const suggestTarget = (examDate: string) => {
  const days = vnDaysUntil(examDate);
  if (days < 14) return 5;
  if (days <= 30) return 4;
  return 3;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: UserGoal | null;
  onSave: (input: { exam_date: string; aim: string; daily_target: number }) => Promise<void>;
}

const GoalSetupModal = ({ open, onOpenChange, goal, onSave }: Props) => {
  const [examDate, setExamDate] = useState(goal?.exam_date ?? "");
  const [aim, setAim] = useState<string>(goal?.aim ?? "B2");
  const [target, setTarget] = useState<number>(goal?.daily_target ?? 3);
  const [touchedTarget, setTouchedTarget] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reopen with existing values (edit mode).
  useEffect(() => {
    if (!open) return;
    setExamDate(goal?.exam_date ?? "");
    setAim(goal?.aim ?? "B2");
    setTarget(goal?.daily_target ?? 3);
    setTouchedTarget(!!goal);
  }, [open, goal]);

  // Prefill the daily target from the exam date until the user edits it.
  useEffect(() => {
    if (!examDate || touchedTarget) return;
    setTarget(suggestTarget(examDate));
  }, [examDate, touchedTarget]);

  const today = vnTodayISO();
  const isFuture = !!examDate && vnDaysUntil(examDate) >= 0;

  const submit = async () => {
    if (!isFuture) {
      toast({ title: "Ngày thi không được ở quá khứ", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ exam_date: examDate, aim, daily_target: target });
      toast({ title: "Đã lưu mục tiêu 🎯" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Không lưu được mục tiêu", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const step = (delta: number) => {
    setTouchedTarget(true);
    setTarget((t) => Math.max(1, Math.min(20, t + delta)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Target className="w-5 h-5 text-primary" /> Mục tiêu của bạn
          </DialogTitle>
          <DialogDescription>Chọn ngày thi, band mục tiêu và số bài luyện mỗi ngày.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Ngày thi</label>
            <Input type="date" min={today} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            {examDate && !isFuture && (
              <p className="text-xs text-destructive mt-1">Ngày thi không được ở quá khứ.</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">Band mục tiêu (Aim)</label>
            <div className="grid grid-cols-3 gap-2">
              {AIMS.map((a) => (
                <Button
                  key={a}
                  type="button"
                  variant={aim === a ? "default" : "outline"}
                  onClick={() => setAim(a)}
                  className="font-bold"
                >
                  {a}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">Số bài mỗi ngày</label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" onClick={() => step(-1)} disabled={target <= 1}>
                <Minus className="w-4 h-4" />
              </Button>
              <div className="w-16 text-center text-2xl font-heading font-extrabold">{target}</div>
              <Button type="button" variant="outline" size="icon" onClick={() => step(1)} disabled={target >= 20}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Gợi ý dựa trên ngày thi của bạn — chỉnh thoải mái.
            </p>
          </div>

          <Button className="w-full" onClick={submit} disabled={saving || !isFuture}>
            {saving ? "Đang lưu..." : "Lưu mục tiêu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalSetupModal;
