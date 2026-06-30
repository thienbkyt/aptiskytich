import { highlightScript } from "@/lib/listeningReview";
import React from "react";

interface Props {
  script: string;
  spans?: string[];
  loading?: boolean;
}

const SPEAKER_RE = /\s*(Speaker [A-D]|Woman|Man|Boy|Girl|Interviewer|Presenter|Host|Guest|Narrator)\s*:/g;

const ScriptBlock = ({ script, spans = [], loading }: Props) => {
  if (!script) return null;
  const parts = highlightScript(script, spans.filter(Boolean));
  const nodes: React.ReactNode[] = [];
  let emitted = false;
  let key = 0;

  parts.forEach((p) => {
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
    let last = 0;
    let m: RegExpExecArray | null;
    SPEAKER_RE.lastIndex = 0;
    while ((m = SPEAKER_RE.exec(p.text)) !== null) {
      const before = p.text.slice(last, m.index);
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
    const rest = p.text.slice(last);
    if (rest) {
      nodes.push(<span key={key++}>{rest}</span>);
      emitted = true;
    }
  });

  return (
    <div className="mt-6 border border-border rounded-md p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-heading font-bold text-foreground">Script</p>
        {loading && (
          <span className="text-xs text-muted-foreground italic">Đang tìm đoạn key...</span>
        )}
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{nodes}</p>
    </div>
  );
};

export default ScriptBlock;
