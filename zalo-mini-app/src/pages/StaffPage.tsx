import { useEffect, useMemo, useState } from "react";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSession = sessions.find((session) => session.id === selectedId) || sessions[0];

  useEffect(() => {
    return listenActiveSessions(
      salonId,
      (nextSessions) => {
        setSessions(nextSessions);
        setError("");
      },
      setError,
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
      setNote("");
      setMessage("Đã gửi yêu cầu cộng 1 điểm cho chủ salon duyệt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ops-page">
      <header className="page-header">
        <p className="eyebrow">Nhân viên</p>
        <h1>Khách đang chờ</h1>
        <p className="muted">Salon: {salonId}</p>
      </header>

      <div className="ops-grid">
        <div className="panel">
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
          {sessions.length === 0 ? (
            <p className="empty">Chưa có khách quét QR.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={selectedSession?.id === session.id ? "ops-card active" : "ops-card"}
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
                <span>Ghi chú kiểu tóc</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ví dụ: Fade thấp, để mái dài, không cắt quá cao"
                />
              </label>

              <button
                className="primary-button"
                disabled={loading || note.trim().length === 0}
                onClick={handleSubmit}
              >
                {loading ? "Đang gửi..." : "Gửi yêu cầu cộng 1 điểm"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
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
    return "Đang phục vụ";
  }

  return "Đang chờ";
}
