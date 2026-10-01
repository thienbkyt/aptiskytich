import { Component, ReactNode } from "react";
import { logClientError } from "@/lib/clientErrorLog";
import { safeSessionStorage } from "@/lib/safeStorage";

/**
 * Lỗi do lệch phiên bản sau khi publish: tab đang mở bản cũ nhưng tải phải chunk
 * của bản mới (hoặc ngược lại) → React văng "Cannot read properties of undefined
 * (reading 'default')" / lỗi import chunk. Cách xử lý: tự tải lại trang 1 lần để
 * lấy bundle mới. Không tự tải lại khi đang làm bài (để học viên bấm nút).
 * Dùng chung khoá "chunk-reload-at" với main.tsx để không lặp reload.
 */
function isVersionMismatchError(error: Error | null | undefined): boolean {
  const msg = String(error?.message ?? "");
  const stack = String(error?.stack ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    (msg.includes("reading 'default'") && stack.includes("/assets/"))
  );
}

function tryAutoReload(): boolean {
  try {
    if ((window as Window & { __ktExamActive?: boolean }).__ktExamActive) return false;
    const KEY = "chunk-reload-at";
    const last = Number(safeSessionStorage.getItem(KEY) || 0);
    if (Date.now() - last <= 10000) return false;
    safeSessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** Dedupe identical crash messages within 60s — a 3rd-party script can loop errors. */
const lastLogged = new Map<string, number>();
const DEDUPE_MS = 60_000;

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
    if (isVersionMismatchError(error)) {
      try {
        logClientError("chunk_version_mismatch", error, {
          url: typeof window !== "undefined" ? window.location.pathname : null,
        });
      } catch {
        /* ignore */
      }
      if (tryAutoReload()) return;
    }
    try {
      const msg = String(error?.message ?? error ?? "").slice(0, 2000);
      const now = Date.now();
      const prev = lastLogged.get(msg);
      if (prev && now - prev < DEDUPE_MS) return;
      lastLogged.set(msg, now);
      if (lastLogged.size > 50) {
        for (const [k, t] of lastLogged) if (now - t > DEDUPE_MS) lastLogged.delete(k);
      }
      logClientError("react_error_boundary", error, {
        stack: error?.stack?.slice(0, 2000) ?? null,
        componentStack: (info as any)?.componentStack?.slice(0, 2000) ?? null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
      });
    } catch {
      /* logging must never break the error screen */
    }
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: 20,
            background: "#fff",
            color: "#0F0F10",
            fontFamily: "system-ui, -apple-system, sans-serif",
            WebkitTextSizeAdjust: "100%",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#CC1C01", marginBottom: 8 }}>
            Có lỗi xảy ra
          </h1>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Ứng dụng gặp lỗi không mong muốn. Vui lòng tải lại trang.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#CC1C01",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 8,
              fontWeight: 600,
              marginBottom: 16,
              cursor: "pointer",
            }}
          >
            Tải lại
          </button>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              background: "#f6f6f7",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              maxHeight: "60vh",
              overflow: "auto",
            }}
          >
            {String(err.message || err)}
            {err.stack ? "\n\n" + err.stack : ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
