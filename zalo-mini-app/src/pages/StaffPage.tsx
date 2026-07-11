import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClipboardPenLine,
  Clock3,
  Send,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import { BrandLogo } from "../components/BrandLogo";
import {
  StaffSession,
  claimServiceSession,
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

const quickNotes = ["Fade thấp", "Fade cao", "Cắt ngắn", "Tỉa mái", "Giữ form cũ", "Nhuộm / uốn"];

export function StaffPage({ currentUser }: Props) {
  const salonId = useMemo(() => {
    return currentUser.salonId.trim();
  }, [currentUser.salonId]);
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pointPerVisit, setPointPerVisit] = useState(1);
  const [salonName, setSalonName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSession = sessions.find((session) => session.id === selectedId) || sessions[0];
  const waitingCount = sessions.filter((session) => session.status === "waiting").length;
  const servingCount = sessions.filter((session) => session.status === "serving").length;
  const pendingApprovalCount = sessions.filter(
    (session) => session.status === "pending_approval",
  ).length;
  const isPendingApproval = selectedSession?.status === "pending_approval";
  const isAssignedToCurrentUser = selectedSession?.assignedStaffId === currentUser.uid;
  const canEditService = selectedSession?.status === "serving" && isAssignedToCurrentUser;
  const isAssignedToAnother =
    selectedSession?.status === "serving" &&
    Boolean(selectedSession.assignedStaffId) &&
    !isAssignedToCurrentUser;
  const canRedeemRewards = currentUser.role === "owner" || currentUser.canRedeemRewards === true;

  useEffect(() => {
    if (!salonId) {
      setLoaded(true);
      setError("Tài khoản chưa được gắn với salon.");
      return undefined;
    }

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
    if (!salonId) {
      return;
    }

    getSalonProfile(salonId)
      .then((profile) => {
        setPointPerVisit(Math.max(1, Math.floor(profile.pointPerVisit || 1)));
        setSalonName(profile.name.trim());
      })
      .catch(() => {
        setPointPerVisit(1);
        setSalonName("");
      });
  }, [salonId]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedId) {
        setSelectedId("");
      }
      return;
    }

    if (!selectedId || !sessions.some((session) => session.id === selectedId)) {
      setSelectedId(sessions[0].id);
    }
  }, [selectedId, sessions]);

  useEffect(() => {
    setNote("");
  }, [selectedId]);

  async function handleSubmit() {
    if (!selectedSession || !canEditService) {
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
        () =>
          submitPointRequest({
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
      setNote("");
      trackEvent("staff_point_request_submitted", {
        salon_id: salonId,
        points_requested: pointPerVisit,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id ? { ...session, status: "pending_approval" } : session,
        ),
      );
      setMessage(`Đã gửi yêu cầu cộng ${pointPerVisit} điểm.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!selectedSession || selectedSession.status !== "waiting") {
      return;
    }

    setClaimingId(selectedSession.id);
    setMessage("");
    setError("");

    try {
      const result = await withMonitoringTrace(
        "staff_claim_session",
        () => claimServiceSession({ salonId, session: selectedSession }),
        { salon_id: salonId },
      );
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id
            ? {
                ...session,
                status: result.status,
                assignedStaffId: result.assignedStaffId,
                assignedStaffName: result.assignedStaffName,
                claimedAtMs: Date.now(),
              }
            : session,
        ),
      );
      setMessage(
        result.status === "pending_approval"
          ? "Lượt này đã được gửi duyệt trước đó."
          : "Đã nhận khách. Bạn có thể ghi chú sau khi hoàn tất dịch vụ.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nhận được khách");
    } finally {
      setClaimingId("");
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
          <span>
            {currentUser.name || "Nhân viên"} · {salonName || "Salon của bạn"}
          </span>
        </div>
      </header>

      <div className="metrics-row compact-metrics">
        <Metric icon={<UsersRound size={20} />} label="Đang chờ" value={waitingCount} />
        <Metric icon={<UserRoundCheck size={20} />} label="Đang phục vụ" value={servingCount} />
        <Metric
          icon={<UserRoundCheck size={20} />}
          label="Chờ duyệt"
          value={pendingApprovalCount}
        />
        <Metric icon={<ClipboardPenLine size={20} />} label="Điểm/lượt" value={pointPerVisit} />
        {canRedeemRewards ? (
          <Metric icon={<TicketCheck size={20} />} label="Đổi quà" value="Bật" />
        ) : null}
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
                  session.status === "pending_approval" ? "pending-card" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedId(session.id)}
              >
                <div className="ops-card-row">
                  <span className="ops-card-title">{session.customer?.name || "Khách hàng"}</span>
                  <span className={statusPillClass(session.status)}>
                    {statusLabel(session.status)}
                  </span>
                </div>
                <span>{customerLine(session)}</span>
                <small>
                  {mirrorLabel(session.mirrorId, session.mirrorName)} ·{" "}
                  {formatDateTime(session.createdAtMs)}
                </small>
              </button>
            ))
          )}
        </div>

        {selectedSession ? (
          <div
            className={
              isPendingApproval ? "panel detail-panel pending-detail-panel" : "panel detail-panel"
            }
          >
            <div className="detail-heading">
              <div>
                <p className="eyebrow">
                  {mirrorLabel(selectedSession.mirrorId, selectedSession.mirrorName)}
                </p>
                <h2>{selectedSession.customer?.name || "Khách hàng"}</h2>
              </div>
              <span className="pill">{selectedSession.customer?.points ?? 0} điểm</span>
            </div>

            <div className="summary-grid compact-summary">
              <div className="summary-item">
                <span>SĐT</span>
                <strong>
                  {selectedSession.customer?.phoneLast4
                    ? `******${selectedSession.customer.phoneLast4}`
                    : "Chưa có"}
                </strong>
              </div>
              <div className="summary-item">
                <span>Trạng thái</span>
                <strong>{statusLabel(selectedSession.status)}</strong>
              </div>
            </div>

            <div
              className={isPendingApproval ? "service-state-card warning" : "service-state-card"}
            >
              <Clock3 size={20} aria-hidden="true" />
              <div>
                <strong>{detailStatusTitle(selectedSession, currentUser.uid)}</strong>
                <span>{detailStatusText(selectedSession, currentUser.uid)}</span>
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
                    disabled={!canEditService}
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
                disabled={!canEditService}
              />
            </label>

            {selectedSession.status === "waiting" ? (
              <button
                className="primary-button"
                disabled={claimingId === selectedSession.id}
                onClick={handleClaim}
              >
                <UserRoundCheck size={20} aria-hidden="true" />
                {claimingId === selectedSession.id ? "Đang nhận khách..." : "Nhận khách"}
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={loading || !canEditService || note.trim().length === 0}
                onClick={handleSubmit}
              >
                {isPendingApproval ? (
                  "Đang chờ chủ duyệt"
                ) : isAssignedToAnother ? (
                  `Đang do ${selectedSession.assignedStaffName || "nhân viên khác"} phục vụ`
                ) : loading ? (
                  "Đang gửi..."
                ) : (
                  <>
                    <Send size={20} aria-hidden="true" />
                    Gửi cộng {pointPerVisit} điểm
                  </>
                )}
              </button>
            )}
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

function mirrorLabel(mirrorId: string, mirrorName?: string) {
  if (mirrorName?.trim()) {
    return mirrorName.trim();
  }
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}

function statusLabel(status: StaffSession["status"]) {
  if (status === "pending_approval") {
    return "Chờ duyệt";
  }
  if (status === "serving") {
    return "Đang phục vụ";
  }
  if (status === "completed") {
    return "Đã xong";
  }
  if (status === "cancelled") {
    return "Đã hủy";
  }

  return "Đang chờ";
}

function statusPillClass(status: StaffSession["status"]) {
  if (status === "pending_approval") {
    return "session-status warning";
  }
  if (status === "serving") {
    return "session-status success";
  }
  if (status === "completed") {
    return "session-status success";
  }
  if (status === "cancelled") {
    return "session-status muted";
  }

  return "session-status";
}

function detailStatusTitle(session: StaffSession, currentUid: string) {
  if (session.status === "pending_approval") {
    return "Đã gửi yêu cầu điểm";
  }
  if (session.status === "serving") {
    return session.assignedStaffId === currentUid
      ? "Bạn đang phụ trách khách này"
      : `${session.assignedStaffName || "Nhân viên khác"} đang phục vụ`;
  }
  if (session.status === "completed") {
    return "Lượt cắt đã hoàn tất";
  }
  if (session.status === "cancelled") {
    return "Lượt cắt đã hủy";
  }

  return "Sẵn sàng ghi nhận lượt cắt";
}

function detailStatusText(session: StaffSession, currentUid: string) {
  if (session.status === "pending_approval") {
    return "Chờ chủ salon duyệt, không gửi lại để tránh cộng trùng điểm.";
  }
  if (session.status === "serving") {
    return session.assignedStaffId === currentUid
      ? "Hoàn tất dịch vụ, thêm ghi chú rồi gửi chủ salon duyệt điểm."
      : "Chỉ nhân viên đã nhận khách mới có thể gửi yêu cầu cộng điểm.";
  }
  if (session.status === "completed") {
    return "Điểm và lịch sử đã được cập nhật cho khách.";
  }
  if (session.status === "cancelled") {
    return "Khách cần tạo lượt mới nếu tiếp tục sử dụng dịch vụ.";
  }

  return "Nhấn Nhận khách trước khi bắt đầu phục vụ.";
}
