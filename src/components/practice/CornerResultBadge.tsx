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
        className="inline-flex flex-col items-center justify-center select-none"
        style={{
          minWidth: 48,
          height: 48,
          padding: "0 8px",
          borderRadius: 14,
          color: "#7c2d12",
          background: "#fbbf24",
          border: "2px solid #fff",
          boxShadow: "0 5px 13px rgba(245,158,11,.55)",
          lineHeight: 1.05,
        }}
      >
        <Trophy style={{ width: 15, height: 15 }} strokeWidth={2.5} />
        <span style={{ fontSize: 12, fontWeight: 800, marginTop: 1 }}>{value}</span>
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
