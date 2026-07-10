import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label to show in the fallback UI. */
  label?: string;
}
interface State {
  error: Error | null;
}

/**
 * Localised error boundary for review / history screens. Prevents a single
 * malformed record (e.g. a legacy AI grading row with an object where a string
 * was expected — React error #31) from whiting out the entire app. Shows a
 * light inline notice with a reload action instead.
 */
export default class ReviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ReviewErrorBoundary]", error, info);
  }

  private handleReload = () => {
    // Try a soft reset first, then hard reload.
    this.setState({ error: null });
    setTimeout(() => {
      try {
        window.location.reload();
      } catch {
        /* noop */
      }
    }, 0);
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Phần này gặp lỗi hiển thị
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.props.label ? `${this.props.label}. ` : ""}Vui lòng thử tải lại.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-[#CC1C01] hover:bg-[#4D0D0D] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Tải lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
