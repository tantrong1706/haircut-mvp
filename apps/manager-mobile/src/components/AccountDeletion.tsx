import { AlertTriangle, CalendarClock, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineFeedback } from "./Feedback";
import { Section } from "./ScreenPrimitives";
import {
  cancelFullSalonDeletion,
  deletePersonalAccount,
  getFullSalonDeletionStatus,
  requestFullSalonDeletion,
  type AppUser,
  type SalonDeletionStatus,
} from "../services/managerApi";

export function AccountDeletion({ user }: { user: AppUser }) {
  const [password, setPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<SalonDeletionStatus>({
    status: "none",
    executeAfterMs: null,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user.role !== "owner") return;
    void getFullSalonDeletionStatus(user.salonId).then(setStatus).catch(() => undefined);
  }, [user.role, user.salonId]);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await task();
      setMessage(success);
      setPassword("");
      setConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xử lý được yêu cầu xóa.");
    } finally {
      setBusy(false);
    }
  }

  if (user.role === "staff") {
    return (
      <Section
        title="Xóa tài khoản cá nhân"
        description="Tài khoản đăng nhập và token thiết bị sẽ bị xóa ngay."
        className="manager-danger-zone"
      >
        <PasswordField value={password} onChange={setPassword} />
        <ConfirmCheck
          checked={confirmed}
          onChange={setConfirmed}
          label="Tôi hiểu thao tác này không thể hoàn tác."
        />
        <button
          className="manager-button danger"
          disabled={busy || !password || !confirmed}
          onClick={() => void run(() => deletePersonalAccount(password), "Đã xóa tài khoản.")}
        >
          <Trash2 aria-hidden="true" />
          {busy ? "Đang xóa..." : "Xóa tài khoản"}
        </button>
        {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      </Section>
    );
  }

  const pending = status.status === "requested";
  return (
    <Section
      title="Xóa salon và tài khoản"
      description="Dữ liệu được giữ 14 ngày để bạn có thể hủy yêu cầu."
      className="manager-danger-zone"
    >
      {pending ? (
        <div className="manager-deletion-pending">
          <CalendarClock aria-hidden="true" />
          <div>
            <strong>Đang chờ xóa</strong>
            <span>Dự kiến: {formatDate(status.executeAfterMs)}</span>
          </div>
        </div>
      ) : (
        <label className="manager-field">
          <span>
            <AlertTriangle aria-hidden="true" />
            Nhập đúng tên salon để xác nhận
          </span>
          <input value={salonName} onChange={(event) => setSalonName(event.target.value)} />
        </label>
      )}
      <PasswordField value={password} onChange={setPassword} />
      {pending ? (
        <button
          className="manager-button primary"
          disabled={busy || !password}
          onClick={() =>
            void run(async () => {
              await cancelFullSalonDeletion({ salonId: user.salonId, password });
              setStatus({ status: "cancelled", executeAfterMs: null });
            }, "Đã hủy yêu cầu xóa salon.")
          }
        >
          <ShieldCheck aria-hidden="true" />
          {busy ? "Đang xử lý..." : "Hủy yêu cầu xóa"}
        </button>
      ) : (
        <>
          <ConfirmCheck
            checked={confirmed}
            onChange={setConfirmed}
            label="Tôi hiểu toàn bộ dữ liệu salon sẽ bị xóa sau 14 ngày."
          />
          <button
            className="manager-button danger"
            disabled={busy || !password || !salonName.trim() || !confirmed}
            onClick={() =>
              void run(async () => {
                const result = await requestFullSalonDeletion({
                  salonId: user.salonId,
                  salonName,
                  password,
                });
                setStatus({ status: result.status, executeAfterMs: result.executeAfterMs });
              }, "Đã ghi nhận yêu cầu xóa salon.")
            }
          >
            <Trash2 aria-hidden="true" />
            {busy ? "Đang gửi..." : "Yêu cầu xóa salon"}
          </button>
        </>
      )}
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </Section>
  );
}

function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="manager-field">
      <span>Mật khẩu hiện tại</span>
      <input
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ConfirmCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="manager-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(value)
    : "Chưa xác định";
}
