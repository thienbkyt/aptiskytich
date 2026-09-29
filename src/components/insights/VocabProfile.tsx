import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LEVELS = ["A1", "A2", "B1", "B2", "C"] as const;
type Level = (typeof LEVELS)[number];
const COLORS: Record<Level, string> = {
  A1: "bg-slate-300 dark:bg-slate-600",
  A2: "bg-sky-400",
  B1: "bg-emerald-500",
  B2: "bg-amber-500",
  C: "bg-fuchsia-500",
};

const variants = (w: string): string[] => {
  const out = new Set([w]);
  if (w.endsWith("ies") && w.length > 4) out.add(w.slice(0, -3) + "y");
  if (w.endsWith("ied") && w.length > 4) out.add(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3) out.add(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) out.add(w.slice(0, -1));
  if (w.endsWith("ed") && w.length > 3) out.add(w.slice(0, -2));
  if (w.endsWith("d") && w.length > 3) out.add(w.slice(0, -1));
  if (w.endsWith("ing") && w.length > 4) out.add(w.slice(0, -3));
  return [...out];
};

export const extractWords = (text: string): string[] =>
  [...new Set((String(text || "").toLowerCase().match(/[a-z']+/g) || []).map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w.length > 0))];

const VocabProfile = ({ text }: { text: string }) => {
  const words = useMemo(() => extractWords(text), [text]);
  const [levels, setLevels] = useState<Map<string, Level> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!words.length) { setLevels(new Map()); return; }
      const cand = [...new Set(words.flatMap(variants))];
      const lv = new Map<string, Level>();
      for (let i = 0; i < cand.length; i += 300) {
        const { data } = await supabase.from("cefr_words").select("word,level").in("word", cand.slice(i, i + 300));
        for (const r of (data || []) as { word: string; level: string }[]) {
          const raw = String(r.level).toUpperCase().slice(0, 2);
          const L = (raw === "C1" || raw === "C2" ? "C" : raw) as Level;
          if (!LEVELS.includes(L)) continue;
          const prev = lv.get(r.word);
          if (!prev || LEVELS.indexOf(L) < LEVELS.indexOf(prev)) lv.set(r.word, L);
        }
      }
      const res = new Map<string, Level>();
      for (const w of words) {
        let best: Level | undefined;
        for (const v of variants(w)) {
          const L = lv.get(v);
          if (L && (!best || LEVELS.indexOf(L) < LEVELS.indexOf(best))) best = L;
        }
        if (best) res.set(w, best);
      }
      if (!cancelled) setLevels(res);
    })();
    return () => { cancelled = true; };
  }, [words]);

  const total = levels?.size || 0;
  const counts = LEVELS.map((L) => [...(levels?.values() || [])].filter((x) => x === L).length);
  const b1Plus = total ? counts.slice(2).reduce((a, b) => a + b, 0) / total : 0;
  const highlights = [...(levels?.entries() || [])]
    .filter(([, L]) => LEVELS.indexOf(L) >= 3)
    .sort((a, b) => LEVELS.indexOf(b[1]) - LEVELS.indexOf(a[1]))
    .slice(0, 12);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">📚 Hồ sơ từ vựng</h3>
      {levels === null ? (
        <div className="h-3 rounded-full bg-muted animate-pulse" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa đủ từ để phân tích.</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {LEVELS.map((L, i) => counts[i] > 0 && (
              <div key={L} className={COLORS[L]} style={{ width: `${(counts[i] / total) * 100}%` }} title={`${L}: ${counts[i]}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {LEVELS.map((L, i) => (
              <span key={L} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${COLORS[L]}`} />
                {L} {Math.round((counts[i] / total) * 100)}%
              </span>
            ))}
          </div>
          {highlights.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-foreground mb-1.5">Từ nổi bật</p>
              <div className="flex flex-wrap gap-1.5">
                {highlights.map(([w, L]) => (
                  <span key={w} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">
                    {w}
                    <span className={`text-[9px] font-bold text-white rounded-full px-1.5 ${COLORS[L]}`}>{L}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {b1Plus < 0.25 && (
            <p className="text-xs text-primary mt-3">💡 Thử dùng thêm từ B1–B2 để tăng điểm từ vựng</p>
          )}
        </>
      )}
      <p className="text-[10px] text-muted-foreground mt-3">
        Cấp độ từ theo CEFR-J Wordlist (Tono Laboratory, TUFS) và Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0).
      </p>
    </div>
  );
};

export default VocabProfile;
