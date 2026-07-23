import { BadgeCheck, Copy, ScanLine, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog, type ConfirmDialogRequest } from "./ConfirmDialog";
import { InlineFeedback } from "./Feedback";
import { Section } from "./ScreenPrimitives";
import {
  formatDateTime,
  lookupRewardCode,
  redeemRewardCode,
  restoreRewardCode,
  type RedeemRewardResult,
  type RewardCodeInfo,
} from "../services/managerApi";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";

export function RewardRedemption({
  salonId,
  branchId,
  disabled = false,
  allowRestore = false,
  onOpenScanner,
}: {
  salonId: string;
  branchId?: string;
  disabled?: boolean;
  allowRestore?: boolean;
  onOpenScanner?: () => void;
}) {
  const [rewardCode, setRewardCode] = useState("");
  const [info, setInfo] = useState<RewardCodeInfo | null>(null);
  const [result, setResult] = useState<RedeemRewardResult | null>(null);
  const [busy, setBusy] = useState<"check" | "redeem" | "restore" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<ConfirmDialogRequest | null>(null);

  useEffect(() => {
    const receiveScannedCode = (event: Event) => {
      const code = String((event as CustomEvent<string>).detail || "")
        .trim()
        .toUpperCase();
      if (!code) return;
      setRewardCode(code);
      setInfo(null);
      setResult(null);
      setMessage("Đã nhận mã từ camera. Hãy kiểm tra trước khi xác nhận.");
      setError("");
    };
    window.addEventListener("haircut:reward-code-scanned", receiveScannedCode);
    return () => window.removeEventListener("haircut:reward-code-scanned", receiveScannedCode);
  }, []);

  async function checkCode() {
    setBusy("check");
    setInfo(null);
    setResult(null);
    setError("");
    setMessage("");
    try {
      const next = await withMonitoringTrace(
        "reward_code_lookup",
        () => lookupRewardCode({ salonId, rewardCode }),
        { salon_id: salonId },
      );
      setInfo(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không kiểm tra được mã quà.");
    } finally {
      setBusy("");
    }
  }

  async function redeem() {
    setBusy("redeem");
    setError("");
    setMessage("");
    try {
      const next = await withMonitoringTrace(
        "reward_code_redeem",
        () => redeemRewardCode({ salonId, branchId, rewardCode }),
        { salon_id: salonId },
      );
      setResult(next);
      setInfo((current) =>
        current
          ? { ...current, status: "used", usedAtMs: Date.now() }
          : {
              found: true,
              rewardCode: next.rewardCode,
              rewardName: next.rewardName,
              customerName: next.customerName,
              status: "used",
              usedAtMs: Date.now(),
            },
      );
      setRewardCode("");
      trackEvent("reward_code_redeemed", { salon_id: salonId, reward_status: "used" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đổi được mã quà.");
    } finally {
      setBusy("");
      setConfirm(null);
    }
  }

  async function restore() {
    if (!result) return;
    setBusy("restore");
    setError("");
    try {
      await restoreRewardCode({ salonId, rewardCode: result.rewardCode });
      setRewardCode(result.rewardCode);
      setInfo((current) => (current ? { ...current, status: "unused", usedAtMs: null } : current));
      setResult(null);
      setMessage("Đã hoàn tác. Mã quà có thể được dùng lại.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không hoàn tác được mã quà.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Section
      title="Xác nhận mã quà"
      description="Kiểm tra đúng khách và trạng thái trước khi đánh dấu đã dùng."
    >
      <label className="manager-field">
        <span>
          <ScanLine aria-hidden="true" />
          Mã quà
        </span>
        <input
          value={rewardCode}
          disabled={disabled || Boolean(busy)}
          onChange={(event) => {
            setRewardCode(event.target.value.toUpperCase());
            setInfo(null);
            setResult(null);
            setMessage("");
          }}
          placeholder="Ví dụ: HC-2026-1A2B3C"
        />
      </label>
      <div className="manager-button-row">
        {onOpenScanner ? (
          <button
            className="manager-button secondary"
            type="button"
            disabled={disabled || Boolean(busy)}
            onClick={onOpenScanner}
          >
            <ScanLine aria-hidden="true" />
            Quét camera
          </button>
        ) : null}
        <button
          className="manager-button primary"
          type="button"
          disabled={disabled || Boolean(busy) || !rewardCode.trim()}
          onClick={() => void checkCode()}
        >
          <Search aria-hidden="true" />
          {busy === "check" ? "Đang kiểm tra..." : "Kiểm tra mã"}
        </button>
      </div>

      {info ? (
        <div className={`manager-reward-status ${info.status}`}>
          <div>
            <strong>{info.rewardName || "Mã quà"}</strong>
            <span>{rewardStatus(info)}</span>
          </div>
          <dl>
            <div>
              <dt>Khách</dt>
              <dd>{info.customerName || "Chưa rõ"}</dd>
            </div>
            <div>
              <dt>Tạo lúc</dt>
              <dd>{formatDateTime(info.createdAtMs ?? null) || "Chưa rõ"}</dd>
            </div>
            {info.expiresAtMs ? (
              <div>
                <dt>Hết hạn</dt>
                <dd>{formatDateTime(info.expiresAtMs)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="manager-button-row">
            <button
              className="manager-button secondary"
              type="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(info.rewardCode)
                  .then(() => setMessage("Đã sao chép mã quà."))
                  .catch(() => setError("Thiết bị không cho phép sao chép."))
              }
            >
              <Copy aria-hidden="true" />
              Sao chép
            </button>
            <button
              className="manager-button primary"
              type="button"
              disabled={Boolean(busy) || !info.found || info.status !== "unused"}
              onClick={() =>
                setConfirm({
                  title: "Xác nhận sử dụng quà?",
                  description: `${info.rewardName || "Mã quà"} của ${
                    info.customerName || "khách hàng"
                  } sẽ không thể dùng lại.`,
                  confirmLabel: "Xác nhận đã dùng",
                  onConfirm: redeem,
                })
              }
            >
              <BadgeCheck aria-hidden="true" />
              Đánh dấu đã dùng
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <InlineFeedback
          tone="success"
          action={
            allowRestore ? (
              <button type="button" disabled={busy === "restore"} onClick={() => void restore()}>
                {busy === "restore" ? "Đang hoàn tác..." : "Hoàn tác"}
              </button>
            ) : undefined
          }
        >
          Đã xác nhận {result.rewardName || "mã quà"} cho{" "}
          {result.customerName || "khách hàng"}.
        </InlineFeedback>
      ) : null}
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}

      <ConfirmDialog
        request={confirm}
        busy={busy === "redeem"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirm?.onConfirm()}
      />
    </Section>
  );
}

function rewardStatus(info: RewardCodeInfo) {
  if (!info.found || info.status === "not_found") return "Không thuộc salon này";
  if (info.status === "used") return "Đã sử dụng";
  if (info.status === "expired") return "Đã hết hạn";
  if (info.status === "revoked") return "Đã bị hủy";
  return "Còn hiệu lực";
}
