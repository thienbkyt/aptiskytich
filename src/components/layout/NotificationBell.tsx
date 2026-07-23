import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Sparkles, BookOpen, Megaphone, ExternalLink, CheckCheck, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserBootstrap } from "@/hooks/useUserBootstrap";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";


type NotifType = "feature" | "content" | "general";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  link_url: string | null;
  created_at: string;
}

const TYPE_META: Record<
  NotifType,
  {
    label: string;
    icon: typeof Sparkles;
    iconBg: string;
    iconText: string;
    pillClass: string;
  }
> = {
  feature: {
    label: "Tính năng mới",
    icon: Sparkles,
    iconBg: "bg-[#FEAD5F]",
    iconText: "text-[#4D0D0D]",
    pillClass: "text-[#4D0D0D] bg-[#FEAD5F]/20",
  },
  content: {
    label: "Update bài",
    icon: BookOpen,
    iconBg: "bg-[#CC1C01]",
    iconText: "text-white",
    pillClass: "text-[#CC1C01] bg-[#CC1C01]/10",
  },
  general: {
    label: "Thông báo chung",
    icon: Megaphone,
    iconBg: "bg-[#4D0D0D]",
    iconText: "text-white",
    pillClass: "text-[#4D0D0D] bg-[#4D0D0D]/7",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "Vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

interface Props {
  variant?: "desktop" | "mobile";
}

const NotificationBell = ({ variant = "desktop" }: Props) => {
  const { user } = useAuth();
  const { unread_notification_count, setUnread } = useUserBootstrap();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [notifRes, readsRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, type, link_url, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("notification_reads").select("notification_id"),
    ]);
    if (notifRes.data) setItems(notifRes.data as Notification[]);
    if (readsRes.data) {
      setReadIds(new Set(readsRes.data.map((r: any) => r.notification_id)));
    }
    setLoading(false);
    setHasFetched(true);
  }, [user]);

  // Only fetch the full list when the bell is opened. The badge count comes
  // from the single bootstrap RPC, so the initial page load makes no extra call.
  useEffect(() => {
    if (open && user) fetchData();
  }, [open, user, fetchData]);

  // Click outside / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const unreadFromList = items.filter((n) => !readIds.has(n.id)).length;
  const unreadCount = hasFetched ? unreadFromList : unread_notification_count;
  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount);


  const markRead = async (id: string) => {
    if (readIds.has(id)) return;
    setReadIds((prev) => new Set(prev).add(id));
    setUnread((n) => n - 1);
    await supabase
      .from("notification_reads")
      .upsert(
        { user_id: user.id, notification_id: id },
        { onConflict: "user_id,notification_id", ignoreDuplicates: true },
      );
  };

  useEffect(() => {
    const handler = () => setOpen(true);
    const detailHandler = (e: Event) => {
      const n = (e as CustomEvent).detail as Notification | undefined;
      if (!n) return;
      setReadIds((prev) => {
        if (prev.has(n.id)) return prev;
        const next = new Set(prev);
        next.add(n.id);
        return next;
      });
      setSelected(n);
      setOpen(false);
    };
    window.addEventListener("kt-open-notifications", handler);
    window.addEventListener("kt-open-notification-detail", detailHandler as EventListener);
    return () => {
      window.removeEventListener("kt-open-notifications", handler);
      window.removeEventListener("kt-open-notification-detail", detailHandler as EventListener);
    };
  }, []);

  const markAllRead = async () => {
    const unread = items.filter((n) => !readIds.has(n.id));
    if (unread.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      unread.forEach((n) => next.add(n.id));
      return next;
    });
    setUnread(0);
    await supabase.from("notification_reads").upsert(
      unread.map((n) => ({ user_id: user.id, notification_id: n.id })),
      { onConflict: "user_id,notification_id", ignoreDuplicates: true },
    );
  };


  const handleItemClick = (n: Notification) => {
    markRead(n.id);
    setSelected(n);
    setOpen(false);
  };

  const handleGoTo = (url: string) => {
    setSelected(null);
    if (url.startsWith("/")) {
      navigate(url);
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  };

  const isMobile = variant === "mobile";
  const selectedMeta = selected ? TYPE_META[selected.type] || TYPE_META.general : null;
  const SelectedIcon = selectedMeta?.icon;

  return (
    <div ref={rootRef} className={isMobile ? "relative w-full" : "relative inline-flex"}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        className={
          isMobile
            ? "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
            : "relative inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
        }
      >
        {isMobile ? (
          <span className="relative inline-flex">
            <Bell className="w-5 h-5 text-[#CC1C01]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#CC1C01] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {badgeText}
              </span>
            )}
          </span>
        ) : (
          <>
            <Bell className="w-4 h-4 text-foreground" />
            {unreadCount > 0 && (
              <span className="pointer-events-none absolute top-0 right-0 min-w-[15px] h-[15px] px-1 rounded-full bg-[#CC1C01] text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-background">
                {badgeText}
              </span>
            )}
          </>
        )}
        {isMobile && <span className="text-sm font-medium">Thông báo</span>}
      </button>


      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className={
              isMobile
                ? "mt-2 w-full bg-white border border-[#4D0D0D]/10 rounded-2xl overflow-hidden shadow-[0_12px_32px_-12px_rgba(77,13,13,0.28)]"
                : "fixed top-[64px] right-4 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-[#4D0D0D]/10 rounded-2xl overflow-hidden shadow-[0_12px_32px_-12px_rgba(77,13,13,0.28)] z-50"
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#FFF3E6] border-b border-[#FEAD5F]/30">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#CC1C01] flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-sm font-bold text-[#4D0D0D]">Thông báo</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold text-[#CC1C01] bg-[#CC1C01]/12 px-2 py-0.5 rounded-full">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-semibold text-[#CC1C01] hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Đọc tất cả
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-4 py-8 text-sm text-[#4D0D0D]/40 text-center">Đang tải...</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-sm text-[#4D0D0D]/40 text-center">
                  Chưa có thông báo nào.
                </p>
              ) : (
                <ul>
                  {items.map((n, idx) => {
                    const meta = TYPE_META[n.type] || TYPE_META.general;
                    const Icon = meta.icon;
                    const isRead = readIds.has(n.id);
                    return (
                      <li
                        key={n.id}
                        className={idx > 0 ? "border-t border-[#4D0D0D]/[0.06]" : ""}
                      >
                        <button
                          onClick={() => handleItemClick(n)}
                          className={`w-full text-left flex gap-3 px-4 py-3 transition-colors border-l-[3px] ${
                            isRead
                              ? "bg-white border-transparent hover:bg-[#FEAD5F]/5"
                              : "bg-[#FEAD5F]/[0.03] border-[#CC1C01]"
                          }`}
                        >
                          {/* Icon box */}
                          <div
                            className={`shrink-0 w-[38px] h-[38px] rounded-[11px] flex items-center justify-center ${meta.iconBg} ${meta.iconText}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.pillClass}`}
                              >
                                {meta.label}
                              </span>
                              {!isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#CC1C01] shrink-0" />
                              )}
                            </div>

                            <p
                              className={`text-sm leading-snug ${
                                isRead
                                  ? "font-medium text-[#4D0D0D]/70"
                                  : "font-bold text-[#4D0D0D]"
                              }`}
                            >
                              {n.title}
                            </p>

                            <p className="text-xs text-[#4D0D0D]/55 mt-0.5 whitespace-pre-wrap leading-relaxed line-clamp-2">
                              {n.body}
                            </p>

                            <div className="flex items-center justify-between mt-1.5">
                              <span className="flex items-center gap-1 text-[11px] text-[#4D0D0D]/35">
                                <Clock className="w-3 h-3" />
                                {timeAgo(n.created_at)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail modal */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[480px] p-0 overflow-hidden bg-white border border-[#4D0D0D]/10 rounded-2xl">
          {selected && selectedMeta && SelectedIcon && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-start gap-3 px-5 pt-5 pb-3">
                <span className="shrink-0 w-10 h-10 rounded-full bg-[#CC1C01] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </span>
                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-base font-bold text-[#4D0D0D] leading-snug">
                    {selected.title}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${selectedMeta.pillClass}`}
                  >
                    <SelectedIcon className="w-3 h-3" />
                    {selectedMeta.label}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 pb-4 max-h-[50vh] overflow-y-auto">
                <p className="text-sm text-[#4D0D0D]/80 whitespace-pre-wrap leading-relaxed">
                  {selected.body}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#4D0D0D]/[0.08] bg-[#FFF3E6]/40">
                <span className="flex items-center gap-1 text-[11px] text-[#4D0D0D]/50">
                  <Clock className="w-3 h-3" />
                  {timeAgo(selected.created_at)}
                </span>
                {selected.link_url && (
                  <button
                    onClick={() => handleGoTo(selected.link_url!)}
                    className="text-xs font-semibold text-white bg-[#CC1C01] hover:bg-[#4D0D0D] transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    Đi tới <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationBell;
