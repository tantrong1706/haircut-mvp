import { useEffect, useRef, useState } from "react";
import { UserRoundCheck } from "lucide-react";
import { awardReturningCustomerPoints } from "../services/returningCustomerPoints";
import { OwnerConfirmDialog } from "./OwnerConfirmDialog";

type Props = {
  salonId: string;
  branchId: string;
  branchName: string;
  pointPerVisit: number;
  customer: { id: string; name: string; phoneLast4: string };
  onAwarded: (pointsAfter: number) => void;
};

export function CustomerPointAction(props: Props) {
  return (
    <PointAction
      key={`${props.salonId}:${props.branchId}:${props.customer.id}:${props.customer.phoneLast4}`}
      {...props}
    />
  );
}

function PointAction({ salonId, branchId, branchName, pointPerVisit, customer, onAwarded }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const operation = useRef<string>();
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const ready = Boolean(branchId) && /^\d{4}$/.test(customer.phoneLast4);

  async function confirm() {
    if (!ready || !open || submitting.current || !operation.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await awardReturningCustomerPoints({
        salonId,
        branchId,
        customerId: customer.id,
        phoneLast4: customer.phoneLast4,
        operationId: operation.current,
      });
      if (!active.current) return;
      onAwarded(result.pointsAfter);
      operation.current = undefined;
      setMessage(
        result.alreadyProcessed
          ? "Lượt này đã được ghi nhận."
          : `Đã cộng ${result.pointsAdded} điểm.`,
      );
    } catch (err) {
      if (active.current)
        setError(err instanceof Error ? err.message : "Chưa cộng được điểm. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      if (active.current) {
        setBusy(false);
        setOpen(false);
      }
    }
  }

  return (
    <div className="customer-point-action">
      <button
        type="button"
        className="primary-button compact"
        aria-label={`Tích điểm cho ${customer.name}`}
        disabled={!ready || busy}
        onClick={() => {
          operation.current ??= crypto.randomUUID();
          setError("");
          setMessage("");
          setOpen(true);
        }}
      >
        <UserRoundCheck size={18} aria-hidden="true" />
        Tích điểm
      </button>
      {!ready ? (
        <p className="field-note">
          {!branchId
            ? "Chọn chi nhánh để cộng điểm."
            : "Hồ sơ chưa đủ 4 số cuối điện thoại. Vui lòng dùng QR."}
        </p>
      ) : null}
      <OwnerConfirmDialog
        busy={busy}
        request={
          open
            ? {
                title: "Xác nhận lượt cắt?",
                description: `${customer.name} · ******${customer.phoneLast4} · ${branchName}. Chỉ xác nhận khi khách đã sử dụng dịch vụ. Có thể bổ sung ảnh và ghi chú vào lượt này sau khi cộng điểm.`,
                confirmLabel: `Xác nhận cộng ${pointPerVisit} điểm`,
                onConfirm: confirm,
              }
            : null
        }
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      />
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="alert success" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
