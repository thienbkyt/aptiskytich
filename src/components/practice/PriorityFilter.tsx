import type { PriorityLabel } from "@/hooks/useExamPriorityLabels";

export type PriorityFilterValue = "all" | PriorityLabel;

interface Props {
  value: PriorityFilterValue;
  onChange: (v: PriorityFilterValue) => void;
  counts?: Partial<Record<PriorityFilterValue, number>>;
  className?: string;
}

const CHIPS: { key: PriorityFilterValue; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "high", label: "Ưu tiên cao" },
  { key: "medium", label: "Ưu tiên vừa" },
  { key: "low", label: "Ưu tiên thấp" },
];

const PriorityFilter = ({ value, onChange, counts, className = "" }: Props) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground mr-1">Lọc ưu tiên:</span>
      {CHIPS.map((chip) => {
        const active = value === chip.key;
        const n = counts?.[chip.key];
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {chip.label}
            {typeof n === "number" && <span className="ml-1 opacity-70">({n})</span>}
          </button>
        );
      })}
    </div>
  );
};

export default PriorityFilter;
