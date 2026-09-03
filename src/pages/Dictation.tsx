import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Headphones,
  Mic,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  Loader2,
  X,
  RotateCcw,
  Home,
  ChevronRight,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import SegmentPlayer, { type SegmentPlayerHandle } from "@/components/dictation/SegmentPlayer";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { safeLocalStorage } from "@/lib/safeStorage";
import { toast } from "@/hooks/use-toast";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import AudioRecorder from "@/components/speaking/AudioRecorder";
import UpgradeLock from "@/components/pro/UpgradeLock";
import { useIsPro } from "@/hooks/useIsPro";

/* ------------------------------------------------------------------ */
/* Word-level diff (case & punctuation insensitive)                    */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Types & settings                                                    */
/* ------------------------------------------------------------------ */
type Screen = "mode" | "level" | "setup" | "sets" | "practice" | "result";

type PracticeMode = "dictation" | "shadow" | "combo";

type SetRow = {
  id: string;
  title: string;
  part: string | null;
  sentence_count: number | null;
  sort: number | null;
  done_cnt: number | null;
};

type LevelRow = {
  level: number;
  bo: number;
  cau: number;
  bo_xong: number;
  cau_xong: number;
};

type SessionSentence = {
  sentence_id: string;
  set_id: string;
  set_title: string;
  part: string | null;
  sort: number | null;
  text: string;
  audio_url: string | null;
  start_sec: number | null;
  end_sec: number | null;
  best_accuracy: number | null;
};

type Settings = {
  size: number;
  speed: number;
  maxPlays: number; // 0 = unlimited
  onlyTodo: boolean;
};

const SETTINGS_KEY = "dict:v2:settings";
const DEFAULT_SETTINGS: Settings = { size: 10, speed: 1, maxPlays: 5, onlyTodo: true };

function loadSettings(): Settings {
  try {
    const raw = safeLocalStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      size: [5, 10, 15, 20].includes(parsed?.size) ? parsed.size : DEFAULT_SETTINGS.size,
      speed: [0.75, 1, 1.25].includes(parsed?.speed) ? parsed.speed : DEFAULT_SETTINGS.speed,
      maxPlays: [0, 3, 5].includes(parsed?.maxPlays) ? parsed.maxPlays : DEFAULT_SETTINGS.maxPlays,
      onlyTodo: typeof parsed?.onlyTodo === "boolean" ? parsed.onlyTodo : DEFAULT_SETTINGS.onlyTodo,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const LEVEL_META: Record<number, { title: string; desc: string }> = {
  1: { title: "Level 1 · Khởi động", desc: "Câu ngắn, tốc độ chậm — Listening Part 1" },
  2: { title: "Level 2 · Tăng tốc", desc: "Đoạn dài, nhiều thông tin — Listening Part 2" },
  3: { title: "Level 3 · Thử thách", desc: "Học thuật, tốc độ thi thật — Listening Part 3 & 4" },
};

type Answer = {
  sentenceId: string;
  text: string;
  typed: string;
  accuracy: number;
  speakingScore?: number | null;
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */
export default function Dictation() {
  const { setId } = useParams<{ setId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  usePageMeta({
    title: "Luyện nghe chép chính tả Aptis | Aptis Kỳ Tích",
    description:
      "Luyện nghe chép chính tả với audio Listening Aptis thật, cắt sẵn từng câu. Chấm điểm tự động theo từ, lộ trình 3 cấp độ.",
  });

  const [screen, setScreen] = useState<Screen>("mode");
  const [mode, setMode] = useState<PracticeMode>("dictation");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [level, setLevel] = useState<number>(1);

  const [sentences, setSentences] = useState<SessionSentence[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [durationSec, setDurationSec] = useState(0);

  /* --- chọn bài cụ thể --- */
  const [setRows, setSetRows] = useState<SetRow[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [setsPage, setSetsPage] = useState(0);
  const [setsHasMore, setSetsHasMore] = useState(false);
  const [chosenSetId, setChosenSetId] = useState<string | null>(null);

  /* --- persist settings --- */
  useEffect(() => {
    safeLocalStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  /* --- load level stats when entering screen 2 --- */
  useEffect(() => {
    if (screen !== "level") return;
    let cancelled = false;
    setLevelsLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("get_dictation_levels");
      if (cancelled) return;
      if (!error && data) setLevels(data as LevelRow[]);
      setLevelsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [screen]);

  const PAGE_SIZE = 30;

  const loadSets = async (page: number) => {
    setSetsLoading(true);
    const { data, error } = await supabase.rpc("get_dictation_sets", {
      p_level: level,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
      p_only_todo: settings.onlyTodo,
    });
    setSetsLoading(false);
    if (error) {
      toast({ title: "Không tải được danh sách bài", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data ?? []) as SetRow[];
    setSetRows((prev) => (page === 0 ? rows : [...prev, ...rows]));
    setSetsHasMore(rows.length === PAGE_SIZE);
    setSetsPage(page);
  };

  const openSetsScreen = () => {
    setSetRows([]);
    setSetsHasMore(false);
    setScreen("sets");
    void loadSets(0);
  };

  const startSession = async (overrideSetId?: string | null) => {
    const targetSetId = overrideSetId ?? setId ?? null;
    setLoadingSession(true);
    const { data, error } = await supabase.rpc("get_dictation_session", {
      p_level: level,
      p_size: settings.size,
      p_set_id: targetSetId,
      p_only_todo: settings.onlyTodo,
    });
    setLoadingSession(false);
    const rows = (data ?? []) as SessionSentence[];
    if (error || rows.length === 0) {
      toast({
        title: "Chưa lấy được câu luyện tập",
        description: error?.message ?? "Cấp độ này hiện chưa có câu phù hợp. Hãy thử cấp độ khác.",
        variant: "destructive",
      });
      return;
    }
    setChosenSetId(targetSetId);
    setSentences(rows);
    setIndex(0);
    setAnswers([]);
    setStartedAt(Date.now());
    setScreen("practice");
  };

  const handleSentenceDone = (a: Answer) => {
    setAnswers((prev) => {
      const i = prev.findIndex((p) => p.sentenceId === a.sentenceId);
      if (i === -1) return [...prev, a];
      // Đã ghi nhận lần chấm đầu — chỉ bổ sung điểm nói đuổi.
      const next = [...prev];
      next[i] = { ...next[i], speakingScore: a.speakingScore ?? next[i].speakingScore ?? null };
      return next;
    });
  };

  const goNext = () => {
    if (index + 1 < sentences.length) {
      setIndex((i) => i + 1);
    } else {
      setDurationSec(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setScreen("result");
    }
  };

  const exitPractice = () => {
    if (!window.confirm("Thoát phiên luyện tập? Các câu chưa làm sẽ không được tính.")) return;
    setScreen("setup");
  };

  /* ---------------- Screen 1: mode ---------------- */
  if (screen === "mode") {
    const cards: Array<{
      key: PracticeMode;
      title: string;
      desc: string;
      icon: typeof Headphones;
      soon: boolean;
    }> = [
      { key: "dictation", title: "Nghe chép", desc: "Nghe rồi gõ lại câu", icon: Headphones, soon: false },
      { key: "shadow", title: "Nói đuổi", desc: "Nghe rồi nhắc lại theo audio", icon: Mic, soon: false },
      { key: "combo", title: "Kết hợp", desc: "Vừa chép vừa nói đuổi", icon: Sparkles, soon: false },
    ];
    return (
      <Shell>
        <h1 className="text-2xl sm:text-3xl font-bold">Luyện nghe chép chính tả</h1>
        <p className="text-muted-foreground mt-2">
          Chọn kiểu luyện tập bạn muốn bắt đầu.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={c.soon}
              onClick={() => {
                setMode(c.key);
                setScreen("level");
              }}
              className={cn(
                "text-left rounded-xl border p-6 transition",
                c.soon
                  ? "opacity-60 cursor-not-allowed bg-muted/40"
                  : "hover:border-primary hover:shadow-md bg-card",
              )}
            >
              <c.icon className="w-9 h-9 text-primary" />
              <div className="mt-4 flex items-center gap-2">
                <span className="font-semibold text-lg">{c.title}</span>
                {c.soon && <Badge variant="secondary">Sắp có</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------------- Screen 2: level ---------------- */
  if (screen === "level") {
    return (
      <Shell onBack={() => setScreen("mode")}>
        <h1 className="text-2xl sm:text-3xl font-bold">Chọn lộ trình</h1>
        <p className="text-muted-foreground mt-2">Ba cấp độ tăng dần theo độ khó bài thi thật.</p>

        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((lv) => {
            const row = levels.find((r) => Number(r.level) === lv);
            const cau = Number(row?.cau ?? 0);
            const done = Number(row?.cau_xong ?? 0);
            const pct = cau ? Math.round((done / cau) * 100) : 0;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => {
                  setLevel(lv);
                  setScreen("setup");
                }}
                className="w-full text-left rounded-xl border bg-card p-5 hover:border-primary hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{LEVEL_META[lv].title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{LEVEL_META[lv].desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-4">
                  {levelsLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tải số liệu…
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {Number(row?.bo ?? 0)} bài · {cau} câu
                      </p>
                      {user && (
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {done}/{cau}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---------------- Screen 3: setup ---------------- */
  if (screen === "setup") {
    return (
      <Shell onBack={() => setScreen("level")}>
        <h1 className="text-2xl sm:text-3xl font-bold">Thiết lập phiên luyện</h1>
        <p className="text-muted-foreground mt-2">{LEVEL_META[level].title}</p>

        <Card className="mt-6 p-5 space-y-6">
          <OptionRow label="Số câu mỗi phiên">
            {[5, 10, 15, 20].map((v) => (
              <Chip key={v} active={settings.size === v} onClick={() => setSettings((s) => ({ ...s, size: v }))}>
                {v} câu
              </Chip>
            ))}
          </OptionRow>

          <OptionRow label="Tốc độ phát">
            {[0.75, 1, 1.25].map((v) => (
              <Chip key={v} active={settings.speed === v} onClick={() => setSettings((s) => ({ ...s, speed: v }))}>
                {v}×
              </Chip>
            ))}
          </OptionRow>

          <OptionRow label="Số lần nghe tối đa mỗi câu">
            {[
              { v: 3, l: "3 lần" },
              { v: 5, l: "5 lần" },
              { v: 0, l: "Không giới hạn" },
            ].map((o) => (
              <Chip
                key={o.v}
                active={settings.maxPlays === o.v}
                onClick={() => setSettings((s) => ({ ...s, maxPlays: o.v }))}
              >
                {o.l}
              </Chip>
            ))}
          </OptionRow>

          <div className="flex items-center justify-between gap-4 pt-2 border-t">
            <div>
              <p className="text-sm font-medium">Chỉ luyện bài chưa hoàn thành</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ưu tiên những câu bạn chưa đạt điểm tối đa.
              </p>
            </div>
            <Switch
              checked={settings.onlyTodo}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, onlyTodo: v }))}
            />
          </div>

          <Button className="w-full" size="lg" onClick={() => void startSession()} disabled={loadingSession}>
            {loadingSession ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Bắt đầu
          </Button>

          <button
            type="button"
            onClick={openSetsScreen}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            Hoặc chọn bài cụ thể →
          </button>
        </Card>
      </Shell>
    );
  }

  /* ---------------- Screen 3b: chọn bài cụ thể ---------------- */
  if (screen === "sets") {
    return (
      <Shell onBack={() => setScreen("setup")}>
        <h1 className="text-2xl sm:text-3xl font-bold">Chọn bài cụ thể</h1>
        <p className="text-muted-foreground mt-2">{LEVEL_META[level].title}</p>

        <div className="mt-6 space-y-3">
          {setRows.map((r) => {
            const total = Number(r.sentence_count ?? 0);
            const done = Number(r.done_cnt ?? 0);
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <button
                key={r.id}
                type="button"
                disabled={loadingSession}
                onClick={() => void startSession(r.id)}
                className="w-full text-left rounded-xl border bg-card p-4 hover:border-primary hover:shadow-md transition disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.title}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {r.part && <Badge variant="secondary">{r.part}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {done}/{total} câu
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
                <Progress value={pct} className="h-2 mt-3" />
              </button>
            );
          })}

          {setsLoading && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
            </p>
          )}

          {!setsLoading && setRows.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Không có bài nào phù hợp ở cấp độ này.
            </Card>
          )}

          {setsHasMore && !setsLoading && (
            <Button variant="outline" className="w-full" onClick={() => void loadSets(setsPage + 1)}>
              Xem thêm
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  /* ---------------- Screen 4: practice ---------------- */
  if (screen === "practice") {
    const s = sentences[index];
    if (!s) return null;
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">{s.set_title}</p>
            <p className="text-xs text-muted-foreground">
              Câu {index + 1}/{sentences.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={exitPractice}>
            <X className="w-4 h-4 mr-1" /> Thoát
          </Button>
        </div>
        <Progress value={((index + 1) / sentences.length) * 100} className="h-2 mt-3" />

        <SentenceTask
          key={s.sentence_id}
          sentence={s}
          settings={settings}
          mode={mode}
          userId={user?.id}
          isLast={index + 1 >= sentences.length}
          onDone={handleSentenceDone}
          onNext={goNext}
        />
      </Shell>
    );
  }

  /* ---------------- Screen 5: result ---------------- */
  return (
    <Shell>
      <ResultScreen
        answers={answers}
        total={sentences.length}
        durationSec={durationSec}
        level={level}
        mode={mode}
        setId={chosenSetId ?? setId ?? null}
        userId={user?.id}
        onNewSession={() => setScreen("setup")}
        onRetry={() => {
          setIndex(0);
          setAnswers([]);
          setStartedAt(Date.now());
          setScreen("practice");
        }}
        onHome={() => navigate("/")}
      />
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Layout & small UI helpers                                          */
/* ------------------------------------------------------------------ */
function Shell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate("/dashboard"))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
        {children}
      </main>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg border text-sm transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One sentence task                                                  */
/* ------------------------------------------------------------------ */
function SentenceTask({
  sentence,
  settings,
  mode,
  userId,
  isLast,
  onDone,
  onNext,
}: {
  sentence: SessionSentence;
  settings: Settings;
  mode: PracticeMode;
  userId?: string;
  isLast: boolean;
  onDone: (a: Answer) => void;
  onNext: () => void;
}) {
  const playerRef = useRef<SegmentPlayerHandle | null>(null);
  const [input, setInput] = useState("");
  const [plays, setPlays] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const firstAccuracyRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const speakingSavedRef = useRef(false);

  const words = useMemo(() => sentence.text.split(/\s+/).filter(Boolean), [sentence.text]);
  const limitReached = settings.maxPlays > 0 && plays >= settings.maxPlays;

  const diff = useMemo(
    () => (checked ? diffWords(sentence.text, input) : null),
    [checked, sentence.text, input],
  );
  const shownAccuracy = firstAccuracyRef.current ?? 0;
  const allWordsCorrect = checked && diff !== null && wordAccuracyPct(diff) === 100;
  const perfect = checked && shownAccuracy === 100;
  const finishedSentence = allWordsCorrect || revealed;

  const saveResult = async (accuracy: number, speakingScore?: number | null) => {
    const isSpeaking = typeof speakingScore === "number";
    if (isSpeaking) {
      if (speakingSavedRef.current) return;
      speakingSavedRef.current = true;
    } else {
      if (savedRef.current) return;
      savedRef.current = true;
    }
    if (!userId) return;
    try {
      await supabase.rpc("save_dictation_result", {
        p_sentence_id: sentence.sentence_id,
        p_accuracy: accuracy,
        p_mode: mode,
        p_speaking_score: isSpeaking ? speakingScore : null,
      });
    } catch {
      /* progress ghi thất bại — không chặn luyện tập */
    }
  };

  /** Nói đuổi: đánh dấu hoàn thành câu dù chưa chấm AI (ví dụ chưa Pro). */
  const ensureShadowRecorded = () => {
    if (mode !== "shadow") return;
    if (firstAccuracyRef.current !== null) return;
    firstAccuracyRef.current = 100;
    void saveResult(100);
    onDone({
      sentenceId: sentence.sentence_id,
      text: sentence.text,
      typed: "",
      accuracy: 100,
      speakingScore: null,
    });
  };

  const handleCheck = () => {
    if (!input.trim()) return;
    const parts = diffWords(sentence.text, input);
    let acc = wordAccuracyPct(parts);
    if (hints.length > 0) acc = Math.min(acc, 90);
    setChecked(true);
    if (firstAccuracyRef.current === null) {
      firstAccuracyRef.current = acc;
      void saveResult(acc);
      onDone({
        sentenceId: sentence.sentence_id,
        text: sentence.text,
        typed: input,
        accuracy: acc,
      });
    }
  };

  const handleHint = () => {
    const remaining = words.filter((w) => !hints.includes(w));
    if (remaining.length === 0) return;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    setHints((h) => [...h, pick]);
  };

  const handleRelisten = () => {
    // Sửa tiếp, không cộng lượt nghe
    setChecked(false);
    playerRef.current?.play({ silentCount: true });
  };


  const handleSkip = () => {
    if (firstAccuracyRef.current === null) {
      firstAccuracyRef.current = 0;
      void saveResult(0);
      onDone({ sentenceId: sentence.sentence_id, text: sentence.text, typed: input, accuracy: 0 });
    }
    setChecked(true);
    setRevealed(true);
  };

  const hasAudio = !!sentence.audio_url && sentence.start_sec != null && sentence.end_sec != null;
  const showDictation = mode !== "shadow";
  const showShadow = mode === "shadow" || (mode === "combo" && finishedSentence);

  return (
    <Card className="mt-5 p-5 sm:p-6">
      {hasAudio ? (
        <>
          <SegmentPlayer
            ref={playerRef}
            path={sentence.audio_url as string}
            startSec={Number(sentence.start_sec)}
            endSec={Number(sentence.end_sec)}
            speed={settings.speed}
            autoPlay
            disabled={limitReached}
            onEnded={() => setPlays((p) => p + 1)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {settings.maxPlays > 0
              ? `Đã nghe ${Math.min(plays, settings.maxPlays)}/${settings.maxPlays} lần`
              : `Đã nghe ${plays} lần`}
            {limitReached && " · đã hết lượt nghe"}
          </p>
        </>
      ) : (
        <p className="text-sm text-destructive">Câu này chưa có dữ liệu audio.</p>
      )}

      {showDictation && (
        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">Gõ lại câu bạn nghe được:</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!checked) handleCheck();
              }
            }}
            placeholder="Nhập câu tiếng Anh…"
            autoFocus
            rows={3}
            className="text-base"
          />
          {hints.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {hints.map((h, i) => (
                <span key={`${h}-${i}`} className="px-2 py-1 rounded-md bg-muted text-xs font-medium">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showDictation && !checked && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleCheck} disabled={!input.trim()}>
            Kiểm tra
          </Button>
          <Button variant="outline" onClick={handleHint}>
            <Lightbulb className="w-4 h-4 mr-2" /> Gợi ý
            {hints.length > 0 && ` (${hints.length})`}
          </Button>
        </div>
      )}

      {showDictation && checked && diff && (
        <div
          className={cn(
            "mt-6 rounded-xl border p-4",
            perfect ? "border-green-500/40 bg-green-500/10" : "border-amber-500/40 bg-amber-500/10",
          )}
        >
          <div className="flex items-center gap-2">
            {perfect ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Lightbulb className="w-5 h-5 text-amber-600" />
            )}
            <p className="font-semibold">
              {perfect
                ? "Chính xác 100%!"
                : allWordsCorrect
                  ? `Đúng hết — trừ điểm gợi ý: ${shownAccuracy}%`
                  : `Điểm ghi nhận: ${shownAccuracy}%`}
            </p>
          </div>

          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {finishedSentence ? "Câu đầy đủ" : "Đối chiếu"}
            </p>
            <p className="leading-relaxed">
              {finishedSentence
                ? sentence.text
                : diff.map((p, i) => (
                    <span
                      key={i}
                      className={cn(
                        "mr-1",
                        p.ok ? "text-green-600 font-medium" : "text-destructive underline",
                      )}
                    >
                      {p.word}
                    </span>
                  ))}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {finishedSentence ? (
              mode === "combo" ? (
                <p className="text-sm text-muted-foreground">
                  Tốt lắm! Giờ hãy nói đuổi lại câu này ở phần dưới.
                </p>
              ) : (
                <Button onClick={onNext}>
                  {isLast ? "Xem kết quả" : "Câu tiếp theo"} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )
            ) : (
              <>
                <Button variant="outline" onClick={handleRelisten}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Nghe lại &amp; sửa
                </Button>
                <Button variant="secondary" onClick={handleSkip}>
                  Bỏ qua, xem đáp án
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {showShadow && (
        <ShadowBlock
          sentence={sentence}
          isLast={isLast}
          onPlayModel={() => playerRef.current?.play({ silentCount: true })}
          onNext={() => {

            ensureShadowRecorded();
            onNext();
          }}
          onScored={(score) => {
            void saveResult(mode === "shadow" ? 100 : (firstAccuracyRef.current ?? 0), score);
            onDone({
              sentenceId: sentence.sentence_id,
              text: sentence.text,
              typed: input,
              accuracy: mode === "shadow" ? 100 : (firstAccuracyRef.current ?? 0),
              speakingScore: score,
            });
          }}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Shadowing block (Nói đuổi)                                         */
/* ------------------------------------------------------------------ */
async function blobToBase64Raw(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

type ShadowResult = {
  transcript: string;
  score: number;
  missed: string[];
  extra: string[];
};

function ShadowBlock({
  sentence,
  isLast,
  onPlayModel,
  onNext,
  onScored,
}: {
  sentence: SessionSentence;
  isLast: boolean;
  onPlayModel: () => void;
  onNext: () => void;
  onScored: (score: number) => void;
}) {
  const { isPro } = useIsPro();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<ShadowResult | null>(null);
  const [gate, setGate] = useState<null | "pro" | "quota">(null);

  const {
    isRecording,
    audioUrl,
    timeLeft,
    micError,
    isRequestingMic,
    startRecording,
    stopRecording,
  } = useAudioRecording({
    maxDuration: 20,
    questionKey: sentence.sentence_id,
    onComplete: async (url: string) => {
      try {
        const res = await fetch(url);
        setBlob(await res.blob());
      } catch {
        setBlob(null);
      }
    },
  });

  const missedSet = useMemo(
    () => new Set((result?.missed ?? []).map((w) => w.toLowerCase().replace(/[^a-z0-9']/gi, ""))),
    [result],
  );

  const handleGrade = async () => {
    if (!blob) return;
    setGrading(true);
    setGate(null);
    try {
      const base64 = await blobToBase64Raw(blob);
      const { data, error } = await supabase.functions.invoke("grade-shadowing", {
        body: { audio: base64, mimeType: blob.type || "audio/webm", text: sentence.text },
      });
      let errCode = "";
      if (error) {
        try {
          const body = await (error as any)?.context?.json?.();
          errCode = String(body?.error ?? "");
        } catch {
          errCode = "";
        }
        if (!errCode) errCode = String((error as any)?.message ?? "");
      } else if ((data as any)?.error) {
        errCode = String((data as any).error);
      }
      const low = errCode.toLowerCase();
      if (low.includes("quota")) {
        setGate("quota");
        return;
      }
      if (low.includes("pro")) {
        setGate("pro");
        return;
      }
      if (error || !data) {
        toast({
          variant: "destructive",
          title: "Không chấm được",
          description: "Vui lòng thử lại sau ít phút.",
        });
        return;
      }
      const r: ShadowResult = {
        transcript: String((data as any).transcript ?? ""),
        score: Number((data as any).score ?? 0),
        missed: Array.isArray((data as any).missed) ? (data as any).missed : [],
        extra: Array.isArray((data as any).extra) ? (data as any).extra : [],
      };
      setResult(r);
      onScored(r.score);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-primary" />
        <p className="font-semibold">Nói đuổi</p>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Nghe câu mẫu rồi nhắc lại thật giống. Nghe mẫu không tính vào lượt nghe.
      </p>

      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={onPlayModel}>
          <Headphones className="w-4 h-4 mr-2" /> Nghe câu mẫu
        </Button>
      </div>

      <div className="mt-4">
        <AudioRecorder
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          audioUrl={audioUrl}
          timeLeft={timeLeft}
          totalTime={20}
          label="Thu âm câu nói của bạn"
          micError={micError}
          isRequestingMic={isRequestingMic}
        />
      </div>

      {audioUrl && !isRecording && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={startRecording}>
            <RotateCcw className="w-4 h-4 mr-2" /> Thu lại
          </Button>
        </div>
      )}

      {gate && (
        <div className="mt-4">
          <UpgradeLock reason={gate} featureLabel="AI chấm phát âm" />
        </div>
      )}

      {!gate && !isPro && (
        <div className="mt-4">
          <UpgradeLock reason="pro" featureLabel="AI chấm phát âm" />
        </div>
      )}

      {!gate && isPro && !result && (
        <div className="mt-4">
          <Button onClick={handleGrade} disabled={!blob || isRecording || grading}>
            {grading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang chấm…
              </>
            ) : (
              "Chấm phát âm"
            )}
          </Button>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <p className="font-semibold">Điểm phát âm: {result.score}%</p>
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Bạn đã nói
            </p>
            <p className="leading-relaxed">
              {result.transcript ? result.transcript : "(Không nghe được tiếng nói)"}
            </p>
          </div>
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Câu mẫu</p>
            <p className="leading-relaxed">
              {sentence.text
                .split(/\s+/)
                .filter(Boolean)
                .map((w, i) => {
                  const norm = w.toLowerCase().replace(/[^a-z0-9']/gi, "");
                  const bad = missedSet.has(norm);
                  return (
                    <span
                      key={`${w}-${i}`}
                      className={cn("mr-1", bad ? "text-destructive underline font-medium" : "")}
                    >
                      {w}
                    </span>
                  );
                })}
            </p>
          </div>
          {result.extra.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Từ nói thừa: {result.extra.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <Button variant={result ? "default" : "secondary"} onClick={onNext}>
          {isLast ? "Xem kết quả" : "Câu tiếp theo"} <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Result screen                                                      */
/* ------------------------------------------------------------------ */
function ResultScreen({
  answers,
  total,
  durationSec,
  level,
  mode,
  setId,
  userId,
  onNewSession,
  onRetry,
  onHome,
}: {
  answers: Answer[];
  total: number;
  durationSec: number;
  level: number;
  mode: PracticeMode;
  setId: string | null;
  userId?: string;
  onNewSession: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const finishedRef = useRef(false);
  const avg = answers.length
    ? Math.round(answers.reduce((sum, a) => sum + a.accuracy, 0) / answers.length)
    : 0;
  const correct = answers.filter((a) => a.accuracy === 100).length;

  useEffect(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!userId) return;
    void supabase
      .rpc("finish_dictation_session", {
        p_mode: mode,
        p_level: level,
        p_set_id: setId,
        p_total: total,
        p_correct: correct,
        p_duration_sec: durationSec,
      })
      .then(() => undefined, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = Math.floor(durationSec / 60);
  const ss = durationSec % 60;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold">Kết quả phiên luyện</h1>

      <Card className="mt-5 p-6 flex flex-col items-center">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${avg * 3.6}deg, hsl(var(--muted)) 0deg)`,
          }}
        >
          <div className="w-24 h-24 rounded-full bg-card flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{avg}%</span>
            <span className="text-[10px] text-muted-foreground">chính xác</span>
          </div>
        </div>
        <div className="mt-5 flex gap-8 text-center">
          <div>
            <p className="text-lg font-semibold">
              {correct}/{total}
            </p>
            <p className="text-xs text-muted-foreground">câu đúng hoàn toàn</p>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {mm}:{String(ss).padStart(2, "0")}
            </p>
            <p className="text-xs text-muted-foreground">thời gian làm</p>
          </div>
        </div>
      </Card>

      <Accordion type="single" collapsible className="mt-5">
        {answers.map((a, i) => (
          <AccordionItem key={a.sentenceId} value={a.sentenceId}>
            <AccordionTrigger className="text-left">
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Câu {i + 1}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    a.accuracy === 100 ? "text-green-600" : "text-amber-600",
                  )}
                >
                  {a.accuracy}%
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Câu gốc</p>
                <p className="text-sm">{a.text}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Bạn đã gõ</p>
                <p className="text-sm">{a.typed || "(để trống)"}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onNewSession}>Luyện tiếp bài mới</Button>
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw className="w-4 h-4 mr-2" /> Làm lại bài này
        </Button>
        <Button variant="ghost" onClick={onHome}>
          <Home className="w-4 h-4 mr-2" /> Về trang chủ
        </Button>
      </div>
    </div>
  );
}
