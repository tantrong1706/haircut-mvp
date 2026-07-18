import { Bell, Cloud, KeyRound, LockKeyhole, Smartphone } from "lucide-react";
import { useState } from "react";
import { useManagerNative } from "../hooks/useManagerNative";
import { getManagerSignedInEmail } from "../services/firebase";
import { requestOwnerStaffPasswordReset } from "../services/managerApi";
import { InlineFeedback } from "./Feedback";
import { Section } from "./ScreenPrimitives";

export function SecuritySettings({
  nativeReady,
  biometricEnabled,
  online,
  onToggleBiometric,
}: {
  nativeReady: boolean;
  biometricEnabled: boolean;
  online: boolean;
  onToggleBiometric: () => Promise<void>;
}) {
  const { pushStatus, retryPush } = useManagerNative();
  const email = getManagerSignedInEmail();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const appVersion = String(import.meta.env.VITE_APP_VERSION || "0.1.0");

  async function sendPasswordReset() {
    if (!email) {
      setError("Tài khoản chưa có email đăng nhập.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await requestOwnerStaffPasswordReset(email);
      setMessage(`Đã gửi hướng dẫn đặt lại mật khẩu tới ${email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được email đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section title="Đăng nhập và mật khẩu">
        <dl className="manager-summary-list">
          <div>
            <dt>Email</dt>
            <dd>{email || "Chưa xác định"}</dd>
          </div>
        </dl>
        <button
          className="manager-button secondary wide"
          type="button"
          disabled={busy || !email}
          onClick={() => void sendPasswordReset()}
        >
          <KeyRound aria-hidden="true" />
          {busy ? "Đang gửi..." : "Gửi email đặt lại mật khẩu"}
        </button>
      </Section>

      <Section
        title="Khóa sinh trắc học"
        description={
          nativeReady
            ? "Dùng Face ID, vân tay hoặc mã khóa thiết bị khi quay lại ứng dụng."
            : "Tính năng này chỉ có trong ứng dụng cài trên điện thoại."
        }
      >
        <button
          className="manager-button primary wide"
          type="button"
          disabled={!nativeReady}
          onClick={() => void onToggleBiometric()}
        >
          <LockKeyhole aria-hidden="true" />
          {biometricEnabled ? "Tắt khóa sinh trắc học" : "Bật khóa sinh trắc học"}
        </button>
      </Section>

      <Section title="Ứng dụng">
        <dl className="manager-summary-list">
          <div>
            <dt>
              <Cloud aria-hidden="true" /> Kết nối
            </dt>
            <dd>{online ? "Đang trực tuyến" : "Đang ngoại tuyến"}</dd>
          </div>
          <div>
            <dt>
              <Bell aria-hidden="true" /> Thông báo
            </dt>
            <dd>{pushStatusLabel(nativeReady, pushStatus)}</dd>
          </div>
          <div>
            <dt>
              <Smartphone aria-hidden="true" /> Phiên bản
            </dt>
            <dd>{appVersion}</dd>
          </div>
        </dl>
        {nativeReady && (pushStatus === "denied" || pushStatus === "unavailable") ? (
          <button className="manager-button secondary wide" type="button" onClick={retryPush}>
            <Bell aria-hidden="true" />
            Thử bật lại thông báo
          </button>
        ) : null}
      </Section>

      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </>
  );
}

function pushStatusLabel(
  nativeReady: boolean,
  status: "idle" | "initializing" | "ready" | "denied" | "unavailable",
) {
  if (!nativeReady) return "Chỉ có trên ứng dụng điện thoại";
  if (status === "initializing") return "Đang kết nối";
  if (status === "ready") return "Đã bật";
  if (status === "denied") return "Đang bị tắt";
  if (status === "unavailable") return "Tạm thời không khả dụng";
  return "Chưa khởi tạo";
}
