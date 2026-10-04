import { useEffect, useMemo, useRef } from "react";

/**
 * Tự lưu nháp bài đang làm (bài lẻ Reading / Listening / Writing) vào localStorage,
 * để lỡ tải lại trang / bị out thì học viên được hỏi "Làm tiếp bài đang dở?".
 *
 * - Mỗi kỹ năng giữ 1 bản nháp (bài gần nhất).
 * - Chỉ bắt đầu lưu khi đồng hồ đã chạy (đã vào làm bài), không lưu màn hướng dẫn.
 * - Nháp quá 24h, khác tài khoản hoặc gần hết giờ (< 10s) thì bỏ qua.
 * - Xoá khi nộp bài hoặc chủ động thoát.
 */
export type DraftSkill = "reading" | "listening" | "writing";

export interface ExamDraft {
  v: 1;
  skill: DraftSkill;
  userId: string | null;
  examSetId: string;
  partType: string;
  title: string;
  answers: unknown;
  timeLeft: number | null;
  savedAt: number;
}

const KEY = (skill: DraftSkill) => `kt_exam_draft:${skill}`;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadExamDraft(skill: DraftSkill, userId: string | null | undefined): ExamDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY(skill));
    if (!raw) return null;
    const d = JSON.parse(raw) as ExamDraft;
    if (!d || d.v !== 1 || d.skill !== skill || !d.examSetId) return null;
    if (Date.now() - Number(d.savedAt || 0) > MAX_AGE_MS) return null;
    if (d.userId && userId && d.userId !== userId) return null;
    if (d.timeLeft != null && d.timeLeft < 10) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearExamDraft(skill: DraftSkill) {
  try {
    window.localStorage.removeItem(KEY(skill));
  } catch {
    /* ignore */
  }
}

function writeDraft(d: ExamDraft) {
  try {
    window.localStorage.setItem(KEY(d.skill), JSON.stringify(d));
  } catch {
    /* quota / private mode — bỏ qua */
  }
}

export interface DraftBase {
  skill: DraftSkill;
  userId: string | null;
  examSetId: string;
  partType: string;
  title: string;
}

export interface DraftRecorder {
  onAnswersChange: (answers: unknown) => void;
  onTimeTick: (timeLeft: number) => void;
  /** Dừng ghi + xoá nháp (nộp bài / thoát). */
  finish: () => void;
}

/**
 * Trả về callback ổn định để gắn vào engine (onAnswersChange / onTimeTick).
 * `base` = null → tắt (không phải đề trong kho, review, ...).
 */
export function useExamDraftRecorder(base: DraftBase | null): DraftRecorder {
  const baseKey = base ? `${base.skill}|${base.examSetId}|${base.partType}|${base.userId ?? ""}` : "";
  const baseRef = useRef<DraftBase | null>(base);
  baseRef.current = base;
  const state = useRef({
    answers: undefined as unknown,
    timeLeft: null as number | null,
    started: false,
    stopped: false,
    lastWrite: 0,
    timer: 0 as unknown as ReturnType<typeof setTimeout> | 0,
  });

  // Đổi đề → reset trạng thái ghi
  useEffect(() => {
    const s = state.current;
    s.answers = undefined;
    s.timeLeft = null;
    s.started = false;
    s.stopped = false;
    s.lastWrite = 0;
  }, [baseKey]);

  const flush = () => {
    const b = baseRef.current;
    const s = state.current;
    if (!b || s.stopped || !s.started) return;
    s.lastWrite = Date.now();
    writeDraft({
      v: 1,
      skill: b.skill,
      userId: b.userId,
      examSetId: b.examSetId,
      partType: b.partType,
      title: b.title,
      answers: s.answers,
      timeLeft: s.timeLeft,
      savedAt: Date.now(),
    });
  };

  // Lưu ngay khi tab bị ẩn / đóng (điện thoại chuyển app)
  useEffect(() => {
    if (!baseKey) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  return useMemo<DraftRecorder>(() => {
    const schedule = (delay: number) => {
      const s = state.current;
      if (s.timer) clearTimeout(s.timer as ReturnType<typeof setTimeout>);
      s.timer = setTimeout(flush, delay);
    };
    return {
      onAnswersChange: (answers: unknown) => {
        const s = state.current;
        if (s.stopped) return;
        s.answers = answers;
        if (s.started) schedule(400);
      },
      onTimeTick: (timeLeft: number) => {
        const s = state.current;
        if (s.stopped) return;
        s.timeLeft = timeLeft;
        if (!s.started) {
          s.started = true;
          schedule(0);
          return;
        }
        if (Date.now() - s.lastWrite > 3000) flush();
      },
      finish: () => {
        const s = state.current;
        s.stopped = true;
        if (s.timer) clearTimeout(s.timer as ReturnType<typeof setTimeout>);
        const b = baseRef.current;
        if (b) clearExamDraft(b.skill);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);
}

export function formatDraftTime(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
