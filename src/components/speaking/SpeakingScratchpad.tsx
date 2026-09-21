import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { SpeakingOutline } from "@/data/speakingQuestions";
import SpeakingOutlineHelper from "@/components/speaking/SpeakingOutlineHelper";

interface Props {
  outlineB1?: SpeakingOutline | null;
  outlineB2?: SpeakingOutline | null;
  currentQuestion?: number;
  note: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
}

/**
 * Floating scratchpad ("Nháp") for Speaking Part 4 — anchored to the right edge,
 * resizable from the left edge, top edge, and top-left corner, plus a splitter
 * that re-divides the note area and the outline form.
 * Notes are NOT persisted to the database: they survive toggling the panel
 * during the current exam session, but are lost when leaving the page,
 * like exam scratch paper being collected.
 */
export default function SpeakingScratchpad({ outlineB1, outlineB2, currentQuestion, note, onNoteChange, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [size, setSize] = useState(() => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    return { w: 420, h: Math.max(320, vh - 170) };
  });
  const [noteRatio, setNoteRatio] = useState(45);

  const hasOutline = !!(outlineB1 || outlineB2);

  const startResize = (e: React.PointerEvent, dir: "left" | "top" | "corner") => {
    e.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const x0 = e.clientX, y0 = e.clientY;
    const w0 = root.offsetWidth, h0 = root.offsetHeight;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const calc = (ev: PointerEvent) => ({
      w: dir === "top" ? w0 : Math.max(300, Math.min(w0 + (x0 - ev.clientX), window.innerWidth - 48)),
      h: dir === "left" ? h0 : Math.max(260, Math.min(h0 + (y0 - ev.clientY), window.innerHeight - 140)),
    });
    const onMove = (ev: PointerEvent) => {
      const s = calc(ev);
      root.style.width = `${s.w}px`;
      root.style.height = `${s.h}px`;
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSize(calc(ev));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={rootRef}
      className="fixed z-[95] flex flex-col bg-exam-surface rounded-xl shadow-xl border border-exam-border overflow-hidden"
      style={{ right: 24, bottom: 96, width: size.w, height: size.h }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize touch-none hover:bg-exam-accent-soft/20"
        onPointerDown={(e) => startResize(e, "left")}
      />
      <div
        className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize touch-none hover:bg-exam-accent-soft/20"
        onPointerDown={(e) => startResize(e, "top")}
      />
      <div
        className="absolute left-0 top-0 w-3 h-3 cursor-nwse-resize touch-none z-10"
        onPointerDown={(e) => startResize(e, "corner")}
      />

      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-exam-border">
        <span className="text-sm font-semibold text-exam-accent">Nháp</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-exam-text-muted hover:bg-exam-border/40 hover:text-exam-text"
          aria-label="Đóng nháp"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea
        className={`w-full min-h-0 resize-none border border-exam-border bg-exam-surface outline-none px-4 py-3 text-sm leading-relaxed text-exam-text caret-exam-accent selection:bg-exam-accent/30 placeholder:text-exam-text-muted focus:border-exam-accent focus:ring-2 focus:ring-inset focus:ring-exam-accent/40 ${showOutline ? "shrink-0" : "flex-1"}`}
        style={showOutline ? { height: `${noteRatio}%` } : undefined}
        placeholder="Gõ ý tưởng của bạn ở đây…"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        spellCheck={false}
      />

      {showOutline && (
        <>
          <div
            className="shrink-0 h-2 cursor-ns-resize touch-none bg-exam-border/40 hover:bg-exam-accent-soft/20 flex items-center justify-center"
            onPointerDown={(e) => {
              e.preventDefault();
              const root = rootRef.current;
              if (!root) return;
              const y0 = e.clientY;
              const r0 = noteRatio;
              const H = root.offsetHeight;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const calc = (ev: PointerEvent) =>
                Math.max(20, Math.min(80, r0 + ((ev.clientY - y0) / H) * 100));
              const ta = root.querySelector("textarea") as HTMLElement | null;
              const onMove = (ev: PointerEvent) => { if (ta) ta.style.height = `${calc(ev)}%`; };
              const onUp = (ev: PointerEvent) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                setNoteRatio(calc(ev));
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          >
            <div className="w-8 h-0.5 rounded-full bg-exam-text-muted" />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto border-t border-exam-border bg-exam-surface">
            <SpeakingOutlineHelper outlineB1={outlineB1} outlineB2={outlineB2} currentQuestion={currentQuestion} />
          </div>
        </>
      )}

      {hasOutline && (
        <button
          type="button"
          onClick={() => setShowOutline((v) => !v)}
          className="shrink-0 border-t border-exam-border px-4 py-2.5 text-sm font-semibold text-exam-accent hover:bg-exam-border/30"
        >
          {showOutline ? "Ẩn form gợi ý" : "Gợi ý form"}
        </button>
      )}
    </div>
  );
}
