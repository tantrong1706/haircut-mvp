import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { updateCustomerName } from "../services/customerName";

export function CustomerNameEditor({
  salonId,
  customerId,
  customerName,
  pointRequestId,
  disabled = false,
  onSaved,
}: {
  salonId: string;
  customerId: string;
  customerName: string;
  pointRequestId?: string;
  disabled?: boolean;
  onSaved: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(customerName);
  const [expectedName, setExpectedName] = useState(customerName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const restoreFocus = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      editButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing]);

  async function save() {
    if (pending.current || disabled || !draft.trim() || draft.trim().length > 80) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await updateCustomerName({
        salonId,
        customerId,
        name: draft.trim(),
        expectedName,
        ...(pointRequestId === undefined ? {} : { pointRequestId }),
      });
      if (!mounted.current) return;
      restoreFocus.current = true;
      setEditing(false);
      setMessage("Đã lưu tên khách.");
      onSaved(result.name);
    } catch (caught) {
      if (mounted.current)
        setError(
          caught instanceof Error ? caught.message : "Chưa lưu được tên khách. Vui lòng thử lại.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="customer-name-editor">
      {editing ? (
        <>
          <label className="field" htmlFor={fieldId}>
            <span>Tên khách</span>
            <input
              id={fieldId}
              value={draft}
              maxLength={80}
              autoComplete="off"
              autoFocus
              disabled={busy || disabled}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
          </label>
          <div className="button-row wrap-row">
            <button
              type="button"
              className="secondary-button"
              disabled={
                busy ||
                disabled ||
                !draft.trim() ||
                draft.trim().length > 80 ||
                draft.trim() === expectedName
              }
              onClick={() => void save()}
            >
              {busy ? "Đang lưu tên..." : "Lưu tên"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                restoreFocus.current = true;
                setEditing(false);
                setError("");
              }}
            >
              Hủy đổi tên
            </button>
          </div>
        </>
      ) : (
        <button
          ref={editButton}
          type="button"
          className="secondary-button"
          disabled={disabled}
          aria-label={`Sửa tên khách ${customerName || "chưa có tên"}`}
          onClick={() => {
            setDraft(customerName);
            setExpectedName(customerName);
            setError("");
            setMessage("");
            setEditing(true);
          }}
        >
          <Pencil size={16} aria-hidden="true" />
          Sửa tên
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
