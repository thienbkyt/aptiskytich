import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Periodically pings the server so the current user is counted as "online".
 * Throttled to at most once per 60s per client. The RPC itself also throttles
 * writes to once per ~30s.
 */
export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!user) return;

    const send = () => {
      const now = Date.now();
      if (now - lastSent.current < 60_000) return;
      lastSent.current = now;
      supabase.rpc("touch_last_active").then(() => {}, () => {});
    };

    send();
    const interval = window.setInterval(send, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);

    const onActivity = () => send();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [user]);
}

export default usePresenceHeartbeat;
