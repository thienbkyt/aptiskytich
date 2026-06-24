import { useEffect, useState } from "react";
import { Flag, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function inferSectionFromPath(path: string): string {
  const p = (path || "").toLowerCase();
  if (p.startsWith("/reading")) return "Reading";
  if (p.startsWith("/listening")) return "Listening";
  if (p.startsWith("/grammar")) return "Grammar & Vocabulary";
  if (p.startsWith("/writing")) return "Writing";
  if (p.startsWith("/speaking")) return "Speaking";
  if (p.startsWith("/thi-thu") || p.startsWith("/full-test") || p.startsWith("/fulltest")) return "Thi thử (Full Test)";
  if (p.startsWith("/history")) return "Lịch sử";
  if (p.startsWith("/dashboard")) return "Dashboard";
  if (p.startsWith("/vocabulary") || p.startsWith("/vocab")) return "Học từ vựng";
  if (p.startsWith("/course")) return "Khóa học";
  return "Khác";
}

type FunctionalReason = "cant_nav" | "cant_exit" | "button_broken" | "page_frozen" | "other";

const FUNCTIONAL_REASONS: { value: FunctionalReason; label: string }[] = [
  { value: "cant_nav", label: "Không bấm được Next/Previous" },
  { value: "cant_exit", label: "Không thoát được" },
  { value: "button_broken", label: "Nút không hoạt động" },
  { value: "page_frozen", label: "Trang bị đứng/treo" },
  { value: "other", label: "Khác" },
];

const NAVY = "#002F5F";

function getDeviceInfo() {
  try {
    return `${navigator.userAgent} | screen ${window.screen.width}x${window.screen.height} | viewport ${window.innerWidth}x${window.innerHeight}`;
  } catch {
    return null;
  }
}

function getPageUrl() {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return null;
  }
}

export default function ReportFab() {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FunctionalReason>("cant_nav");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Auto-hide during exams / review (full-screen takeover).
  useEffect(() => {
    const update = () => {
      const isExam =
        document.body.classList.contains("exam-mode") ||
        document.body.classList.contains("history-review-mode");
      setHidden(isExam);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("question_reports").insert({
        exam_question_id: null,
        exam_set_id: null,
        user_id: user?.id ?? null,
        skill: null,
        part_type: null,
        question_number: null,
        reason,
        note: note.trim() || null,
        status: "new",
        report_category: "functional",
        page_url: getPageUrl(),
        device_info: getDeviceInfo(),
        section: inferSectionFromPath(location.pathname),
      });
      if (error) throw error;
      toast.success("Đã gửi báo lỗi, cảm ơn bạn");
      setOpen(false);
      setNote("");
      setReason("cant_nav");
    } catch (e) {
      console.error("[ReportFab] insert failed", e);
      toast.error("Gửi báo lỗi thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[90] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md border transition-colors hover:bg-slate-50"
        style={{
          bottom: 20,
          left: 16,
          color: NAVY,
          borderColor: NAVY,
        }}
        aria-label="Báo lỗi chức năng"
      >
        <Flag className="w-3.5 h-3.5" />
        Báo lỗi
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ color: "#111" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: NAVY }}>
                Báo lỗi chức năng
              </h3>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="text-slate-500 hover:text-slate-800"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-semibold mb-1.5 text-slate-600">Chi tiết</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {FUNCTIONAL_REASONS.map((r) => {
                const active = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
                    style={{
                      backgroundColor: active ? NAVY : "white",
                      color: active ? "white" : NAVY,
                      borderColor: NAVY,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mô tả thêm (không bắt buộc)"
              rows={3}
              className="w-full rounded-md border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ color: "#111" }}
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                disabled={submitting}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                style={{ backgroundColor: NAVY }}
              >
                {submitting ? "Đang gửi..." : "Gửi báo lỗi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
