/**
 * Mùa Halloween 2026: giao diện "halloween" là mặc định cho mọi người
 * tới hết 31/10/2026 (giờ Việt Nam). Từ 00:00 ngày 01/11/2026 lựa chọn này
 * tự biến mất và web trở lại giao diện Sáng/Tối như bình thường.
 */
export const HALLOWEEN_END = Date.UTC(2026, 9, 31, 17, 0, 0); // 01/11/2026 00:00 GMT+7

export const isHalloweenSeason = () => Date.now() < HALLOWEEN_END;

/**
 * Ưu đãi 20/10/2026: từ 00:00 15/10 đến 23:59 20/10 (giờ VN) giao diện Halloween
 * tạm nhường chỗ cho theme hoa 20/10 (dây hoa nhẹ, cánh hoa rơi, Tích Tích cầm hoa,
 * popup ưu đãi). Từ 21/10 tự quay lại Halloween.
 * Xem thử trước: thêm ?xemthu2010=1 vào đường dẫn (chỉ trên trình duyệt đó, trong phiên).
 */
export const WOMEN_DAY_START = Date.UTC(2026, 9, 14, 17, 0, 0); // 15/10/2026 00:00 GMT+7
export const WOMEN_DAY_END = Date.UTC(2026, 9, 20, 17, 0, 0); // 21/10/2026 00:00 GMT+7

const isPreview2010 = () => {
  try {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).has("xemthu2010")) {
      window.sessionStorage.setItem("xemthu2010", "1");
      return true;
    }
    return window.sessionStorage.getItem("xemthu2010") === "1";
  } catch {
    return false;
  }
};

export const isWomenDaySeason = () => {
  const n = Date.now();
  return (n >= WOMEN_DAY_START && n < WOMEN_DAY_END) || (n < WOMEN_DAY_END && isPreview2010());
};
