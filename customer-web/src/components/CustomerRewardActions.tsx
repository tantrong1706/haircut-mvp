import { useId, useRef, useState } from "react";
import { Gift } from "lucide-react";
import {
  listRedeemableCustomerRewards,
  redeemCustomerReward,
  type RedeemableCustomerReward,
  type RedeemableCustomerRewardPage,
} from "../services/customerRewardRedemption";

type Props = {
  salonId: string;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  verifiedPhoneLast4?: string;
  disabled?: boolean;
};

export function CustomerRewardActions(props: Props) {
  return (
    <CustomerRewardForm
      key={JSON.stringify([
        props.salonId,
        props.branchId,
        props.customerId,
        props.verifiedPhoneLast4,
      ])}
      {...props}
    />
  );
}

function CustomerRewardForm({
  salonId,
  branchId,
  branchName,
  customerId,
  customerName,
  verifiedPhoneLast4,
  disabled,
}: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState("");
  const [page, setPage] = useState<RedeemableCustomerRewardPage | null>(null);
  const [selection, setSelection] = useState<{
    reward: RedeemableCustomerReward;
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const phoneLast4 = verifiedPhoneLast4 ?? digits;
  const ready = Boolean(branchId && !disabled && /^\d{4}$/.test(phoneLast4));
  const identity = { salonId, branchId, customerId, phoneLast4 };

  async function load(cursor?: string) {
    if (!ready || pending.current) return;
    pending.current = true;
    setBusy(true);
    setSelection(null);
    setError("");
    setMessage("");
    try {
      const result = await listRedeemableCustomerRewards({
        ...identity,
        ...(cursor ? { cursor } : {}),
      });
      setPage((current) => ({
        rewards: cursor && current ? [...current.rewards, ...result.rewards] : result.rewards,
        nextCursor: result.nextCursor,
      }));
    } catch (err) {
      if (!cursor) setPage(null);
      setError(err instanceof Error ? err.message : "Chưa tải được quà của khách.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function confirmReward() {
    if (!ready || !selection || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await redeemCustomerReward({
        ...identity,
        rewardId: selection.reward.id,
        idempotencyKey: selection.key,
      });
      setPage(
        (current) =>
          current && {
            ...current,
            rewards: current.rewards.filter((reward) => reward.id !== selection.reward.id),
          },
      );
      setSelection(null);
      setMessage(
        result.alreadyRedeemed
          ? "Quà này đã được xác nhận trước đó."
          : `Đã xác nhận sử dụng ${selection.reward.rewardName} cho ${customerName || "khách hàng"}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa xác nhận được quà. Vui lòng thử lại.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="customer-reward-actions">
      <button
        type="button"
        className="secondary-button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!branchId || disabled || busy}
        onClick={() => {
          setOpen(!open);
          if (open) {
            setSelection(null);
          } else if (verifiedPhoneLast4) {
            void load();
          }
        }}
      >
        <Gift size={17} aria-hidden="true" /> {open ? "Ẩn quà của khách" : "Xem quà có thể dùng"}
      </button>
      {!branchId ? <small>Chọn chi nhánh phục vụ để xem quà có thể dùng.</small> : null}
      <div id={panelId} hidden={!open}>
        {open ? (
          <>
            <strong>Quà dùng tại {branchName}</strong>
            {!verifiedPhoneLast4 ? (
              <label className="field">
                <span>4 số cuối điện thoại để xem quà</span>
                <input
                  value={digits}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  disabled={busy || disabled}
                  onChange={(event) => {
                    setDigits(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setPage(null);
                    setSelection(null);
                    setError("");
                    setMessage("");
                  }}
                />
              </label>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={!ready || busy}
              onClick={() => void load()}
            >
              {page ? "Cập nhật quà" : "Tải quà của khách"}
            </button>
            {busy ? <p role="status">Đang xử lý quà...</p> : null}
            {page && !page.rewards.length ? (
              <p>
                {page.nextCursor
                  ? "Chưa thấy quà trong trang này."
                  : "Không có quà dùng được tại chi nhánh này."}
              </p>
            ) : null}
            {page?.rewards.length ? (
              <ul className="customer-reward-list">
                {page.rewards.map((reward) => (
                  <li key={reward.id}>
                    <span>
                      {reward.rewardName}
                      {reward.expiresAtMs
                        ? ` · Hạn ${new Date(reward.expiresAtMs).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Sử dụng ${reward.rewardName}`}
                      disabled={!ready || busy || Boolean(selection)}
                      onClick={() => {
                        setError("");
                        setMessage("");
                        setSelection({ reward, key: crypto.randomUUID() });
                      }}
                    >
                      Sử dụng
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {page?.nextCursor ? (
              <button
                type="button"
                className="secondary-button"
                disabled={!ready || busy || Boolean(selection)}
                onClick={() => void load(page.nextCursor ?? undefined)}
              >
                Xem thêm quà
              </button>
            ) : null}
            {selection ? (
              <div className="service-state-card" role="group" aria-label="Xác nhận sử dụng quà">
                <p>
                  Chỉ xác nhận sau khi đã trao <strong>{selection.reward.rewardName}</strong> cho{" "}
                  {customerName || "khách hàng"}.
                </p>
                <div className="button-row wrap-row">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => setSelection(null)}
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!ready || busy}
                    onClick={() => void confirmReward()}
                  >
                    Xác nhận đã trao quà
                  </button>
                </div>
              </div>
            ) : null}
            {message ? (
              <p className="alert success" role="status">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="alert error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
