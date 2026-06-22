import { Trophy } from "lucide-react";
import type { ExamProgressItem } from "@/hooks/useUserExamProgress";

interface Props {
  item?: ExamProgressItem;
  /** Nhãn tùy biến: band "B1" hoặc "85%" — ưu tiên hơn item */
  label?: string;
}

const CornerResultBadge = ({ item, label }: Props) => {
  const value = label ?? (item && item.total > 0 ? `${item.bestScore}/${item.total}` : null);

  if (value) {
    return (
      <span
        className="inline-flex items-center gap-1 select-none"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#92400e",
          background: "#fef3c7",
          padding: "3px 9px",
          borderRadius: 999,
          border: "1px solid #fde68a",
        }}
      >
        <Trophy style={{ width: 13, height: 13 }} strokeWidth={2.25} />
        {value}
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
