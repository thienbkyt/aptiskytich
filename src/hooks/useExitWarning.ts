import { useEffect } from "react";

/**
 * Hiển thị hộp xác nhận mặc định của trình duyệt khi user reload/đóng tab/đóng cửa sổ
 * trong lúc đang làm bài chưa nộp. Không lưu nháp, không khôi phục.
 */
export function useExitWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Một số trình duyệt yêu cầu returnValue được set
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
