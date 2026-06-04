import { CheckCircle2 } from "lucide-react";
import type { ExamProgressItem } from "@/hooks/useUserExamProgress";

interface Props {
  item?: ExamProgressItem;
}

/**
 * Renders a status pill on exam-set cards:
 * - "Đã hoàn thành ✓ • X/Y (Z%)" in success color when user has results
 * - "Chưa bắt đầu" muted otherwise
 */
const CompletionBadge = ({ item }: Props) => {
  if (item && item.total > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Đã hoàn thành · {item.bestScore}/{item.total} ({item.bestPct}%)
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
      Chưa bắt đầu
    </span>
  );
};

export default CompletionBadge;
