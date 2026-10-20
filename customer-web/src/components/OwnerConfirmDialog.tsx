import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export type OwnerConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => Promise<void> | void;
};

export function OwnerConfirmDialog({ request, busy, onCancel, onConfirm }: {
  request: OwnerConfirmation | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = Boolean(request);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = dialogRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    (first || dialogRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!request) return null;
  return <div className="dialog-backdrop" role="presentation">
    <div ref={dialogRef} tabIndex={-1}
      className={request.tone === "danger" ? "confirm-dialog danger" : "confirm-dialog"}
      role="dialog" aria-modal="true" aria-labelledby="owner-confirm-title" aria-describedby="owner-confirm-description"
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!busy) onCancel();
          return;
        }
        if (event.key !== "Tab") return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
        if (!buttons.length) { event.preventDefault(); event.currentTarget.focus(); return; }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (document.activeElement === event.currentTarget) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}>
      <div className="confirm-icon"><AlertTriangle size={24} aria-hidden="true" /></div>
      <div className="confirm-copy"><h2 id="owner-confirm-title">{request.title}</h2><p id="owner-confirm-description" className="muted">{request.description}</p></div>
      <div className="button-row wrap-row">
        <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>{request.cancelLabel || "Hủy"}</button>
        <button type="button" className={request.tone === "danger" ? "primary-button danger-primary" : "primary-button"} disabled={busy} onClick={onConfirm}>{busy ? "Đang xử lý..." : request.confirmLabel}</button>
      </div>
    </div>
  </div>;
}
