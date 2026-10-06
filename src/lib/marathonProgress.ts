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
  /** Thời điểm học viên chủ động làm lại từ đầu / kết thúc lượt — kết quả Lịch sử trước mốc này không được khôi phục. */
  resetAt?: number;
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
  // Không xoá hẳn: để lại mốc "đã reset" (results rỗng) để phần đối chiếu Lịch sử
  // không khôi phục nhầm lượt cũ mà học viên đã chủ động bỏ.
  const now = Date.now();
  const marker: MarathonProgress = { currentIndex: 0, results: [], drafts: {}, resetAt: now, updatedAt: now };
  try { localStorage.setItem(key(skill, part), JSON.stringify(marker)); } catch { /* noop */ }
  queueServerSave(key(skill, part), "progress", marker);
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
      let localDone = 0;
      let localResetAt = 0;
      try {
        const raw = localStorage.getItem(row.storage_key);
        if (raw) {
          const loc = JSON.parse(raw);
          localAt = Number(loc?.updatedAt ?? 0);
          localDone = Array.isArray(loc?.results) ? loc.results.filter(Boolean).length : 0;
          localResetAt = Number(loc?.resetAt ?? 0);
        }
      } catch { /* noop */ }
      const serverDone = Array.isArray(row.data?.results) ? row.data.results.filter(Boolean).length : 0;
      const serverResetAt = Number(row.data?.resetAt ?? 0);
      // Máy này có bản mới hơn nhưng ÍT đề đã làm hơn server (không phải do người dùng bấm làm lại)
      // → coi như bản trong máy bị hỏng/mất, lấy bản server.
      const localLostProgress =
        serverDone > localDone && !(localResetAt && localResetAt >= serverAt) && localResetAt <= serverResetAt;
      if (serverAt > localAt || localLostProgress) {
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

/* ------------------------------------------------------------------ */
/* Đối chiếu với Lịch sử (test_results) — các đề Marathon đã NỘP luôn  */
/* được tính là "đã làm", kể cả khi tiến độ trong máy bị mất/ghi đè.   */
/* Chỉ áp dụng Reading & Listening (Marathon không theo key).          */
/* ------------------------------------------------------------------ */
const RECONCILE_SKILLS = new Set(["reading", "listening"]);

function partKeyOf(part: string | null | undefined): string | null {
  if (!part) return null;
  const m = String(part).match(/part\s*(\d)/i);
  return m ? `part${m[1]}` : null;
}

export async function reconcileMarathonFromHistory(): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const sb = supabase as any;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: rows, error } = await sb
      .from("test_results")
      .select("id, exam_set_id, score, total, skill_scores, created_at")
      .eq("user_id", userId)
      .in("skill_scores->>mode", ["marathon-set", "marathon"])
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error || !Array.isArray(rows) || rows.length === 0) return false;

    type Row = { id: string; exam_set_id: string | null; score: number; total: number; skill_scores: any; created_at: string };
    // Gom theo skill + part; mỗi nhóm lấy phiên (session) mới nhất
    const groups = new Map<string, { latestSession: string; latestAt: number; sets: Row[]; summaries: Row[] }>();
    for (const r of rows as Row[]) {
      const ss = r.skill_scores || {};
      const skill = String(ss.skill || "");
      if (!RECONCILE_SKILLS.has(skill)) continue;
      const part = ss.mode === "marathon" ? (ss.partType as string) : partKeyOf(ss.part);
      if (!part) continue;
      const sess = String(ss.marathonSessionId || "");
      if (!sess) continue;
      const gk = `${skill}|${part}`;
      const at = Date.parse(r.created_at);
      let g = groups.get(gk);
      if (!g) { g = { latestSession: sess, latestAt: at, sets: [], summaries: [] }; groups.set(gk, g); }
      if (ss.mode === "marathon-set" && at >= g.latestAt) { g.latestAt = at; g.latestSession = sess; }
      if (ss.mode === "marathon-set") g.sets.push(r); else g.summaries.push(r);
    }

    // Đáp án từng đề (để xem lại / khoá đúng đề đã làm)
    const setRowIds: string[] = [];
    groups.forEach((g) => g.sets.filter((r) => r.skill_scores?.marathonSessionId === g.latestSession).forEach((r) => setRowIds.push(r.id)));
    const qByRow = new Map<string, { exam_question_id: string; user_answer: string | null; is_correct: boolean }[]>();
    if (setRowIds.length) {
      const { data: qrows } = await sb
        .from("exam_question_results")
        .select("test_result_id, exam_question_id, user_answer, is_correct")
        .in("test_result_id", setRowIds.slice(0, 500));
      for (const q of (qrows || []) as any[]) {
        const arr = qByRow.get(q.test_result_id) || [];
        arr.push({ exam_question_id: q.exam_question_id, user_answer: q.user_answer, is_correct: !!q.is_correct });
        qByRow.set(q.test_result_id, arr);
      }
    }

    let changed = false;
    groups.forEach((g, gk) => {
      const [skill, part] = gk.split("|");
      const sessSets = g.sets.filter((r) => r.skill_scores?.marathonSessionId === g.latestSession);
      if (sessSets.length === 0) return;
      // Lượt đã kết thúc (đủ số đề) → không khôi phục
      const summary = g.summaries.filter((r) => r.skill_scores?.marathonSessionId === g.latestSession).pop();
      const sDone = Number(summary?.skill_scores?.done ?? 0);
      const sTotal = Number(summary?.skill_scores?.totalSets ?? 0);
      if (sTotal > 0 && sDone >= sTotal) return;

      const local = loadMarathonProgress(skill, part);
      const last = loadMarathonLast(skill, part);
      const cutoff = Math.max(Number(local?.resetAt ?? 0), Number(last?.updatedAt ?? 0));
      if (g.latestAt <= cutoff) return; // học viên đã reset/kết thúc sau lượt này

      // Phiên khác đang chạy trong máy và mới hơn → giữ nguyên
      const localDone = (local?.results || []).filter(Boolean) as MarathonResultEntry[];
      if (local && local.sessionId && local.sessionId !== g.latestSession && localDone.length > 0 && Number(local.updatedAt) > g.latestAt) return;

      const byId = new Map<string, any>();
      if (local && local.sessionId === g.latestSession) localDone.forEach((r) => byId.set(r.examSetId, r));
      let added = 0;
      for (const r of sessSets) {
        if (!r.exam_set_id || byId.has(r.exam_set_id)) continue;
        const q = qByRow.get(r.id) || [];
        let answers: any = undefined;
        try {
          const parsed = q[0]?.user_answer ? JSON.parse(q[0].user_answer as string) : null;
          answers = parsed?.answers ?? parsed?.placements ?? parsed?.answer ?? undefined;
        } catch { /* noop */ }
        byId.set(r.exam_set_id, {
          correct: Number(r.score ?? 0),
          total: Number(r.total ?? 0),
          examSetId: r.exam_set_id,
          part: String(r.skill_scores?.part ?? ""),
          qResults: q,
          ...(skill === "reading" && answers !== undefined ? { answers } : {}),
        });
        added++;
      }
      if (added === 0) return;
      saveMarathonProgress(skill, part, {
        currentIndex: 0,
        results: Array.from(byId.values()),
        drafts: local && local.sessionId === g.latestSession ? (local.drafts ?? {}) : {},
        sessionId: g.latestSession,
        testResultId: (local && local.sessionId === g.latestSession ? local.testResultId : null) ?? summary?.id ?? null,
        updatedAt: Math.max(g.latestAt, Number(local?.updatedAt ?? 0)),
      });
      changed = true;
    });
    return changed;
  } catch {
    return false;
  }
}

/** Có đáp án nào thật sự được điền chưa (để không lưu đè tiến độ bằng trạng thái rỗng lúc mới mở). */
export function hasAnyAnswer(x: unknown): boolean {
  if (x == null) return false;
  if (typeof x === "string") return x.trim() !== "";
  if (typeof x === "number") return Number.isFinite(x) && x >= 0;
  if (typeof x === "boolean") return x;
  if (Array.isArray(x)) return x.some(hasAnyAnswer);
  if (typeof x === "object") return Object.values(x as Record<string, unknown>).some(hasAnyAnswer);
  return false;
}
