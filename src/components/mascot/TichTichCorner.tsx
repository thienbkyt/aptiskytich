/**
 * Tích Tích nổi ở góc dưới bên trái mọi trang.
 * Ẩn khi: đang làm bài / xem lại bài (body có class exam-mode, history-review-mode,
 * exam-fullscreen, full-test-active), trang /auth, /reset-password, /admin*.
 * Ẩn trên thiết bị cảm ứng (CSS trong TichTich).
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import TichTich from "./TichTich";

const HIDE_BODY_CLASSES = ["exam-mode", "history-review-mode", "exam-fullscreen", "full-test-active"];
const HIDE_PATHS = [/^\/auth/, /^\/reset-password/, /^\/admin/];

const TIPS = [
  "Mỗi ngày 1 bài là giữ được chuỗi 🔥",
  "Đề Key dự đoán cập nhật hằng ngày nha ✨",
  "Speaking: nói đủ ý, đừng im lặng quá 3 giây 🎙️",
  "Writing: soát lại thì và mạo từ trước khi nộp ✍️",
];

export default function TichTichCorner() {
  const { pathname } = useLocation();
  const [examHidden, setExamHidden] = useState(false);
  const [tip, setTip] = useState(TIPS[0]);
  const [hover, setHover] = useState(false);

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
    <div
      className="fixed left-4 bottom-16 z-40 hidden md:flex items-end gap-1.5"
      onMouseEnter={() => { setHover(true); setTip(TIPS[Math.floor(Math.random() * TIPS.length)]); }}
      onMouseLeave={() => setHover(false)}
    >
      <TichTich size={72} idleSleep />
      <div
        className={`mb-12 max-w-[200px] rounded-xl rounded-bl-sm border border-orange-200 bg-white px-3 py-2 text-xs text-foreground shadow-md transition-all duration-200 ${
          hover ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-1"
        }`}
      >
        {tip}
      </div>
    </div>
  );
}
