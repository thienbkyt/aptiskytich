import { useState } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Reason = "wrong_answer" | "audio" | "image" | "content" | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "wrong_answer", label: "Sai đáp án" },
  { value: "audio", label: "Lỗi audio" },
  { value: "image", label: "Lỗi hình ảnh" },
  { value: "content", label: "Lỗi nội dung/chính tả" },
  { value: "other", label: "Khác" },
];

interface Props {
  examQuestionId?: string | null;
  examSetId?: string | null;
  skill: string;
  partType?: string | null;
  questionNumber?: number | null;
}

const NAVY = "#002F5F";

export default function ExamReportButton({
  examQuestionId,
  examSetId,
  skill,
  partType,
  questionNumber,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("wrong_answer");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("question_reports").insert({
        exam_question_id: examQuestionId ?? null,
        exam_set_id: examSetId ?? null,
        user_id: user?.id ?? null,
        skill,
        part_type: partType ?? null,
        question_number: questionNumber ?? null,
        reason,
        note: note.trim() || null,
        status: "new",
      });
      if (error) throw error;
      toast.success("Đã gửi báo lỗi, cảm ơn bạn");
      setOpen(false);
      setNote("");
      setReason("wrong_answer");
    } catch (e) {
      console.error("[ExamReportButton] insert failed", e);
      toast.error("Gửi báo lỗi thất bại, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[90] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-md border transition-colors hover:bg-slate-50"
        style={{
          bottom: 80,
          left: 16,
          color: NAVY,
          borderColor: NAVY,
        }}
        aria-label="Báo lỗi câu hỏi"
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
                Báo lỗi câu hỏi này
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

            <div className="flex flex-wrap gap-2 mb-3">
              {REASONS.map((r) => {
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
