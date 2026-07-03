import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClipboardPenLine, Clock3, Send, TicketCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import { BrandLogo } from "../components/BrandLogo";
import {
  StaffSession,
  formatDateTime,
  getSalonProfile,
  listenActiveSessions,
  submitPointRequest,
} from "../services/operations";
import { AppUser } from "../services/auth";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";

type Props = {
  currentUser: AppUser;
};

const quickNotes = [
  "Fade thấp",
  "Fade cao",
  "Cắt ngắn",
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
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pointPerVisit, setPointPerVisit] = useState(1);
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
    getSalonProfile(salonId)
      .then((profile) => setPointPerVisit(Math.max(1, Math.floor(profile.pointPerVisit || 1))))
      .catch(() => setPointPerVisit(1));
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
    trackEvent("staff_point_request_started", {
      salon_id: salonId,
      session_status: selectedSession.status,
      points_requested: pointPerVisit,
    });

    try {
      await withMonitoringTrace(
        "staff_point_request",
        () => submitPointRequest({
          salonId,
          session: selectedSession,
          note,
          pointsRequested: pointPerVisit,
        }),
        {
          salon_id: salonId,
          session_status: selectedSession.status,
        },
      );
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id ? { ...session, status: "serving" } : session,
        ),
      );
      setNote("");
      trackEvent("staff_point_request_submitted", {
        salon_id: salonId,
        points_requested: pointPerVisit,
      });
      setMessage(`Đã gửi yêu cầu cộng ${pointPerVisit} điểm.`);
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
    <section className="ops-page compact-ops-page">
      <header className="ops-topbar">
        <BrandLogo />
        <div>
          <p className="eyebrow">Nhân viên</p>
          <h1>Khách đang chờ</h1>
          <span>{currentUser.name || "Nhân viên"} · {salonId}</span>
        </div>
      </header>

      <div className="metrics-row compact-metrics">
        <Metric icon={<UsersRound size={20} />} label="Đang chờ" value={waitingCount} />
        <Metric icon={<UserRoundCheck size={20} />} label="Chờ duyệt" value={pendingApprovalCount} />
        <Metric icon={<ClipboardPenLine size={20} />} label="Điểm/lượt" value={pointPerVisit} />
        {canRedeemRewards ? <Metric icon={<TicketCheck size={20} />} label="Đổi quà" value="Bật" /> : null}
      </div>

      <div className="ops-grid staff-workspace">
        <div className="ops-list">
          {!loaded ? (
            <div className="empty-state compact-empty">
              <Clock3 size={26} aria-hidden="true" />
              <strong>Đang tải khách</strong>
            </div>
          ) : sessions.length === 0 ? (
            <div className="empty-state compact-empty">
              <UsersRound size={28} aria-hidden="true" />
              <strong>Chưa có khách</strong>
              <p>Khách quét QR sẽ hiện tại đây.</p>
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
                <span className="ops-card-title">{session.customer?.name || "Khách hàng"}</span>
                <span>{customerLine(session)}</span>
                <small>{statusLabel(session.status)} · {mirrorLabel(session.mirrorId)} · {formatDateTime(session.createdAtMs)}</small>
              </button>
            ))
          )}
        </div>

        {selectedSession ? (
          <div className="panel detail-panel">
            <div className="detail-heading">
              <div>
                <p className="eyebrow">{mirrorLabel(selectedSession.mirrorId)}</p>
                <h2>{selectedSession.customer?.name || "Khách hàng"}</h2>
              </div>
              <span className="pill">{selectedSession.customer?.points ?? 0} điểm</span>
            </div>

            <div className="summary-grid compact-summary">
              <div className="summary-item">
                <span>SĐT</span>
                <strong>{selectedSession.customer?.phoneLast4 ? `******${selectedSession.customer.phoneLast4}` : "Chưa có"}</strong>
              </div>
              <div className="summary-item">
                <span>Trạng thái</span>
                <strong>{statusLabel(selectedSession.status)}</strong>
              </div>
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
                placeholder="Ví dụ: Fade thấp, giữ mái, không cắt quá cao"
                disabled={isPendingApproval}
              />
            </label>

            {isPendingApproval ? (
              <div className="notice-banner compact-notice">
                <Clock3 size={20} aria-hidden="true" />
                <span>Đang chờ chủ salon duyệt.</span>
              </div>
            ) : null}

            <button
              className="primary-button"
              disabled={loading || isPendingApproval || note.trim().length === 0}
              onClick={handleSubmit}
            >
              {isPendingApproval ? (
                "Đang chờ duyệt"
              ) : loading ? (
                "Đang gửi..."
              ) : (
                <>
                  <Send size={20} aria-hidden="true" />
                  Gửi cộng {pointPerVisit} điểm
                </>
              )}
            </button>
          </div>
        ) : null}

        {canRedeemRewards ? <RedeemRewardPanel salonId={salonId} /> : null}

        {message ? <p className="alert success">{message}</p> : null}
        {error ? <p className="alert error">{error}</p> : null}
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function customerLine(session: StaffSession) {
  const customer = session.customer;

  if (!customer) {
    return "Đang tải hồ sơ";
  }

  const phone = customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có SĐT";
  return `${phone} · ${customer.points} điểm`;
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}

function statusLabel(status: StaffSession["status"]) {
  if (status === "serving") {
    return "Chờ duyệt";
  }
  if (status === "completed") {
    return "Đã xong";
  }
  if (status === "cancelled") {
    return "Đã hủy";
  }

  return "Đang chờ";
}
