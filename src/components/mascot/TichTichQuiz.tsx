/**
 * Tích Tích đố từ vựng — thỉnh thoảng tự bật một câu đố nhỏ bên cạnh Tích Tích.
 * - Từ lấy từ phần Vocabulary trong các đề G&V thật (xem tichtichQuizBank.ts).
 * - 4 dạng: chọn nghĩa tiếng Việt, từ đồng nghĩa, từ đúng nghĩa (định nghĩa), điền từ vào câu.
 * - Trả lời xong → hiện nghĩa tiếng Việt (từ đúng + từ đã chọn; dạng điền từ có thêm nghĩa cả câu).
 *   Đúng → tự sang câu tiếp; sai → dừng lại cho đọc, bấm "Câu tiếp →". Không bấm thì sau 30s tự ẩn,
 *   vài phút sau mới đố lại. Chỉ đố vui, không lưu điểm.
 * - Chỉ chạy khi Tích Tích góc màn hình đang hiện (đã tự ẩn trong màn thi / mobile).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizBank } from "./tichtichQuizBank";

export type QuizMood = "think" | "happy" | "worry" | "sad" | null;

type Kind = "vi" | "syn" | "def" | "gap";
interface Question {
  kind: Kind;
  title: string;
  prompt: string;
  sub?: string;
  options: string[];
  answer: string;
}

const FIRST_DELAY_MS = 30_000;      // lần đầu: sau 30 giây ở trang
const NEXT_DELAY_MS = 4 * 60_000;   // sau khi ẩn: 4 phút đố lại
const IDLE_HIDE_MS = 30_000;        // không bấm 30s thì tự ẩn
const NEXT_QUESTION_MS = 3500;      // trả lời đúng → câu tiếp (đủ thời gian đọc nghĩa)
const WRONG_IDLE_HIDE_MS = 60_000;  // trả lời sai mà không bấm "Câu tiếp" → 60s tự ẩn
const OFF_KEY = "tt-quiz-off-date";

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const distractors = (pool: string[], answer: string) =>
  shuffle(Array.from(new Set(pool.filter((o) => o && o !== answer)))).slice(0, 3);

function makeQuestion(bank: QuizBank, avoid?: string): Question {
  for (let tries = 0; tries < 5; tries++) {
    const r = Math.random();
    let q: Question;
    if (r < 0.3) {
      const [word, vi] = pickOne(bank.vi);
      q = {
        kind: "vi",
        title: "Chọn nghĩa tiếng Việt",
        prompt: word,
        options: shuffle([vi, ...distractors(bank.vi.map((x) => x[1]), vi)]),
        answer: vi,
      };
    } else if (r < 0.55) {
      const [word, ans, opts] = pickOne(bank.syn);
      q = {
        kind: "syn",
        title: "Từ đồng nghĩa",
        prompt: word,
        sub: "gần nghĩa nhất với từ nào?",
        options: shuffle([ans, ...distractors(opts, ans)]),
        answer: ans,
      };
    } else if (r < 0.72) {
      const [def, ans, opts] = pickOne(bank.def);
      q = {
        kind: "def",
        title: "Từ nào đúng nghĩa?",
        prompt: def,
        options: shuffle([ans, ...distractors(opts, ans)]),
        answer: ans,
      };
    } else {
      const [sentence, ans, opts] = pickOne(bank.gap);
      q = {
        kind: "gap",
        title: "Điền từ vào chỗ trống",
        prompt: sentence,
        options: shuffle([ans, ...distractors(opts, ans)]),
        answer: ans,
      };
    }
    if (q.prompt !== avoid) return q;
  }
  const [word, vi] = pickOne(bank.vi);
  return { kind: "vi", title: "Chọn nghĩa tiếng Việt", prompt: word, options: shuffle([vi, ...distractors(bank.vi.map((x) => x[1]), vi)]), answer: vi };
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const isOffToday = () => {
  try { return localStorage.getItem(OFF_KEY) === todayKey(); } catch { return false; }
};

const PRAISE = ["Chuẩn luôn! 🎉", "Giỏi quá đi! ✨", "Đúng rồi nè! 🙌", "Xịn! Nhớ từ này nha 💪"];

// Học viên chưa chọn đáp án → Tích Tích nũng nịu nhắc (10s và 20s).
const NUDGES = [
  "Bạn iu ơi, chú ý Tích Tích xíu nhứ 🥺",
  "Đố dễ mà, chọn đại 1 cái đi nè 👉👈",
  "Tích Tích đợi nãy giờ á 😚",
  "Hong trả lời là Tích Tích dỗi đó nha 😤",
  "Bạn iu bận hả? Liếc qua 1 xíu thui 🥹",
  "Câu này dễ ẹc à, thử hong? 🤭",
  "Tích Tích ngồi chờ bạn iu nè 🫶",
];
const NUDGE_1_MS = 10_000;
const NUDGE_2_MS = 20_000;

export default function TichTichQuiz({ onMood, name = "Tích Tích" }: { onMood?: (m: QuizMood) => void; name?: string }) {
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [praise, setPraise] = useState(PRAISE[0]);
  const [nudge, setNudge] = useState<string | null>(null);
  const nudgeTimers = useRef<number[]>([]);
  const showTimer = useRef<number>();
  const idleTimer = useRef<number>();
  const nextTimer = useRef<number>();

  const clearNudges = () => {
    nudgeTimers.current.forEach((t) => clearTimeout(t));
    nudgeTimers.current = [];
    setNudge(null);
  };

  const clearAll = () => {
    clearNudges();
    clearTimeout(showTimer.current);
    clearTimeout(idleTimer.current);
    clearTimeout(nextTimer.current);
  };

  const loadBank = useCallback(async () => {
    if (bank) return bank;
    const mod = await import("./tichtichQuizBank");
    setBank(mod.default);
    return mod.default;
  }, [bank]);

  const hide = useCallback((scheduleNext = true) => {
    clearAll();
    setQ(null);
    setPicked(null);
    onMood?.(null);
    if (scheduleNext && !isOffToday()) {
      showTimer.current = window.setTimeout(() => void open(), NEXT_DELAY_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMood]);

  const armIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearNudges();
    const lines = shuffle(NUDGES).map((l) => l.replace(/Tích Tích/g, name));
    nudgeTimers.current.push(window.setTimeout(() => { setNudge(lines[0]); onMood?.("worry"); }, NUDGE_1_MS));
    nudgeTimers.current.push(window.setTimeout(() => { setNudge(lines[1]); onMood?.("sad"); }, NUDGE_2_MS));
    idleTimer.current = window.setTimeout(() => hide(true), IDLE_HIDE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hide, onMood]);

  const open = useCallback(async (avoid?: string) => {
    if (isOffToday()) return;
    if (document.hidden) {
      showTimer.current = window.setTimeout(() => void open(avoid), 20_000);
      return;
    }
    try {
      const b = await loadBank();
      setPicked(null);
      setQ(makeQuestion(b, avoid));
      onMood?.("think");
      armIdle();
    } catch {
      /* không tải được ngân hàng câu đố → bỏ qua */
    }
  }, [armIdle, loadBank, onMood]);

  useEffect(() => {
    if (!isOffToday()) showTimer.current = window.setTimeout(() => void open(), FIRST_DELAY_MS);
    return () => { clearAll(); onMood?.(null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (opt: string) => {
    if (!q || picked) return;
    clearTimeout(idleTimer.current);
    clearNudges();
    setPicked(opt);
    const ok = opt === q.answer;
    if (ok) setPraise(pickOne(PRAISE));
    onMood?.(ok ? "happy" : "worry");
    const prev = q.prompt;
    if (ok) {
      nextTimer.current = window.setTimeout(() => void open(prev), NEXT_QUESTION_MS);
    } else {
      // Sai → đứng yên cho học viên đọc nghĩa, bấm "Câu tiếp →" mới đổi câu.
      idleTimer.current = window.setTimeout(() => hide(true), WRONG_IDLE_HIDE_MS);
    }
  };

  const goNext = () => {
    if (!q) return;
    clearTimeout(idleTimer.current);
    clearTimeout(nextTimer.current);
    void open(q.prompt);
  };

  /** Nghĩa tiếng Việt của 1 từ trong câu đố (nếu có). */
  const meanOf = (w: string): string | undefined => bank?.mean?.[w.toLowerCase().trim()];
  /** Dạng "chọn nghĩa": tìm từ tiếng Anh ứng với nghĩa tiếng Việt đã chọn. */
  const wordOfVi = (vi: string): string | undefined => bank?.vi.find((x) => x[1] === vi)?.[0];

  const turnOffToday = () => {
    try { localStorage.setItem(OFF_KEY, todayKey()); } catch { /* ignore */ }
    hide(false);
  };

  if (!q) return null;

  const renderPrompt = () => {
    if (q.kind === "gap") {
      const parts = q.prompt.split("____");
      return (
        <p className="text-[14px] leading-snug text-foreground">
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {i < parts.length - 1 && (
                <span className="inline-block min-w-[48px] mx-0.5 border-b-2 border-primary text-center font-bold text-primary">
                  {picked ? q.answer : " "}
                </span>
              )}
            </span>
          ))}
        </p>
      );
    }
    if (q.kind === "def") return <p className="text-[14px] leading-snug italic text-foreground">“{q.prompt}”</p>;
    return (
      <p className="text-foreground">
        <span className="text-[20px] font-extrabold tracking-tight">{q.prompt}</span>
        {q.sub && <span className="block text-[12px] text-muted-foreground mt-0.5">{q.sub}</span>}
      </p>
    );
  };

  return (
    <div
      className="absolute right-[108px] bottom-0 w-[300px] rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] p-3.5 animate-in fade-in slide-in-from-right-2"
      role="dialog"
      aria-label={`${name} đố từ vựng`}
      onMouseEnter={() => {
        clearTimeout(idleTimer.current);
        if (nudge) { clearNudges(); if (!picked) onMood?.("think"); }
      }}
      onMouseLeave={() => { if (!picked) armIdle(); }}
    >
      {nudge && !picked && (
        <div className="absolute -top-12 right-2 max-w-[270px] rounded-2xl rounded-br-sm border border-pink-200 bg-pink-50 px-3 py-1.5 text-[12.5px] font-semibold text-pink-700 shadow-md animate-in fade-in zoom-in-95">
          {nudge}
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-bold text-primary">🧠 {name} đố nè · {q.title}</span>
        <button
          type="button"
          onClick={() => hide(true)}
          aria-label="Đóng"
          className="w-6 h-6 -mr-1 rounded-full text-muted-foreground hover:bg-muted flex items-center justify-center text-base leading-none"
        >
          ×
        </button>
      </div>

      <div className="mb-3">{renderPrompt()}</div>

      <div className="grid grid-cols-2 gap-1.5">
        {q.options.map((opt) => {
          const isAns = opt === q.answer;
          const isPicked = opt === picked;
          let cls = "border-border bg-background hover:border-primary hover:bg-primary/5 text-foreground";
          if (picked) {
            if (isAns) cls = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
            else if (isPicked) cls = "border-red-400 bg-red-500/10 text-red-600 dark:text-red-400";
            else cls = "border-border bg-background text-muted-foreground opacity-60";
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={!!picked}
              onClick={() => choose(opt)}
              className={`min-h-[36px] px-2 py-1.5 rounded-lg border text-[13px] font-semibold leading-tight text-left transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked && (() => {
        const ok = picked === q.answer;
        const rows: { w: string; m?: string; bad?: boolean }[] = [];
        if (q.kind === "vi") {
          rows.push({ w: q.prompt, m: q.answer });
          if (!ok) rows.push({ w: wordOfVi(picked) ?? "", m: picked, bad: true });
        } else {
          if (q.kind === "syn") rows.push({ w: q.prompt, m: meanOf(q.prompt) });
          rows.push({ w: q.answer, m: meanOf(q.answer) });
          if (!ok) rows.push({ w: picked, m: meanOf(picked), bad: true });
        }
        const shown = rows.filter((r) => r.w && r.m);
        const sentenceVi = q.kind === "gap" ? bank?.gapVi?.[q.prompt] : undefined;
        if (!shown.length && !sentenceVi) return null;
        return (
          <div className="mt-2.5 rounded-lg bg-muted/60 px-2.5 py-2 space-y-0.5 text-[12.5px] leading-snug">
            {shown.map((r, i) => (
              <p key={i} className={r.bad ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                <span className="font-bold">{r.w}</span>
                <span className="text-muted-foreground"> = </span>
                {r.m}
              </p>
            ))}
            {sentenceVi && (
              <p className="pt-0.5 text-muted-foreground italic">→ {sentenceVi}</p>
            )}
          </div>
        );
      })()}

      <div className="mt-2.5 flex items-center justify-between min-h-[18px]">
        <span className="text-[12px] font-semibold">
          {picked
            ? picked === q.answer
              ? <span className="text-green-600 dark:text-green-400">{praise}</span>
              : <span className="text-red-600 dark:text-red-400">Đáp án: {q.answer}</span>
            : <span className="text-muted-foreground font-normal">Từ trong đề thật</span>}
        </span>
        {picked && picked !== q.answer ? (
          <button
            type="button"
            onClick={goNext}
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-[12px] font-bold text-primary-foreground hover:opacity-90"
          >
            Câu tiếp →
          </button>
        ) : (
          <button type="button" onClick={turnOffToday} className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
            Tạm tắt hôm nay
          </button>
        )}
      </div>
    </div>
  );
}
