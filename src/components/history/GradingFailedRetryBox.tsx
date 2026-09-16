import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Shown in the Speaking / Writing history review when the AI grading job for an
 * attempt gave up (status 'failed') and no *_skill_results row exists.
 *
 * The learner never sees a fake 0 — they get one button that calls
 * requeue_grading_jobs (max 3 times per attempt, enforced in the database) and
 * then a "đang chấm lại" state.
 */
export default function GradingFailedRetryBox({
  testResultId,
  skill,
  hasResult,
}: {
  testResultId?: string | null;
  skill: "speaking" | "writing";
  /** True when the graded result already exists — the box then stays hidden. */
  hasResult: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requeued, setRequeued] = useState(false);

  const check = useCallback(async () => {
    if (!testResultId || hasResult) { setFailed(false); return; }
    const { data } = await (supabase as any)
      .from("grading_jobs")
      .select("id,status,part")
      .eq("test_result_id", testResultId)
      .eq("skill", skill)
      .in("status", ["failed", "done"]);
    const rows = (Array.isArray(data) ? data : []) as any[];
    // A part that already has a 'done' job is graded — ignore its failed twin.
    const donePart = new Set(rows.filter((r) => r.status === "done").map((r) => r.part ?? ""));
    setFailed(rows.some((r) => r.status === "failed" && !donePart.has(r.part ?? "")));
  }, [testResultId, skill, hasResult]);

  useEffect(() => { void check(); }, [check]);

  if (!failed && !requeued) return null;

  const onRetry = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("requeue_grading_jobs", {
        _test_result_id: testResultId,
      });
      if (error) {
        toast.error("Không gửi lại được. Vui lòng thử lại sau ít phút.");
        return;
      }
      if (!Number(data)) {
        toast.error("Bài này đã chấm lại tối đa 3 lần. Vui lòng liên hệ hỗ trợ.");
        return;
      }
      setRequeued(true);
      setFailed(false);
      supabase.functions.invoke("process-grading-jobs", { body: {} }).catch(() => {});
      toast.success("Đã gửi lại. Bài sẽ được chấm trong ít phút.");
    } finally {
      setBusy(false);
    }
  };

  if (requeued) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        Đang chấm lại bài của bạn. Quay lại sau vài phút để xem điểm.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Chấm bài bị lỗi, bấm để chấm lại</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bài của bạn vẫn được lưu, chỉ phần chấm điểm gặp sự cố.
          </p>
          <Button size="sm" className="mt-3 gap-2" onClick={onRetry} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Chấm lại
          </Button>
        </div>
      </div>
    </div>
  );
}
