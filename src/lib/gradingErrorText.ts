/**
 * Đổi mã lỗi chấm AI (vd. "quota_exceeded", "step timeout after 110s") sang câu
 * tiếng Việt cho học viên. Không bao giờ hiện mã kỹ thuật ra màn hình.
 */
export type GradingErrorKind = "quota" | "network" | "audio" | "other";

export interface GradingErrorText {
  kind: GradingErrorKind;
  title: string;
  body: string;
}

export function describeGradingError(raw: unknown): GradingErrorText {
  const s = String(raw ?? "").toLowerCase();
  if (/quota|hết lượt|upgrade|disabled|limit/.test(s)) {
    return {
      kind: "quota",
      title: "Hết lượt chấm AI",
      body: "Bài nói đã được lưu đầy đủ, chỉ chưa chấm vì tài khoản đã dùng hết lượt chấm AI.",
    };
  }
  if (/timeout|timed out|network|fetch|gateway|50[234]|busy|overload|rate/.test(s)) {
    return {
      kind: "network",
      title: "Chưa chấm xong",
      body: "Mạng hoặc AI đang bận nên câu này chưa chấm xong. Bấm Chấm lại để thử lần nữa.",
    };
  }
  if (/audio|ghi âm|recording|silent|transcri/.test(s)) {
    return {
      kind: "audio",
      title: "Không đọc được ghi âm",
      body: "Ghi âm của câu này không nghe được hoặc chưa tải lên đủ. Bấm Chấm lại, nếu vẫn lỗi hãy làm lại câu này.",
    };
  }
  return {
    kind: "other",
    title: "Chưa chấm được câu này",
    body: "Có lỗi khi chấm câu này. Bấm Chấm lại để thử lần nữa.",
  };
}
