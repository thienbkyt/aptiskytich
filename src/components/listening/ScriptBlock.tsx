import { highlightScript } from "@/lib/listeningReview";
import React from "react";

interface Props {
  script: string;
  spans?: string[];
  loading?: boolean;
  /** Highlight signal phrases (agree / disagree / turn) — review mode only. */
  highlightSignals?: boolean;
}

const SPEAKER_RE = /\s*(Speaker [A-D]|Woman|Man|Boy|Girl|Interviewer|Presenter|Host|Guest|Narrator)\s*:/g;

type SignalCat = "agree" | "disagree" | "turn";

type PhraseEntry = string | { text: string; underline?: boolean };

interface SignalRange {
  start: number;
  end: number;
  cat: SignalCat;
  /** Extra underline (TURN-style) — e.g. partial-agreement cues that usually lead to a rebuttal. */
  underline?: boolean;
}

// Signal phrase lists — matched case-insensitively, whole phrase, longest first.
const SIGNAL_PHRASES: Array<{ cat: SignalCat; phrases: PhraseEntry[] }> = [
  {
    cat: "agree",
    phrases: [
      "that's true", "that is true", "exactly", "yes,", "that's right", "that is right",
      "i completely agree", "i totally agree", "i agree with you", "i agree",
      "you're absolutely right", "you are absolutely right", "i couldn't agree more",
      "absolutely", "definitely", "same here", "me too", "i think so too",
      "good point", "fair enough",
      "true enough", "fair point", "that's fair", "i'd go along with that",
      "you've got a point", "i feel the same", "i share that view",
      "no argument there", "can't argue with that", "same for me", "i'm with you",
    ],
  },
  {
    cat: "disagree",
    phrases: [
      "i see it differently", "actually", "i don't have any ideas about this",
      "that's one perspective", "i don't think so", "i'm not sure", "i am not sure",
      "i disagree", "i don't agree", "not really", "i'm not convinced", "i doubt",
      "on the contrary", "that's not how i see it", "i wouldn't say that",
      "that's not my experience", "i beg to differ", "that's debatable",
      // Partial agreement that usually leads to a rebuttal — orange + TURN-style underline.
      { text: "sometimes, perhaps", underline: true },
      { text: "up to a point", underline: true },
      "i'd say the opposite",
    ],
  },
  {
    cat: "turn",
    phrases: ["but", "however", "although", "though", "on the other hand", "having said that", "then again", "and yet", "still,", "even so", "that said", "mind you"],
  },
];

const SIGNAL_CLASS: Record<SignalCat, string> = {
  agree: "bg-emerald-500/20 text-foreground",
  disagree: "bg-orange-500/20 text-foreground",
  turn: "bg-amber-400/30 text-foreground underline underline-offset-2",
};

const SIGNAL_PRIORITY: Record<SignalCat, number> = { agree: 0, disagree: 1, turn: 2 };


const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phraseRegex(phrase: string): RegExp | null {
  let p = phrase.trim();
  let requireComma = false;
  if (p.endsWith(",")) {
    requireComma = true;
    p = p.slice(0, -1).trimEnd();
  }
  if (!p) return null;
  let src = escapeRe(p).replace(/\s+/g, "\\s+").replace(/'/g, "['’`\\u2019]");
  src = requireComma ? `\\b${src}(?=\\s*,)` : `\\b${src}\\b`;
  return new RegExp(src, "gi");
}

/** Find all signal phrase ranges in the script; overlaps resolved longest-first. */
function findSignalRanges(script: string): SignalRange[] {
  const candidates: SignalRange[] = [];
  for (const group of SIGNAL_PHRASES) {
    for (const phrase of group.phrases) {
      const re = phraseRegex(phrase);
      if (!re) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(script)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        candidates.push({ start: m.index, end: m.index + m[0].length, cat: group.cat });
      }
    }
  }
  candidates.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      SIGNAL_PRIORITY[a.cat] - SIGNAL_PRIORITY[b.cat] ||
      a.start - b.start
  );
  const picked: SignalRange[] = [];
  for (const c of candidates) {
    if (picked.some((p) => c.start < p.end && p.start < c.end)) continue;
    picked.push(c);
  }
  return picked.sort((a, b) => a.start - b.start);
}

const ScriptBlock = ({ script, spans = [], loading, highlightSignals }: Props) => {
  if (!script) return null;
  const parts = highlightScript(script, spans.filter(Boolean));
  const signals = highlightSignals ? findSignalRanges(script) : [];
  const nodes: React.ReactNode[] = [];
  let emitted = false;
  let key = 0;
  let offset = 0;

  parts.forEach((p) => {
    const partStart = offset;
    const partEnd = offset + p.text.length;
    offset = partEnd;

    if (p.mark) {
      nodes.push(
        <mark
          key={key++}
          className="bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5"
        >
          {p.text}
        </mark>
      );
      if (p.text) emitted = true;
      return;
    }

    // Split this chunk by signal ranges (answer highlights take precedence).
    const segs: Array<{ text: string; cat?: SignalCat }> = [];
    let cursor = partStart;
    for (const s of signals) {
      if (s.end <= partStart || s.start >= partEnd) continue;
      const sStart = Math.max(s.start, partStart);
      const sEnd = Math.min(s.end, partEnd);
      if (sStart > cursor) {
        segs.push({ text: p.text.slice(cursor - partStart, sStart - partStart) });
      }
      segs.push({ text: p.text.slice(sStart - partStart, sEnd - partStart), cat: s.cat });
      cursor = sEnd;
    }
    if (cursor < partEnd) segs.push({ text: p.text.slice(cursor - partStart) });

    segs.forEach((seg) => {
      if (seg.cat) {
        nodes.push(
          <mark key={key++} className={`rounded px-0.5 ${SIGNAL_CLASS[seg.cat]}`}>
            {seg.text}
          </mark>
        );
        if (seg.text) emitted = true;
        return;
      }
      let last = 0;
      let m: RegExpExecArray | null;
      SPEAKER_RE.lastIndex = 0;
      while ((m = SPEAKER_RE.exec(seg.text)) !== null) {
        const before = seg.text.slice(last, m.index);
        if (before) {
          nodes.push(<span key={key++}>{before}</span>);
          emitted = true;
        }
        nodes.push(
          <span key={key++} className="font-semibold text-foreground">
            {emitted ? "\n" : ""}
            {m[1]}:{" "}
          </span>
        );
        emitted = true;
        last = m.index + m[0].length;
      }
      const rest = seg.text.slice(last);
      if (rest) {
        nodes.push(<span key={key++}>{rest}</span>);
        emitted = true;
      }
    });
  });

  return (
    <div className="mt-6 border border-border rounded-md p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-heading font-bold text-foreground">Script</p>
        {loading && (
          <span className="text-xs text-muted-foreground italic">Đang tìm đoạn key...</span>
        )}
      </div>
      {highlightSignals && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded bg-emerald-500/20" aria-hidden />
            Xanh = tín hiệu cả hai đồng ý
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded bg-orange-500/20" aria-hidden />
            Cam = tín hiệu chỉ một người
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded bg-amber-400/30 underline underline-offset-2" aria-hidden />
            Vàng = đảo chiều — nghe kỹ vế sau
          </span>
        </div>
      )}
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{nodes}</p>
    </div>
  );
};

export default ScriptBlock;
