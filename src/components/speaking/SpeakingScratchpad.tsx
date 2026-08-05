import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { SpeakingOutline } from "@/data/speakingQuestions";
import SpeakingOutlineHelper from "@/components/speaking/SpeakingOutlineHelper";

interface Props {
  outlineB1?: SpeakingOutline | null;
  outlineB2?: SpeakingOutline | null;
  onClose: () => void;
}

/**
 * Floating scratchpad ("Nháp") for Speaking Part 4 — draggable + resizable.
 * Notes are intentionally NOT persisted: closing the panel discards them,
 * like exam scratch paper being collected.
 */
export default function SpeakingScratchpad({ outlineB1, outlineB2, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [showOutline, setShowOutline] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const hasOutline = !!(outlineB1 || outlineB2);

  return (
    <div
      ref={rootRef}
      className="fixed z-[95] flex flex-col bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
      style={{
        width: 380,
        height: 460,
        resize: "both",
        minWidth: 300,
        minHeight: 260,
        maxWidth: "90vw",
        maxHeight: "85vh",
        ...(pos ? { left: pos.x, top: pos.y } : { right: 24, top: 120 }),
      }}
    >
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-200 cursor-move select-none touch-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const root = rootRef.current;
          if (!root) return;
          const box = root.getBoundingClientRect();
          const offX = e.clientX - box.left;
          const offY = e.clientY - box.top;
          root.style.transition = "none";
          root.style.right = "";
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const clamp = (cx: number, cy: number) => ({
            x: Math.max(8, Math.min(cx - offX, window.innerWidth - box.width - 8)),
            y: Math.max(8, Math.min(cy - offY, window.innerHeight - 80)),
          });
          const onMove = (ev: PointerEvent) => {
            const p = clamp(ev.clientX, ev.clientY);
            root.style.left = `${p.x}px`;
            root.style.top = `${p.y}px`;
          };
          const onUp = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            root.style.transition = "";
            setPos(clamp(ev.clientX, ev.clientY));
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        <span className="text-sm font-semibold text-[#24085a]">Nháp</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Đóng nháp"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <textarea
        className="w-full flex-1 resize-none border-0 outline-none px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400"
        placeholder="Gõ ý tưởng của bạn ở đây…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        spellCheck={false}
      />

      {showOutline && (
        <div className="border-t border-gray-200 overflow-y-auto max-h-[55%] bg-[#24085a]/5">
          <SpeakingOutlineHelper outlineB1={outlineB1} outlineB2={outlineB2} />
        </div>
      )}

      {hasOutline && (
        <button
          type="button"
          onClick={() => setShowOutline((v) => !v)}
          className="shrink-0 border-t border-gray-200 px-4 py-2.5 text-sm font-semibold text-[#24085a] hover:bg-gray-50"
        >
          {showOutline ? "Ẩn form gợi ý" : "Gợi ý form"}
        </button>
      )}
    </div>
  );
}
