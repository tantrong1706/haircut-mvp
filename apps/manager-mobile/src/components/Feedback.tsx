import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCcw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";

export function InlineFeedback({
  tone,
  children,
  action,
}: {
  tone: "success" | "error" | "warning" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : AlertCircle;
  return (
    <div className={`manager-feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <span>{children}</span>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Đang tải dữ liệu" }: { label?: string }) {
  return (
    <div className="manager-state" role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <strong>{label}</strong>
      <span>Vui lòng chờ trong giây lát.</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="manager-state">
      {icon}
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Chưa tải được dữ liệu",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="manager-state error" role="alert">
      <ShieldAlert aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {onRetry ? (
        <button className="manager-button secondary" type="button" onClick={onRetry}>
          <RefreshCcw aria-hidden="true" />
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function OfflineNotice() {
  return (
    <div className="manager-offline" role="status">
      <WifiOff aria-hidden="true" />
      <span>Mất kết nối. Dữ liệu có thể chưa được cập nhật.</span>
    </div>
  );
}
