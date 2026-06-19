import { useEffect, useRef, useState } from "react";
import { SkipForward, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_NAV_LOCK_MS = 700;
let adminNavLockedUntil = 0;

interface AdminExamControlsProps {
  onSkip: () => void;
  onBack?: () => void;
  /** Optional small label after "Admin", e.g. "Speaking · Part 2/4" */
  label?: string;
  /** Position: top-center (default) places overlay in the center top */
  position?: "top-left" | "top-right" | "top-center";
}

/**
 * Floating admin-only navigation overlay used across all exam engines.
 * Renders only when the current user has the `admin` role.
 *
 * - "Bỏ qua" advances to the next page/part/skill (depends on caller wiring).
 * - "Quay lại" goes to the previous page/part/skill (depends on caller wiring).
 *   Hidden when `onBack` is not provided.
 */
const AdminExamControls = ({
  onSkip,
  onBack,
  label,
  position = "top-center",
}: AdminExamControlsProps) => {
  const { isAdmin: authIsAdmin } = useAuth();
  const clickLockRef = useRef(false);
  const [isLocked, setIsLocked] = useState(true);
  // Fallback: support both cached `isAdmin:*` and `user_roles` formats.
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
  useEffect(() => {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i) || "";
        if (k.startsWith("isAdmin:") && sessionStorage.getItem(k) === "1") {
          setSessionIsAdmin(true);
          return;
        }
      }
      const rawRoles = sessionStorage.getItem("user_roles");
      if (rawRoles) {
        let parsed: any = rawRoles;
        try { parsed = JSON.parse(rawRoles); } catch {}
        const roles = Array.isArray(parsed) ? parsed : parsed?.roles ?? parsed;
        if (Array.isArray(roles) && roles.some((r) => (typeof r === "string" ? r : r?.role) === "admin")) {
          setSessionIsAdmin(true);
        } else if (typeof roles === "string" && roles.includes("admin")) {
          setSessionIsAdmin(true);
        }
      }
    } catch {}
  }, [authIsAdmin]);

  useEffect(() => {
    clickLockRef.current = true;
    const timer = window.setTimeout(() => {
      clickLockRef.current = false;
      setIsLocked(false);
    }, ADMIN_NAV_LOCK_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const isAdmin = authIsAdmin || sessionIsAdmin;
  if (!isAdmin) return null;

  const posClass =
    position === "top-right" ? "top-2 right-2"
    : position === "top-left" ? "top-2 left-2"
    : "top-2 left-1/2 -translate-x-1/2";

  const runOnce = (action?: () => void) => {
    const now = Date.now();
    if (!action || clickLockRef.current || now < adminNavLockedUntil) return;
    adminNavLockedUntil = now + ADMIN_NAV_LOCK_MS;
    clickLockRef.current = true;
    setIsLocked(true);
    action();
    window.setTimeout(() => {
      clickLockRef.current = false;
      setIsLocked(false);
    }, ADMIN_NAV_LOCK_MS);
  };

  return (
    <div className={`fixed ${posClass} z-[100] flex flex-col gap-0.5 ${position === "top-center" ? "items-center" : "items-start"} pointer-events-auto`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-300 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-yellow-300/40">
        Admin{label ? ` · ${label}` : ""}
      </span>
      <div className="flex items-center gap-1.5">
        {onBack && (
          <button
            onClick={() => runOnce(onBack)}
            disabled={isLocked}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-white/60 bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors shadow-sm"
            title="Quay lại trang trước (admin)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Quay lại
          </button>
        )}
        <button
          onClick={() => runOnce(onSkip)}
          disabled={isLocked}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-white/60 bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors shadow-sm"
          title="Chuyển sang trang tiếp theo (admin)"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Bỏ qua
        </button>
      </div>
    </div>
  );
};

export default AdminExamControls;
