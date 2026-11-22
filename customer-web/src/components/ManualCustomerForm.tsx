import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { UserRoundPlus } from "lucide-react";
import { createManualCustomer } from "../services/manualCustomer";

type Props = {
  salonId: string;
  branchId?: string;
  branchName?: string;
  mode?: "profile" | "visit";
  branches?: Array<{ id: string; name: string }>;
  onCreated?: (sessionId?: string) => void;
};

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
    if (visit && !effectiveBranch) {
      setError("Chọn chi nhánh phục vụ để tạo lượt chờ.");
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
            aria-label={visit ? "Tạo lượt khách trực tiếp" : "Thêm khách thủ công"}
            onSubmit={(event) => void submit(event)}
          >
            {branchName ? <p className="muted">{branchName}</p> : null}
            {visit && !branchId ? (
              <label className="field">
                <span>Chi nhánh phục vụ</span>
                <select
                  value={effectiveBranch}
                  disabled={busy}
                  onChange={(event) => {
                    operation.current = null;
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
              </label>
            ) : null}
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
            {visit ? (
              <>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={allowPhoto}
                    disabled={busy}
                    onChange={(event) => {
                      operation.current = null;
                      setAllowPhoto(event.target.checked);
                    }}
                  />
                  Khách đã đồng ý cho salon chụp và lưu ảnh
                </label>
                <p className="muted">
                  Tạo lượt chờ để thêm ảnh, ghi chú và xác nhận cộng điểm. Không gửi OTP, không tự
                  cộng điểm khi lưu. Có thể để trống SĐT.
                </p>
              </>
            ) : (
              <p className="muted">Chỉ lưu vào danh bạ salon, không gửi OTP hay tự cộng điểm.</p>
            )}
            {error ? (
              <p className="alert error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="button-row wrap-row">
              <button className="secondary-button" type="button" disabled={busy} onClick={close}>
                Đóng
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || !name.trim() || (visit && !effectiveBranch)}
              >
                {busy ? "Đang lưu…" : visit ? "Tạo lượt chờ" : "Lưu khách"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
