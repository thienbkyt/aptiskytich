import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Quay về từ PayOS sau khi mua gói lượt (?credits_paid=1 / ?credits_cancel=1):
 * xoá tham số khỏi URL (giữ nguyên trang đang làm bài) và báo kết quả.
 */
const CreditsReturnWatcher = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paid = params.get("credits_paid") === "1";
    const cancel = params.get("credits_cancel") === "1";
    if ((!paid && !cancel) || handled.current) return;
    handled.current = true;
    ["credits_paid", "credits_cancel", "code", "id", "cancel", "status", "orderCode"].forEach((k) => params.delete(k));
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });

    if (cancel) {
      toast("Đã huỷ thanh toán gói lượt", { description: "Bài làm của bạn vẫn được giữ nguyên." });
      return;
    }
    const id = toast.loading("Đang xác nhận thanh toán…");
    let tries = 0;
    let start: number | null = null;
    const tick = async () => {
      tries += 1;
      const { data } = await (supabase as any).rpc("get_my_ai_wallet");
      const g = Array.isArray(data?.grants) ? data.grants : [];
      const fresh = g.find((x: any) => x.source === "purchase" && Date.now() - new Date(x.granted_at).getTime() < 15 * 60 * 1000);
      if (start === null) start = Number(data?.balance ?? 0);
      if (fresh) {
        toast.success(`Đã cộng ${fresh.amount} lượt vào ví`, {
          id,
          description: "Bấm \"Chấm AI\" / nộp lại bài để chấm ngay.",
          duration: 8000,
        });
        window.dispatchEvent(new Event("ai-wallet-updated"));
        return;
      }
      if (tries < 20) { setTimeout(tick, 3000); return; }
      toast("Đang chờ ngân hàng xác nhận", {
        id,
        description: "Lượt sẽ tự cộng vào ví trong vài phút. Nếu quá 10 phút chưa thấy, nhắn admin kèm mã đơn nhé.",
        duration: 10000,
      });
    };
    void tick();
  }, [location.pathname, location.search, navigate]);

  return null;
};

export default CreditsReturnWatcher;
