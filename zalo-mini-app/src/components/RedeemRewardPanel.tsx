import { useState } from "react";
import { BadgeCheck, Copy, ScanLine, Search, TicketCheck } from "lucide-react";
import {
  RedeemRewardResult,
  RewardCodeInfo,
  formatDateTime,
  lookupRewardCode,
  redeemRewardCode,
} from "../services/operations";

type Props = {
  salonId: string;
  disabled?: boolean;
  note?: string;
};

export function RedeemRewardPanel({ salonId, disabled, note }: Props) {
  const [rewardCode, setRewardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<RewardCodeInfo | null>(null);
  const [result, setResult] = useState<RedeemRewardResult | null>(null);
  const [error, setError] = useState("");

  async function checkCode() {
    setChecking(true);
    setResult(null);
    setInfo(null);
    setError("");

    try {
      setInfo(await lookupRewardCode({ salonId, rewardCode }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được mã quà");
    } finally {
      setChecking(false);
    }
  }

  async function redeem() {
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const nextResult = await redeemRewardCode({ salonId, rewardCode });
      setResult(nextResult);
      setInfo({
        found: true,
        rewardId: nextResult.rewardId,
        rewardCode: nextResult.rewardCode,
        rewardName: nextResult.rewardName,
        customerName: nextResult.customerName,
        status: "used",
        usedAtMs: Date.now(),
      });
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
          onChange={(event) => {
            setRewardCode(event.target.value.toUpperCase());
            setInfo(null);
            setResult(null);
          }}
          placeholder="Ví dụ: HC-20260629-1A2B3C4D"
          disabled={disabled || loading || checking}
        />
      </label>

      <div className="button-row wrap-row">
        <button
          className="secondary-button"
          type="button"
          disabled={disabled || checking || loading || rewardCode.trim().length === 0}
          onClick={checkCode}
        >
          <Search size={18} aria-hidden="true" />
          {checking ? "Đang kiểm tra..." : "Kiểm tra mã"}
        </button>

        <button
          className="primary-button compact"
          type="button"
          disabled={disabled || loading || !info?.found || info.status !== "unused"}
          onClick={redeem}
        >
          <BadgeCheck size={20} aria-hidden="true" />
          {loading ? "Đang xác nhận..." : "Đánh dấu đã sử dụng"}
        </button>
      </div>

      {info ? <RewardCodeStatus info={info} /> : null}

      {result ? (
        <p className="alert success">
          Đã xác nhận {result.rewardName || "mã quà"} {result.customerName ? `cho ${result.customerName}` : ""}.
        </p>
      ) : null}
      {error ? <p className="alert error">{error}</p> : null}
    </div>
  );
}

function RewardCodeStatus({ info }: { info: RewardCodeInfo }) {
  if (!info.found || info.status === "not_found") {
    return <p className="alert error">Không tìm thấy mã quà trong salon này.</p>;
  }

  return (
    <div className={info.status === "unused" ? "reward-code-status success" : "reward-code-status warning"}>
      <div>
        <strong>{info.rewardName || "Mã quà"}</strong>
        <span>{statusText(info.status)}</span>
      </div>
      <small>Khách: {info.customerName || "Chưa rõ"}</small>
      <small>Tạo lúc: {formatDateTime(info.createdAtMs ?? null) || "Chưa rõ"}</small>
      {info.usedAtMs ? <small>Đã dùng lúc: {formatDateTime(info.usedAtMs)}</small> : null}
      <button type="button" onClick={() => navigator.clipboard.writeText(info.rewardCode)}>
        <Copy size={16} aria-hidden="true" />
        Copy mã
      </button>
    </div>
  );
}

function statusText(status: RewardCodeInfo["status"]) {
  if (status === "used") {
    return "Mã đã được sử dụng";
  }
  if (status === "expired") {
    return "Mã đã hết hạn";
  }
  return "Mã còn hiệu lực";
}
