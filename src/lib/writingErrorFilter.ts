/**
 * Cleans AI writing error lists before display:
 * 1) Drops "style suggestion" items (explanation says the student wasn't actually wrong).
 * 2) Moves pure spelling items out of the grammar list into the spelling list.
 * 3) Drops no-op corrections where `corrected` is identical to `original` (whitespace-normalized; case differences are real errors).
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

function normalizeText(s: any): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function isSameAfterNormalization(a: any, b: any): boolean {
  // Chỉ coi là "không sửa gì" khi giống hệt (sau khi gộp khoảng trắng).
  // Lỗi chỉ khác viết hoa (vd "i" → "I") VẪN là lỗi bị trừ điểm → phải hiện trong danh sách
  // để học viên biết vì sao bị trừ.
  return normalizeText(a) === normalizeText(b);
}

export function isNoOpCorrection(e: any) {
  return isSameAfterNormalization(e?.original, e?.corrected);
}

export function splitWritingErrors<T = any>(
  grammar: T[] | null | undefined,
  spelling: T[] | null | undefined,
): { grammarErrors: T[]; spellingErrors: T[] } {
  const g = (Array.isArray(grammar) ? grammar : [])
    .filter((e) => !isStyleNote(e) && !isNoOpCorrection(e));
  const s = (Array.isArray(spelling) ? spelling : [])
    .filter((e) => !isStyleNote(e) && !isNoOpCorrection(e));
  return {
    grammarErrors: g.filter((e) => !SPELL_RE.test(expl(e))),
    spellingErrors: [...s, ...g.filter((e) => SPELL_RE.test(expl(e)))],
  };
}
