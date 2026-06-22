import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Sparkles, BookOpen, Megaphone, ExternalLink, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

type NotifType = "feature" | "content" | "general";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotifType;
  link_url: string | null;
  created_at: string;
}

const TYPE_META: Record<NotifType, { label: string; icon: typeof Sparkles; color: string }> = {
  feature: { label: "Tính năng mới", icon: Sparkles, color: "text-[#FEAD5F] bg-[#FEAD5F]/15" },
  content: { label: "Update bài", icon: BookOpen, color: "text-[#CC1C01] bg-[#CC1C01]/10" },
  general: { label: "Thông báo chung", icon: Megaphone, color: "text-[#4D0D0D] bg-[#4D0D0D]/10" },
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

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

  const unreadCount = items.filter((n) => !readIds.has(n.id)).length;
  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount);

  const markRead = async (id: string) => {
    if (readIds.has(id)) return;
    setReadIds((prev) => new Set(prev).add(id));
    await supabase
      .from("notification_reads")
      .upsert(
        { user_id: user.id, notification_id: id },
        { onConflict: "user_id,notification_id", ignoreDuplicates: true },
      );
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !readIds.has(n.id));
    if (unread.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      unread.forEach((n) => next.add(n.id));
      return next;
    });
    await supabase.from("notification_reads").upsert(
      unread.map((n) => ({ user_id: user.id, notification_id: n.id })),
      { onConflict: "user_id,notification_id", ignoreDuplicates: true },
    );
  };

  const handleItemClick = (n: Notification) => {
    markRead(n.id);
    setExpanded((prev) => (prev === n.id ? null : n.id));
  };

  const isMobile = variant === "mobile";

  return (
    <div ref={rootRef} className={isMobile ? "relative w-full" : "relative"}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        className={
          isMobile
            ? "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-left"
            : "relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        }
      >
        <span className="relative inline-flex">
          <Bell className={isMobile ? "w-5 h-5 text-[#CC1C01]" : "w-4 h-4 text-foreground"} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#CC1C01] text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {badgeText}
            </span>
          )}
        </span>
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
                ? "mt-2 w-full bg-popover border border-[#FEAD5F]/40 rounded-xl shadow-lg overflow-hidden"
                : "absolute top-full right-0 mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-popover border border-[#FEAD5F]/40 rounded-xl shadow-lg overflow-hidden z-50"
            }
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#FEAD5F]/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#CC1C01]" />
                <span className="text-sm font-bold text-[#4D0D0D]">Thông báo</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-muted-foreground">({unreadCount} chưa đọc)</span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#CC1C01] hover:underline font-medium flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Đọc tất cả
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">Đang tải...</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                  Chưa có thông báo nào.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const meta = TYPE_META[n.type] || TYPE_META.general;
                    const Icon = meta.icon;
                    const isRead = readIds.has(n.id);
                    const isOpen = expanded === n.id;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => handleItemClick(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors flex gap-3 ${
                            isRead ? "" : "bg-[#FEAD5F]/5"
                          }`}
                        >
                          <div
                            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {meta.label}
                              </span>
                              {!isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#CC1C01]" />
                              )}
                            </div>
                            <p
                              className={`text-sm leading-snug ${
                                isRead ? "font-medium text-foreground" : "font-bold text-foreground"
                              }`}
                            >
                              {n.title}
                            </p>
                            <p
                              className={`text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap ${
                                isOpen ? "" : "line-clamp-2"
                              }`}
                            >
                              {n.body}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-[11px] text-muted-foreground">
                                {timeAgo(n.created_at)}
                              </span>
                              {isOpen && n.link_url && (
                                <a
                                  href={n.link_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-semibold text-[#CC1C01] hover:underline flex items-center gap-1"
                                >
                                  Đi tới <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
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
    </div>
  );
};

export default NotificationBell;
