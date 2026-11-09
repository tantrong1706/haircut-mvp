import { useId, useRef, useState } from "react";
import {
  adjustSalonCustomerPoints,
  type CustomerPointAdjustment as Adjustment,
} from "../services/customerPointAdjustment";

type Props = {
  salonId: string;
  customerId: string;
  customerName: string;
  points: number;
  disabled?: boolean;
  onAdjusted: (points: number) => void;
};

export function CustomerPointAdjustment({
  salonId,
  customerId,
  customerName,
  points,
  disabled,
  onAdjusted,
}: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [subtract, setSubtract] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [request, setRequest] = useState<Adjustment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const count = Number(amount);
  const validAmount = /^\d+$/.test(amount) && Number.isInteger(count) && count >= 1 && count <= 100;
  const insufficient = subtract && validAmount && count > points;
  const valid =
    validAmount && !insufficient && reason.trim().length >= 5 && reason.trim().length <= 200;

  async function confirmAdjustment() {
    if (!request || disabled || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await adjustSalonCustomerPoints(request);
      onAdjusted(result.currentPoints);
      setMessage(
        result.alreadyProcessed
          ? `Điều chỉnh đã được ghi nhận. Hiện có ${result.currentPoints} điểm.`
          : `Đã điều chỉnh điểm. Hiện có ${result.currentPoints} điểm.`,
      );
      setAmount("");
      setReason("");
      setRequest(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa điều chỉnh được điểm. Vui lòng thử lại.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="customer-action-block">
      <button
        type="button"
        className="secondary-button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled || busy}
        onClick={() => {
          setOpen(!open);
          setRequest(null);
          setError("");
          setMessage("");
        }}
      >
        {open ? "Đóng điều chỉnh điểm" : "Điều chỉnh điểm"}
      </button>
      <div id={panelId} hidden={!open}>
        {open && !request ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!valid || disabled || busy) return;
              setError("");
              setRequest({
                salonId,
                customerId,
                expectedPoints: points,
                delta: subtract ? -count : count,
                reason: reason.trim(),
                idempotencyKey: crypto.randomUUID(),
              });
            }}
          >
            <label className="field">
              <span>Thao tác điểm</span>
              <select
                value={subtract ? "subtract" : "add"}
                disabled={disabled}
                onChange={(event) => setSubtract(event.target.value === "subtract")}
              >
                <option value="add">Cộng điểm</option>
                <option value="subtract">Trừ điểm</option>
              </select>
            </label>
            <label className="field">
              <span>Số điểm điều chỉnh</span>
              <input
                value={amount}
                type="number"
                min={1}
                max={100}
                step={1}
                disabled={disabled}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Lý do điều chỉnh</span>
              <input
                value={reason}
                maxLength={200}
                disabled={disabled}
                placeholder="Ví dụ: Sửa cộng trùng"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <small>Ghi từ 5 ký tự; không nhập số điện thoại hay thông tin riêng tư.</small>
            {insufficient ? <p role="status">Khách không đủ điểm để trừ số này.</p> : null}
            <div className="button-row">
              <button
                type="submit"
                className="secondary-button"
                disabled={!valid || disabled || busy}
              >
                Kiểm tra điều chỉnh
              </button>
            </div>
          </form>
        ) : null}
        {open && request ? (
          <div className="service-state-card" role="group" aria-label="Xác nhận điều chỉnh điểm">
            <p>
              {request.delta < 0 ? "Trừ" : "Cộng"} {Math.abs(request.delta)} điểm cho{" "}
              <strong>{customerName}</strong>: {request.expectedPoints} →{" "}
              {request.expectedPoints + request.delta} điểm.
            </p>
            <p>Lý do: {request.reason}</p>
            <div className="button-row wrap-row">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setRequest(null);
                  setError("");
                }}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={busy || disabled}
                onClick={() => void confirmAdjustment()}
              >
                {busy ? "Đang điều chỉnh..." : "Xác nhận điều chỉnh"}
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="alert error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {message ? (
        <p className="alert success" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
