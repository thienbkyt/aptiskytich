import { Trophy, CheckCircle2 } from "lucide-react";
import type { ExamProgressItem } from "@/hooks/useUserExamProgress";

interface Props {
  item?: ExamProgressItem;
  /** Nhãn tùy biến: band "B1" hoặc "85%" — ưu tiên hơn item */
  label?: string;
  /** Đánh dấu đã làm bài (dù chưa có điểm chính thức từ skill_results). */
  done?: boolean;
}

const CornerResultBadge = ({ item, label, done }: Props) => {
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

  if (done) {
    return (
      <span
        className="inline-flex items-center gap-1 select-none"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#047857",
          background: "#ECFDF5",
          padding: "3px 9px",
          borderRadius: 999,
          border: "1px solid #A7F3D0",
        }}
      >
        <CheckCircle2 style={{ width: 13, height: 13 }} strokeWidth={2.25} />
        Đã làm
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
