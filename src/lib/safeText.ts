/**
 * Coerce any AI-generated / legacy value into a plain display string.
 *
 * Some legacy rows in `speaking_skill_results` stored text fields as objects
 * (e.g. `{ questionText: "..." }`), which crash React with error #31 when
 * rendered directly. NEVER render an object as text — always route through
 * `safeText()` first.
 *
 * Rules:
 *   - string → returned as-is
 *   - number / boolean → String(value)
 *   - object → tries value.questionText / value.text / value.value in order;
 *              if none is a scalar, returns "" (empty string), never the object
 *   - null / undefined → ""
 */
export function safeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const cand =
      o.questionText ??
      o.question_text ??
      o.text ??
      o.value ??
      o.content;
    if (typeof cand === "string") return cand;
    if (cand != null && typeof cand !== "object") return String(cand);
    return "";
  }
  return "";
}

export default safeText;
