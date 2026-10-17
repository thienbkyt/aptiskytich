import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import type { SampleAnswerPair } from "@/data/speakingQuestions";

interface Props {
  pair?: SampleAnswerPair | null;
  /** Optional heading suffix, e.g. "cho cả phần này". */
  note?: string;
  /** Mở sẵn (dùng trong khung Bảng Kỳ Tích & bài mẫu). */
  defaultOpen?: boolean;
  /** Giao diện gọn cho màn xem lại trên điện thoại (tab dạng segmented). */
  compact?: boolean;
}

/**
 * Collapsed-by-default reference sample answer, shown only on results/review
 * screens (never while the student is still speaking). Renders nothing when
 * the question has no sample answer in exam_questions.extra_data.
 */
const SpeakingSampleAnswerBlock = ({ pair, note, defaultOpen = false, compact = false }: Props) => {
  const basic = (pair?.basic || "").trim();
  const advanced = (pair?.advanced || "").trim();
  const [open, setOpen] = useState(defaultOpen);
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
        ? "bg-exam-accent text-exam-accent-foreground border-exam-accent"
        : "bg-card text-muted-foreground border-border hover:border-foreground/20"
    }`;

  if (compact) {
    const seg = (active: boolean) =>
      `flex-1 rounded-lg px-2 py-2 text-center text-[12.5px] font-bold transition-colors ${
        active ? "bg-card text-exam-accent shadow-sm" : "text-exam-accent/70"
      }`;
    return (
      <div className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-foreground">
            <BookOpen className="h-4 w-4 text-exam-accent" />
            Bài mẫu tham khảo{note ? ` ${note}` : ""}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
            {open ? "Ẩn" : "Mở"}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
        {open && (
          <div className="px-4 pb-4">
            <div className="mb-3 flex gap-1 rounded-xl bg-exam-accent/10 p-1">
              {basic && (
                <button type="button" onClick={() => setLevel("basic")} className={seg(effective === "basic")}>
                  Bản B1 · dễ học
                </button>
              )}
              {advanced && (
                <button type="button" onClick={() => setLevel("advanced")} className={seg(effective === "advanced")}>
                  Bản B2+ · phong phú
                </button>
              )}
            </div>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground">{text}</p>
            <p className="mt-2 text-xs text-muted-foreground">{words} từ</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-exam-accent">
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
