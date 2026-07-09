import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Play, Volume2, Check, ChevronRight, Ear } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { speakWithTTS, stopTTS } from "@/lib/tts";
import { usePageMeta } from "@/hooks/usePageMeta";

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

/* --------- Char-level diff --------- */
type DiffPart = { ch: string; ok: boolean };
function diffChars(expected: string, got: string): DiffPart[] {
  // simple LCS-based diff on characters, case-insensitive, whitespace-collapsed
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const a = norm(expected);
  const b = norm(got);
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const m = al.length;
  const n = bl.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = al[i - 1] === bl[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Walk expected; for each expected char decide ok if matched in LCS
  const out: DiffPart[] = [];
  let i = m, j = n;
  const matchedExpected = new Array<boolean>(m).fill(false);
  while (i > 0 && j > 0) {
    if (al[i - 1] === bl[j - 1]) {
      matchedExpected[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  for (let k = 0; k < a.length; k++) {
    out.push({ ch: a[k], ok: matchedExpected[k] });
  }
  return out;
}

function accuracyPct(parts: DiffPart[]) {
  if (!parts.length) return 0;
  const ok = parts.filter((p) => p.ok && p.ch.trim() !== "").length;
  const total = parts.filter((p) => p.ch.trim() !== "").length || 1;
  return Math.round((ok / total) * 100);
}

/* ==================== List page ==================== */
function DictationListView() {
  usePageMeta({
    title: "Nghe chép chính tả — Aptis Kỳ Tích",
    description: "Luyện nghe và chép lại câu tiếng Anh theo từng bộ, kiểm tra chính xác từng ký tự.",
  });
  const [sets, setSets] = useState<DictationSet[] | null>(null);
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
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: sents } = await supabase
          .from("dictation_sentences")
          .select("set_id")
          .in("set_id", ids);
        (sents || []).forEach((r: any) => { counts[r.set_id] = (counts[r.set_id] || 0) + 1; });
      }
      setSets((setsData || []).map((s) => ({ ...s, sentence_count: counts[s.id] || 0 })));
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ear className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Nghe chép chính tả</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Nghe câu tiếng Anh và gõ lại chính xác. Hệ thống sẽ tô đỏ chỗ sai từng ký tự.
        </p>

        {error && <p className="text-destructive">{error}</p>}
        {!sets ? (
          <p className="text-muted-foreground">Đang tải…</p>
        ) : sets.length === 0 ? (
          <p className="text-muted-foreground">Chưa có bộ luyện nào.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sets.map((s) => (
              <Link key={s.id} to={`/nghe-chep/${s.id}`} className="block group">
                <Card className="p-5 h-full hover:border-primary transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {s.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.sentence_count ?? 0} câu
                        {s.level != null && ` · Level ${s.level}`}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ==================== Practice page ==================== */
function DictationPracticeView({ setId }: { setId: string }) {
  const navigate = useNavigate();
  const [setInfo, setSetInfo] = useState<DictationSet | null>(null);
  const [sentences, setSentences] = useState<Sentence[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: `${setInfo?.title || "Nghe chép chính tả"} — Aptis Kỳ Tích`,
    description: "Luyện nghe chép chính tả câu tiếng Anh với kiểm tra từng ký tự.",
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

  const current = sentences && sentences[idx];
  const total = sentences?.length || 0;

  const diff = useMemo(() => {
    if (!current || !checked) return null;
    return diffChars(current.text, input);
  }, [current, checked, input]);

  const playAudio = () => {
    if (!current) return;
    if (current.audio_url) {
      // Fallback to raw audio if provided
      const a = new Audio(current.audio_url);
      stopTTS();
      a.play().catch(() => speakWithTTS(current.text, "en"));
    } else {
      speakWithTTS(current.text, "en");
    }
  };

  // Auto-play when sentence changes
  useEffect(() => {
    if (current) {
      const t = setTimeout(playAudio, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const handleCheck = () => {
    if (!input.trim()) return;
    setChecked(true);
  };

  const handleNext = () => {
    if (idx + 1 < total) {
      setIdx(idx + 1);
      setInput("");
      setChecked(false);
    }
  };

  const handleRestart = () => {
    setIdx(0);
    setInput("");
    setChecked(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!sentences || !setInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-muted-foreground">Bộ này chưa có câu nào.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/nghe-chep")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
        </div>
      </div>
    );
  }

  const isLast = idx + 1 >= total;
  const acc = diff ? accuracyPct(diff) : 0;
  const perfect = checked && acc === 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/nghe-chep")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Tất cả bộ luyện
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{setInfo.title}</h1>
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            Câu {idx + 1}/{total}
          </span>
        </div>

        {/* progress bar */}
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((idx + (checked ? 1 : 0)) / total) * 100}%` }}
          />
        </div>

        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={playAudio}
              className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition"
              aria-label="Phát câu"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
            <Button variant="ghost" size="sm" onClick={playAudio}>
              <Volume2 className="w-4 h-4 mr-2" /> Phát lại
            </Button>
          </div>

          <div className="mt-8">
            <label className="text-sm font-medium mb-2 block">Gõ lại câu bạn nghe được:</label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (!checked) handleCheck();
                  else if (!isLast) handleNext();
                }
              }}
              placeholder="Nhập câu tiếng Anh…"
              disabled={checked}
              autoFocus
              className="text-base"
            />
          </div>

          {checked && diff && current && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  So sánh (đỏ = sai/thiếu)
                </p>
                <p className="text-lg leading-relaxed font-mono">
                  {diff.map((p, i) => (
                    <span
                      key={i}
                      className={p.ok ? "text-foreground" : "text-destructive font-semibold underline decoration-destructive/60"}
                    >
                      {p.ch}
                    </span>
                  ))}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Đáp án đúng</p>
                <p className="text-lg leading-relaxed">{current.text}</p>
              </div>
              <div className={`text-sm font-medium ${perfect ? "text-green-600" : "text-primary"}`}>
                {perfect ? "✓ Chính xác 100%!" : `Chính xác: ${acc}%`}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            {!checked ? (
              <Button onClick={handleCheck} disabled={!input.trim()}>
                <Check className="w-4 h-4 mr-2" /> Kiểm tra
              </Button>
            ) : isLast ? (
              <Button onClick={handleRestart} variant="outline">Làm lại từ đầu</Button>
            ) : (
              <Button onClick={handleNext}>
                Câu tiếp theo <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

/* ==================== Route wrapper ==================== */
export default function Dictation() {
  const { setId } = useParams();
  if (setId) return <DictationPracticeView setId={setId} />;
  return <DictationListView />;
}
