import { useEffect, useMemo, useState } from "react";
import { ClipboardPenLine, Clock3, Send, UserRoundCheck, UsersRound } from "lucide-react";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import { BrandLogo } from "../components/BrandLogo";
import {
  StaffSession,
  formatDateTime,
  listenActiveSessions,
  submitPointRequest,
} from "../services/operations";
import { AppUser } from "../services/auth";

type Props = {
  currentUser: AppUser;
};

const quickNotes = [
  "Fade thấp",
  "Fade cao",
  "Cắt ngắn gọn",
  "Tỉa mái",
  "Giữ form cũ",
  "Nhuộm / uốn",
];

export function StaffPage({ currentUser }: Props) {
  const salonId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return currentUser.salonId || params.get("salonId") || "demo-salon";
  }, [currentUser.salonId]);
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [staffName, setStaffName] = useState(
    localStorage.getItem("haircut_staff_name") || currentUser.name || "",
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSession = sessions.find((session) => session.id === selectedId) || sessions[0];
  const waitingCount = sessions.filter((session) => session.status === "waiting").length;
  const pendingApprovalCount = sessions.filter((session) => session.status === "serving").length;
  const isPendingApproval = selectedSession?.status === "serving";
  const canRedeemRewards = currentUser.role === "owner" || currentUser.canRedeemRewards === true;

  useEffect(() => {
    return listenActiveSessions(
      salonId,
      (nextSessions) => {
        setSessions(nextSessions);
        setLoaded(true);
        setError("");
      },
      (message) => {
        setLoaded(true);
        setError(message);
      },
    );
  }, [salonId]);

  useEffect(() => {
    if (!selectedId && sessions.length > 0) {
      setSelectedId(sessions[0].id);
    }
  }, [selectedId, sessions]);

  async function handleSubmit() {
    if (!selectedSession) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      localStorage.setItem("haircut_staff_name", staffName);
      await submitPointRequest({
        salonId,
        session: selectedSession,
        staffName: staffName || "Nhân viên",
        note,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id ? { ...session, status: "serving" } : session,
        ),
      );
      setNote("");
      setMessage("Đã gửi yêu cầu. Khách này đang chờ chủ salon duyệt điểm.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  function addQuickNote(nextNote: string) {
    setNote((current) => {
      const trimmed = current.trim();
      if (!trimmed) {
        return nextNote;
      }
      if (trimmed.includes(nextNote)) {
        return current;
      }
      return `${trimmed}, ${nextNote}`;
    });
  }

  return (
    <section className="ops-page">
      <header className="page-header premium-hero ops-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">Ca làm việc</span>
        </div>
        <p className="eyebrow">Nhân viên</p>
        <h1>Khách đang chờ</h1>
        <p className="muted">Salon: {salonId}</p>
      </header>

      <div className="metrics-row">
        <div className="metric-card">
          <UsersRound size={20} aria-hidden="true" />
          <span>Đang chờ</span>
          <strong>{waitingCount}</strong>
        </div>
        <div className="metric-card">
          <UserRoundCheck size={20} aria-hidden="true" />
          <span>Chờ chủ duyệt</span>
          <strong>{pendingApprovalCount}</strong>
        </div>
      </div>

      <div className="flow-steps staff-flow">
        <div className="flow-step">
          <strong>1</strong>
          <span>Chọn khách</span>
          <small>Khách mới quét QR sẽ hiện trong danh sách.</small>
        </div>
        <div className="flow-step">
          <strong>2</strong>
          <span>Ghi chú kiểu tóc</span>
          <small>Dùng nút ghi chú nhanh để thao tác nhanh hơn.</small>
        </div>
        <div className="flow-step">
          <strong>3</strong>
          <span>Gửi cộng điểm</span>
          <small>Sau khi gửi, khách chuyển sang trạng thái chờ chủ duyệt.</small>
        </div>
      </div>

      <div className="ops-grid">
        <div className="panel form-panel">
          <label className="field">
            <span>Tên nhân viên</span>
            <input
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
              placeholder="Ví dụ: Nam"
            />
          </label>
        </div>

        <div className="ops-list">
          {!loaded ? (
            <div className="empty-state compact-empty">
              <Clock3 size={26} aria-hidden="true" />
              <strong>Đang tải khách</strong>
              <p>Danh sách sẽ tự cập nhật khi khách quét QR.</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="empty-state compact-empty">
              <UsersRound size={28} aria-hidden="true" />
              <strong>Chưa có khách quét QR</strong>
              <p>Khi khách quét mã tại gương, hồ sơ sẽ xuất hiện ở đây.</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={[
                  "ops-card",
                  selectedSession?.id === session.id ? "active" : "",
                  session.status === "serving" ? "pending-card" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedId(session.id)}
              >
                <span className="ops-card-title">{mirrorLabel(session.mirrorId)}</span>
                <span>{customerLine(session)}</span>
                <small>
                  {statusLabel(session.status)} · {formatDateTime(session.createdAtMs)}
                </small>
              </button>
            ))
          )}
        </div>

        {selectedSession ? (
          <div className="panel">
            <div className="detail-stack">
              <div>
                <p className="eyebrow">{mirrorLabel(selectedSession.mirrorId)}</p>
                <h2>{selectedSession.customer?.name || "Khách hàng"}</h2>
                <p className="muted">
                  SĐT:{" "}
                  {selectedSession.customer?.phoneLast4
                    ? `******${selectedSession.customer.phoneLast4}`
                    : "Chưa có"}
                </p>
                <p className="muted">Điểm: {selectedSession.customer?.points ?? 0}</p>
              </div>

              <label className="field">
                <span>
                  <ClipboardPenLine size={18} aria-hidden="true" />
                  Ghi chú kiểu tóc
                </span>
                <div className="quick-note-row" aria-label="Ghi chú nhanh">
                  {quickNotes.map((quickNote) => (
                    <button
                      key={quickNote}
                      type="button"
                      disabled={isPendingApproval}
                      onClick={() => addQuickNote(quickNote)}
                    >
                      {quickNote}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ví dụ: Fade thấp, để mái dài, không cắt quá cao"
                  disabled={isPendingApproval}
                />
              </label>

              {isPendingApproval ? (
                <div className="notice-banner">
                  <Clock3 size={20} aria-hidden="true" />
                  <span>Yêu cầu đã gửi. Vui lòng chờ chủ salon duyệt điểm.</span>
                </div>
              ) : null}

              <button
                className="primary-button"
                disabled={loading || isPendingApproval || note.trim().length === 0}
                onClick={handleSubmit}
              >
                {isPendingApproval ? (
                  "Đang chờ chủ duyệt"
                ) : loading ? (
                  "Đang gửi..."
                ) : (
                  <>
                    <Send size={20} aria-hidden="true" />
                    Gửi yêu cầu cộng 1 điểm
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {canRedeemRewards ? <RedeemRewardPanel salonId={salonId} /> : null}

        {message ? <p className="alert success">{message}</p> : null}
        {error ? <p className="alert error">{error}</p> : null}
      </div>
    </section>
  );
}

function customerLine(session: StaffSession) {
  const customer = session.customer;

  if (!customer) {
    return "Đang tải hồ sơ khách";
  }

  const phone = customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có SĐT";
  return `${customer.name} · ${phone} · ${customer.points} điểm`;
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương số 1";
  }

  return mirrorId || "Gương";
}

function statusLabel(status: StaffSession["status"]) {
  if (status === "serving") {
    return "Chờ chủ duyệt";
  }

  return "Đang chờ";
}
