import type { ExamProgressItem } from "@/hooks/useUserExamProgress";

const CornerResultBadge = ({ item }: { item?: ExamProgressItem }) => {
  if (item && item.total > 0) {
    return (
      <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
        {item.bestScore}/{item.total}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
      Chưa làm
    </span>
  );
};

export default CornerResultBadge;
