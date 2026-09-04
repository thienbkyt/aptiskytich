import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
import FillBlanks, {
  type FillBlanksResult,
  seededPickIndices,
} from "@/components/dictation/FillBlanks";
import ShadowPanel from "@/components/dictation/ShadowPanel";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { safeLocalStorage } from "@/lib/safeStorage";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/* Types & settings                                                    */
/* ------------------------------------------------------------------ */
type Screen = "home" | "setup" | "sets" | "practice" | "result";

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
  blankRatio: number;
};

const SETTINGS_KEY = "dict:v2:settings";
const BLANK_RATIOS = [0.3, 0.5, 0.7, 1];
const DEFAULT_SETTINGS: Settings = {
  size: 10,
  speed: 1,
  maxPlays: 5,
  onlyTodo: true,
  blankRatio: 0.3,
};

const LEVEL_DEFAULT_RATIO: Record<number, number> = { 1: 0.3, 2: 0.5, 3: 0.7 };

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
      blankRatio: BLANK_RATIOS.includes(parsed?.blankRatio)
        ? parsed.blankRatio
        : DEFAULT_SETTINGS.blankRatio,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const LEVEL_META: Record<number, { title: string; desc: string }> = {
  1: { title: "Level 1 · Foundation", desc: "Câu ngắn, tốc độ chậm — dựng phản xạ (Listening câu 1 - 13) " },
  2: { title: "Level 2 · Momentum", desc: "Đoạn dài, nhiều thông tin — tập giữ mạch khi thông tin dồn dập (Listening câu 14)" },
  3: { title: "Level 3 · Mastery", desc: "Hội thoại nêu quan điểm và bài nói học thuật khó (Listening câu 15 - 17)" },
};


type Answer = {
  sentenceId: string;
  text: string;
  typed: string;
  accuracy: number;
  speakingScore?: number | null;
};

/** State của từng câu, giữ ở component cha để quay lại câu cũ không mất bài. */
type TaskState = {
  checked: boolean;
  hintUsed: boolean;
  accuracy: number | null;
  res: FillBlanksResult | null;
  speakingScore: number | null;
  plays: number;
  saved: boolean;
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

  const [screen, setScreen] = useState<Screen>("home");
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

  /* --- state từng câu (giữ khi quay lại câu trước) --- */
  const taskStatesRef = useRef<Map<string, TaskState>>(new Map());
  /* --- hàm "chốt câu hiện tại rồi đi tiếp" do SentenceTask đăng ký --- */
  const leaveRef = useRef<(() => void) | null>(null);


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

  /* --- load level stats on the merged first screen --- */
  useEffect(() => {
    if (screen !== "home") return;

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
    taskStatesRef.current = new Map();
    leaveRef.current = null;
    setStartedAt(Date.now());
    setScreen("practice");
  };

  const handleSentenceDone = (a: Answer) => {
    setAnswers((prev) => {
      const i = prev.findIndex((p) => p.sentenceId === a.sentenceId);
      if (i === -1) return [...prev, a];
      // Đã ghi nhận lần chấm đầu — chỉ bổ sung điểm nói nhại.
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

  /* ---------------- Screen 1: kiểu luyện + lộ trình ---------------- */
  if (screen === "home") {
    const cards: Array<{
      key: PracticeMode;
      title: string;
      desc: string;
      icon: typeof Headphones;
    }> = [
      { key: "dictation", title: "Nghe chép", desc: "Nghe rồi gõ lại câu", icon: Headphones },
      { key: "shadow", title: "Nói nhại", desc: "Nghe rồi nhắc lại theo audio (Shadowing)", icon: Mic },
      { key: "combo", title: "Kết hợp", desc: "Vừa chép vừa nói nhại", icon: Sparkles },
    ];
    return (
      <Shell onBack={() => navigate("/dashboard")}>
        <h1 className="text-2xl sm:text-3xl font-bold">Nghe chép & nói nhại (Dictation & Shadowing)</h1>
        <p className="text-muted-foreground mt-2">Chọn kiểu luyện tập, rồi chọn level để bắt đầu.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setMode(c.key)}
              className={cn(
                "text-left rounded-xl border p-6 transition bg-card",
                mode === c.key
                  ? "border-primary ring-2 ring-primary/30 shadow-md"
                  : "hover:border-primary/60 hover:shadow-md",
              )}
            >
              <c.icon className="w-9 h-9 text-primary" />
              <div className="mt-4 flex items-center gap-2">
                <span className="font-semibold text-lg">{c.title}</span>
                {mode === c.key && <Badge variant="secondary">Đang chọn</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
            </button>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10">Chọn Level </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Ba cấp độ tăng dần theo độ khó bài thi thật.
        </p>

        <div className="mt-4 space-y-4">
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
                  setSettings((s) => ({ ...s, blankRatio: LEVEL_DEFAULT_RATIO[lv] ?? s.blankRatio }));
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

  /* ---------------- Screen 2: setup ---------------- */
  if (screen === "setup") {
    return (
      <Shell onBack={() => setScreen("home")}>
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

          <OptionRow label="Độ khó (số từ phải điền)">
            {[
              { v: 0.3, l: "Dễ · ẩn 30%" },
              { v: 0.5, l: "Vừa · 50%" },
              { v: 0.7, l: "Khó · 70%" },
              { v: 1, l: "Chép hết · 100%" },
            ].map((o) => (
              <Chip
                key={o.v}
                active={settings.blankRatio === o.v}
                onClick={() => setSettings((s) => ({ ...s, blankRatio: o.v }))}
              >
                {o.l}
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
    const modeMeta =
      mode === "dictation"
        ? { icon: Headphones, label: "Nghe & điền từ" }
        : mode === "shadow"
          ? { icon: Mic, label: "Nghe & nói nhại" }
          : { icon: Sparkles, label: "Chế độ Kết hợp" };
    const ModeIcon = modeMeta.icon;
    return (
      <Shell wide={mode === "combo"} hideBack>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exitPractice}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <p className="font-semibold truncate">{s.set_title}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-0.5">
              <ModeIcon className="w-3.5 h-3.5" /> {modeMeta.label}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={exitPractice}>
            <X className="w-4 h-4 mr-1" /> Thoát
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Câu trước
          </Button>
          <Badge variant="secondary" className="mx-1">
            {index + 1}/{sentences.length}
          </Badge>
          <Button size="sm" onClick={() => (leaveRef.current ? leaveRef.current() : goNext())}>
            {index + 1 >= sentences.length ? "Xem kết quả" : "Câu tiếp theo"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <Progress value={((index + 1) / sentences.length) * 100} className="h-1 mt-3" />

        <SentenceTask
          key={s.sentence_id}
          sentence={s}
          settings={settings}
          mode={mode}
          userId={user?.id}
          isLast={index + 1 >= sentences.length}
          initialState={taskStatesRef.current.get(s.sentence_id) ?? null}
          onPersistState={(st) => taskStatesRef.current.set(s.sentence_id, st)}
          onRegisterLeave={(fn) => {
            leaveRef.current = fn;
          }}
          onDone={handleSentenceDone}
          onNext={goNext}
        />
      </Shell>
    );
  }

  /* ---------------- Screen 5: result ---------------- */
  return (
    <Shell onBack={() => setScreen("home")}>
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
          taskStatesRef.current = new Map();
          leaveRef.current = null;
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
function Shell({
  children,
  onBack,
  backLabel = "Quay lại",
  backIcon: BackIcon = ArrowLeft,
  wide = false,
  hideBack = false,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backIcon?: typeof ArrowLeft;
  wide?: boolean;
  hideBack?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className={cn("mx-auto px-4 pt-20 pb-10 sm:pt-24", wide ? "max-w-6xl" : "max-w-3xl")}>
        {!hideBack && (
          <button
            type="button"
            onClick={() => (onBack ? onBack() : navigate("/dashboard"))}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <BackIcon className="w-4 h-4" /> {backLabel}
          </button>
        )}
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
function waveformBars(seed: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const bars: number[] = [];
  let x = h || 0x9e3779b9;
  for (let i = 0; i < 40; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    bars.push(20 + Math.round((x / 0xffffffff) * 80));
  }
  return bars;
}

/** Chuẩn hoá từ giống FillBlanks (bỏ dấu câu, không phân biệt hoa/thường). */
function normWord(w: string) {
  return w.toLowerCase().replace(/[^a-z0-9']/gi, "");
}

function SentenceTask({
  sentence,
  settings,
  mode,
  userId,
  isLast,
  initialState,
  onPersistState,
  onRegisterLeave,
  onDone,
  onNext,
}: {
  sentence: SessionSentence;
  settings: Settings;
  mode: PracticeMode;
  userId?: string;
  isLast: boolean;
  initialState: TaskState | null;
  onPersistState: (state: TaskState) => void;
  onRegisterLeave: (fn: () => void) => void;
  onDone: (a: Answer) => void;
  onNext: () => void;
}) {
  const playerRef = useRef<SegmentPlayerHandle | null>(null);
  const fillWrapRef = useRef<HTMLDivElement | null>(null);
  const [plays, setPlays] = useState(initialState?.plays ?? 0);
  const [speed, setSpeed] = useState(settings.speed);
  const [hintUsed, setHintUsed] = useState(initialState?.hintUsed ?? false);
  const [checked, setChecked] = useState(initialState?.checked ?? false);
  const [revealed, setRevealed] = useState(initialState?.checked ?? false);
  const [res, setRes] = useState<FillBlanksResult | null>(initialState?.res ?? null);
  const firstAccuracyRef = useRef<number | null>(initialState?.accuracy ?? null);
  const savedRef = useRef(initialState?.saved ?? false);
  const speakingScoreRef = useRef<number | null>(initialState?.speakingScore ?? null);
  const resRef = useRef<FillBlanksResult | null>(initialState?.res ?? null);
  /** Bản chụp kết quả lần chấm ĐẦU TIÊN — không bao giờ bị null hoá. */
  const firstResultRef = useRef<FillBlanksResult | null>(initialState?.res ?? null);
  /** Câu đã chấm ở lần trước → hiển thị chỉ đọc. */
  const readOnly = !!initialState?.checked;

  const limitReached = settings.maxPlays > 0 && plays >= settings.maxPlays;
  const shownAccuracy = firstAccuracyRef.current ?? 0;
  const allCorrect = !!res && res.total > 0 && res.correct === res.total;
  const bars = useMemo(() => waveformBars(sentence.sentence_id), [sentence.sentence_id]);

  const hasAudio = !!sentence.audio_url && sentence.start_sec != null && sentence.end_sec != null;
  const segLen = Math.max(1, Math.round(Number(sentence.end_sec ?? 0) - Number(sentence.start_sec ?? 0)));

  /** Đẩy state hiện tại lên cha để quay lại câu này không mất bài. */
  const persist = () => {
    onPersistState({
      checked: checked || savedRef.current,
      hintUsed,
      accuracy: firstAccuracyRef.current,
      res: resRef.current,
      speakingScore: speakingScoreRef.current,
      plays,
      saved: savedRef.current,
    });
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    persistRef.current();
  }, [checked, hintUsed, res, plays]);

  /** Ghi kết quả — chỉ MỘT lần cho mỗi câu. */
  const saveOnce = (accuracy: number, speakingScore: number | null) => {
    if (savedRef.current) return;
    savedRef.current = true;
    speakingScoreRef.current = speakingScore ?? speakingScoreRef.current;
    onDone({
      sentenceId: sentence.sentence_id,
      text: sentence.text,
      typed: firstResultRef.current?.filledSentence ?? "",
      accuracy,
      speakingScore,
    });
    persistRef.current();
    if (!userId) return;
    void (async () => {
      try {
        await supabase.rpc("save_dictation_result", {
          p_sentence_id: sentence.sentence_id,
          p_accuracy: accuracy,
          p_mode: mode,
          p_speaking_score: speakingScore,
        });
      } catch {
        /* progress ghi thất bại — không chặn luyện tập */
      }
    })();
  };

  const applyResult = (result: FillBlanksResult) => {
    let acc = result.total ? Math.round((result.correct / result.total) * 100) : 0;
    if (hintUsed) acc = Math.min(acc, 90);
    resRef.current = result;
    if (firstResultRef.current === null) firstResultRef.current = result;
    setRes(result);
    setChecked(true);
    if (firstAccuracyRef.current === null) firstAccuracyRef.current = acc;
    return firstAccuracyRef.current;
  };

  const handleCheck = (result: FillBlanksResult) => {
    const acc = applyResult(result);
    // Nghe chép thuần: ghi ngay. Kết hợp: chờ điểm nói (hoặc lúc sang câu khác).
    if (mode === "dictation") saveOnce(acc, null);
  };

  /** Chấm từ những gì đang gõ trong ô nhập (khi học viên chưa bấm "Kiểm tra"). */
  const gradeFromInputs = (): FillBlanksResult | null => {
    const el = fillWrapRef.current;
    if (!el) return null;
    const inputs = Array.from(el.querySelectorAll("input")) as HTMLInputElement[];
    if (!inputs.length) return null;
    const words = sentence.text.match(/[A-Za-z0-9']+/g) ?? [];
    if (!words.length) return null;
    const count = Math.max(1, Math.round(words.length * settings.blankRatio));
    const hidden = seededPickIndices(
      words.length,
      count,
      `${sentence.sentence_id}:${settings.blankRatio}`,
    );
    const filled = inputs.map((i) => i.value);
    let correct = 0;
    hidden.forEach((wi, slot) => {
      const expected = normWord(words[wi] ?? "");
      if (expected && normWord(filled[slot] ?? "") === expected) correct++;
    });
    const slotOf = new Map<number, number>();
    hidden.forEach((wi, slot) => slotOf.set(wi, slot));
    let wi = -1;
    const filledSentence = sentence.text.replace(/[A-Za-z0-9']+/g, (m) => {
      wi++;
      const slot = slotOf.get(wi);
      if (slot === undefined) return m;
      return (filled[slot] ?? "").trim() || "___";
    });
    return { correct, total: hidden.length, filled, filledSentence };
  };

  const handleScored = (score: number) => {
    speakingScoreRef.current = score;
    if (mode === "shadow") saveOnce(0, score);
    else saveOnce(firstAccuracyRef.current ?? 0, score);
    persistRef.current();
  };

  /** Chốt câu hiện tại (tự chấm nếu cần) rồi mới đi tiếp. */
  const commitAndNext = () => {
    if (!savedRef.current) {
      if (mode === "shadow") {
        saveOnce(0, speakingScoreRef.current);
      } else {
        let acc = firstAccuracyRef.current;
        if (acc === null) {
          const auto = gradeFromInputs();
          acc = auto ? applyResult(auto) : 0;
        }
        saveOnce(acc ?? 0, speakingScoreRef.current);
      }
    }
    persistRef.current();
    onNext();
  };

  const commitRef = useRef(commitAndNext);
  commitRef.current = commitAndNext;

  useEffect(() => {
    onRegisterLeave(() => commitRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.sentence_id]);

  const handleNext = () => {
    commitRef.current();
  };

  const handleRelisten = () => {
    playerRef.current?.play({ silentCount: true });
  };

  const speedButtons = (
    <div className="flex items-center gap-1">
      {[0.75, 1, 1.25].map((v) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSpeed(v)}
          className={cn(
            "h-7 px-2 text-xs font-medium",
            speed === v
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:border-primary",
          )}
        >
          {v}x
        </Button>
      ))}
    </div>
  );

  const audioRow = hasAudio ? (
    <>
      <div className="mt-5 flex items-center gap-3">
        <SegmentPlayer
          ref={playerRef}
          path={sentence.audio_url as string}
          startSec={Number(sentence.start_sec)}
          endSec={Number(sentence.end_sec)}
          speed={speed}
          autoPlay
          disabled={limitReached}
          onEnded={() => setPlays((p) => p + 1)}
          className="shrink-0 [&>div]:hidden"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Phát lại"
          disabled={limitReached}
          onClick={() => playerRef.current?.play()}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* Waveform trang trí — không phân tích audio thật */}
        <div className="flex-1 min-w-0 h-10 flex items-center gap-[3px] overflow-hidden">
          {bars.map((b, i) => (
            <span key={i} className="flex-1 rounded-full bg-primary/30" style={{ height: `${b}%` }} />
          ))}
        </div>

        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          0:00 / 0:{String(segLen).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {settings.maxPlays > 0
            ? `Đã nghe ${Math.min(plays, settings.maxPlays)}/${settings.maxPlays} lần`
            : `Đã nghe ${plays} lần`}
          {limitReached && " · đã hết lượt nghe"}
        </p>
        {speedButtons}
      </div>
    </>
  ) : (
    <p className="mt-4 text-sm text-destructive">Câu này chưa có dữ liệu audio.</p>
  );

  const nextButton = (
    <Button size="sm" onClick={handleNext}>
      {isLast ? "Xem kết quả" : "Câu tiếp theo"}
      <ChevronRight className="w-4 h-4 ml-1" />
    </Button>
  );

  const fillColumn = (
    <div>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Headphones className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Nghe và điền từ
          </p>
          <p className="text-lg font-bold leading-tight">Listen &amp; Fill</p>
        </div>
      </div>

      {audioRow}

      <div ref={fillWrapRef} className="mt-6 rounded-xl border bg-muted/30 p-4 sm:p-5">
        {readOnly ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Bạn đã điền (chỉ đọc)
            </p>
            <p className="leading-relaxed font-semibold">
              {res?.filled.some((v) => v.trim())
                ? res.filled.map((v) => (v.trim() ? v : "___")).join(" · ")
                : "(để trống)"}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Câu này đã được chấm — kết quả đã lưu, không thể sửa lại.
            </p>
          </div>
        ) : (
          <FillBlanks
            text={sentence.text}
            ratio={settings.blankRatio}
            sentenceId={sentence.sentence_id}
            hintUsed={hintUsed}
            onHint={() => setHintUsed(true)}
            onReset={() => {
              setChecked(false);
              resRef.current = null;
              setRes(null);
            }}
            onCheck={handleCheck}
          />
        )}
      </div>

      {checked && res && (
        <div className="mt-5 rounded-xl border bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            {allCorrect ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Lightbulb className="w-5 h-5 text-[#FEAD5F]" />
            )}
            <p className="font-semibold">Lần này: {res.correct}/{res.total} từ đúng</p>
          </div>
          <div className="mt-1">
            <p className="text-sm">
              <span className="font-semibold">Điểm ghi nhận: {shownAccuracy}%</span>
              {hintUsed && (
                <span className="ml-2 text-xs text-muted-foreground">(đã dùng gợi ý, trần 90%)</span>
              )}
            </p>
            {(() => {
              const rawLatest = res.total ? Math.round((res.correct / res.total) * 100) : 0;
              const latestAcc = hintUsed ? Math.min(rawLatest, 90) : rawLatest;
              return latestAcc !== shownAccuracy ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Lần đầu bạn đạt {shownAccuracy}% — điểm ghi nhận tính theo lần chấm đầu.
                </p>
              ) : null;
            })()}
          </div>
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Đáp án đúng</p>
            <p className="leading-relaxed font-medium">{sentence.text}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRelisten}>
              <RotateCcw className="w-4 h-4 mr-2" /> Nghe lại &amp; sửa
            </Button>
            {mode === "dictation" && nextButton}
          </div>
        </div>
      )}

      {!checked && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const snapshot = gradeFromInputs();
              setChecked(true);
              setRevealed(true);
              if (firstAccuracyRef.current === null) firstAccuracyRef.current = 0;
              const fallback: FillBlanksResult =
                snapshot ?? { correct: 0, total: 0, filled: [], filledSentence: "" };
              resRef.current = resRef.current ?? fallback;
              if (firstResultRef.current === null) firstResultRef.current = resRef.current;
              setRes((r) => r ?? fallback);
              if (mode === "dictation") saveOnce(0, null);
            }}
          >
            Bỏ qua, xem đáp án
          </Button>
        </div>
      )}
    </div>
  );

  const shadowPanel = (
    <ShadowPanel
      sentence={sentence}
      speed={speed}
      revealed={mode === "shadow" ? true : checked || revealed}
      onScored={handleScored}
      onPlayModel={() => playerRef.current?.play({ silentCount: true })}
    />
  );

  /* ---- Nói đuổi: một cột ---- */
  if (mode === "shadow") {
    return (
      <Card className="mt-5 p-5 sm:p-6">
        {audioRow}
        <div className="mt-5">{shadowPanel}</div>
        <div className="mt-4 flex justify-end">{nextButton}</div>
      </Card>
    );
  }

  /* ---- Kết hợp: hai cột ---- */
  if (mode === "combo") {
    return (
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Card className="p-5 sm:p-6 min-w-0">{fillColumn}</Card>
        <div className="space-y-4 min-w-0">
          {shadowPanel}
          <div className="flex justify-end">{nextButton}</div>
        </div>
      </div>
    );
  }

  /* ---- Nghe chép ---- */
  return <Card className="mt-5 p-5 sm:p-6">{fillColumn}</Card>;
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

      {/* Bảng chi tiết từng câu (ẩn trên mobile) */}
      <div className="mt-5 hidden sm:block rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2 w-16 font-semibold">Câu</th>
              <th className="px-3 py-2 font-semibold">Câu gốc</th>
              <th className="px-3 py-2 font-semibold">Bạn đã gõ</th>
              <th className="px-3 py-2 w-16 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a, i) => (
              <tr key={a.sentenceId} className="border-t align-top">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 whitespace-pre-wrap break-words">{a.text}</td>
                <td className="px-3 py-2 whitespace-pre-wrap break-words">
                  {a.typed ? a.typed : <span className="text-muted-foreground">(để trống)</span>}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold",
                    a.accuracy === 100 ? "text-green-600" : "text-amber-600",
                  )}
                >
                  {a.accuracy}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danh sách thẻ dọc trên màn hình hẹp */}
      <div className="mt-5 space-y-3 sm:hidden">
        {answers.map((a, i) => (
          <div key={a.sentenceId} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Câu {i + 1}</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  a.accuracy === 100 ? "text-green-600" : "text-amber-600",
                )}
              >
                {a.accuracy}%
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Câu gốc</p>
              <p className="text-sm whitespace-pre-wrap break-words">{a.text}</p>
            </div>
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bạn đã gõ</p>
              <p className="text-sm whitespace-pre-wrap break-words">
                {a.typed ? a.typed : <span className="text-muted-foreground">(để trống)</span>}
              </p>
            </div>
          </div>
        ))}
      </div>


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
