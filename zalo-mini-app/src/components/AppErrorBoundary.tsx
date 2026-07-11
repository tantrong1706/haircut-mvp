import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { captureError } from "../services/monitoring";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, {
      area: "react_render",
      component_stack: info.componentStack?.slice(0, 1000) || "",
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-main">
        <section className="entry-page auth-entry">
          <div className="empty-state app-error-state">
            <ShieldAlert size={34} aria-hidden="true" />
            <strong>Ứng dụng đang gặp lỗi hiển thị</strong>
            <p>
              Vui lòng tải lại trang. Nếu lỗi vẫn còn, chủ salon có thể kiểm tra cảnh báo trong
              Sentry/Firebase.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw size={18} aria-hidden="true" />
              Tải lại app
            </button>
          </div>
        </section>
      </main>
    );
  }
}
