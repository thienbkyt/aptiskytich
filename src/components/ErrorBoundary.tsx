import { Component, ReactNode } from "react";

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
