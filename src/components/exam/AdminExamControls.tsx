import { useEffect, useState } from "react";
import { SkipForward, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AdminExamControlsProps {
  onSkip: () => void;
  onBack?: () => void;
  /** Optional small label after "Admin", e.g. "Speaking · Part 2/4" */
  label?: string;
  /** Position: top-left (default) avoids collision with engine top-right buttons */
  position?: "top-left" | "top-right";
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
  position = "top-left",
}: AdminExamControlsProps) => {
  const { isAdmin: authIsAdmin } = useAuth();
  // Fallback: scan sessionStorage for any cached `isAdmin:*` = "1"
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
    } catch {}
  }, [authIsAdmin]);
  const isAdmin = authIsAdmin || sessionIsAdmin;
  if (!isAdmin) return null;

  const posClass =
    position === "top-right" ? "top-2 right-2" : "top-2 left-2";

  return (
    <div className={`fixed ${posClass} z-[100] flex flex-col items-start gap-0.5 pointer-events-auto`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-300 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-yellow-300/40">
        Admin{label ? ` · ${label}` : ""}
      </span>
      <div className="flex items-center gap-1.5">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-white/60 bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors shadow-sm"
            title="Quay lại phần trước (admin)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Quay lại
          </button>
        )}
        <button
          onClick={onSkip}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-white/60 bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors shadow-sm"
          title="Bỏ qua sang phần tiếp theo (admin)"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Bỏ qua
        </button>
      </div>
    </div>
  );
};

export default AdminExamControls;
