/**
 * Ưu đãi 20/10 — "Món quà từ Kỳ Tích cho các bông hoa ham học".
 * Tài khoản giới tính Nữ + có SĐT được giảm 20% gói từ 1 tuần (server tự áp khi thanh toán).
 * - variant "full": banner lớn ở Dashboard (có Tích Tích, 3 bước, đếm ngược, ẩn trong ngày).
 * - variant "slim": thanh mảnh đầu trang Nâng cấp.
 * Tự ẩn khi: chưa đăng nhập, hết hạn, đã dùng ưu đãi.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProfileModal from "@/components/layout/ProfileModal";
import TichTich from "@/components/mascot/TichTich";
import { cn } from "@/lib/utils";

type PromoStatus = {
  active: boolean;
  eligible: boolean;
  reason: string | null;
  percent: number;
  plans: string[];
  ends_at: string;
};

const HIDE_KEY = "women2010_banner_hidden";
const todayKey = () => new Date().toISOString().slice(0, 10);

export function useWomenDayPromo() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["women-day-promo", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_women_day_promo");
      if (error) return null;
      return data as PromoStatus | null;
    },
  });
  const { refetch } = q;
  useEffect(() => {
    const h = () => { void refetch(); };
    window.addEventListener("profile-updated", h);
    return () => window.removeEventListener("profile-updated", h);
  }, [refetch]);
  return q;
}

function daysLeft(endsAt: string | undefined) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export default function WomenDayPromoBanner({ variant = "full", className }: { variant?: "full" | "slim"; className?: string }) {
  const { user } = useAuth();
  const { data: promo } = useWomenDayPromo();
  const [profileOpen, setProfileOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === todayKey(); } catch { return false; }
  });

  if (!user || !promo || !promo.active) return null;
  if (promo.reason === "used" || promo.reason === "expired") return null;

  const eligible = promo.eligible;
  const genderOk = !(promo.reason === "need_gender_phone" || promo.reason === "need_gender");
  const phoneOk = !(promo.reason === "need_gender_phone" || promo.reason === "need_phone");
  const left = daysLeft(promo.ends_at);
  const countdown = left === null ? null : left <= 1 ? "Hết hạn hôm nay" : `Còn ${left} ngày · hết 20/10`;

  const modal = <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />;

  if (variant === "slim") {
    return (
      <>
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-2.5 text-center text-[13.5px] font-semibold text-white shadow-sm",
            className,
          )}
          style={{ background: "linear-gradient(90deg,#CC1C01,#F0612C)" }}
        >
          <span>
            🌸 Món quà 20/10 cho các bông hoa ham học:{" "}
            <b className="font-extrabold">giảm {promo.percent}%</b> mọi gói từ 1 tuần
            {eligible ? " — giá đã tự giảm bên dưới" : " — cập nhật giới tính & SĐT để nhận"}
          </span>
          {!eligible && (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="rounded-full border border-white/70 bg-white/15 px-3 py-0.5 text-[12.5px] font-extrabold hover:bg-white/25"
            >
              Cập nhật
            </button>
          )}
        </div>
        {modal}
      </>
    );
  }

  if (hidden) return null;

  const hideToday = () => {
    try { localStorage.setItem(HIDE_KEY, todayKey()); } catch { /* ignore */ }
    setHidden(true);
  };

  const Step = ({ ok, n, label }: { ok: boolean; n: number; label: string }) => (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold",
        ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#F4C6A8] bg-white text-[#8A1C08]",
      )}
    >
      <i
        className={cn(
          "not-italic inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-black",
          ok ? "bg-emerald-600 text-white" : "bg-[#FFE3D3] text-[#CC1C01]",
        )}
      >
        {ok ? "✓" : n}
      </i>
      {label}
    </span>
  );

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] border-[1.5px] border-[#F8C3B0] p-5 md:py-6 md:pl-[190px] md:pr-7",
          className,
        )}
        style={{
          background: "linear-gradient(115deg,#FFF3EC 0%,#FFE2D6 45%,#FFD0DC 100%)",
          boxShadow: "0 14px 30px -18px rgba(176,64,42,0.45)",
        }}
      >
        <span className="pointer-events-none absolute -top-3 right-[220px] h-11 w-11 rotate-[30deg] rounded-[60%_0_60%_0] bg-[#FF9DB5] opacity-50" />
        <span className="pointer-events-none absolute bottom-3 right-[170px] h-6 w-6 -rotate-[20deg] rounded-[60%_0_60%_0] bg-[#FF9DB5] opacity-50" />
        <div className="pointer-events-none absolute -bottom-2 left-3 hidden md:block">
          <TichTich size={160} mood={eligible ? "love" : "happy"} interactive={false} />
        </div>
        <button
          type="button"
          onClick={hideToday}
          aria-label="Ẩn hôm nay"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-[15px] text-[#8A1C08] hover:bg-white"
        >
          ×
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="min-w-0 flex-1 pr-6 md:pr-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold tracking-wide text-white"
              style={{ background: "linear-gradient(135deg,#CC1C01,#F0532F)" }}
            >
              🌸 MỪNG 20/10
            </span>
            {eligible ? (
              <>
                <h2 className="mt-2 text-[20px] font-black leading-tight text-[#8A1C08] md:text-[24px]">
                  Bạn đã được giảm <span className="text-[#CC1C01]">{promo.percent}%</span> 🎉
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#6E2A16]">
                  Giá ưu đãi tự áp dụng cho gói <b className="text-[#CC1C01]">1 tuần, 1 tháng, 3 tháng, 6 tháng</b>. Mỗi tài khoản dùng 1 lần.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-[20px] font-black leading-tight text-[#8A1C08] md:text-[24px]">
                  Món quà từ Kỳ Tích cho các bông hoa ham học
                </h2>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span
                    className="whitespace-nowrap text-[38px] font-black leading-none tracking-tight text-transparent md:text-[44px]"
                    style={{ backgroundImage: "linear-gradient(135deg,#CC1C01,#F0612C)", WebkitBackgroundClip: "text", backgroundClip: "text" }}
                  >
                    Giảm {promo.percent}%
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-extrabold text-[#8A1C08]">mọi gói từ 1 tuần</span>
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6E2A16]">
                  Cập nhật thông tin tài khoản (<b className="text-[#CC1C01]">giới tính/SĐT</b>) ngay để nhận ưu đãi — giá tự giảm khi thanh toán, không cần nhập mã.
                </p>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Step ok={genderOk} n={1} label="Chọn giới tính Nữ" />
              <Step ok={phoneOk} n={2} label="Thêm số điện thoại" />
              <Step ok={false} n={3} label={`Mua gói, tự giảm ${promo.percent}%`} />
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 md:items-center">
            {eligible ? (
              <Link
                to="/pricing"
                className="whitespace-nowrap rounded-[14px] px-5 py-3 text-[15px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#CC1C01,#F0612C)", boxShadow: "0 10px 20px -10px #CC1C01" }}
              >
                Xem gói ưu đãi →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="whitespace-nowrap rounded-[14px] px-5 py-3 text-[15px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#CC1C01,#F0612C)", boxShadow: "0 10px 20px -10px #CC1C01" }}
              >
                Cập nhật ngay →
              </button>
            )}
            {countdown && <span className="text-[12px] font-bold text-[#8A1C08]">⏰ {countdown}</span>}
          </div>
        </div>
      </div>
      {modal}
    </>
  );
}
