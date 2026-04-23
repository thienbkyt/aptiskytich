import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Volume2, Check, RotateCcw, ArrowLeft, Trophy } from "lucide-react";

function speak(text: string, lang: "en" | "vi") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "en" ? "en-US" : "vi-VN";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

interface VocabWord {
  id: string;
  word: string;
  word_type?: string;
  phonetic?: string;
  meaning?: string;
  example_en?: string;
  example_vi?: string;
  word_family: string[];
}

interface FlashcardModeProps {
  words: VocabWord[];
  learnedWords: Set<string>;
  onMarkLearned: (word: string) => void;
  onBackToList: () => void;
}

const FlashcardMode = ({ words, learnedWords, onMarkLearned, onBackToList }: FlashcardModeProps) => {
  // Initial pile: words not yet learned. If all already learned, use full list so user can review.
  const initialPile = useMemo(() => {
    const remaining = words.filter((w) => !learnedWords.has(w.word));
    return remaining.length > 0 ? remaining : words;
  }, [words, learnedWords]);

  const [pile, setPile] = useState<VocabWord[]>(initialPile);
  const [flipped, setFlipped] = useState(false);
  const [learnedCount, setLearnedCount] = useState(0);

  // Reset when underlying words list changes (e.g., dataset loads)
  useEffect(() => {
    setPile(initialPile);
    setFlipped(false);
    setLearnedCount(0);
  }, [initialPile]);

  const total = initialPile.length;
  const remaining = pile.length;
  const progressPct = total === 0 ? 0 : ((total - remaining) / total) * 100;
  const current = pile[0];

  const handleReview = () => {
    if (pile.length <= 1) {
      // Only one card → moving to end means same card stays; just unflip
      setFlipped(false);
      return;
    }
    setFlipped(false);
    // small delay so flip-back animation looks clean before swap
    setTimeout(() => {
      setPile((prev) => [...prev.slice(1), prev[0]]);
    }, 150);
  };

  const handleLearned = () => {
    if (!current) return;
    onMarkLearned(current.word);
    setLearnedCount((c) => c + 1);
    setFlipped(false);
    setTimeout(() => {
      setPile((prev) => prev.slice(1));
    }, 150);
  };

  const handleRestart = () => {
    setPile(words);
    setFlipped(false);
    setLearnedCount(0);
  };

  // Done screen
  if (!current) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-[hsl(170,55%,40%)]/10 flex items-center justify-center mx-auto mb-5">
          <Trophy className="w-10 h-10 text-[hsl(170,55%,40%)]" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Bạn đã hoàn thành! 🎉</h2>
        <p className="text-muted-foreground mb-8">
          Đã thuộc <span className="font-semibold text-foreground">{learnedCount}</span> / {total} từ trong phiên này
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={handleRestart}
            className="bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,34%)] text-white gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Học lại từ đầu
          </Button>
          <Button variant="outline" onClick={onBackToList} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Quay về danh sách
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <p className="text-sm text-muted-foreground">
          Đã thuộc: <span className="font-semibold text-foreground">{learnedCount}</span>
        </p>
        <Badge variant="outline" className="shrink-0">Còn lại: {remaining} từ</Badge>
      </div>
      <Progress value={progressPct} className="h-2 mb-6" />

      {/* Flashcard */}
      <div className="[perspective:1200px] mb-6">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="relative w-full min-h-[360px] [transform-style:preserve-3d] transition-transform duration-500 cursor-pointer"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
          aria-label="Lật thẻ"
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 [backface-visibility:hidden] rounded-xl border border-border bg-[hsl(170,50%,96%)] dark:bg-[hsl(170,25%,10%)] shadow-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-foreground">
              {current.word}
              {current.word_type && (
                <span className="text-2xl font-normal text-muted-foreground ml-2">({current.word_type})</span>
              )}
            </h2>
            {current.phonetic && (
              <p className="text-muted-foreground text-base mt-3">{current.phonetic}</p>
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                speak(current.word, "en");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  speak(current.word, "en");
                }
              }}
              className="mt-5 inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              title="Nghe phát âm"
            >
              <Volume2 className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground mt-8">Bấm để lật thẻ</p>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl border border-border bg-card shadow-sm p-6 overflow-y-auto text-left"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-heading font-bold text-foreground">{current.word}</h3>
                <p className="text-lg font-semibold text-[hsl(170,55%,35%)] dark:text-[hsl(170,55%,55%)] mt-1">
                  {current.meaning || "—"}
                </p>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  speak(current.word, "en");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    speak(current.word, "en");
                  }
                }}
                className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                title="Nghe phát âm"
              >
                <Volume2 className="w-4 h-4" />
              </div>
            </div>

            {(current.example_en || current.example_vi) && (
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Ví dụ</p>
                {current.example_en && (
                  <p className="text-foreground italic text-sm leading-relaxed">"{current.example_en}"</p>
                )}
                {current.example_vi && (
                  <p className="text-muted-foreground text-sm mt-1">{current.example_vi}</p>
                )}
              </div>
            )}

            {current.word_family.length > 0 && (
              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">Word Family</p>
                <div className="flex flex-wrap gap-1.5">
                  {current.word_family.map((wf) => (
                    <Badge key={wf} variant="secondary" className="text-xs font-normal">{wf}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-4 text-center">Bấm để lật lại</p>
          </div>
        </button>
      </div>

      {/* Action buttons (only shown after flip) */}
      <div className="flex items-center justify-center gap-3 min-h-[44px]">
        {flipped ? (
          <>
            <Button variant="outline" onClick={handleReview} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Ôn lại
            </Button>
            <Button
              onClick={handleLearned}
              className="bg-[hsl(142,60%,45%)] hover:bg-[hsl(142,60%,38%)] text-white gap-1.5"
            >
              <Check className="w-4 h-4" /> Đã thuộc
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Lật thẻ để xem nghĩa và đánh giá</p>
        )}
      </div>
    </div>
  );
};

export default FlashcardMode;
