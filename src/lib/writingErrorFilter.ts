/**
 * Cleans AI writing error lists before display:
 * 1) Drops "style suggestion" items (explanation says the student wasn't actually wrong).
 * 2) Moves pure spelling items out of the grammar list into the spelling list.
 * Mirrors the server-side sanitizer in the grade-exam function so older stored
 * gradings are displayed correctly too.
 */
const STYLE_RE =
  /(không\s*(hoàn toàn\s*)?sai|không phải là\s*(hoàn toàn\s*)?sai|vẫn\s*(là\s*)?đúng|đúng ngữ pháp nhưng|chỉ là\s|nghe\s*(sẽ\s*)?tự nhiên hơn|phù hợp hơn|hay hơn|trang trọng hơn|not wrong|still correct)/i;

const SPELL_RE = /^\s*(\*\*)?\s*(lỗi\s*)?(chính\s*tả|sai\s*chính\s*tả|spelling)/i;

const expl = (e: any) => String(e?.explanation ?? "");

export function isStyleNote(e: any) {
  return STYLE_RE.test(expl(e));
}

export function splitWritingErrors<T = any>(
  grammar: T[] | null | undefined,
  spelling: T[] | null | undefined,
): { grammarErrors: T[]; spellingErrors: T[] } {
  const g = (Array.isArray(grammar) ? grammar : []).filter((e) => !isStyleNote(e));
  const s = (Array.isArray(spelling) ? spelling : []).filter((e) => !isStyleNote(e));
  return {
    grammarErrors: g.filter((e) => !SPELL_RE.test(expl(e))),
    spellingErrors: [...s, ...g.filter((e) => SPELL_RE.test(expl(e)))],
  };
}
