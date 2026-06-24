export function safeRandomId(prefix = "id") {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function safeMatches(query: string) {
  try {
    return window.matchMedia?.(query).matches ?? false;
  } catch {
    return false;
  }
}