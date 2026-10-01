/**
 * Tích Tích nổi ở góc dưới bên phải (ngay trên nút "Chat với admin").
 * Lời thoại / mẹo hiện ở bên trái robot để không bị cắt mép màn hình.
 * Ẩn khi: đang làm bài / xem lại bài (body có class exam-mode, history-review-mode,
 * exam-fullscreen, full-test-active), trang /, /dashboard (đã có robot riêng),
 * /auth, /reset-password, /admin*. Ẩn trên thiết bị cảm ứng (CSS trong TichTich).
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import TichTich from "./TichTich";
import TichTichQuiz, { type QuizMood } from "./TichTichQuiz";

const HIDE_BODY_CLASSES = ["exam-mode", "history-review-mode", "exam-fullscreen", "full-test-active"];
const HIDE_PATHS = [/^\/$/, /^\/dashboard/, /^\/auth/, /^\/reset-password/, /^\/admin/];

const TIPS = [
  "Mỗi ngày 1 bài là giữ được chuỗi 🔥",
  "Đề Key dự đoán cập nhật hằng ngày nha ✨",
  "Speaking: nói đủ ý, đừng im lặng quá 3 giây 🎙️",
  "Writing: soát lại thì và mạo từ trước khi nộp ✍️",
  "Listening: đọc câu hỏi trước khi bấm nghe nha 🎧",
];

export default function TichTichCorner() {
  const { pathname } = useLocation();
  const [examHidden, setExamHidden] = useState(false);
  // Biểu cảm của Tích Tích khi đang đố từ vựng (nghĩ / vui / lo).
  const [quizMood, setQuizMood] = useState<QuizMood>(null);

  useEffect(() => {
    const check = () =>
      setExamHidden(HIDE_BODY_CLASSES.some((c) => document.body.classList.contains(c)));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (examHidden || HIDE_PATHS.some((r) => r.test(pathname))) return null;

  return (
    <div className="fixed right-6 bottom-[84px] z-40 hidden md:block">
      <TichTichQuiz onMood={setQuizMood} />
      <TichTich size={96} idleSleep={!quizMood} bubbleSide="left" enterLines={TIPS} mood={quizMood ?? "normal"} />
    </div>
  );
}
