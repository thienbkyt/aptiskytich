import { useState } from "react";
import { Trophy, ChevronDown, BookOpen } from "lucide-react";
import ShowcaseSetSamples from "@/components/showcase/ShowcaseSetSamples";
import SpeakingSampleAnswerBlock from "@/components/speaking/SpeakingSampleAnswerBlock";
import type { SampleAnswerPair } from "@/data/speakingQuestions";

export interface WritingSampleItem {
  prompt: string;
  sample?: string | null;
}
export interface SpeakingSampleItem {
  question: string;
  pair?: SampleAnswerPair | null;
}

interface Props {
  skill: "writing" | "speaking";
  examSetId: string | null | undefined;
  partType: string | null | undefined;
  /** Điểm thô của part (để chọn band bài Kỳ Tích phù hợp). */
  rawPart?: number | null;
  writingSamples?: WritingSampleItem[];
  speakingSamples?: SpeakingSampleItem[];
  /** Speaking Part 4: một bài mẫu chung cho cả phần. */
  sharedSpeakingSample?: SampleAnswerPair | null;
}

/**
 * Cuối trang xem lại bài Writing / Speaking: 1 nút mở Bài mẫu + Bảng Kỳ Tích của đề.
 * Đóng mặc định để trang xem lại gọn.
 */
const ReviewKyTichPanel = ({ skill, examSetId, partType, rawPart, writingSamples, speakingSamples, sharedSpeakingSample }: Props) => {
  const [open, setOpen] = useState(false);

  const wItems = (writingSamples || []).filter((s) => (s.sample || "").trim());
  const sItems = (speakingSamples || []).filter((s) => (s.pair?.basic || "").trim() || (s.pair?.advanced || "").trim());
  const hasShared = !!((sharedSpeakingSample?.basic || "").trim() || (sharedSpeakingSample?.advanced || "").trim());
  const hasSamples = wItems.length > 0 || sItems.length > 0 || hasShared;

  if (!examSetId && !hasSamples) return null;

  return (
    <div className="mt-8 mb-4">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-2.5 text-sm font-bold text-amber-900 shadow-sm transition hover:shadow-md hover:border-amber-400 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-200 dark:border-amber-700"
        >
          <Trophy className="h-4 w-4" />
          {open ? "Ẩn Bảng Kỳ Tích & bài mẫu" : "Xem Bảng Kỳ Tích & bài mẫu"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5">
          {hasSamples && (
            <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" /> Bài mẫu của đề
              </h3>

              {wItems.length > 0 && (
                <div className="space-y-4">
                  {wItems.map((it, i) => (
                    <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                      {it.prompt && (
                        <p className="mb-2 whitespace-pre-line text-xs font-semibold text-muted-foreground">
                          {wItems.length > 1 ? `${i + 1}. ` : ""}{it.prompt}
                        </p>
                      )}
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{it.sample}</p>
                    </div>
                  ))}
                </div>
              )}

              {sItems.length > 0 && (
                <div className="space-y-3">
                  {sItems.map((it, i) => (
                    <div key={i}>
                      {it.question && (
                        <p className="mb-1.5 text-sm font-semibold text-foreground">
                          {sItems.length > 1 ? `Câu ${i + 1}: ` : ""}{it.question}
                        </p>
                      )}
                      <SpeakingSampleAnswerBlock pair={it.pair} defaultOpen />
                    </div>
                  ))}
                </div>
              )}

              {hasShared && sItems.length === 0 && (
                <SpeakingSampleAnswerBlock pair={sharedSpeakingSample} note="cho cả phần này" defaultOpen />
              )}
            </section>
          )}

          {examSetId && (
            <ShowcaseSetSamples examSetId={examSetId} rawPart={rawPart ?? null} skill={skill} partType={partType} />
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewKyTichPanel;
