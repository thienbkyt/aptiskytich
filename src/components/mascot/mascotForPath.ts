/**
 * Mỗi trang chỉ hiện 1 linh vật: Tích Tích hoặc Kỳ Kỳ (chia theo trang).
 * Trang chủ: Tích Tích · Dashboard + Đăng nhập: Kỳ Kỳ · các trang khác theo danh sách dưới.
 */
export type MascotKey = "tichtich" | "kyky";

const KYKY_PATHS = [
  /^\/dashboard/, /^\/auth/, /^\/reset-password/,
  /^\/reading/, /^\/writing/, /^\/grammar/,
  /^\/vocabulary/, /^\/vocab\//, /^\/nghe-chep/,
  /^\/history/, /^\/progress/, /^\/my-sets/,
  /^\/blog/, /^\/meo-thi-aptis/, /^\/reviews/,
];

export function mascotForPath(pathname: string): MascotKey {
  return KYKY_PATHS.some((r) => r.test(pathname)) ? "kyky" : "tichtich";
}

export const MASCOT_NAME: Record<MascotKey, string> = { tichtich: "Tích Tích", kyky: "Kỳ Kỳ" };
