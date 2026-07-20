import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Play, Volume2, Check, ChevronRight, ChevronLeft, Ear, Eye, EyeOff, Lightbulb, CheckCircle2, Repeat, Headphones } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { speakAsync, speakWithTTS, stopTTS } from "@/lib/tts";
import { Pause } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

/** Best-effort upsert of best_accuracy = max(existing, new) for signed-in users. */
async function saveDictationProgress(
  userId: string | undefined,
  setId: string,
  sentenceId: string,
  accuracy: number,
): Promise<number | null> {
  if (!userId) return null;
  try {
    const acc = Math.max(0, Math.min(100, Math.round(accuracy)));
    const { data: existing } = await supabase
      .from("dictation_progress")
      .select("best_accuracy")
      .eq("user_id", userId)
      .eq("sentence_id", sentenceId)
      .maybeSingle();
    const best = Math.max(existing?.best_accuracy ?? 0, acc);
    if (existing && best === existing.best_accuracy) return best;
    await supabase
      .from("dictation_progress")
      .upsert(
        { user_id: userId, set_id: setId, sentence_id: sentenceId, best_accuracy: best },
        { onConflict: "user_id,sentence_id" },
      );
    return best;
  } catch {
    return null;
  }
}


type DictationSet = {
  id: string;
  title: string;
  level: number | null;
  sort: number | null;
  sentence_count?: number;
};

type Sentence = {
  id: string;
  set_id: string;
  text: string;
  audio_url: string | null;
  sort: number | null;
};

type Mode = "check" | "chep";

/* --------- Word-level diff (case & punctuation insensitive) --------- */
type WordDiffPart = { word: string; ok: boolean };
function normalizeWordCore(w: string) {
  return w.toLowerCase().replace(/[^a-z0-9']/gi, "");
}
function diffWords(expected: string, got: string): WordDiffPart[] {
  const expRaw = expected.split(/\s+/).filter(Boolean);
  const gotRaw = got.split(/\s+/).filter(Boolean);
  const a = expRaw.map(normalizeWordCore);
  const b = gotRaw.map(normalizeWordCore);
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] && a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matched = new Array<boolean>(m).fill(false);
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] && a[i - 1] === b[j - 1]) { matched[i - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return expRaw.map((w, k) => ({ word: w, ok: matched[k] }));
}
function wordAccuracyPct(parts: WordDiffPart[]) {
  if (!parts.length) return 0;
  const ok = parts.filter((p) => p.ok).length;
  return Math.round((ok / parts.length) * 100);
}


/* --------- Word tokenization for "Nghe Check" --------- */
type Token = { raw: string; core: string; isWord: boolean };
function tokenize(text: string): Token[] {
  // Split into words vs. non-word chunks so punctuation is preserved.
  const parts = text.match(/[A-Za-z0-9''-]+|[^A-Za-z0-9''-]+/g) ?? [];
  return parts.map((raw) => {
    const isWord = /[A-Za-z0-9]/.test(raw);
    return { raw, core: raw.trim(), isWord };
  });
}
function normalizeWord(w: string) {
  return w.toLowerCase().replace(/[^a-z0-9']/g, "");
}

// Deterministic seeded shuffle so hidden picks stay stable per sentence+ratio.
function seededPickIndices(count: number, howMany: number, seed: string): Set<number> {
  const indices = Array.from({ length: count }, (_, i) => i);
  // FNV-1a hash for a stable numeric seed
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return new Set(indices.slice(0, Math.max(0, Math.min(howMany, count))));
}

/* ==================== List page ==================== */
function DictationListView() {
  usePageMeta({
    title: "Nghe chép chính tả — Aptis Kỳ Tích",
    description: "Luyện nghe và chép lại câu tiếng Anh theo từng bộ, kiểm tra chính xác từng ký tự.",
  });
  const { user } = useAuth();
  const [sets, setSets] = useState<DictationSet[] | null>(null);
  const groupedSets = useMemo(() => {
    if (!sets) return [];
    const groups = new Map<string, { label: string; level: number | null; sets: DictationSet[] }>();
    sets.forEach((s) => {
      const key = s.level != null ? `level-${s.level}` : "uncategorized";
      if (!groups.has(key)) {
        groups.set(key, {
          label: s.level != null ? `Level ${s.level}` : "Chưa phân loại",
          level: s.level ?? null,
          sets: [],
        });
      }
      groups.get(key)!.sets.push(s);
    });
    return Array.from(groups.values())
      .sort((a, b) => (a.level ?? Number.MAX_VALUE) - (b.level ?? Number.MAX_VALUE))
      .map((g) => ({ ...g, sets: [...g.sets].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)) }));
  }, [sets]);
  const [doneBySet, setDoneBySet] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: setsData, error: e1 } = await supabase
        .from("dictation_sets")
        .select("id, title, level, sort")
        .order("sort", { ascending: true })
        .order("created_at", { ascending: true });
      if (e1) { setError(e1.message); return; }
      const ids = (setsData || []).map((s) => s.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: sents } = await supabase
          .from("dictation_sentences")
          .select("set_id")
          .in("set_id", ids);
        (sents || []).forEach((r: any) => { counts[r.set_id] = (counts[r.set_id] || 0) + 1; });
      }
      setSets((setsData || []).map((s) => ({ ...s, sentence_count: counts[s.id] || 0 })));

      if (user?.id && ids.length) {
        const { data: progress } = await supabase
          .from("dictation_progress")
          .select("set_id")
          .eq("user_id", user.id)
          .eq("best_accuracy", 100)
          .in("set_id", ids);
        const done: Record<string, number> = {};
        (progress || []).forEach((r: any) => { done[r.set_id] = (done[r.set_id] || 0) + 1; });
        setDoneBySet(done);
      } else {
        setDoneBySet({});
      }
    })();
  }, [user?.id]);

  const levelMeta = (lvl: number | null) => {
    if (lvl === 1) return { label: "Cơ bản", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
    if (lvl === 2) return { label: "Trung bình", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" };
    if (lvl === 3) return { label: "Nâng cao", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
    if (lvl != null) return { label: "Chuyên sâu", badge: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" };
    return { label: "Khác", badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-background to-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 pt-[144px] md:pt-24 pb-14">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--brand-brown,0_0%_30%))] flex items-center justify-center shadow-sm">
            <Ear className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Nghe chép chính tả</h1>
        </div>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          2 Chế độ: <span className="font-medium text-foreground">Nghe Check</span> (chép từng từ) và{" "}
          <span className="font-medium text-foreground">Nghe Chép</span> (chép nguyên câu) với 3 level.
        </p>

        {error && <p className="text-destructive">{error}</p>}
        {!sets ? (
          <p className="text-muted-foreground">Đang tải…</p>
        ) : sets.length === 0 ? (
          <p className="text-muted-foreground">Chưa có bộ luyện nào.</p>
        ) : (
          <div className="space-y-10">
            {groupedSets.map((group) => {
              const meta = levelMeta(group.level);
              return (
                <section key={group.label}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border", meta.badge)}>
                      <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                      {group.label}
                    </span>
                    <span className="text-sm text-muted-foreground">{meta.label}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{group.sets.length} bộ</span>
                  </div>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {group.sets.map((s) => {
                      const total = s.sentence_count ?? 0;
                      const done = doneBySet[s.id] ?? 0;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      const allDone = user && total > 0 && done >= total;
                      return (
                        <Link key={s.id} to={`/nghe-chep/${s.id}`} className="block group">
                          <Card className="p-5 h-full bg-card rounded-2xl border border-border/70 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:border-primary/60">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                allDone ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary group-hover:bg-primary/15"
                              )}>
                                {allDone ? <CheckCircle2 className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-base md:text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                  {s.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">{total} câu</p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                            </div>
                            {user && total > 0 && (
                              <div className="mt-4">
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      allDone ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-[#FEAD5F]"
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between mt-1.5 text-xs">
                                  <span className="text-muted-foreground">{done}/{total} câu</span>
                                  <span className={cn("font-semibold", allDone ? "text-emerald-600" : "text-primary")}>{pct}%</span>
                                </div>
                              </div>
                            )}
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}

/* ==================== Practice page ==================== */
function DictationPracticeView({ setId }: { setId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [setInfo, setSetInfo] = useState<DictationSet | null>(null);
  const [sentences, setSentences] = useState<Sentence[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("check");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  usePageMeta({
    title: `${setInfo?.title || "Nghe chép chính tả"} — Aptis Kỳ Tích`,
    description: "Luyện nghe với 3 chế độ: nghe full, điền từ, và chép chính tả.",
  });

  useEffect(() => {
    (async () => {
      const [{ data: s, error: e1 }, { data: ss, error: e2 }] = await Promise.all([
        supabase.from("dictation_sets").select("id, title, level, sort").eq("id", setId).maybeSingle(),
        supabase.from("dictation_sentences").select("id, set_id, text, audio_url, sort")
          .eq("set_id", setId).order("sort", { ascending: true }).order("created_at", { ascending: true }),
      ]);
      if (e1 || e2) { setError((e1 || e2)?.message || "Lỗi tải dữ liệu"); return; }
      setSetInfo(s as any);
      setSentences((ss || []) as Sentence[]);
    })();
    return () => { stopTTS(); };
  }, [setId]);

  // Load user's completed (best_accuracy=100) sentences for this set
  useEffect(() => {
    if (!user?.id) { setCompleted(new Set()); return; }
    (async () => {
      const { data } = await supabase
        .from("dictation_progress")
        .select("sentence_id")
        .eq("user_id", user.id)
        .eq("set_id", setId)
        .eq("best_accuracy", 100);
      setCompleted(new Set((data || []).map((r: any) => r.sentence_id)));
    })();
  }, [user?.id, setId]);

  const current = sentences && sentences[idx];
  const total = sentences?.length || 0;

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const chainTokenRef = useRef(0);
  const pendingResolveRef = useRef<(() => void) | null>(null);

  // Persisted playback settings
  const [speed, setSpeed] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem("dict:speed") || "1");
    return Number.isFinite(v) && v >= 0.7 && v <= 1.4 ? v : 1;
  });
  const [repeatCount, setRepeatCount] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("dict:repeatCount") || "3", 10);
    return [2, 3, 4, 5].includes(v) ? v : 3;
  });
  const [repeatGap, setRepeatGap] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem("dict:repeatGap") || "1");
    return [0.5, 1, 1.5, 2].includes(v) ? v : 1;
  });
  useEffect(() => { localStorage.setItem("dict:speed", String(speed)); }, [speed]);
  useEffect(() => { localStorage.setItem("dict:repeatCount", String(repeatCount)); }, [repeatCount]);
  useEffect(() => { localStorage.setItem("dict:repeatGap", String(repeatGap)); }, [repeatGap]);

  const stopAudio = () => {
    chainTokenRef.current++;
    stopTTS();
    const a = audioElRef.current;
    if (a) {
      try { a.pause(); } catch { /* noop */ }
      a.onended = null;
      a.onerror = null;
      audioElRef.current = null;
    }
    const r = pendingResolveRef.current;
    pendingResolveRef.current = null;
    r?.();
  };

  const speakBrowser = (text: string, rate: number, token: number): Promise<void> =>
    new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
      if (token !== chainTokenRef.current) return resolve();
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate;
      let done = false;
      const finish = () => { if (done) return; done = true; pendingResolveRef.current = null; resolve(); };
      u.onend = finish;
      u.onerror = finish;
      pendingResolveRef.current = finish;
      try { window.speechSynthesis.speak(u); } catch { finish(); }
    });

  const playOnce = (rate: number, token: number): Promise<void> =>
    new Promise((resolve) => {
      if (!current || token !== chainTokenRef.current) return resolve();
      const settle = () => { pendingResolveRef.current = null; resolve(); };
      if (current.audio_url) {
        const a = new Audio(current.audio_url);
        a.playbackRate = rate;
        audioElRef.current = a;
        a.onended = () => { audioElRef.current = null; settle(); };
        a.onerror = () => {
          audioElRef.current = null;
          speakBrowser(current.text, rate, token).then(settle);
        };
        pendingResolveRef.current = settle;
        a.play().catch(() => {
          audioElRef.current = null;
          speakBrowser(current.text, rate, token).then(settle);
        });
      } else {
        speakBrowser(current.text, rate, token).then(settle);
      }
    });

  const playAudio = async (onEnded?: () => void) => {
    if (!current) return;
    stopAudio();
    const token = ++chainTokenRef.current;
    const count = repeatCount;
    const gapMs = Math.round(repeatGap * 1000);
    for (let i = 0; i < count; i++) {
      if (token !== chainTokenRef.current) return;
      await playOnce(speed, token);
      if (token !== chainTokenRef.current) return;
      if (i < count - 1) {
        await new Promise<void>((r) => {
          const t = setTimeout(() => { pendingResolveRef.current = null; r(); }, gapMs);
          pendingResolveRef.current = () => { clearTimeout(t); r(); };
        });
        if (token !== chainTokenRef.current) return;
      }
    }
    if (token === chainTokenRef.current) onEnded?.();
  };

  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };
  const goNext = () => { if (idx + 1 < total) setIdx(idx + 1); };

  const handleSave = async (sentenceId: string, accuracy: number) => {
    const best = await saveDictationProgress(user?.id, setId, sentenceId, accuracy);
    if (best === 100) {
      setCompleted((prev) => {
        if (prev.has(sentenceId)) return prev;
        const next = new Set(prev);
        next.add(sentenceId);
        return next;
      });
    }
  };



  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 pt-[144px] md:pt-24 pb-10"><p className="text-destructive">{error}</p></div>
      </div>
    );
  }
  if (!sentences || !setInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 pt-[144px] md:pt-24 pb-10"><p className="text-muted-foreground">Đang tải…</p></div>
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 pt-[144px] md:pt-24 pb-10">
          <p className="text-muted-foreground">Bộ này chưa có câu nào.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/nghe-chep")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 pt-[144px] md:pt-24 pb-8">
        <button
          onClick={() => navigate("/nghe-chep")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Tất cả bộ luyện
        </button>

        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {setInfo.title}
            {user && total > 0 && completed.size >= total && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </h1>
          <div className="flex items-center gap-2">
            {current && completed.has(current.id) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã đạt 100%
              </span>
            )}
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
              Câu {idx + 1}/{total}
              {user && total > 0 && ` · ${completed.size}/${total} ✓`}
            </span>
          </div>
        </div>

        {/* Mode selector */}
        <div className="inline-flex rounded-lg border border-border bg-muted p-1 mb-4">
          {[
            { key: "check", label: "Nghe Check" },
            { key: "chep", label: "Nghe Chép Full Câu" },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key as Mode)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                mode === m.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Audio settings: speed + repeat */}
        <AudioSettingsBar
          speed={speed}
          setSpeed={setSpeed}
          repeatCount={repeatCount}
          setRepeatCount={setRepeatCount}
          repeatGap={repeatGap}
          setRepeatGap={setRepeatGap}
        />

        {/* progress bar */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>


        {mode === "check" && current && (
          <CheckMode
            key={current.id}
            sentence={current}
            playAudio={playAudio}
            stopAudio={stopAudio}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={idx > 0}
            hasNext={idx + 1 < total}
            onSave={(acc) => handleSave(current.id, acc)}
          />
        )}
        {mode === "chep" && current && (
          <ChepMode
            key={current.id}
            sentence={current}
            playAudio={playAudio}
            stopAudio={stopAudio}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={idx > 0}
            hasNext={idx + 1 < total}
            onSave={(acc) => handleSave(current.id, acc)}
          />
        )}


      </main>
    </div>
  );
}

/* ==================== Audio settings bar ==================== */
function AudioSettingsBar({
  speed, setSpeed, repeatCount, setRepeatCount, repeatGap, setRepeatGap,
}: {
  speed: number;
  setSpeed: (v: number) => void;
  repeatCount: number;
  setRepeatCount: (v: number) => void;
  repeatGap: number;
  setRepeatGap: (v: number) => void;
}) {
  const speeds = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4];
  const [open, setOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(repeatCount);
  const [draftGap, setDraftGap] = useState(repeatGap);
  useEffect(() => { if (open) { setDraftCount(repeatCount); setDraftGap(repeatGap); } }, [open, repeatCount, repeatGap]);

  const apply = () => {
    setRepeatCount(draftCount);
    setRepeatGap(draftGap);
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Tốc độ</label>
        <Select value={String(speed)} onValueChange={(v) => setSpeed(parseFloat(v))}>
          <SelectTrigger className="w-[92px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {speeds.map((s) => (
              <SelectItem key={s} value={String(s)}>{s.toFixed(1)}x</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Repeat className="w-4 h-4" />
            Lặp {repeatCount}x{"\u00a0"}· Nghỉ {repeatGap}s
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Số lần phát lại</p>
              <div className="inline-flex rounded-md border border-border p-0.5">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDraftCount(n)}
                    className={cn(
                      "px-3 py-1 text-sm font-medium rounded",
                      draftCount === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n} lần
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Thời gian nghỉ</p>
              <div className="inline-flex flex-wrap gap-1 rounded-md border border-border p-0.5">
                {[0.5, 1, 1.5, 2].map((g) => (
                  <button
                    key={g}
                    onClick={() => setDraftGap(g)}
                    className={cn(
                      "px-3 py-1 text-sm font-medium rounded",
                      draftGap === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}s
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={apply}>Áp dụng</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ==================== Shared play/stop hook ==================== */
function usePlayback(
  playAudio: (onEnded?: () => void) => void,
  stopAudio: () => void,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const didAutoplayRef = useRef(false);

  const play = () => {
    setIsPlaying(true);
    playAudio(() => setIsPlaying(false));
  };
  const stop = () => {
    stopAudio();
    setIsPlaying(false);
  };
  const toggle = () => (isPlaying ? stop() : play());

  // Autoplay once per sentence (component remounts on sentence change via key).
  useEffect(() => {
    if (didAutoplayRef.current) return;
    didAutoplayRef.current = true;
    const t = setTimeout(play, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopAudio(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPlaying, toggle };
}


/* ==================== Mode: Nghe Check ==================== */
function CheckMode({ sentence, playAudio, stopAudio, onPrev, onNext, hasPrev, hasNext, onSave }: {
  sentence: Sentence;
  playAudio: (onEnded?: () => void) => void;
  stopAudio: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onSave: (accuracy: number) => void;
}) {
  const { isPlaying, toggle } = usePlayback(playAudio, stopAudio);
  const [ratio, setRatio] = useState<30 | 50 | 100>(100);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const inputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  const tokens = useMemo(() => tokenize(sentence.text), [sentence.text]);
  // indices of word tokens (in tokens array)
  const wordIdxList = useMemo(
    () => tokens.map((t, i) => (t.isWord ? i : -1)).filter((i) => i >= 0),
    [tokens],
  );

  const hiddenSet = useMemo(() => {
    const wordCount = wordIdxList.length;
    const howMany = Math.round((wordCount * ratio) / 100);
    const picked = seededPickIndices(wordCount, howMany, `${sentence.id}:${ratio}`);
    return new Set([...picked].map((k) => wordIdxList[k]));
  }, [wordIdxList, ratio, sentence.id]);

  useEffect(() => {
    setChecked(false);
    setAnswers({});
    setRevealed(new Set());
  }, [sentence.id, ratio]);




  const isCorrect = (tokenIdx: number) => {
    const exp = normalizeWord(tokens[tokenIdx].core);
    const got = normalizeWord(answers[tokenIdx] || "");
    return exp !== "" && exp === got;
  };

  const handleCheck = () => {
    setChecked(true);
    // Accuracy = share of hidden slots filled with the correct word (revealed slots count as correct).
    const hidden = [...hiddenSet];
    if (hidden.length === 0) { onSave(0); return; }
    const ok = hidden.filter((i) => isCorrect(i)).length;
    onSave(Math.round((ok / hidden.length) * 100));
  };



  const handleReveal = () => {
    // Reveal one hidden, still-empty & not-yet-revealed word
    const candidates = [...hiddenSet].filter(
      (i) => !revealed.has(i) && !isCorrect(i),
    );
    if (candidates.length === 0) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    setRevealed((prev) => new Set(prev).add(target));
    setAnswers((prev) => ({ ...prev, [target]: tokens[target].core }));
    // focus next input
    setTimeout(() => {
      const el = inputsRef.current[target];
      if (el) el.blur();
    }, 0);
  };

  const allCorrect = checked && [...hiddenSet].every((i) => isCorrect(i));

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition"
            aria-label={isPlaying ? "Dừng" : "Phát câu"}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <Button variant="ghost" size="sm" onClick={toggle}>
            <Volume2 className="w-4 h-4 mr-2" /> {isPlaying ? "Dừng" : "Phát lại"}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Ẩn</span>
          <div className="inline-flex rounded-md border border-border p-0.5">
            {[30, 50, 100].map((r) => (
              <button
                key={r}
                onClick={() => setRatio(r as 30 | 50 | 100)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded",
                  ratio === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}%
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleReveal} disabled={checked && allCorrect}>
            <Lightbulb className="w-4 h-4 mr-1" /> Hé 1 từ
          </Button>
        </div>
      </div>

      <div className="text-lg leading-loose flex flex-wrap items-center gap-y-2">
        {tokens.map((t, i) => {
          if (!t.isWord) {
            // Preserve whitespace/punctuation exactly
            return <span key={i} className="whitespace-pre-wrap">{t.raw}</span>;
          }
          if (!hiddenSet.has(i)) {
            return <span key={i} className="font-medium">{t.raw}</span>;
          }
          const val = answers[i] ?? "";
          const isRev = revealed.has(i);
          const correct = isCorrect(i);
          const state: "idle" | "ok" | "bad" =
            isRev ? "ok" : checked ? (correct ? "ok" : "bad") : correct ? "ok" : "idle";
          // width based on target word length
          const w = Math.max(3, t.core.length + 1);
          return (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              value={val}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
              disabled={isRev}
              spellCheck={false}
              autoComplete="off"
              style={{ width: `${w}ch` }}
              className={cn(
                "inline-block px-1.5 py-0.5 mx-0.5 rounded border-b-2 bg-background text-center font-medium outline-none focus:border-primary transition-colors",
                state === "ok" && "border-green-600 text-green-700 dark:text-green-500",
                state === "bad" && "border-destructive text-destructive",
                state === "idle" && "border-muted-foreground/40",
              )}
            />
          );
        })}
      </div>

      {checked && (() => {
        const hidden = [...hiddenSet];
        const ok = hidden.filter((i) => isCorrect(i)).length;
        const total = hidden.length;
        const pct = total ? Math.round((ok / total) * 100) : 0;
        return (
          <div className="mt-6 space-y-3">
            <div className={cn(
              "text-sm font-semibold",
              pct === 100 ? "text-green-600" : "text-primary"
            )}>
              {pct === 100 ? `✓ Đúng hết! ${ok}/${total} từ · 100%` : `Đúng ${ok}/${total} từ · ${pct}%`}
            </div>
            {!allCorrect && (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Đáp án</p>
                <p className="text-base">{sentence.text}</p>
              </div>
            )}
          </div>
        );
      })()}


      <div className="mt-6 flex flex-wrap gap-3 justify-end">
        {!checked ? (
          <Button onClick={handleCheck}>
            <Check className="w-4 h-4 mr-2" /> Hiện đáp án
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => { setChecked(false); }}
          >
            <EyeOff className="w-4 h-4 mr-2" /> Ẩn&nbsp;đáp án
          </Button>
        )}
      </div>

      <NavButtons onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
    </Card>
  );
}

/* ==================== Mode: Nghe Chép (existing) ==================== */
function ChepMode({ sentence, playAudio, stopAudio, onPrev, onNext, hasPrev, hasNext, onSave }: {
  sentence: Sentence;
  playAudio: (onEnded?: () => void) => void;
  stopAudio: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onSave: (accuracy: number) => void;
}) {
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const { isPlaying, toggle } = usePlayback(playAudio, stopAudio);

  const diff = useMemo(() => (checked ? diffWords(sentence.text, input) : null), [checked, sentence.text, input]);

  const handleCheck = () => {
    if (!input.trim()) return;
    setChecked(true);
    const parts = diffWords(sentence.text, input);
    onSave(wordAccuracyPct(parts));
  };

  const acc = diff ? wordAccuracyPct(diff) : 0;
  const okCount = diff ? diff.filter((p) => p.ok).length : 0;
  const totalWords = diff ? diff.length : 0;
  const perfect = checked && acc === 100;

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition"
          aria-label={isPlaying ? "Dừng" : "Phát câu"}
        >
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </button>
        <Button variant="ghost" size="sm" onClick={toggle}>
          <Volume2 className="w-4 h-4 mr-2" /> {isPlaying ? "Dừng" : "Phát lại"}
        </Button>
      </div>


      <div className="mt-8">
        <label className="text-sm font-medium mb-2 block">Gõ lại câu bạn nghe được:</label>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !checked) handleCheck();
          }}
          placeholder="Nhập câu tiếng Anh…"
          disabled={checked}
          autoFocus
          className="text-base"
        />
      </div>

      {checked && diff && (
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              So sánh theo từ (đỏ = sai/thiếu)
            </p>
            <p className="text-lg leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
              {diff.map((p, i) => (
                <span
                  key={i}
                  className={p.ok ? "text-foreground" : "text-destructive font-semibold underline decoration-destructive/60"}
                >
                  {p.word}
                </span>
              ))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Đáp án đúng</p>
            <p className="text-lg leading-relaxed">{sentence.text}</p>
          </div>
          <div className={`text-sm font-medium ${perfect ? "text-green-600" : "text-primary"}`}>
            {perfect ? `✓ Chính xác 100%! (${okCount}/${totalWords} từ)` : `Đúng ${okCount}/${totalWords} từ · ${acc}%`}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 justify-end">
        {!checked ? (
          <Button onClick={handleCheck} disabled={!input.trim()}>
            <Check className="w-4 h-4 mr-2" /> Hiện đáp án
          </Button>
        ) : (
          <Button variant="outline" onClick={() => { setChecked(false); }}>Sửa tiếp</Button>
        )}
      </div>

      <NavButtons onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
    </Card>

  );
}

/* ==================== Shared nav ==================== */
function NavButtons({ onPrev, onNext, hasPrev, hasNext }: {
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between pt-6 border-t border-border">
      <Button variant="ghost" onClick={onPrev} disabled={!hasPrev}>
        <ChevronLeft className="w-4 h-4 mr-1" /> Câu trước
      </Button>
      <Button variant="ghost" onClick={onNext} disabled={!hasNext}>
        Câu tiếp <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

/* ==================== Route wrapper ==================== */
export default function Dictation() {
  const { setId } = useParams();
  if (setId) return <DictationPracticeView setId={setId} />;
  return <DictationListView />;
}
