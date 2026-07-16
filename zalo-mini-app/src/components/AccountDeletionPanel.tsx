import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ShieldCheck, Trash2 } from "lucide-react";
import type { AppUser } from "../services/auth";
import {
  cancelFullSalonDeletion,
  deletePersonalAccount,
  getFullSalonDeletionStatus,
  requestFullSalonDeletion,
  type SalonDeletionStatus,
} from "../services/accountDeletion";

export function AccountDeletionPanel({ currentUser }: { currentUser: AppUser }) {
  const [password, setPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<SalonDeletionStatus>({
    status: "none",
    executeAfterMs: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (currentUser.role !== "owner") return;
    void getFullSalonDeletionStatus(currentUser.salonId)
      .then(setStatus)
      .catch(() => undefined);
  }, [currentUser.role, currentUser.salonId]);

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
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

  if (currentUser.role === "staff") {
    return (
      <section className="panel account-deletion-panel">
        <div className="section-heading">
          <Trash2 />
          <div>
            <h2>Xóa tài khoản cá nhân</h2>
            <p className="muted">Tài khoản đăng nhập và token thiết bị sẽ bị xóa ngay.</p>
          </div>
        </div>
        <label className="field">
          <span>Mật khẩu hiện tại</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>Tôi hiểu thao tác này không thể hoàn tác.</span>
        </label>
        <button
          className="danger-button"
          disabled={busy || !password || !confirmed}
          onClick={() => void run(() => deletePersonalAccount(password), "Đã xóa tài khoản.")}
        >
          <Trash2 />
          Xóa tài khoản
        </button>
        {error ? <p className="alert error">{error}</p> : null}
      </section>
    );
  }

  const pending = status.status === "requested";
  return (
    <section className="panel account-deletion-panel">
      <div className="section-heading">
        <AlertTriangle />
        <div>
          <h2>Xóa salon và tài khoản</h2>
          <p className="muted">Dữ liệu được giữ 14 ngày để bạn có thể hủy yêu cầu.</p>
        </div>
      </div>
      {pending ? (
        <div className="deletion-pending">
          <CalendarClock />
          <div>
            <strong>Đang chờ xóa</strong>
            <span>Dự kiến: {formatDate(status.executeAfterMs)}</span>
          </div>
        </div>
      ) : (
        <label className="field">
          <span>Nhập đúng tên salon để xác nhận</span>
          <input value={salonName} onChange={(event) => setSalonName(event.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Mật khẩu hiện tại</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {pending ? (
        <button
          className="primary-button"
          disabled={busy || !password}
          onClick={() =>
            void run(async () => {
              await cancelFullSalonDeletion({ salonId: currentUser.salonId, password });
              setStatus({ status: "cancelled", executeAfterMs: null });
            }, "Đã hủy yêu cầu xóa salon.")
          }
        >
          <ShieldCheck />
          Hủy yêu cầu xóa
        </button>
      ) : (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>Tôi hiểu toàn bộ dữ liệu salon sẽ bị xóa sau 14 ngày.</span>
          </label>
          <button
            className="danger-button"
            disabled={busy || !password || !salonName.trim() || !confirmed}
            onClick={() =>
              void run(async () => {
                const result = await requestFullSalonDeletion({
                  salonId: currentUser.salonId,
                  salonName,
                  password,
                });
                setStatus({ status: result.status, executeAfterMs: result.executeAfterMs });
              }, "Đã ghi nhận yêu cầu xóa salon.")
            }
          >
            <Trash2 />
            Yêu cầu xóa salon
          </button>
        </>
      )}
      {message ? <p className="alert success">{message}</p> : null}
      {error ? <p className="alert error">{error}</p> : null}
    </section>
  );
}

function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(value)
    : "Chưa xác định";
}
