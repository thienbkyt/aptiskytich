import { AlertTriangle } from "lucide-react";
import ExamReportButton from "./ExamReportButton";

interface Props {
  kind: "audio" | "image";
  examQuestionId?: string | null;
  examSetId?: string | null;
  skill: string;
  partType?: string | null;
  questionNumber?: number | null;
  className?: string;
}

/**
 * Placeholder shown in place of a broken/missing audio player or image.
 * Surfaces a clear Vietnamese message + a Báo lỗi button so users can flag
 * the broken question instead of being stuck with a dead play button or
 * invisible image.
 */
export default function MissingMediaNotice({
  kind,
  examQuestionId,
  examSetId,
  skill,
  partType,
  questionNumber,
  className = "",
}: Props) {
  const label =
    kind === "audio" ? "Thiếu audio cho câu này" : "Thiếu ảnh đề bài";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          {label}. Bạn có thể bỏ qua hoặc bấm <b>Báo lỗi</b> để báo cho đội ngũ.
        </span>
      </div>
      <ExamReportButton
        examQuestionId={examQuestionId ?? null}
        examSetId={examSetId ?? null}
        skill={skill}
        partType={partType ?? null}
        questionNumber={questionNumber ?? null}
      />
    </div>
  );
}
