import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CODE_RE = /^KT-[A-Z0-9]{5}$/;

/**
 * Bắt ?ref=KT-XXXXX từ link giới thiệu: lưu vào localStorage("voucher_code")
 * để PricingPage tự áp mã, ghi nhận 1 lượt bấm mỗi session, rồi xoá param.
 */
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("ref");
      if (!raw) return;

      const code = raw.trim().toUpperCase();
      if (CODE_RE.test(code)) {
        const existing = (localStorage.getItem("voucher_code") || "").trim();
        if (!existing) localStorage.setItem("voucher_code", code);

        if (!sessionStorage.getItem("kt-ref-logged")) {
          sessionStorage.setItem("kt-ref-logged", "1");
          void (supabase as any)
            .rpc("log_referral_click", { p_code: code })
            .then(() => undefined, () => undefined);
        }
      }

      url.searchParams.delete("ref");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
