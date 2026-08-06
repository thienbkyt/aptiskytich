import { useEffect } from "react";
import useWritingGradingStatus from "@/hooks/useWritingGradingStatus";
import WritingGradingStatusBanner from "@/components/writing/WritingGradingStatusBanner";

interface Props {
  sessionId: string | null;
  expectedParts: string[];
  /** Fired once the official skill score lands (display update only). */
  onResolved?: (scale50: number, cefr: string) => void;
  className?: string;
}

/**
 * Live "đang chấm / chấm lỗi" notice for a Writing attempt, polling until the
 * background worker finishes. Display-only: it reads persisted results and
 * hands the score up so the score report can re-render without an F5.
 */
const WritingGradingLiveStatus = ({ sessionId, expectedParts, onResolved, className }: Props) => {
  const status = useWritingGradingStatus({
    sessionId,
    expectedParts,
    enabled: Boolean(sessionId) && expectedParts.length > 0,
  });

  useEffect(() => {
    if (!status.isGrading && status.scale50 != null && status.scale50 > 0) {
      onResolved?.(status.scale50, status.cefr || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.isGrading, status.scale50, status.cefr]);

  return (
    <WritingGradingStatusBanner
      pendingParts={status.pendingParts}
      failedParts={status.failedParts}
      recoverableParts={status.recoverableParts}
      onRetry={status.retryPart}
      onRecover={status.recoverPart}
      className={className}
    />
  );
};

export default WritingGradingLiveStatus;
