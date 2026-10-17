import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { asArray } from "@/components/insights/errorCategories";

/** Khối thẻ chung của màn xem lại trên điện thoại. */
export const MCard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>{children}</div>
);

export const MEyebrow = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{children}</p>
    {right}
  </div>
);

export const MTag = ({ tone = "navy", children }: { tone?: "navy" | "green" | "rose" | "amber"; children: ReactNode }) => (
  <span
    className={cn(
      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
      tone === "navy" && "bg-exam-accent/10 text-exam-accent",
      tone === "green" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      tone === "rose" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      tone === "amber" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    )}
  >
    {children}
  </span>
);

/** Điểm lớn + thanh 5 tiêu chí (band 0–5). */
export const MScoreCard = ({
  label,
  score,
  max,
  badge,
  criteria,
  note,
}: {
  label: string;
  score?: string | number | null;
  max?: string | number | null;
  badge?: ReactNode;
  criteria?: Array<{ label: string; value: number | null }>;
  note?: ReactNode;
}) => (
  <MCard>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        {score != null && score !== "" && (
          <p className="text-[30px] font-extrabold leading-none text-exam-accent tabular-nums">
            {score}
            {max != null && <span className="text-[15px] font-bold text-muted-foreground"> / {max}</span>}
          </p>
        )}
      </div>
      {badge}
    </div>
    {criteria && criteria.some((c) => c.value != null) && (
      <div className="grid grid-cols-[110px_1fr_32px] items-center gap-x-2.5 gap-y-2 text-[12.5px]">
        {criteria.map((c) => (
          <div key={c.label} className="contents">
            <span className="text-foreground">{c.label}</span>
            <div className="h-[7px] overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-exam-accent" style={{ width: `${Math.max(0, Math.min(100, ((c.value ?? 0) / 5) * 100))}%` }} />
            </div>
            <span className="text-right font-bold tabular-nums">{c.value != null ? `${Math.round(c.value * 10) / 10}/5` : "—"}</span>
          </div>
        ))}
      </div>
    )}
    {note && (
      <div className="mt-3 whitespace-pre-line rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/85">
        {note}
      </div>
    )}
  </MCard>
);

export interface MFix {
  original?: string;
  corrected?: string;
  explanation?: string;
}

/** Danh sách lỗi: gạch đỏ → sửa xanh + giải thích. */
export const MFixList = ({ errors }: { errors: unknown }) => {
  const list = asArray<MFix>(errors).filter((e) => String(e?.original ?? "").trim() || String(e?.corrected ?? "").trim());
  if (!list.length) return null;
  return (
    <div className="space-y-2">
      {list.map((e, i) => (
        <div key={i} className="rounded-xl border border-border px-3 py-2.5 text-[13px]">
          <span className="text-rose-600 line-through decoration-rose-500/70 dark:text-rose-400">{String(e.original ?? "")}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400">{String(e.corrected ?? "")}</span>
          {String(e.explanation ?? "").trim() && (
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{String(e.explanation)}</p>
          )}
        </div>
      ))}
    </div>
  );
};

/** Chip từ cần luyện phát âm. */
export const MPronChips = ({ words }: { words: Array<{ word: string; issue: string }> }) => {
  const list = words.filter((w) => w.word.trim());
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((w, i) => (
        <span key={i} className="rounded-full border border-border bg-background px-2.5 py-1 text-[12.5px]">
          <b className="text-exam-accent">{w.word}</b>
          {w.issue ? <span className="text-muted-foreground"> · {w.issue}</span> : null}
        </span>
      ))}
    </div>
  );
};

/** Hộp xanh "nói/viết lại hay hơn". */
export const MBetter = ({ label, text }: { label: string; text: string }) => (
  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-3 text-[13.5px] leading-relaxed">
    <span className="font-bold text-emerald-700 dark:text-emerald-400"><Sparkles className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />{label}: </span>
    <span className="whitespace-pre-line text-foreground">{text}</span>
  </div>
);
