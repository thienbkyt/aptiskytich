import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";

const partLabel = (p: string) => {
  const m = p.match(/(\d)/);
  return m ? `Part ${m[1]}` : p;
};

interface Props {
  pendingParts: string[];
  failedParts: string[];
  recoverableParts?: string[];
  onRetry?: (part: string) => Promise<boolean> | void;
  onRecover?: (part: string) => Promise<{ ok: boolean; upgrade?: boolean }>;
  className?: string;
}

/**
 * Display-only banner telling the student that AI grading is still running
 * (or has failed) for some Writing parts. Never touches grading logic.
 */
const WritingGradingStatusBanner = ({ pendingParts, failedParts, recoverableParts = [], onRetry, onRecover, className = "" }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (pendingParts.length === 0 && failedParts.length === 0 && recoverableParts.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {pendingParts.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left">
          <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Đang chấm {pendingParts.map(partLabel).join(", ")} — kết quả sẽ cập nhật trong vài phút.
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Bài của bạn đã được lưu đầy đủ. Bạn có thể thoát, điểm vẫn được lưu và xem lại trong
            Lịch sử học tập. Trang này sẽ tự cập nhật khi chấm xong.
          </p>
        </div>
      )}

      {failedParts.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left">
          <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Chấm không thành công: {failedParts.map(partLabel).join(", ")}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Bài viết của bạn vẫn được lưu. Bấm “Chấm lại” để hệ thống chấm lại phần này.
          </p>
          {onRetry && (
            <div className="flex flex-wrap gap-2 mt-3">
              {failedParts.map((p) => (
                <button
                  key={p}
                  disabled={busy === p}
                  onClick={async () => {
                    setBusy(p);
                    try {
                      await onRetry(p);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {busy === p ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Chấm lại {partLabel(p)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {recoverableParts.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left">
          <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Chấm chưa hoàn tất — bài viết đã được lưu an toàn.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {recoverableParts.map((p) => (
              <button
                key={p}
                disabled={busy === p || !onRecover}
                onClick={async () => {
                  if (!onRecover) return;
                  setBusy(p); setMessage(null);
                  try {
                    const result = await onRecover(p);
                    if (!result.ok) setMessage(result.upgrade ? "Bạn đã hết lượt chấm AI. Vui lòng nâng cấp hoặc chờ hạn mức được làm mới." : "Chưa thể tạo lượt chấm. Vui lòng thử lại.");
                  } finally { setBusy(null); }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {busy === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Chấm ngay {partLabel(p)}
              </button>
            ))}
          </div>
          {message && <p className="text-xs text-destructive mt-2">{message}</p>}
        </div>
      )}
    </div>
  );
};

export default WritingGradingStatusBanner;
