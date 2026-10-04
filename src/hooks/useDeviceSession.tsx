import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceId, getDeviceType, getDeviceLabel } from "@/lib/deviceInfo";
import { EXAM_ACTIVE_EVENT, isExamActive, isFullTestActive } from "@/lib/examActive";

const CHECK_INTERVAL_MS = 60_000;

/**
 * Registers this browser as the single active device for the signed-in user,
 * then polls periodically (and when the tab regains focus). If this device's
 * row is gone, the account was signed in elsewhere → sign this session out.
 */
export function useDeviceSession() {
  const { user, signOut } = useAuth();
  const registeredForUser = useRef<string | null>(null);
  const kickedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      registeredForUser.current = null;
      kickedRef.current = false;
      return;
    }

    const deviceId = getDeviceId();
    const deviceType = getDeviceType();
    const deviceLabel = getDeviceLabel();
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const register = async () => {
      if (registeredForUser.current === user.id) return;
      registeredForUser.current = user.id;
      const { error } = await supabase.rpc("register_device", {
        p_device_id: deviceId,
        p_type: deviceType,
        p_label: deviceLabel,
      });
      if (error) {
        console.warn("register_device failed:", error.message);
        // allow a retry on the next render/effect run
        registeredForUser.current = null;
      }
    };

    const checkStillActive = async () => {
      if (cancelled || kickedRef.current) return;
      if (registeredForUser.current !== user.id) return;
      const { data, error } = await supabase
        .from("user_devices")
        .select("id")
        .eq("device_id", deviceId)
        .limit(1);
      // Network/timeout errors must never kick the user out.
      if (error || cancelled || kickedRef.current) return;
      if (Array.isArray(data) && data.length === 0) {
        kickedRef.current = true;
        if (intervalId) clearInterval(intervalId);
        // Đang làm bài → KHÔNG đăng xuất ngay (mất bài). Cho làm/nộp nốt, rời bài thi mới đăng xuất.
        if (isExamActive() || isFullTestActive()) {
          toast.warning(
            "Tài khoản của bạn vừa đăng nhập trên một thiết bị cùng loại khác. Bạn cứ làm và nộp nốt bài này — sau khi rời bài thi, phiên này sẽ được đăng xuất.",
            { duration: 12000 },
          );
          const onExamChange = () => {
            if (isExamActive() || isFullTestActive()) return;
            window.removeEventListener(EXAM_ACTIVE_EVENT, onExamChange);
            toast.error("Tài khoản của bạn đã đăng nhập ở nơi khác. Phiên này đã bị đăng xuất.");
            signOut();
          };
          window.addEventListener(EXAM_ACTIVE_EVENT, onExamChange);
          return;
        }
        toast.error("Tài khoản của bạn vừa đăng nhập ở nơi khác. Phiên này đã bị đăng xuất.");
        signOut();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkStillActive();
    };

    void (async () => {
      await register();
      if (cancelled) return;
      intervalId = setInterval(() => void checkStillActive(), CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", onVisibility);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, signOut]);
}

export default useDeviceSession;
