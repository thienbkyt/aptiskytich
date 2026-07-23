import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TechSkeleton } from "@/components/ui/tech-skeleton";
import SignedImage from "@/components/exam/SignedImage";
import { fetchExamQuestions, type ExamSetRow, type ExamQuestionRow } from "@/hooks/useExamSets";
import type { SpeakingPartType } from "@/data/speakingQuestions";
import { toast } from "sonner";

interface Props {
  sets: ExamSetRow[];
  partType: SpeakingPartType;
  partLabel: string;
  onExit: () => void;
}

const partSubtitle: Record<SpeakingPartType, string> = {
  part1: "Personal Questions",
  part2: "Describe a Picture",
  part3: "Compare Pictures",
  part4: "Opinion Questions",
};

const SpeakingBrowseViewer = ({ sets, partType, partLabel, onExit }: Props) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [questions, setQuestions] = useState<ExamQuestionRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const currentSet = sets[activeIdx];

  useEffect(() => {
    if (!currentSet) return;
    let cancelled = false;
    setLoading(true);
    setQuestions(null);
    fetchExamQuestions(currentSet.id)
      .then((rows) => {
        if (cancelled) return;
        setQuestions(rows || []);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[SpeakingBrowseViewer] load failed", e);
        toast.error("Không tải được đề. Vui lòng thử lại.");
        setQuestions([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentSet?.id]);

  // Scroll to top when switching sets
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeIdx]);

  const goPrev = () => setActiveIdx((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIdx((i) => Math.min(sets.length - 1, i + 1));

  const firstRow = questions?.[0];
  const extra: any = firstRow?.extra_data || {};

  // Resolve images per part
  const images = useMemo<string[]>(() => {
    if (!firstRow) return [];
    if (partType === "part2") {
      const u = firstRow.image_url;
      return u ? [u] : [];
    }
    if (partType === "part3") {
      const u1 = extra.imageUrl1 ?? firstRow.image_url ?? null;
      const u2 = extra.imageUrl2 ?? null;
      return [u1, u2].filter(Boolean) as string[];
    }
    return [];
  }, [firstRow, extra, partType]);

  if (!currentSet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-muted-foreground">Chưa có đề để xem.</p>
        <Button onClick={onExit} variant="outline">Quay lại</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={onExit} className="gap-1">
              <X className="w-4 h-4" /> Thoát
            </Button>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">
                Xem toàn bộ đề Speaking · {partLabel} – {partSubtitle[partType]}
              </div>
              <div className="text-sm font-semibold text-foreground truncate">
                {currentSet.title}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="text-[11px] font-semibold gap-1 shrink-0">
            <Eye className="w-3 h-3" /> Chỉ xem
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left: content */}
        <div className="min-w-0 space-y-5">
          {/* Notice banner */}
          <div className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              <strong>Bài nói mẫu tham khảo</strong> — không phải để làm bài. Muốn tự luyện nói và được AI chấm, vào{" "}
              <strong>Luyện Part</strong> hoặc <strong>Full test</strong>.
            </p>
          </div>

          <h2 className="text-2xl font-heading font-bold text-foreground">
            Đề {activeIdx + 1} of {sets.length}
          </h2>

          {loading || !questions ? (
            <div className="space-y-3">
              <TechSkeleton variant="text" className="w-2/3" />
              <TechSkeleton variant="card" className="h-32" />
              <TechSkeleton variant="card" className="h-32" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-muted-foreground">Đề này chưa có nội dung.</p>
          ) : (
            <>
              {/* Images for Part 2 / Part 3 */}
              {images.length > 0 && (
                <div className={`grid gap-3 ${images.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                  {images.map((src, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-border bg-muted">
                      <SignedImage src={src} alt={`Đề ${activeIdx + 1} – hình ${i + 1}`} className="w-full h-auto object-contain" />
                    </div>
                  ))}
                </div>
              )}

              {/* Questions + sample answers */}
              <div className="space-y-5">
                {questions.map((q, qi) => {
                  const sample = (q.extra_data as any)?.sampleAnswer || q.explanation || "";
                  return (
                    <div key={q.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-start gap-2 mb-3">
                        <Badge variant="secondary" className="text-[11px] font-semibold shrink-0 mt-0.5">
                          Câu {qi + 1}
                        </Badge>
                        <p className="text-base font-semibold text-foreground leading-relaxed">
                          {q.question_text}
                        </p>
                      </div>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-primary mb-2">
                          Bài nói mẫu
                        </div>
                        {sample.trim() ? (
                          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                            {sample}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Chưa có bài nói mẫu.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Prev / Next */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={activeIdx === 0}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Đề trước
            </Button>
            <div className="text-xs text-muted-foreground">
              {activeIdx + 1} / {sets.length}
            </div>
            <Button
              variant="outline"
              onClick={goNext}
              disabled={activeIdx >= sets.length - 1}
              className="gap-1.5"
            >
              Đề sau <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right: navigator */}
        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Mục lục đề · {partLabel}
            </div>
            <div className="grid grid-cols-6 lg:grid-cols-5 gap-2">
              {sets.map((s, i) => {
                const active = i === activeIdx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    title={s.title}
                    className={`h-9 rounded-md text-xs font-semibold transition-all border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow"
                        : "bg-background text-foreground border-border hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              Chỉ xem đề và bài nói mẫu. Không ghi âm, không chấm điểm.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SpeakingBrowseViewer;
