/**
 * Mùa Halloween 2026: giao diện "halloween" là mặc định cho mọi người
 * tới hết 31/10/2026 (giờ Việt Nam). Từ 00:00 ngày 01/11/2026 lựa chọn này
 * tự biến mất và web trở lại giao diện Sáng/Tối như bình thường.
 */
export const HALLOWEEN_END = Date.UTC(2026, 9, 31, 17, 0, 0); // 01/11/2026 00:00 GMT+7

export const isHalloweenSeason = () => Date.now() < HALLOWEEN_END;
