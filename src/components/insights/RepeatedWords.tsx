import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STOP = new Set(("a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves dear thank thanks really think want like get make know going good well much many will would shall might must also").split(" "));

const RepeatedWords = ({ text }: { text: string }) => {
  const repeated = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of String(text || "").toLowerCase().match(/[a-z']+/g) || []) {
      if (w.length < 4 || STOP.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  }, [text]);
  const [syn, setSyn] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!repeated.length) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, string[]> = {};
      await Promise.all(repeated.map(async ([w]) => {
        const { data } = await supabase.from("dictionary_cache").select("result").eq("word", w).maybeSingle();
        const s = (data?.result as any)?.synonyms;
        if (Array.isArray(s)) out[w] = s.map((x: any) => (typeof x === "string" ? x : x?.word)).filter(Boolean).slice(0, 4);
      }));
      if (!cancelled) setSyn(out);
    })();
    return () => { cancelled = true; };
  }, [repeated]);

  if (!repeated.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="text-sm font-heading font-bold text-foreground mb-3">🔁 Từ lặp lại nhiều</h3>
      <div className="space-y-2">
        {repeated.map(([w, n]) => (
          <div key={w} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{w}</span>
            <span className="text-xs text-muted-foreground">× {n}</span>
            {syn[w]?.length > 0 && (
              <span className="text-xs text-muted-foreground">→ thử: <span className="text-primary">{syn[w].join(", ")}</span></span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RepeatedWords;
