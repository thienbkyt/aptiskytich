import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import type { SampleAnswerPair } from "@/data/speakingQuestions";

interface Props {
  pair?: SampleAnswerPair | null;
  /** Optional heading suffix, e.g. "cho cả phần này". */
  note?: string;
}

/**
 * Collapsed-by-default reference sample answer, shown only on results/review
 * screens (never while the student is still speaking). Renders nothing when
 * the question has no sample answer in exam_questions.extra_data.
 */
const SpeakingSampleAnswerBlock = ({ pair, note }: Props) => {
  const basic = (pair?.basic || "").trim();
  const advanced = (pair?.advanced || "").trim();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"basic" | "advanced">("basic");

  if (!basic && !advanced) return null;

  const effective =
    level === "basic" && !basic ? "advanced"
    : level === "advanced" && !advanced ? "basic"
    : level;
  const text = effective === "advanced" ? advanced : basic;
  const words = text.split(/\s+/).filter(Boolean).length;

  const cardCls = (active: boolean) =>
    `flex-1 text-left rounded-xl border p-3 transition-colors ${
      active
        ? "bg-[#24085a] text-white border-[#24085a]"
        : "bg-card text-muted-foreground border-border hover:border-foreground/20"
    }`;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#24085a] dark:text-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          📖 Bài mẫu tham khảo{note ? ` ${note}` : ""}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
          {open ? "Ẩn bài mẫu" : "Xem bài mẫu"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => setLevel("basic")} className={cardCls(effective === "basic")}>
              <span className="block text-sm font-bold">Bản B1</span>
              <span className="block text-[11px] mt-0.5 opacity-80">Dễ học · phù hợp aim B1</span>
            </button>
            <button type="button" onClick={() => setLevel("advanced")} className={cardCls(effective === "advanced")}>
              <span className="block text-sm font-bold">Bản B2 trở lên</span>
              <span className="block text-[11px] mt-0.5 opacity-80">Câu phong phú hơn</span>
            </button>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{text}</p>
          <p className="text-xs text-muted-foreground mt-2">{words} từ</p>
        </div>
      )}
    </div>
  );
};

export default SpeakingSampleAnswerBlock;
