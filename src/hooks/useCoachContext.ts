import { useLocation } from "react-router-dom";

export type CoachContext = {
  pathname: string;
  pageTitle?: string;
  skill?: string;
};

const SKILL_MAP: Record<string, { skill: string; title: string }> = {
  "/grammar": { skill: "Grammar & Vocabulary", title: "Luyện Grammar & Vocabulary" },
  "/reading": { skill: "Reading", title: "Luyện Reading" },
  "/listening": { skill: "Listening", title: "Luyện Listening" },
  "/speaking": { skill: "Speaking", title: "Luyện Speaking" },
  "/writing": { skill: "Writing", title: "Luyện Writing" },
  "/vocabulary": { skill: "Vocabulary", title: "Học từ vựng" },
  "/thi-thu": { skill: "Full Test", title: "Thi thử Aptis full test" },
  "/dashboard": { skill: "", title: "Dashboard học tập" },
  "/history": { skill: "", title: "Lịch sử học tập" },
  "/progress": { skill: "", title: "Tiến độ học tập" },
  "/course": { skill: "", title: "Khoá học" },
  "/": { skill: "", title: "Trang chủ Aptis Kỳ Tích" },
};

export function useCoachContext(): CoachContext {
  const loc = useLocation();
  const path = loc.pathname;
  let match = SKILL_MAP[path];
  if (!match) {
    const key = Object.keys(SKILL_MAP).find((k) => k !== "/" && path.startsWith(k));
    if (key) match = SKILL_MAP[key];
  }
  return {
    pathname: path,
    pageTitle: match?.title,
    skill: match?.skill || undefined,
  };
}

export function getSuggestedPrompts(ctx: CoachContext): string[] {
  const s = ctx.skill?.toLowerCase() || "";
  if (s.includes("grammar")) {
    return [
      "Mẹo làm Grammar Part 1 nhanh và chính xác",
      "Phân biệt thì hiện tại hoàn thành và quá khứ đơn",
      "Cách đoán nghĩa từ vựng khi không biết từ",
      "Lộ trình ôn Grammar trong 2 tuần",
    ];
  }
  if (s.includes("reading")) {
    return [
      "Chiến thuật làm Reading Part 4 (matching headings)",
      "Cách quản lý thời gian Reading 35 phút",
      "Mẹo skim & scan hiệu quả",
      "Từ nối thường gặp trong Reading",
    ];
  }
  if (s.includes("listening")) {
    return [
      "Mẹo nghe Listening Part 3 (conversation)",
      "Cách luyện nghe khi mất gốc",
      "Bẫy thường gặp trong Listening Aptis",
      "Làm sao nghe được lần đầu tiên?",
    ];
  }
  if (s.includes("speaking")) {
    return [
      "Cấu trúc trả lời Speaking Part 2",
      "Mẫu câu mở đầu cho Speaking Part 4",
      "Cách khắc phục pause khi nói",
      "Từ nối nâng band Speaking",
    ];
  }
  if (s.includes("writing")) {
    return [
      "Cấu trúc email Writing Part 2 (50 từ)",
      "Cách viết Writing Part 4 đạt B2 trở lên",
      "Cụm từ formal vs informal",
      "Sửa lỗi ngữ pháp thường gặp",
    ];
  }
  if (s.includes("full test")) {
    return [
      "Chiến thuật phân bổ thời gian full test",
      "Nên làm phần nào trước trong Aptis?",
      "Cách giữ tâm lý ổn định khi thi",
      "Mẹo tránh mất điểm oan",
    ];
  }
  if (s.includes("vocabulary")) {
    return [
      "Phương pháp 3R học từ vựng",
      "Bao nhiêu từ/ngày là hợp lý?",
      "Cách ôn từ vựng không quên",
      "Từ vựng nào hay xuất hiện trong Aptis?",
    ];
  }
  return [
    "Cấu trúc đề thi Aptis General gồm những gì?",
    "Lộ trình ôn Aptis trong 1 tháng",
    "Aptis bao nhiêu điểm thì đạt B2?",
    "Nên bắt đầu luyện kỹ năng nào trước?",
  ];
}
