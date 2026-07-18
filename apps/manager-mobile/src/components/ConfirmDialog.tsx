import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { handleDialogKeyboard } from "./dialogKeyboard";

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
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  const descriptionId = useId();
  const open = Boolean(request);

  useEffect(() => {
    busyRef.current = busy;
    onCancelRef.current = onCancel;
  }, [busy, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      const focusable = dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
      handleDialogKeyboard({
        key: event.key,
        shiftKey: event.shiftKey,
        busy: busyRef.current,
        activeElement:
          document.activeElement instanceof HTMLElement ? document.activeElement : null,
        focusable,
        preventDefault: () => event.preventDefault(),
        onCancel: () => onCancelRef.current(),
      });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!request) return null;

  return (
    <div className="manager-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
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
        <h2 id={titleId}>{request.title}</h2>
        <p id={descriptionId}>{request.description}</p>
        <div className="manager-button-row">
          <button
            ref={cancelButtonRef}
            className="manager-button secondary"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
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
