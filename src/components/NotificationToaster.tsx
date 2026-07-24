import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserBootstrap } from "@/hooks/useUserBootstrap";

type NotifType = "feature" | "content" | "general";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  type: NotifType;
  link_url: string | null;
  is_active: boolean;
  target_user_id: string | null;
  created_at: string;
}

const MAX_VISIBLE = 2;

function excerpt(s: string | null | undefined, n = 120): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/**
 * App-wide notification toaster.
 * - On login, toasts unread + not-yet-toasted active notifications (max 2 shown,
 *   rest collapsed into "and N more" summary).
 * - Subscribes to realtime INSERT on notifications to toast new ones live.
 * - Persists toasted ids per user in localStorage to avoid re-toasting.
 */
const NotificationToaster = () => {
  const { user } = useAuth();
  const { setUnread } = useUserBootstrap();
  const navigate = useNavigate();
  const bootstrappedRef = useRef<string | null>(null);

  const showToastFor = (n: Notif) => {
    const body = excerpt(n.body, 140);
    toast(n.title, {
      description: body || undefined,
      duration: 8000,
      action: {
        label: "Xem",
        onClick: () => handleClick(n),
      },
      onDismiss: () => {},
      // Clicking body area also navigates
      className: "cursor-pointer",
    });
  };

  const handleClick = async (n: Notif) => {
    if (!user) return;
    // Open the detail modal for this exact notification
    window.dispatchEvent(
      new CustomEvent("kt-open-notification-detail", { detail: n }),
    );
    // Mark read
    try {
      await supabase.from("notification_reads").upsert(
        { user_id: user.id, notification_id: n.id },
        { onConflict: "user_id,notification_id", ignoreDuplicates: true },
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  // Bootstrap: fetch active unread notifs on login
  useEffect(() => {
    if (!user) return;
    if (bootstrappedRef.current === user.id) return;
    bootstrappedRef.current = user.id;

    let cancelled = false;
    (async () => {
      const toasted = loadToasted(user.id);
      const [notifRes, readsRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, title, body, type, link_url, is_active, target_user_id, created_at")
          .eq("is_active", true)
          .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("notification_reads").select("notification_id"),
      ]);
      if (cancelled) return;
      const readIds = new Set<string>((readsRes.data || []).map((r: any) => r.notification_id));
      const candidates = ((notifRes.data as Notif[]) || []).filter(
        (n) => !readIds.has(n.id) && !toasted.has(n.id),
      );
      if (candidates.length === 0) return;

      // Show newest first (already ordered desc); toast up to MAX_VISIBLE
      const visible = candidates.slice(0, MAX_VISIBLE);
      const rest = candidates.slice(MAX_VISIBLE);
      visible.forEach((n) => showToastFor(n));
      if (rest.length > 0) {
        toast(`và ${rest.length} thông báo khác`, {
          description: "Xem trong chuông thông báo.",
          duration: 8000,
          action: {
            label: "Mở",
            onClick: () =>
              window.dispatchEvent(new CustomEvent("kt-open-notifications")),
          },
        });
      }
      // Mark all as toasted
      candidates.forEach((n) => toasted.add(n.id));
      saveToasted(user.id, toasted);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: new notifications live
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-toast-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notif;
          if (!n || !n.is_active) return;
          if (n.target_user_id && n.target_user_id !== user.id) return;
          const toasted = loadToasted(user.id);
          if (toasted.has(n.id)) return;
          toasted.add(n.id);
          saveToasted(user.id, toasted);
          showToastFor(n);
          // Bump unread badge
          setUnread((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

export default NotificationToaster;
