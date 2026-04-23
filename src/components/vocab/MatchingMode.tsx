import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, RotateCcw, Timer } from "lucide-react";

interface VocabWord {
  id: string;
  word: string;
  meaning: string | null;
}

interface MatchingModeProps {
  words: VocabWord[];
  onBackToList: () => void;
}

const MAX_PAIRS = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickPairs(words: VocabWord[]): VocabWord[] {
  const eligible = words.filter((w) => w.meaning && w.meaning.trim().length > 0);
  const pool = eligible.length > 0 ? eligible : words;
  return shuffle(pool).slice(0, Math.min(MAX_PAIRS, pool.length));
}

const MatchingMode = ({ words, onBackToList }: MatchingModeProps) => {
  const [pairs, setPairs] = useState<VocabWord[]>(() => pickPairs(words));
  const [leftOrder, setLeftOrder] = useState<VocabWord[]>(() => shuffle(pairs));
  const [rightOrder, setRightOrder] = useState<VocabWord[]>(() => shuffle(pairs));
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [shakingIds, setShakingIds] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const total = pairs.length;
  const matchedCount = matchedIds.size;

  // Detect completion
  useEffect(() => {
    if (total > 0 && matchedCount === total && !finished) {
      setRunning(false);
      setFinalTime(seconds);
      setFinished(true);
    }
  }, [matchedCount, total, finished, seconds]);

  const handleLeftClick = (id: string) => {
    if (matchedIds.has(id)) return;
    setSelectedLeft(id);
  };

  const handleRightClick = (id: string) => {
    if (matchedIds.has(id) || !selectedLeft) return;

    if (id === selectedLeft) {
      // correct
      setMatchedIds((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      setSelectedLeft(null);
    } else {
      // wrong → shake both
      const wrongLeft = selectedLeft;
      setShakingIds(new Set([wrongLeft, id]));
      window.setTimeout(() => {
        setShakingIds(new Set());
        setSelectedLeft(null);
      }, 450);
    }
  };

  const restart = () => {
    const newPairs = pickPairs(words);
    setPairs(newPairs);
    setLeftOrder(shuffle(newPairs));
    setRightOrder(shuffle(newPairs));
    setMatchedIds(new Set());
    setSelectedLeft(null);
    setShakingIds(new Set());
    setSeconds(0);
    setFinalTime(0);
    setRunning(true);
    setFinished(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  const verdict = useMemo(() => {
    if (finalTime < 30) return { text: "Siêu nhanh 🔥", color: "text-[hsl(0,75%,50%)]" };
    if (finalTime <= 60) return { text: "Tốt 👍", color: "text-[hsl(38,90%,45%)]" };
    return { text: "Hoàn thành ✓", color: "text-[hsl(170,55%,40%)]" };
  }, [finalTime]);

  if (total === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Bộ từ này chưa đủ dữ liệu để chơi Matching.</p>
        <Button variant="outline" className="mt-4" onClick={onBackToList}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Quay về danh sách
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border border-border overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(45,95%,90%)] dark:bg-[hsl(45,40%,20%)] flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-[hsl(38,90%,45%)]" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Hoàn thành! ⏱ {formatTime(finalTime)}</h2>
            <p className={`text-xl font-semibold mt-3 ${verdict.color}`}>{verdict.text}</p>
            <p className="text-sm text-muted-foreground mt-2">Bạn đã ghép đúng {total} cặp từ.</p>

            <div className="flex items-center justify-center gap-3 mt-8">
              <Button variant="outline" onClick={onBackToList} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Quay về danh sách
              </Button>
              <Button
                onClick={restart}
                className="bg-[hsl(0,98%,40%)] hover:bg-[hsl(0,98%,34%)] text-white gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Chơi lại
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cellClass = (id: string, side: "left" | "right") => {
    const matched = matchedIds.has(id);
    const shaking = shakingIds.has(id);
    const selected = side === "left" && selectedLeft === id;

    let cls = "border-border hover:border-[hsl(0,98%,40%)] hover:bg-[hsl(0,98%,40%)]/5 cursor-pointer";
    if (matched) {
      cls = "border-[hsl(142,60%,45%)] bg-[hsl(142,60%,95%)] dark:bg-[hsl(142,40%,15%)] text-[hsl(142,60%,30%)] dark:text-[hsl(142,60%,70%)] opacity-50 cursor-default";
    } else if (selected) {
      cls = "border-[hsl(0,98%,40%)] bg-[hsl(0,98%,40%)]/10 cursor-pointer";
    }
    if (shaking) cls += " animate-[shake_0.4s_ease-in-out]";
    return cls;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Inline keyframes for shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="text-sm">
          Đã ghép: {matchedCount} / {total}
        </Badge>
        <Badge className="bg-[hsl(170,55%,40%)] hover:bg-[hsl(170,55%,40%)] text-white text-sm gap-1.5">
          <Timer className="w-3.5 h-3.5" /> {formatTime(seconds)}
        </Badge>
      </div>

      <Card className="border border-border overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Bấm 1 từ tiếng Anh bên trái, sau đó bấm nghĩa tiếng Việt tương ứng bên phải.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Left column — English */}
            <div className="flex flex-col gap-2.5">
              {leftOrder.map((w) => (
                <button
                  key={`L-${w.id}`}
                  onClick={() => handleLeftClick(w.id)}
                  disabled={matchedIds.has(w.id)}
                  className={`px-4 py-3 rounded-lg border-2 font-medium text-left transition-all ${cellClass(w.id, "left")}`}
                >
                  {w.word}
                </button>
              ))}
            </div>
            {/* Right column — Vietnamese */}
            <div className="flex flex-col gap-2.5">
              {rightOrder.map((w) => (
                <button
                  key={`R-${w.id}`}
                  onClick={() => handleRightClick(w.id)}
                  disabled={matchedIds.has(w.id) || !selectedLeft}
                  className={`px-4 py-3 rounded-lg border-2 text-left text-sm transition-all ${cellClass(w.id, "right")}`}
                >
                  {w.meaning}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchingMode;
