import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickerSet {
  id: string;
  title: string;
  /** Đã học đề này (đề lẻ hoặc marathon). */
  done?: boolean;
  /** Nhãn trạng thái, vd "Đã làm · đúng 3/4". */
  status?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partLabel: string;
  sets: PickerSet[];
  /** Tick sẵn (null = tick tất cả). */
  initialSelected?: string[] | null;
  /** Marathon đang làm dở của Part này (để cảnh báo trước khi thay). */
  inProgress?: { done: number; total: number } | null;
  /** ids theo thứ tự danh sách; isAll = chọn đủ mọi đề. */
  onStart: (ids: string[], isAll: boolean) => void;
}

const shortName = (title: string) => (title || "").match(/Đề\s*\d+/i)?.[0] ?? title;

const MarathonSetPicker = ({ open, onOpenChange, partLabel, sets, initialSelected, inProgress, onStart }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickN, setQuickN] = useState("10");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const valid = new Set(sets.map((s) => s.id));
    const init = initialSelected?.filter((id) => valid.has(id)) ?? [];
    setSelected(new Set(init.length ? init : sets.map((s) => s.id)));
    setConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const undoneCount = useMemo(() => sets.filter((s) => !s.done).length, [sets]);
  const orderedSel = useMemo(() => sets.filter((s) => selected.has(s.id)), [sets, selected]);
  const doneSel = useMemo(() => orderedSel.filter((s) => s.done), [orderedSel]);
  const newSel = useMemo(() => orderedSel.filter((s) => !s.done), [orderedSel]);
  const replacing = !!inProgress && inProgress.done > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const pickQuick = () => {
    const n = Math.max(1, Math.min(sets.length, parseInt(quickN, 10) || 0));
    // Ưu tiên đề chưa làm, thiếu mới lấy thêm đề đã làm — giữ thứ tự danh sách.
    const chosen = new Set([...sets.filter((s) => !s.done), ...sets.filter((s) => s.done)].slice(0, n).map((s) => s.id));
    setSelected(chosen);
  };

  const launch = (list: PickerSet[]) => {
    if (!list.length) return;
    setConfirmOpen(false);
    onOpenChange(false);
    onStart(list.map((s) => s.id), list.length === sets.length);
  };

  const handleStart = () => {
    if (!orderedSel.length) return;
    if (doneSel.length || replacing) { setConfirmOpen(true); return; }
    launch(orderedSel);
  };

  const doneNames = doneSel.map((s) => shortName(s.title));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 text-left">
            <DialogTitle>Chọn đề Marathon · {partLabel}</DialogTitle>
            <DialogDescription>
              Tick các đề muốn làm liên tục. Kết quả từng đề vẫn được lưu vào ô đề như bình thường.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSelected(new Set(sets.map((s) => s.id)))}>
              Chọn tất cả ({sets.length})
            </Button>
            <Button
              type="button" size="sm" variant="outline" className="h-8"
              disabled={undoneCount === 0}
              onClick={() => setSelected(new Set(sets.filter((s) => !s.done).map((s) => s.id)))}
            >
              Chỉ đề chưa làm ({undoneCount})
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </Button>
          </div>
          <div className="px-5 pb-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Chọn nhanh</span>
            <Input
              type="number" inputMode="numeric" min={1} max={sets.length}
              value={quickN}
              onChange={(e) => setQuickN(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") pickQuick(); }}
              className="h-8 w-16 text-center"
            />
            <span className="text-muted-foreground">đề</span>
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={pickQuick}>Chọn</Button>
            <span className="text-xs text-muted-foreground/80 hidden sm:inline">(ưu tiên đề chưa làm)</span>
          </div>

          <div className="border-y border-border max-h-[50vh] overflow-y-auto">
            {sets.map((s) => {
              const on = selected.has(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 cursor-pointer border-b border-border/60 last:border-b-0 transition-colors",
                    on ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(s.id)} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{s.title}</span>
                  {s.done ? (
                    <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap text-[11px] font-bold px-2 py-[2px] rounded-full bg-success/15 text-success border border-success/30">
                      <CheckCircle2 style={{ width: 11, height: 11 }} strokeWidth={2.25} />
                      {s.status || "Đã làm"}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground/70 bg-muted px-2 py-[2px] rounded-full">Chưa làm</span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Đã chọn <b className="text-foreground">{orderedSel.length}</b>/{sets.length} đề
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Huỷ</Button>
              <Button type="button" disabled={!orderedSel.length} onClick={handleStart} className="gap-1.5 font-semibold">
                Bắt đầu ({orderedSel.length} đề) <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {doneSel.length === 1
                ? `${doneNames[0]} bạn đã học 1 lần rồi`
                : doneSel.length > 1
                  ? `Có ${doneSel.length} đề bạn đã học rồi`
                  : "Thay bộ marathon đang làm dở?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {doneSel.length > 1 && (
                  <p>
                    {doneNames.slice(0, 10).join(", ")}{doneNames.length > 10 ? ` và ${doneNames.length - 10} đề khác` : ""}.
                  </p>
                )}
                {doneSel.length > 0 && <p className="text-foreground font-medium">Bạn có chắc chắn muốn học lại không?</p>}
                {replacing && (
                  <p>
                    Bộ marathon đang làm dở (đã xong {inProgress!.done}/{inProgress!.total} đề) sẽ được thay bằng bộ mới.
                    Kết quả các đề đã làm vẫn giữ nguyên ở từng ô đề.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <AlertDialogCancel className="mt-0">Huỷ</AlertDialogCancel>
            {doneSel.length > 0 && newSel.length > 0 && (
              <Button type="button" variant="outline" onClick={() => launch(newSel)}>
                Chỉ làm {newSel.length} đề chưa học
              </Button>
            )}
            <Button type="button" onClick={() => launch(orderedSel)} className="font-semibold">
              {doneSel.length > 0 ? "Có, học lại" : "Bắt đầu bộ mới"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MarathonSetPicker;
