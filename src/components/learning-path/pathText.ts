import type { LearningPathData, PathSkill, StepKey, Tier } from "@/hooks/useLearningPath";
import { PATH_SKILLS, SKILL_VI, TIERS, TIER_VI } from "@/hooks/useLearningPath";

export const POSE: Record<StepKey, string> = {
  goal: "wave",
  placement: "check",
  reading: "read",
  listening: "listen",
  writing: "write",
  speaking: "speak",
  examKey: "timer",
  finish: "flag",
};

export const STEP_LABEL: Record<StepKey, string> = {
  goal: "Mục tiêu",
  placement: "Thi thử đầu vào",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  examKey: "Key ngày thi",
  finish: "Về đích",
};

export const STEP_SHORT: Record<StepKey, string> = {
  goal: "🎯", placement: "Thử", reading: "R", listening: "L", writing: "W", speaking: "S", examKey: "🔑", finish: "🏁",
};

export function mascotSrc(pose: string) {
  return `/mascot/kyky/${pose}.webp`;
}

/** "2026-10-30" → "30/10" */
export function ddmm(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Ngày mở bước Key ngày thi = ngày thi − 1. */
export function examKeyOpenDate(examISO: string | null | undefined): string {
  if (!examISO) return "";
  const t = Date.parse(`${examISO}T00:00:00Z`) - 86400000;
  return ddmm(new Date(t).toISOString().slice(0, 10));
}

export function currentTier(d: LearningPathData, sk: PathSkill): Tier | null {
  return TIERS.find((t) => d.skills[sk].tiers[t].open > 0) ?? null;
}

/** Câu Kỳ Kỳ nói, theo đúng bước đang ở. Trả về HTML-free parts để in đậm. */
export function bubbleFor(d: LearningPathData): Array<string | { b: string }> {
  switch (d.current) {
    case "goal":
      return ["Chào bạn, mình là ", { b: "Kỳ Kỳ" }, "! Đặt mục tiêu để mình dẫn bạn ôn ", { b: "đúng trọng tâm" }, " tới ngày thi nha ✨"];
    case "placement":
      return ["Làm ", { b: "1 bài thi thử" }, " để biết band hiện tại, quen format và xem kỹ năng nào yếu nha. Bận thì bấm Bỏ qua cũng được!"];
    case "examKey": {
      const ek = d.examKey;
      if (!ek?.published) return [{ b: "Mai thi rồi!" }, " Key ngày thi đang được cập nhật, tối nay quay lại xem nha 🔑"];
      if (ek.open === 0 && ek.locked === 0) return ["Bạn đã làm hết key ngày thi 🎉 Nghỉ ngơi, ngủ sớm, ", { b: "mai thi thật tốt" }, " nha!"];
      if (ek.open === 0) return [{ b: "Mai thi rồi!" }, " Bạn đã làm hết đề key miễn phí. Mở Pro để làm nốt ", { b: `${ek.locked} đề key` }, " ngày thi nha!"];
      return [{ b: "Mai thi rồi!" }, " Key ngày thi còn ", { b: `${ek.open} đề` }, " bạn chưa làm. Làm lần lượt nha, tối nay ngủ sớm 😴"];
    }
    case "finish":
      return ["Bạn đã ôn hết đề key ", { b: "4 kỹ năng" }, " 🎉 Làm 1 bài thi thử full để đo band về đích nha!"];
    default: {
      const sk = d.current as PathSkill;
      const st = d.skills[sk];
      const t = currentTier(d, sk);
      const name = SKILL_VI[sk];
      const nextSkill = PATH_SKILLS[PATH_SKILLS.indexOf(sk) + 1];
      if (st.open <= 3) {
        return ["Còn ", { b: `${st.open} đề ${name}${t ? ` ưu tiên ${TIER_VI[t]}` : ""}` }, ` nữa là xong ${name} rồi! Làm luôn nha 💪`, nextSkill ? ` Xong mình sang ${SKILL_VI[nextSkill]}.` : ""];
      }
      return ["Đang ôn ", { b: `${name} · ưu tiên ${t ? TIER_VI[t] : ""}` }, `: còn ${t ? st.tiers[t].open : st.open} đề. Làm tiếp đề bên dưới nha, ôn từng part là đủ, chưa cần Full Part.`];
    }
  }
}

export function stepIndex(k: StepKey): number {
  return ["goal", "placement", ...PATH_SKILLS, "examKey", "finish"].indexOf(k);
}

/** Trạng thái từng bước để vẽ thanh tiến độ. */
export function stepState(d: LearningPathData, k: StepKey): "done" | "cur" | "todo" {
  if (k === d.current) return "cur";
  if (k === "goal") return d.goal ? "done" : "todo";
  if (k === "placement") return d.placementDone ? "done" : "todo";
  if (PATH_SKILLS.includes(k as PathSkill)) return d.skills[k as PathSkill].complete && d.placementDone && !!d.goal ? "done" : "todo";
  return "todo";
}

