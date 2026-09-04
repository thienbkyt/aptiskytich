import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- seeded RNG (FNV-1a + xorshift) ---------------- */
function fnv1a(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function makeRng(seed: string) {
  let x = fnv1a(seed) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0xffffffff;
  };
}

/** Chọn cố định `count` chỉ số trong [0, total) theo seed. */
export function seededPickIndices(total: number, count: number, seed: string): number[] {
  const idx = Array.from({ length: total }, (_, i) => i);
  const rnd = makeRng(seed);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.max(0, Math.min(total, count))).sort((a, b) => a - b);
}

/* ---------------- helpers ---------------- */
function normalize(w: string) {
  return w.toLowerCase().replace(/[^a-z0-9']/gi, "");
}

type Token = { text: string; isWord: boolean; wordIndex: number };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /[A-Za-z0-9']+/g;
  let last = 0;
  let wi = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isWord: false, wordIndex: -1 });
    out.push({ text: m[0], isWord: true, wordIndex: wi++ });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), isWord: false, wordIndex: -1 });
  return out;
}

export type FillBlanksResult = {
  correct: number;
  total: number;
  filled: string[];
  filledSentence: string;
};

type Props = {
  text: string;
  ratio: number;
  sentenceId?: string;
  disabled?: boolean;
  onCheck: (result: FillBlanksResult) => void;
  hintUsed: boolean;
  onHint: () => void;
  onReset: () => void;
};

export default function FillBlanks({
  text,
  ratio,
  sentenceId,
  disabled,
  onCheck,
  hintUsed,
  onHint,
  onReset,
}: Props) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const words = useMemo(() => tokens.filter((t) => t.isWord), [tokens]);

  const hiddenWordIdx = useMemo(() => {
    const total = words.length;
    if (!total) return [] as number[];
    const count = Math.max(1, Math.round(total * ratio));
    return seededPickIndices(total, count, `${sentenceId ?? text}:${ratio}`);
  }, [words.length, ratio, sentenceId, text]);

  const slotOf = useMemo(() => {
    const map = new Map<number, number>();
    hiddenWordIdx.forEach((wi, slot) => map.set(wi, slot));
    return map;
  }, [hiddenWordIdx]);

  const [values, setValues] = useState<string[]>(() => hiddenWordIdx.map(() => ""));
  const [hintPos, setHintPos] = useState<Record<number, number>>({});
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setValues(hiddenWordIdx.map(() => ""));
    setHintPos({});
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenWordIdx.join(","), text]);

  const focusSlot = (i: number) => {
    const el = inputsRef.current[i];
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const check = () => {
    if (disabled) return;
    let correct = 0;
    hiddenWordIdx.forEach((wi, slot) => {
      const expected = normalize(words[wi]?.text ?? "");
      if (expected && normalize(values[slot] ?? "") === expected) correct++;
    });
    onCheck({ correct, total: hiddenWordIdx.length, filled: values.slice() });
  };

  const handleHint = () => {
    if (hintUsed || disabled) return;
    const next: Record<number, number> = { ...hintPos };
    const rnd = makeRng(`${sentenceId ?? text}:hint:${ratio}`);
    hiddenWordIdx.forEach((wi, slot) => {
      if ((values[slot] ?? "").trim()) return;
      const len = words[wi]?.text.length ?? 0;
      if (len > 0) next[slot] = Math.floor(rnd() * len);
    });
    setHintPos(next);
    onHint();
  };

  const handleReset = () => {
    setValues(hiddenWordIdx.map(() => ""));
    onReset();
    focusSlot(0);
  };

  const placeholderFor = (slot: number, wi: number) => {
    const pos = hintPos[slot];
    if (pos === undefined) return "";
    const w = words[wi]?.text ?? "";
    return w
      .split("")
      .map((ch, i) => (i === pos ? ch : "_"))
      .join("");
  };

  return (
    <div>
      <div className="text-base sm:text-lg leading-[2.6] font-semibold text-foreground">
        {tokens.map((t, i) => {
          if (!t.isWord) {
            return (
              <span key={i} className="whitespace-pre-wrap font-normal">
                {t.text}
              </span>
            );
          }
          const slot = slotOf.get(t.wordIndex);
          if (slot === undefined) {
            return <span key={i}>{t.text}</span>;
          }
          const w = t.text;
          return (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[slot] = el;
              }}
              value={values[slot] ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setValues((prev) => {
                  const n = [...prev];
                  n[slot] = e.target.value;
                  return n;
                })
              }
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  focusSlot(Math.min(slot + 1, hiddenWordIdx.length - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  check();
                } else if (e.key === "Backspace" && !(values[slot] ?? "").length) {
                  e.preventDefault();
                  focusSlot(Math.max(slot - 1, 0));
                }
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={placeholderFor(slot, t.wordIndex)}
              aria-label={`Từ thứ ${slot + 1}`}
              style={{ width: `${Math.max(4, w.length + 1)}ch` }}
              className={cn(
                "mx-0.5 bg-transparent border-0 border-b-2 border-primary/50 text-center",
                "font-semibold text-foreground outline-none focus:border-primary",
                "placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-widest",
                disabled && "opacity-70",
              )}
            />
          );
        })}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground">Nhấn phím Space để qua từ</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleHint}
            disabled={hintUsed || disabled}
            className="border-2 border-[#FEAD5F] text-foreground hover:bg-[#FEAD5F]/10"
          >
            <Lightbulb className="w-4 h-4 mr-2" /> Gợi ý
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={disabled}>
            <RotateCcw className="w-4 h-4 mr-2" /> Làm lại
          </Button>
          <Button type="button" size="sm" onClick={check} disabled={disabled}>
            Kiểm tra
          </Button>
        </div>
      </div>
    </div>
  );
}
