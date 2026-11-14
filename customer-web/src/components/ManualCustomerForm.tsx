import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { UserRoundPlus } from "lucide-react";
import { createManualCustomer } from "../services/manualCustomer";

type Props = { salonId: string; branchId?: string; branchName?: string; onCreated?: () => void };

export function ManualCustomerForm(props: Props) {
  return <ManualCustomerFields key={`${props.salonId}:${props.branchId ?? ""}`} {...props} />;
}

function ManualCustomerFields({ salonId, branchId, branchName, onCreated }: Props) {
  const formId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const operation = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (open) nameInput.current?.focus();
    else if (saved) trigger.current?.focus();
  }, [open, saved]);

  function close() {
    setOpen(false);
    setError("");
    trigger.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const cleanName = name.trim();
    const compact = phone.trim().replace(/[\s().-]/gu, "");
    const national = compact.replace(/^\+?84/u, "0");
    setError("");
    if (!cleanName || cleanName.length > 80 || /\p{Cc}/u.test(cleanName)) {
      setError("Nhập tên khách từ 1 đến 80 ký tự.");
      return;
    }
    if (phone.trim() && !/^0[35789]\d{8}$/u.test(national)) {
      setError("Vui lòng nhập đúng số di động Việt Nam hoặc để trống.");
      return;
    }
    operation.current ??= crypto.randomUUID();
    pending.current = true;
    setBusy(true);
    try {
      await createManualCustomer({
        salonId,
        name: cleanName,
        operationId: operation.current,
        ...(branchId ? { branchId } : {}),
        ...(national ? { phone: national } : {}),
      });
      if (!alive.current) return;
      operation.current = null;
      setName("");
      setPhone("");
      close();
      setSaved(true);
      onCreated?.();
    } catch (caught) {
      if (alive.current)
        setError(caught instanceof Error ? caught.message : "Chưa thêm được khách. Thử lại.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="manual-customer">
      <button
        type="button"
        ref={trigger}
        className="secondary-button"
        aria-expanded={open}
        aria-controls={formId}
        disabled={busy}
        onClick={() => {
          setSaved(false);
          if (open) close();
          else setOpen(true);
        }}
      >
        <UserRoundPlus size={18} aria-hidden="true" /> Thêm khách
      </button>
      {saved ? (
        <p className="alert success" role="status">
          Đã thêm khách vào danh bạ.
        </p>
      ) : null}
      <div id={formId} hidden={!open}>
        {open ? (
          <form
            className="panel manual-customer-form"
            aria-label="Thêm khách thủ công"
            onSubmit={(event) => void submit(event)}
          >
            {branchName ? <p className="muted">{branchName}</p> : null}
            <label className="field">
              <span>Tên khách</span>
              <input
                ref={nameInput}
                value={name}
                maxLength={80}
                required
                autoComplete="off"
                disabled={busy}
                onChange={(event) => {
                  operation.current = null;
                  setName(event.target.value);
                }}
              />
            </label>
            <label className="field">
              <span>Số điện thoại (không bắt buộc)</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                maxLength={32}
                autoComplete="off"
                disabled={busy}
                placeholder="09… hoặc +84…"
                onChange={(event) => {
                  operation.current = null;
                  setPhone(event.target.value);
                }}
              />
            </label>
            <p className="muted">Chỉ lưu vào danh bạ salon, không gửi OTP hay tự cộng điểm.</p>
            {error ? (
              <p className="alert error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="button-row wrap-row">
              <button className="secondary-button" type="button" disabled={busy} onClick={close}>
                Đóng
              </button>
              <button className="primary-button" type="submit" disabled={busy || !name.trim()}>
                {busy ? "Đang lưu…" : "Lưu khách"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
