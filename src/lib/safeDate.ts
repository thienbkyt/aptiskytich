/**
 * Safari's Date parser is strict — `new Date("YYYY-MM-DD HH:mm:ss")` returns
 * Invalid Date, and any later `.toISOString()` / format() call throws and can
 * white-screen the page. Normalize timestamp strings before parsing.
 */
export function parseDateSafe(input: unknown): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;

  // "YYYY-MM-DD HH:mm:ss[.fff]" → "YYYY-MM-DDTHH:mm:ss[.fff]Z"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** parseDateSafe but returns the original Date constructor result when fallback needed; never throws. */
export function toTimeSafe(input: unknown): number {
  const d = parseDateSafe(input);
  return d ? d.getTime() : 0;
}
