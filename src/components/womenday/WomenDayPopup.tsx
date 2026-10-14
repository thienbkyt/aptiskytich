/**
 * Popup "Món quà từ Kỳ Tích cho các bông hoa ham học" — 15–20/10/2026.
 * Hiện cho mọi người (cả khách chưa đăng nhập), 1 lần/ngày; ẩn khi đã dùng ưu đãi,
 * khi đang làm bài, ở /admin và trang đăng nhập.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isWomenDaySeason, WOMEN_DAY_END } from "@/lib/halloween";
import { useWomenDayPromo } from "@/components/promo/WomenDayPromoBanner";
import ProfileModal from "@/components/layout/ProfileModal";
import TichTich from "@/components/mascot/TichTich";
import KyKy from "@/components/mascot/KyKy";
import "./womenday.css";

const EXAM_CLASSES = ["exam-mode", "history-review-mode", "exam-fullscreen", "full-test-active"];
const SEEN_KEY = "women2010_popup_seen";
const todayKey = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD theo giờ máy

export default function WomenDayPopup() {
  const { user, loading: authLoading } = useAuth();
  const { data: promo, isLoading: promoLoading } = useWomenDayPromo();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!isWomenDaySeason() || authLoading) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/auth") || pathname.startsWith("/reset")) return;
    if (EXAM_CLASSES.some((c) => document.body.classList.contains(c))) return;
    if (user && (promoLoading || promo?.reason === "used")) return;
    try { if (localStorage.getItem(SEEN_KEY) === todayKey()) return; } catch { /* ignore */ }
    const t = window.setTimeout(() => {
      if (EXAM_CLASSES.some((c) => document.body.classList.contains(c))) return;
      setOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [user, authLoading, promoLoading, promo?.reason, pathname]);

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, todayKey()); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open && !profileOpen) return null;

  const eligible = !!promo?.eligible;
  const left = Math.max(0, Math.ceil((WOMEN_DAY_END - Date.now()) / 86_400_000));
  const countdown = left <= 1 ? "Hết hạn hôm nay" : `Còn ${left} ngày · hết 23:59 ngày 20/10`;
  const after = encodeURIComponent("/dashboard?openProfile=1");

  const go = (fn: () => void) => { close(); fn(); };

  return (
    <>
      {open && (
        <div
          className="wd-pop fixed inset-0 z-[1000] flex items-end justify-center bg-[#2a0a1c]/60 p-0 backdrop-blur-[2px] md:items-center md:p-5"
          onClick={close}
        >
          <div
            role="dialog"
            aria-label="Ưu đãi 20/10"
            className="wd-pop-card relative flex w-full max-w-[720px] flex-col overflow-hidden rounded-t-[26px] bg-white shadow-[0_30px_70px_-20px_#2a0a1c] md:flex-row md:rounded-[26px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-lg text-[#8A1C08] hover:bg-white"
            >
              ×
            </button>

            {/* Linh vật */}
            <div
              className="relative flex h-[190px] items-end justify-center gap-0 overflow-hidden md:h-auto md:w-[42%] md:min-h-[400px]"
              style={{ background: "radial-gradient(120% 90% at 30% 20%,#FFE9F0 0%,#FFD3DF 50%,#FFB8CB 100%)" }}
            >
              <div className="relative z-[2] -mb-1 md:absolute md:bottom-0 md:left-0">
                <TichTich size={typeof window !== "undefined" && window.innerWidth >= 768 ? 230 : 150} mood="happy" interactive={false} />
              </div>
              <div className="relative z-[1] mb-3 md:absolute md:bottom-3 md:right-[-4%]">
                <KyKy size={typeof window !== "undefined" && window.innerWidth >= 768 ? 110 : 80} mood="love" interactive={false} />
              </div>
            </div>

            {/* Nội dung */}
            <div className="flex-1 px-5 pb-5 pt-5 md:px-8 md:pb-6 md:pt-8" style={{ background: "linear-gradient(160deg,#FFF8F3,#FFF0F3)" }}>
              <span
                className="inline-flex rounded-full px-3 py-1 text-[11.5px] font-extrabold tracking-wide text-white"
                style={{ background: "linear-gradient(135deg,#CC1C01,#F0532F)" }}
              >
                🌸 MỪNG 20/10
              </span>
              <h2 className="mt-3 text-[19px] font-black leading-tight text-[#8A1C08] md:text-[24px]">
                {eligible ? "Bạn đã nhận được món quà 20/10 🎉" : "Món quà từ Kỳ Tích cho các bông hoa ham học"}
              </h2>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span
                  className="whitespace-nowrap text-[40px] font-black leading-[1.05] tracking-tight text-transparent md:text-[52px]"
                  style={{ backgroundImage: "linear-gradient(135deg,#CC1C01,#F0612C)", WebkitBackgroundClip: "text", backgroundClip: "text" }}
                >
                  Giảm 20%
                </span>
                <span className="whitespace-nowrap text-[15px] font-extrabold text-[#8A1C08]">mọi gói từ 1 tuần</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6E2A16]">
                {eligible ? (
                  <>Giá ưu đãi đã tự áp dụng cho gói <b className="text-[#CC1C01]">1 tuần, 1 tháng, 3 tháng, 6 tháng</b>. Mỗi tài khoản dùng 1 lần.</>
                ) : (
                  <>Cập nhật thông tin tài khoản (<b className="text-[#CC1C01]">giới tính/SĐT</b>) để nhận ưu đãi — giá tự giảm khi thanh toán, không cần nhập mã.</>
                )}
              </p>
              <p className="mt-2.5 text-[12.5px] font-bold text-[#8A1C08]">⏰ {countdown}</p>

              <div className="mt-4 flex flex-col gap-2">
                {!user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go(() => navigate(`/auth?tab=signup&redirect=${after}`))}
                      className="rounded-[14px] px-4 py-3 text-[15px] font-extrabold text-white"
                      style={{ background: "linear-gradient(135deg,#CC1C01,#F0612C)", boxShadow: "0 10px 20px -10px #CC1C01" }}
                    >
                      Đăng ký nhận ưu đãi →
                    </button>
                    <button
                      type="button"
                      onClick={() => go(() => navigate(`/auth?redirect=${after}`))}
                      className="rounded-[14px] border-[1.5px] border-[#F0612C] bg-white px-4 py-2.5 text-[14px] font-extrabold text-[#CC1C01]"
                    >
                      Đã có tài khoản? Đăng nhập
                    </button>
                  </>
                ) : eligible ? (
                  <button
                    type="button"
                    onClick={() => go(() => navigate("/pricing"))}
                    className="rounded-[14px] px-4 py-3 text-[15px] font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg,#CC1C01,#F0612C)", boxShadow: "0 10px 20px -10px #CC1C01" }}
                  >
                    Xem gói ưu đãi →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => go(() => setProfileOpen(true))}
                    className="rounded-[14px] px-4 py-3 text-[15px] font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg,#CC1C01,#F0612C)", boxShadow: "0 10px 20px -10px #CC1C01" }}
                  >
                    Cập nhật ngay →
                  </button>
                )}
              </div>
              <button type="button" onClick={close} className="mx-auto mt-3 block text-[13px] text-[#8b7f86] underline">
                Để sau
              </button>
            </div>
          </div>
        </div>
      )}
      {user && <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />}
    </>
  );
}
