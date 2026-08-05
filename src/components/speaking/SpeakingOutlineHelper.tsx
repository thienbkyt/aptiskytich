import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import type { SpeakingOutline } from "@/data/speakingQuestions";

interface Props {
  outlineB1?: SpeakingOutline | null;
  outlineB2?: SpeakingOutline | null;
}

const tidy = (s: string) =>
  s.replace(/\s{2,}/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();

const fill = (text: string, choice: string) => tidy(text.replace("___", choice));

/**
 * "Dựng bài nhanh" — template with 19 blanks × 5 alternatives each.
 * Content only; the floating toggle button lives in OutlineBuilderButton.
 */
export default function SpeakingOutlineHelper({ outlineB1, outlineB2 }: Props) {
  const [level, setLevel] = useState<"b1" | "b2">("b1");
  const [choices, setChoices] = useState<Record<number, number>>({});

  const requested = level === "b1" ? outlineB1 : outlineB2;
  const other = level === "b1" ? outlineB2 : outlineB1;
  const outline = requested ?? null;

  const allItems = useMemo(
    () => (outline?.groups ?? []).flatMap((g) => g.items ?? []),
    [outline]
  );

  const composed = useMemo(() => {
    const parts = allItems.map((it) => {
      const idx = choices[it.no] ?? 0;
      return fill(it.text, it.options?.[idx] ?? it.options?.[0] ?? "");
    });
    return tidy(parts.join(" "));
  }, [allItems, choices]);

  const wordCount = composed.split(/\s+/).filter(Boolean).length;
  const seconds = Math.round(wordCount / 1.4);

  const randomize = () => {
    const next: Record<number, number> = {};
    allItems.forEach((it) => {
      const n = it.options?.length || 1;
      next[it.no] = Math.floor(Math.random() * Math.min(5, n));
    });
    setChoices(next);
  };

  const cardCls = (active: boolean) =>
    `flex-1 text-left rounded-xl border p-3 transition-colors ${
      active
        ? "bg-[#24085a] text-white border-[#24085a]"
        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
    }`;

  return (
    <div className="mt-4 bg-white rounded-xl shadow-sm p-5 border-l-4 border-[#24085a]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-bold text-[#24085a] uppercase tracking-wide">
          ✨ Dựng bài nhanh
        </p>
        {outline && (
          <button
            type="button"
            onClick={randomize}
            className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Shuffle className="w-3 h-3" />
            Đổi ngẫu nhiên
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <button type="button" onClick={() => setLevel("b1")} className={cardCls(level === "b1")}>
          <span className="block text-sm font-bold">Bản B1</span>
          <span className="block text-[11px] mt-0.5 opacity-80">Câu ngắn, dễ nói</span>
        </button>
        <button type="button" onClick={() => setLevel("b2")} className={cardCls(level === "b2")}>
          <span className="block text-sm font-bold">Bản B2 trở lên</span>
          <span className="block text-[11px] mt-0.5 opacity-80">Câu dài, nhiều liên từ</span>
        </button>
      </div>

      {!outline ? (
        <div className="text-sm text-gray-500 italic">
          Chưa có dàn ý cho bản này.
          {other && (
            <button
              type="button"
              onClick={() => setLevel(level === "b1" ? "b2" : "b1")}
              className="ml-2 not-italic font-semibold text-[#24085a] underline"
            >
              Xem bản {level === "b1" ? "B2" : "B1"}
            </button>
          )}
        </div>
      ) : (
        <>
          {outline.targetWords && (
            <p className="text-xs text-muted-foreground mb-3">
              Mục tiêu: {outline.targetWords} từ
            </p>
          )}

          <div className="space-y-5">
            {outline.groups.map((g, gi) => (
              <div key={gi}>
                <p className="text-xs text-muted-foreground mb-2">
                  {g.question} · ~{g.seconds} giây
                </p>
                <div className="space-y-2">
                  {g.items.map((it) => {
                    const idx = choices[it.no] ?? 0;
                    const [before, after] = it.text.split("___");
                    return (
                      <p key={it.no} className="text-sm leading-loose text-gray-900">
                        <span className="text-[11px] font-semibold text-[#24085a] mr-1">
                          {it.no}. {it.label}:
                        </span>
                        {before}
                        <select
                          value={idx}
                          onChange={(e) =>
                            setChoices((p) => ({ ...p, [it.no]: Number(e.target.value) }))
                          }
                          className="bg-amber-100 border rounded px-1.5 py-0.5 text-sm max-w-full"
                        >
                          {it.options.map((o, oi) => (
                            <option key={oi} value={oi}>
                              {o}
                            </option>
                          ))}
                        </select>
                        {after}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4">
            <p className="text-xs font-bold text-[#24085a] uppercase tracking-wide mb-2">
              Bài của bạn — đọc to 3 lần
            </p>
            <p className="text-sm leading-relaxed text-gray-900">{composed}</p>
            <p className="text-xs text-gray-500 mt-2">
              {wordCount} từ · khoảng {seconds} giây
            </p>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Đây là gợi ý — hãy thay bằng chuyện của bạn, đừng học thuộc nguyên bài.
          </p>
        </>
      )}
    </div>
  );
}
