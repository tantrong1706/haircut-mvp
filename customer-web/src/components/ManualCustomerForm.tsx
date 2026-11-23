import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, UserRoundPlus } from "lucide-react";
import { createManualCustomer } from "../services/manualCustomer";

type Props = {
  salonId: string;
  branchId?: string;
  branchName?: string;
  mode?: "profile" | "visit";
  branches?: Array<{ id: string; name: string }>;
  onCreated?: (sessionId?: string) => void;
};

type FieldName = "name" | "phone" | "branch";
type FormError = { message: string; field?: FieldName };

export function ManualCustomerForm(props: Props) {
  return (
    <ManualCustomerFields
      key={`${props.salonId}:${props.branchId ?? ""}:${props.mode ?? "profile"}`}
      {...props}
    />
  );
}

function ManualCustomerFields({
  salonId,
  branchId,
  branchName,
  onCreated,
  mode = "profile",
  branches = [],
}: Props) {
  const visit = mode === "visit";
  const formId = useId();
  const errorId = `${formId}-error`;
  const titleId = `${formId}-title`;
  const descriptionId = `${formId}-description`;
  const phoneHintId = `${formId}-phone-hint`;
  const photoHintId = `${formId}-photo-hint`;
  const trigger = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const branchInput = useRef<HTMLSelectElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const operation = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [allowPhoto, setAllowPhoto] = useState(false);
  const effectiveBranch =
    branchId || selectedBranch || (branches.length === 1 ? branches[0].id : "");
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
  useEffect(() => {
    if (!open || !error || busy) return;
    const controls = { name: nameInput, phone: phoneInput, branch: branchInput };
    (error.field ? controls[error.field] : submitButton).current?.focus();
  }, [open, error, busy]);

  function clearFieldError(field: FieldName) {
    setError((current) => (current?.field === field ? null : current));
  }

  function close() {
    setOpen(false);
    setError(null);
    trigger.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const cleanName = name.trim();
    const compact = phone.trim().replace(/[\s().-]/gu, "");
    const national = compact.replace(/^\+?84/u, "0");
    setError(null);
    if (!cleanName || cleanName.length > 80 || /\p{Cc}/u.test(cleanName)) {
      setError({ field: "name", message: "Nhập tên khách từ 1 đến 80 ký tự." });
      return;
    }
    if (phone.trim() && !/^0[35789]\d{8}$/u.test(national)) {
      setError({
        field: "phone",
        message: "Vui lòng nhập đúng số di động Việt Nam hoặc để trống.",
      });
      return;
    }
    if (visit && !effectiveBranch) {
      setError({ field: "branch", message: "Chọn chi nhánh phục vụ để tạo lượt chờ." });
      return;
    }
    operation.current ??= crypto.randomUUID();
    pending.current = true;
    setBusy(true);
    try {
      const result = await createManualCustomer({
        salonId,
        name: cleanName,
        operationId: operation.current,
        ...(effectiveBranch ? { branchId: effectiveBranch } : {}),
        ...(national ? { phone: national } : {}),
        ...(visit ? { startVisit: true, allowPhoto } : {}),
      });
      if (visit && !result.sessionId)
        throw new Error("Máy chủ chưa trả lượt chờ. Hãy kiểm tra danh sách trước khi thử lại.");
      if (!alive.current) return;
      operation.current = null;
      setName("");
      setPhone("");
      setAllowPhoto(false);
      close();
      setSaved(true);
      onCreated?.(result.sessionId);
    } catch (caught) {
      if (alive.current)
        setError({
          message: caught instanceof Error ? caught.message : "Chưa thêm được khách. Thử lại.",
        });
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const fieldError = error?.field;
  const errorText = error ? (
    <p id={errorId} className={fieldError ? "manual-field-error" : "alert error"} role="alert">
      {error.message}
    </p>
  ) : null;

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
        <UserRoundPlus size={18} aria-hidden="true" />{" "}
        {visit ? "Thêm khách trực tiếp" : "Thêm khách"}
      </button>
      {saved ? (
        <p className="alert success" role="status">
          {visit ? "Đã tạo lượt chờ xác nhận. Chưa cộng điểm." : "Đã thêm khách vào danh bạ."}
        </p>
      ) : null}
      <div id={formId} hidden={!open}>
        {open ? (
          <form
            className="panel manual-customer-form"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={busy}
            onSubmit={(event) => void submit(event)}
          >
            <header className="manual-card-heading">
              <h2 id={titleId}>{visit ? "Tạo lượt khách trực tiếp" : "Thêm khách thủ công"}</h2>
              <p id={descriptionId} className="muted">
                {visit
                  ? "Tạo lượt chờ xác nhận. Không gửi OTP, không tự cộng điểm."
                  : "Chỉ lưu vào danh bạ salon, không gửi OTP hay tự cộng điểm."}
              </p>
              {branchName ? <p className="manual-card-branch">{branchName}</p> : null}
            </header>
            <div className="manual-card-fields">
              {visit && !branchId ? (
                <div className="manual-field">
                  <label htmlFor={`${formId}-branch`}>Chi nhánh phục vụ</label>
                  <select
                    id={`${formId}-branch`}
                    ref={branchInput}
                    value={effectiveBranch}
                    disabled={busy}
                    aria-invalid={fieldError === "branch" || undefined}
                    aria-describedby={fieldError === "branch" ? errorId : undefined}
                    onChange={(event) => {
                      operation.current = null;
                      clearFieldError("branch");
                      setSelectedBranch(event.target.value);
                    }}
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {fieldError === "branch" ? errorText : null}
                </div>
              ) : null}
              <div className="manual-field">
                <label htmlFor={`${formId}-name`}>Tên khách</label>
                <input
                  id={`${formId}-name`}
                  ref={nameInput}
                  value={name}
                  maxLength={80}
                  required
                  autoComplete="off"
                  disabled={busy}
                  aria-invalid={fieldError === "name" || undefined}
                  aria-describedby={fieldError === "name" ? errorId : undefined}
                  onChange={(event) => {
                    operation.current = null;
                    clearFieldError("name");
                    setName(event.target.value);
                  }}
                />
                {fieldError === "name" ? errorText : null}
              </div>
              <div className="manual-field">
                <label htmlFor={`${formId}-phone`}>
                  Số điện thoại <span>(không bắt buộc)</span>
                </label>
                <input
                  id={`${formId}-phone`}
                  ref={phoneInput}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  maxLength={32}
                  autoComplete="off"
                  disabled={busy}
                  aria-invalid={fieldError === "phone" || undefined}
                  aria-describedby={fieldError === "phone" ? errorId : phoneHintId}
                  placeholder="09… hoặc +84…"
                  onChange={(event) => {
                    operation.current = null;
                    clearFieldError("phone");
                    setPhone(event.target.value);
                  }}
                />
                {fieldError === "phone" ? (
                  errorText
                ) : (
                  <p className="manual-field-hint" id={phoneHintId}>
                    Có thể để trống nếu khách chưa muốn cung cấp số.
                  </p>
                )}
              </div>
              {visit ? (
                <div className="manual-consent">
                  <label>
                    <input
                      type="checkbox"
                      checked={allowPhoto}
                      disabled={busy}
                      aria-describedby={photoHintId}
                      onChange={(event) => {
                        operation.current = null;
                        setAllowPhoto(event.target.checked);
                      }}
                    />
                    <span>Khách đã đồng ý cho salon chụp và lưu ảnh</span>
                  </label>
                  <p className="manual-field-hint" id={photoHintId}>
                    Chỉ đánh dấu nếu khách đã đồng ý. Có thể tạo lượt mà không lưu ảnh.
                  </p>
                </div>
              ) : null}
              {!fieldError ? errorText : null}
            </div>
            <footer className="manual-card-actions">
              <button className="secondary-button" type="button" disabled={busy} onClick={close}>
                Đóng
              </button>
              <button
                ref={submitButton}
                className="primary-button"
                type="submit"
                disabled={busy || !name.trim() || (visit && !effectiveBranch)}
              >
                {busy ? <LoaderCircle size={16} className="spin-icon" aria-hidden="true" /> : null}
                {busy ? "Đang lưu…" : visit ? "Tạo lượt chờ" : "Lưu khách"}
              </button>
            </footer>
          </form>
        ) : null}
      </div>
    </div>
  );
}
