import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_LABEL, categorize, type InsightError } from "./errorCategories";

interface Props {
  text: string;
  errors: (InsightError & { kind?: "grammar" | "spelling" })[];
  className?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Seg = { start: number; end: number; err: Props["errors"][number] };

function locate(text: string, errors: Props["errors"]): Seg[] {
  const segs: Seg[] = [];
  for (const err of errors) {
    const orig = String(err?.original ?? "").trim();
    if (!orig) continue;
    const pattern = orig.split(/\s+/).map(escapeRe).join("\\s+");
    let re: RegExp;
    try { re = new RegExp(pattern, "gi"); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (!segs.some((g) => s < g.end && e > g.start)) { segs.push({ start: s, end: e, err }); break; }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return segs.sort((a, b) => a.start - b.start);
}

const ErrorMark = ({ label, err }: { label: string; err: Props["errors"][number] }) => {
  const [open, setOpen] = useState(false);
  const cat = categorize(err, err.kind);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onMouseEnter={() => setOpen(true)}
          className="underline decoration-wavy decoration-red-500 underline-offset-4 bg-red-500/10 rounded-sm cursor-pointer"
        >
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-1.5" onMouseLeave={() => setOpen(false)}>
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
          {CATEGORY_LABEL[cat]}
        </span>
        <p className="text-sm">
          <span className="line-through text-red-600 dark:text-red-400">{err.original}</span>
          {" → "}
          <span className="text-green-600 dark:text-green-400 font-semibold">{err.corrected}</span>
        </p>
        {err.explanation && <p className="text-xs text-muted-foreground leading-relaxed">{err.explanation}</p>}
      </PopoverContent>
    </Popover>
  );
};

const InlineErrorText = ({ text, errors, className }: Props) => {
  const segs = useMemo(() => locate(text || "", errors || []), [text, errors]);
  const nodes: React.ReactNode[] = [];
  let cur = 0;
  segs.forEach((s, i) => {
    if (s.start > cur) nodes.push(<span key={`t${i}`}>{text.slice(cur, s.start)}</span>);
    nodes.push(<ErrorMark key={`e${i}`} label={text.slice(s.start, s.end)} err={s.err} />);
    cur = s.end;
  });
  if (cur < text.length) nodes.push(<span key="tail">{text.slice(cur)}</span>);
  return (
    <div className={className}>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{nodes}</p>
      <p className="text-[11px] text-muted-foreground mt-2">
        Bấm vào chỗ gạch chân để xem cách sửa · {segs.length} lỗi
      </p>
    </div>
  );
};

export default InlineErrorText;
