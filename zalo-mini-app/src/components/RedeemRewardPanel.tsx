import { useEffect, useState } from "react";
import { BadgeCheck, ScanLine, Search, ShieldCheck, TicketCheck, X } from "lucide-react";
import {
  RedeemRewardResult,
  RewardCodeInfo,
  formatDateTime,
  lookupRewardCode,
  redeemRewardCode,
  restoreRewardCode,
} from "../services/operations";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";

type Props = {
  salonId: string;
  branchId?: string;
  disabled?: boolean;
  note?: string;
  allowRestore?: boolean;
};

export function RedeemRewardPanel({
  salonId,
  branchId,
  disabled,
  note,
  allowRestore = false,
}: Props) {
  const [rewardCode, setRewardCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [info, setInfo] = useState<RewardCodeInfo | null>(null);
  const [result, setResult] = useState<RedeemRewardResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const receiveScannedCode = (event: Event) => {
      const code = String((event as CustomEvent<string>).detail || "")
        .trim()
        .toUpperCase();
      if (!code) return;
      setRewardCode(code);
      setInfo(null);
      setResult(null);
      setConfirming(false);
      setMessage("Đã nhận mã từ camera. Hãy kiểm tra trước khi xác nhận.");
      setError("");
    };
    window.addEventListener("haircut:reward-code-scanned", receiveScannedCode);
    return () => window.removeEventListener("haircut:reward-code-scanned", receiveScannedCode);
  }, []);

  async function checkCode() {
    setChecking(true);
    setResult(null);
    setInfo(null);
    setError("");
    setMessage("");

    try {
      const nextInfo = await withMonitoringTrace(
        "reward_code_lookup",
        () => lookupRewardCode({ salonId, branchId, rewardCode }),
        {
          salon_id: salonId,
        },
      );
      setInfo(nextInfo);
      trackEvent("reward_code_lookup_completed", {
        salon_id: salonId,
        found: Boolean(nextInfo.found),
        status: nextInfo.status || "unknown",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được mã quà");
    } finally {
      setChecking(false);
    }
  }

  async function redeem() {
    setConfirming(false);
    setLoading(true);
    setResult(null);
    setError("");
    setMessage("");

    try {
      const nextResult = await withMonitoringTrace(
        "reward_code_redeem",
        () => redeemRewardCode({ salonId, branchId, rewardCode }),
        {
          salon_id: salonId,
        },
      );
      setResult(nextResult);
      setInfo((current) => ({
        ...current,
        found: true,
        rewardId: nextResult.rewardId,
        rewardCode: nextResult.rewardCode,
        rewardName: nextResult.rewardName,
        customerName: nextResult.customerName,
        status: "used",
        usedAtMs: nextResult.usedAtMs,
      }));
      setRewardCode("");
      setMessage(
        nextResult.alreadyRedeemed
          ? "Mã quà này đã được xác nhận trước đó. Không ghi nhận thêm lần sử dụng."
          : "",
      );
      trackEvent("reward_code_redeemed", {
        salon_id: salonId,
        reward_status: "used",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mã quà");
    } finally {
      setLoading(false);
    }
  }

  async function restore() {
    if (!result) {
      return;
    }

    setRestoring(true);
    setError("");
    setMessage("");
    try {
      await restoreRewardCode({ salonId, rewardCode: result.rewardCode });
      setRewardCode(result.rewardCode);
      setInfo((current) => (current ? { ...current, status: "unused", usedAtMs: null } : current));
      setResult(null);
      setMessage("Đã hoàn tác. Mã quà có thể được sử dụng lại.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tác được mã quà");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="panel redeem-panel">
      <div className="section-heading">
        <TicketCheck size={22} aria-hidden="true" />
        <div>
          <h2>Xác nhận mã quà</h2>
          <p className="muted">
            Kiểm tra tên khách và quà, sau đó chỉ xác nhận khi ưu đãi đã được trao.
          </p>
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
            setConfirming(false);
            setMessage("");
            setError("");
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
          disabled={
            disabled ||
            loading ||
            !info?.found ||
            info.status !== "unused" ||
            info.redeemableAtBranch === false
          }
          onClick={() => setConfirming(true)}
        >
          <BadgeCheck size={20} aria-hidden="true" />
          {loading ? "Đang xác nhận..." : "Xác nhận khách đã dùng"}
        </button>
      </div>

      {info ? (
        <RewardCodeStatus info={info} />
      ) : null}

      {result ? (
        <div className="alert success retry-alert">
          <span>
            {result.alreadyRedeemed
              ? "Mã đã ở trạng thái sử dụng."
              : `Đã xác nhận ${result.rewardName || "mã quà"} ${
                  result.customerName ? `cho ${result.customerName}` : ""
                }.`}
          </span>
          {allowRestore ? (
            <button type="button" disabled={restoring} onClick={restore}>
              {restoring ? "Đang hoàn tác..." : "Hoàn tác"}
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="alert success">{message}</p> : null}
      {error ? <p className="alert error">{error}</p> : null}

      {confirming &&
      info?.found &&
      info.status === "unused" &&
      info.redeemableAtBranch !== false ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="redeem-confirm-title"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Đóng"
              onClick={() => setConfirming(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <ShieldCheck className="confirm-icon" size={28} aria-hidden="true" />
            <h3 id="redeem-confirm-title">Xác nhận sử dụng quà?</h3>
            <p>
              {info.rewardName || "Mã quà"} cho {info.customerName || "khách hàng"}. Sau khi xác
              nhận đã trao quà, mã sẽ được đánh dấu đã sử dụng. Chủ salon có thể hoàn tác trong 15
              phút nếu thao tác nhầm.
            </p>
            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setConfirming(false)}
              >
                Quay lại
              </button>
              <button className="primary-button compact" type="button" onClick={redeem}>
                <BadgeCheck size={18} aria-hidden="true" />
                Xác nhận đã trao quà
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RewardCodeStatus({
  info,
}: {
  info: RewardCodeInfo;
}) {
  if (!info.found || info.status === "not_found") {
    return <p className="alert error">Không tìm thấy mã quà trong salon này.</p>;
  }

  return (
    <div
      className={
        info.status === "unused" ? "reward-code-status success" : "reward-code-status warning"
      }
    >
      <div>
        <strong>{info.rewardName || "Mã quà"}</strong>
        <span>{statusText(info.status)}</span>
      </div>
      <small>Khách: {info.customerName || "Chưa rõ"}</small>
      <small>Tạo lúc: {formatDateTime(info.createdAtMs ?? null) || "Chưa rõ"}</small>
      {info.expiresAtMs ? <small>Hết hạn: {formatDateTime(info.expiresAtMs)}</small> : null}
      {info.usedAtMs ? <small>Đã dùng lúc: {formatDateTime(info.usedAtMs)}</small> : null}
      {info.reason === "WRONG_BRANCH" ? (
        <small>Mã quà không áp dụng tại chi nhánh hiện tại.</small>
      ) : null}
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
  if (status === "revoked") {
    return "Mã đã bị hủy";
  }
  return "Mã còn hiệu lực";
}
