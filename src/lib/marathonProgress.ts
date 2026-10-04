export type MarathonQResult = { exam_question_id: string; user_answer: string | null; is_correct: boolean };
export type MarathonResultEntry = { correct: number; total: number; examSetId: string; part: string; qResults: MarathonQResult[] };

export interface MarathonProgress {
  currentIndex: number;
  /** Id của đề đang làm — resume ưu tiên theo id để không lệch khi có đề mới thêm vào. */
  currentSetId?: string;
  results: (MarathonResultEntry | null)[];
  /** Per-set draft answers keyed by examSetId (unsubmitted work-in-progress). */
  drafts?: Record<string, any>;
  /** Stable per-session id — one History row per session, updated as progress grows. */
  sessionId?: string;
  /** test_results.id created for this session on first save; updated thereafter. */
  testResultId?: string | null;
  updatedAt: number;
}
export interface MarathonLast {
  correct: number;
  total: number;
  wrongSetIds: string[];
  wrongQuestionsBySet?: Record<string, string[]>;
  /** Per-set score of the latest attempt for each set (merged across retries). */
  setResults?: Record<string, { correct: number; total: number }>;
  /** Number of sets in the original completed run (used to know when a retry fully covers every set). */
  setCount?: number;
  updatedAt: number;
}

const key = (skill: string, part: string) => `kt_marathon:${skill}:${part}`;
const lastKey = (skill: string, part: string) => `kt_marathon_last:${skill}:${part}`;

export function saveMarathonProgress(skill: string, part: string, data: MarathonProgress) {
  try { localStorage.setItem(key(skill, part), JSON.stringify(data)); } catch { /* noop */ }
  queueServerSave(key(skill, part), "progress", data);
}
export function loadMarathonProgress(skill: string, part: string): MarathonProgress | null {
  try { const r = localStorage.getItem(key(skill, part)); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearMarathonProgress(skill: string, part: string) {
  try { localStorage.removeItem(key(skill, part)); } catch { /* noop */ }
  queueServerDelete(key(skill, part));
}
export function saveMarathonLast(skill: string, part: string, data: MarathonLast) {
  const norm = normalizeMarathonLast(data);
  try { localStorage.setItem(lastKey(skill, part), JSON.stringify(norm)); } catch { /* noop */ }
  queueServerSave(lastKey(skill, part), "last", norm);
}
export function normalizeMarathonLast(l: MarathonLast): MarathonLast {
  const wrongSetIds = l.wrongSetIds || [];
  let correct = l.correct;
  let wrongQuestionsBySet = l.wrongQuestionsBySet ? { ...l.wrongQuestionsBySet } : {};
  if (wrongSetIds.length === 0) {
    correct = l.total;
    wrongQuestionsBySet = {};
  } else {
    Object.keys(wrongQuestionsBySet).forEach((k) => {
      if (!wrongSetIds.includes(k)) delete wrongQuestionsBySet[k];
    });
  }
  return { ...l, correct, wrongSetIds, wrongQuestionsBySet };
}
export function loadMarathonLast(skill: string, part: string): MarathonLast | null {
  try {
    const r = localStorage.getItem(lastKey(skill, part));
    if (!r) return null;
    return normalizeMarathonLast(JSON.parse(r));
  } catch { return null; }
}
export function clearMarathonLast(skill: string, part: string) {
  try { localStorage.removeItem(lastKey(skill, part)); } catch { /* noop */ }
  queueServerDelete(lastKey(skill, part));
}

/**
 * Merge a "Làm lại câu sai" (retry) run into the previous marathon result so the
 * History row reflects the latest state instead of a standalone partial run.
 * Returns the merged MarathonLast (also persisted), or null when there is no
 * previous run to merge into.
 */
export function mergeMarathonLastAfterRetry(
  skill: string,
  part: string,
  retried: { examSetId: string; correct: number; total: number; wrongQuestionIds: string[] }[],
): MarathonLast | null {
  const last = loadMarathonLast(skill, part);
  if (!last) return null;

  const setResults: Record<string, { correct: number; total: number }> = { ...(last.setResults ?? {}) };
  for (const r of retried) setResults[r.examSetId] = { correct: r.correct, total: r.total };

  const retriedClean = new Set(retried.filter((r) => r.correct >= r.total).map((r) => r.examSetId));
  const wrongSetIds = last.wrongSetIds.filter((id) => !retriedClean.has(id));
  for (const r of retried) {
    if (r.correct < r.total && !wrongSetIds.includes(r.examSetId)) wrongSetIds.push(r.examSetId);
  }

  const wrongQuestionsBySet: Record<string, string[]> = { ...(last.wrongQuestionsBySet ?? {}) };
  for (const r of retried) {
    if (r.wrongQuestionIds.length) wrongQuestionsBySet[r.examSetId] = r.wrongQuestionIds;
    else delete wrongQuestionsBySet[r.examSetId];
  }

  const total = last.total;
  const complete = !!last.setCount && Object.keys(setResults).length >= last.setCount;
  const correct = complete
    ? Object.values(setResults).reduce((s, x) => s + x.correct, 0)
    : wrongSetIds.length === 0
      ? total
      : last.correct;

  const merged: MarathonLast = {
    ...last,
    correct,
    wrongSetIds,
    wrongQuestionsBySet,
    setResults: complete ? setResults : last.setResults,
    updatedAt: Date.now(),
  };
  saveMarathonLast(skill, part, merged);
  return merged;
}

/** Cryptographically-random enough session id. */
export function newMarathonSessionId(): string {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return `mth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Đồng bộ tiến độ Marathon lên server (bảng marathon_progress)        */
/* để đổi máy / đổi trình duyệt / qua ngày vẫn làm tiếp được.          */
/* localStorage vẫn là nguồn chính (đọc đồng bộ, nhanh); server là bản */
/* sao lưu. Mọi lỗi mạng đều bỏ qua — không bao giờ chặn luồng làm bài.*/
/* ------------------------------------------------------------------ */
type ServerOp = { kind: "progress" | "last"; data: unknown } | { del: true };
const pendingOps = new Map<string, ServerOp>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function getUserId(): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function flushServerOps() {
  flushTimer = null;
  if (pendingOps.size === 0) return;
  const ops = Array.from(pendingOps.entries());
  pendingOps.clear();
  const userId = await getUserId();
  if (!userId) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const sb = supabase as any;
    const upserts = ops
      .filter(([, op]) => !("del" in op))
      .map(([storage_key, op]) => ({
        user_id: userId,
        storage_key,
        kind: (op as any).kind,
        data: (op as any).data,
        updated_at: new Date().toISOString(),
      }));
    const dels = ops.filter(([, op]) => "del" in op).map(([k]) => k);
    if (upserts.length) await sb.from("marathon_progress").upsert(upserts, { onConflict: "user_id,storage_key" });
    if (dels.length) await sb.from("marathon_progress").delete().eq("user_id", userId).in("storage_key", dels);
  } catch {
    /* best-effort */
  }
}

function scheduleFlush(delay = 1500) {
  if (typeof window === "undefined") return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushServerOps(), delay);
}

function queueServerSave(storageKey: string, kind: "progress" | "last", data: unknown) {
  pendingOps.set(storageKey, { kind, data });
  scheduleFlush();
}
function queueServerDelete(storageKey: string) {
  pendingOps.set(storageKey, { del: true });
  scheduleFlush();
}

if (typeof window !== "undefined") {
  // Điện thoại chuyển app / đóng tab → đẩy ngay phần đang chờ
  const flushNow = () => { if (pendingOps.size) void flushServerOps(); };
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
}

/**
 * Kéo tiến độ Marathon từ server về localStorage (bản nào mới hơn thì lấy).
 * Trả về true nếu localStorage có thay đổi (để trang vẽ lại nút "Tiếp tục").
 */
export async function syncMarathonFromServer(): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await (supabase as any)
      .from("marathon_progress")
      .select("storage_key, data, updated_at")
      .eq("user_id", userId);
    if (error || !Array.isArray(data)) return false;
    let changed = false;
    for (const row of data as { storage_key: string; data: any; updated_at: string }[]) {
      if (!row?.storage_key?.startsWith("kt_marathon")) continue;
      if (pendingOps.has(row.storage_key)) continue; // máy này đang có thay đổi mới hơn chờ gửi
      const serverAt = Number(row.data?.updatedAt ?? Date.parse(row.updated_at) ?? 0);
      let localAt = -1;
      try {
        const raw = localStorage.getItem(row.storage_key);
        if (raw) localAt = Number(JSON.parse(raw)?.updatedAt ?? 0);
      } catch { /* noop */ }
      if (serverAt > localAt) {
        try {
          localStorage.setItem(row.storage_key, JSON.stringify(row.data));
          changed = true;
        } catch { /* noop */ }
      }
    }
    return changed;
  } catch {
    return false;
  }
}
