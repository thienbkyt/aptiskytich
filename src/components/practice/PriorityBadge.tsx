import { Flame } from "lucide-react";
import type { PriorityLabel } from "@/hooks/useExamPriorityLabels";
import { PRIORITY_LABEL_VI } from "@/hooks/useExamPriorityLabels";

interface Props {
  label: PriorityLabel | null | undefined;
  className?: string;
}

/**
 * Small badge showing auto-computed exam priority based on prediction-key
 * frequency (see useExamPriorityLabels). Not rendered when label is nullish.
 */
const PriorityBadge = ({ label, className = "" }: Props) => {
  if (!label) return null;
  const base = "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border-0 leading-tight";
  if (label === "high") {
    return (
      <span className={`${base} bg-[#CC1C01] text-white ${className}`} title={PRIORITY_LABEL_VI.high}>
        <Flame className="w-3 h-3" />
        {PRIORITY_LABEL_VI.high}
      </span>
    );
  }
  if (label === "medium") {
    return (
      <span className={`${base} bg-[#FEAD5F] text-[#4D0D0D] ${className}`} title={PRIORITY_LABEL_VI.medium}>
        {PRIORITY_LABEL_VI.medium}
      </span>
    );
  }
  return (
    <span className={`${base} bg-muted text-muted-foreground ${className}`} title={PRIORITY_LABEL_VI.low}>
      {PRIORITY_LABEL_VI.low}
    </span>
  );
};

export default PriorityBadge;
