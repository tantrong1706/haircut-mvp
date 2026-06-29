import { useState } from "react";
import { BadgeCheck, ScanLine, TicketCheck } from "lucide-react";
import { RedeemRewardResult, redeemRewardCode } from "../services/operations";

type Props = {
  salonId: string;
  disabled?: boolean;
  note?: string;
};

export function RedeemRewardPanel({ salonId, disabled, note }: Props) {
  const [rewardCode, setRewardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedeemRewardResult | null>(null);
  const [error, setError] = useState("");

  async function redeem() {
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const nextResult = await redeemRewardCode({ salonId, rewardCode });
      setResult(nextResult);
      setRewardCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mã quà");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel redeem-panel">
      <div className="section-heading">
        <TicketCheck size={22} aria-hidden="true" />
        <div>
          <h2>Xác nhận mã quà</h2>
          <p className="muted">Nhập mã khách đưa để đánh dấu là đã sử dụng.</p>
        </div>
      </div>

      {note ? <p className="notice-banner">{note}</p> : null}

      <label className="field">
        <span>
          <ScanLine size={18} aria-hidden="true" />
          Mã quà
        </span>
        <input
          value={rewardCode}
          onChange={(event) => setRewardCode(event.target.value.toUpperCase())}
          placeholder="Ví dụ: HC-20260629-1A2B3C4D"
          disabled={disabled || loading}
        />
      </label>

      <button
        className="primary-button"
        type="button"
        disabled={disabled || loading || rewardCode.trim().length === 0}
        onClick={redeem}
      >
        <BadgeCheck size={20} aria-hidden="true" />
        {loading ? "Đang kiểm tra..." : "Đánh dấu đã sử dụng"}
      </button>

      {result ? (
        <p className="alert success">
          Đã xác nhận {result.rewardName || "mã quà"} {result.customerName ? `cho ${result.customerName}` : ""}.
        </p>
      ) : null}
      {error ? <p className="alert error">{error}</p> : null}
    </div>
  );
}
