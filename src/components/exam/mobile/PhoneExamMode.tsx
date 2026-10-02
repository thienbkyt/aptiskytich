import { useEffect } from "react";
import { isPhoneExamUI } from "./phoneExam";
import "./phoneExam.css";

let activeCount = 0;

/**
 * Đặt trong engine bài thi (thay cho RotateDeviceOverlay).
 * Trên điện thoại: KHÔNG bắt xoay ngang, gắn class `kt-phone-exam` lên <html>
 * để CSS gọn lại header / timer / thanh điều hướng cho màn dọc.
 * Máy tính / iPad: không làm gì.
 */
const PhoneExamMode = () => {
  useEffect(() => {
    if (!isPhoneExamUI()) return;
    const root = document.documentElement;
    activeCount += 1;
    root.classList.add("kt-phone-exam");
    return () => {
      activeCount = Math.max(0, activeCount - 1);
      if (activeCount === 0) root.classList.remove("kt-phone-exam");
    };
  }, []);
  return null;
};

export default PhoneExamMode;
