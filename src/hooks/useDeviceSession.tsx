import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceId, getDeviceType, getDeviceLabel } from "@/lib/deviceInfo";

/**
 * Registers this browser as a device for the signed-in user, and listens
 * for realtime DELETE events. If THIS device row is removed (kicked by a
 * newer login of the same type), sign the user out.
 */
export function useDeviceSession() {
  const { user, signOut } = useAuth();
  const registeredForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      registeredForUser.current = null;
      return;
    }

    const deviceId = getDeviceId();
    const deviceType = getDeviceType();
    const deviceLabel = getDeviceLabel();

    // Register once per user session; RPC is idempotent (upsert + kick same-type)
    if (registeredForUser.current !== user.id) {
      registeredForUser.current = user.id;
      supabase.rpc("register_device", {
        p_device_id: deviceId,
        p_type: deviceType,
        p_label: deviceLabel,
      });
    }

    const channel = supabase
      .channel(`user-devices-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "user_devices",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { device_id?: string } | null;
          if (oldRow?.device_id === deviceId) {
            toast.error("Tài khoản đã đăng nhập trên thiết bị khác cùng loại. Bạn đã bị đăng xuất.");
            signOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, signOut]);
}

export default useDeviceSession;
