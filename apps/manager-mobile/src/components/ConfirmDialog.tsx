import { AlertTriangle, X } from "lucide-react";

export type ConfirmDialogRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: ConfirmDialogRequest | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!request) return null;

  return (
    <div className="manager-dialog-backdrop" role="presentation">
      <section
        className="manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-dialog-title"
      >
        <button
          className="manager-icon-button dialog-close"
          type="button"
          aria-label="Đóng"
          disabled={busy}
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>
        <AlertTriangle className={request.tone === "danger" ? "danger-icon" : ""} aria-hidden="true" />
        <h2 id="manager-dialog-title">{request.title}</h2>
        <p>{request.description}</p>
        <div className="manager-button-row">
          <button className="manager-button secondary" type="button" disabled={busy} onClick={onCancel}>
            Quay lại
          </button>
          <button
            className={`manager-button ${request.tone === "danger" ? "danger" : "primary"}`}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Đang xử lý..." : request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
