import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClipboardPenLine,
  Clock3,
  Send,
  TicketCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { HaircutPhotoCapture } from "../components/HaircutPhotoCapture";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import { AccountDeletionPanel } from "../components/AccountDeletionPanel";
import { BrandLogo } from "../components/BrandLogo";
import {
  StaffSession,
  cancelServiceSession,
  claimServiceSession,
  formatDateTime,
  getBranchQrSettings,
  getSalonProfile,
  listenActiveSessions,
  submitPointRequest,
} from "../services/operations";
import { AppUser } from "../services/auth";
import {
  MAX_HAIRCUT_PHOTOS,
  UploadedHaircutPhoto,
  deleteHaircutPhoto,
  recoverHaircutPhotoUploads,
  uploadHaircutPhoto,
} from "../services/customerPhotos";
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
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [branchFilter, setBranchFilter] = useState(
    currentUser.role === "owner" ? "all" : currentUser.branchId || currentUser.branchIds?.[0] || "",
  );
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pointPerVisit, setPointPerVisit] = useState(1);
  const [salonName, setSalonName] = useState("");
  const [photosBySession, setPhotosBySession] = useState<Record<string, UploadedHaircutPhoto[]>>(
    {},
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const photoAbortRef = useRef<AbortController | null>(null);
  const recoveredPhotoSessionsRef = useRef(new Set<string>());
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
  const selectedPhotos = selectedSession ? (photosBySession[selectedSession.id] ?? []) : [];
  const customerAllowsPhoto = selectedSession?.customer?.allowPhoto === true;
  const hasRevokedPhotoConsent = selectedPhotos.length > 0 && !customerAllowsPhoto;
  const isAssignedToAnother =
    selectedSession?.status === "serving" &&
    Boolean(selectedSession.assignedStaffId) &&
    !isAssignedToCurrentUser;
  const photoDisabledReason = !canEditService
    ? selectedSession?.status === "waiting"
      ? "Nhận khách trước khi chụp ảnh."
      : selectedSession?.status === "pending_approval"
        ? "Ảnh đã được gửi sang chủ salon duyệt."
        : isAssignedToAnother
          ? `Lượt này đang do ${selectedSession?.assignedStaffName || "nhân viên khác"} phụ trách.`
          : "Chỉ người đang phụ trách lượt cắt mới được chụp ảnh."
    : "";
  const canRedeemRewards = currentUser.role === "owner" || currentUser.canRedeemRewards === true;
  const canAwardPointsDirectly =
    currentUser.role === "owner" || currentUser.canAwardPointsDirectly === true;
  const currentBranchName =
    branchFilter === "all"
      ? "Tất cả chi nhánh"
      : branches.find((branch) => branch.id === branchFilter)?.name || "Chi nhánh được phân công";

  useEffect(() => () => photoAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!salonId) {
      setLoaded(true);
      setError("Tài khoản chưa được gắn với salon.");
      return undefined;
    }

    const branchIds =
      currentUser.role === "owner"
        ? branchFilter === "all"
          ? null
          : [branchFilter]
        : branchFilter
          ? [branchFilter]
          : currentUser.branchIds || [];
    if (branchIds !== null && branchIds.length === 0) {
      setLoaded(true);
      setSessions([]);
      setError("Tài khoản chưa được phân công chi nhánh.");
      return undefined;
    }

    return listenActiveSessions(
      salonId,
      branchIds,
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
  }, [branchFilter, currentUser.branchIds, currentUser.role, salonId]);

  useEffect(() => {
    if (!salonId) {
      return;
    }
    getBranchQrSettings(salonId)
      .then((settings) => {
        const accessible = settings.branches.map(({ id, name }) => ({ id, name }));
        setBranches(accessible);
        if (currentUser.role === "staff" && accessible[0]) {
          setBranchFilter((current) => current || accessible[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được chi nhánh"));
  }, [currentUser.role, salonId]);

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

  useEffect(() => {
    const session = selectedSession;
    if (
      !session ||
      !canEditService ||
      !customerAllowsPhoto ||
      selectedPhotos.length > 0 ||
      recoveredPhotoSessionsRef.current.has(session.id)
    ) {
      return undefined;
    }
    recoveredPhotoSessionsRef.current.add(session.id);
    let active = true;
    recoverHaircutPhotoUploads({ salonId, sessionId: session.id })
      .then((photos) => {
        if (!active || photos.length === 0) return;
        setPhotosBySession((current) => ({ ...current, [session.id]: photos }));
      })
      .catch(() => {
        recoveredPhotoSessionsRef.current.delete(session.id);
      });
    return () => {
      active = false;
    };
  }, [canEditService, customerAllowsPhoto, salonId, selectedPhotos.length, selectedSession]);

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
      const result = await withMonitoringTrace(
        "staff_point_request",
        () =>
          submitPointRequest({
            salonId,
            session: selectedSession,
            note,
            photoUrls: [],
            photoPaths: selectedPhotos.map((photo) => photo.path),
            pointsRequested: pointPerVisit,
          }),
        {
          salon_id: salonId,
          session_status: selectedSession.status,
        },
      );
      setNote("");
      setPhotosBySession((current) => {
        const next = { ...current };
        delete next[selectedSession.id];
        return next;
      });
      trackEvent("staff_point_request_submitted", {
        salon_id: salonId,
        points_requested: pointPerVisit,
        approval_mode: result.approvalMode || "owner_approval",
      });
      if (result.status === "approved") {
        setSessions((current) => current.filter((session) => session.id !== selectedSession.id));
        setMessage(`Đã hoàn tất và cộng ${result.pointsAdded} điểm cho khách.`);
      } else {
        setSessions((current) =>
          current.map((session) =>
            session.id === selectedSession.id
              ? { ...session, status: "pending_approval" }
              : session,
          ),
        );
        setMessage(`Đã hoàn tất. Chủ salon sẽ duyệt ${result.pointsAdded} điểm.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoFiles(files: File[]) {
    const session = selectedSession;
    if (!session || !canEditService || !customerAllowsPhoto || photoBusy) {
      return;
    }

    const availableSlots = MAX_HAIRCUT_PHOTOS - selectedPhotos.length;
    if (availableSlots <= 0) {
      setError(`Mỗi lượt chỉ lưu tối đa ${MAX_HAIRCUT_PHOTOS} ảnh.`);
      return;
    }
    if (files.length > availableSlots) {
      setError(`Bạn chỉ có thể thêm ${availableSlots} ảnh nữa cho lượt này.`);
      return;
    }

    setPhotoBusy(true);
    setPhotoProgress(0);
    const abortController = new AbortController();
    photoAbortRef.current = abortController;
    setMessage("");
    setError("");
    let uploadedCount = 0;

    try {
      for (const file of files) {
        const uploadedPhoto = await withMonitoringTrace(
          "staff_upload_haircut_photo",
          () =>
            uploadHaircutPhoto({
              salonId,
              branchId: session.branchId,
              customerId: session.customerId,
              sessionId: session.id,
              file,
              signal: abortController.signal,
              onProgress: (progress) =>
                setPhotoProgress(Math.round((uploadedCount * 100 + progress) / files.length)),
            }),
          {
            salon_id: salonId,
            file_size: file.size,
            file_type: file.type,
          },
        );

        setPhotosBySession((current) => ({
          ...current,
          [session.id]: [...(current[session.id] ?? []), uploadedPhoto],
        }));
        uploadedCount += 1;
      }

      trackEvent("staff_haircut_photos_uploaded", {
        salon_id: salonId,
        photo_count: uploadedCount,
      });
      setMessage(`Đã thêm ${uploadedCount} ảnh kiểu tóc.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessage("Đã hủy tải ảnh.");
      } else {
        setError(err instanceof Error ? err.message : "Không tải được ảnh kiểu tóc");
      }
    } finally {
      photoAbortRef.current = null;
      setPhotoBusy(false);
      setPhotoProgress(0);
    }
  }

  async function removePhoto(photo: UploadedHaircutPhoto) {
    const sessionId = selectedSession?.id;
    if (!sessionId || photoBusy) {
      return;
    }

    setPhotoBusy(true);
    setMessage("");
    setError("");

    try {
      await deleteHaircutPhoto(photo.path, salonId);
      setPhotosBySession((current) => ({
        ...current,
        [sessionId]: (current[sessionId] ?? []).filter((item) => item.id !== photo.id),
      }));
      setMessage("Đã xóa ảnh kiểu tóc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được ảnh kiểu tóc");
    } finally {
      setPhotoBusy(false);
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

  async function handleCancel(reason: "cancelled" | "no_show") {
    if (!selectedSession || cancellingId) {
      return;
    }
    const prompt =
      reason === "no_show"
        ? "Xác nhận khách không đến và đóng lượt này?"
        : "Xác nhận hủy lượt đang phục vụ?";
    if (!window.confirm(prompt)) {
      return;
    }

    setCancellingId(selectedSession.id);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "staff_cancel_session",
        () => cancelServiceSession({ salonId, session: selectedSession, reason }),
        { salon_id: salonId, branch_id: selectedSession.branchId, cancellation_reason: reason },
      );
      setSessions((current) => current.filter((session) => session.id !== selectedSession.id));
      setPhotosBySession((current) => {
        const next = { ...current };
        delete next[selectedSession.id];
        return next;
      });
      setMessage(reason === "no_show" ? "Đã đóng lượt khách không đến." : "Đã hủy lượt cắt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hủy được lượt cắt");
    } finally {
      setCancellingId("");
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
            {currentUser.name || "Nhân viên"} · {salonName || "Salon của bạn"} · {currentBranchName}
          </span>
        </div>
      </header>

      {branches.length > 0 ? (
        <label className="field compact-field">
          <span>Chi nhánh hiện tại</span>
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            {currentUser.role === "owner" ? <option value="all">Tất cả chi nhánh</option> : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="metrics-row compact-metrics">
        <Metric icon={<UsersRound size={20} />} label="Đang chờ" value={waitingCount} />
        <Metric icon={<UserRoundCheck size={20} />} label="Đang phục vụ" value={servingCount} />
        <Metric
          icon={<UserRoundCheck size={20} />}
          label="Chờ duyệt"
          value={pendingApprovalCount}
        />
        <Metric icon={<ClipboardPenLine size={20} />} label="Điểm/lượt" value={pointPerVisit} />
        <Metric
          icon={<UserRoundCheck size={20} />}
          label="Cộng điểm"
          value={canAwardPointsDirectly ? "Trực tiếp" : "Chờ duyệt"}
        />
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
                  {session.branchName || "Chi nhánh"} · {formatDateTime(session.createdAtMs)}
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
                <p className="eyebrow">{selectedSession.branchName || "Chi nhánh"}</p>
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

            <HaircutPhotoCapture
              photos={selectedPhotos}
              consentGranted={customerAllowsPhoto}
              busy={photoBusy}
              progress={photoProgress}
              onCancelUpload={() => photoAbortRef.current?.abort()}
              disabled={!canEditService}
              disabledReason={
                hasRevokedPhotoConsent
                  ? "Khách đã rút quyền lưu ảnh. Hãy xóa ảnh trước khi gửi duyệt."
                  : photoDisabledReason
              }
              maxPhotos={MAX_HAIRCUT_PHOTOS}
              onFilesSelected={handlePhotoFiles}
              onRemove={removePhoto}
            />

            <label className="field">
              <span>
                <ClipboardPenLine size={18} aria-hidden="true" />
                Ghi chú kiểu tóc (không bắt buộc)
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
              <div className="button-row wrap-row">
                <button
                  className="primary-button"
                  disabled={
                    claimingId === selectedSession.id || cancellingId === selectedSession.id
                  }
                  onClick={handleClaim}
                >
                  <UserRoundCheck size={20} aria-hidden="true" />
                  {claimingId === selectedSession.id ? "Đang nhận khách..." : "Nhận khách"}
                </button>
                <button
                  className="secondary-button"
                  disabled={cancellingId === selectedSession.id}
                  onClick={() => void handleCancel("no_show")}
                >
                  <XCircle size={19} aria-hidden="true" />
                  {cancellingId === selectedSession.id ? "Đang đóng lượt..." : "Khách không đến"}
                </button>
              </div>
            ) : (
              <div className="button-row wrap-row">
                <button
                  className="primary-button"
                  disabled={
                    loading ||
                    photoBusy ||
                    hasRevokedPhotoConsent ||
                    !canEditService
                  }
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
                      {canAwardPointsDirectly
                        ? `Hoàn tất và cộng ngay ${pointPerVisit} điểm`
                        : `Hoàn tất và gửi duyệt ${pointPerVisit} điểm`}
                    </>
                  )}
                </button>
                {canEditService ? (
                  <button
                    className="secondary-button"
                    disabled={cancellingId === selectedSession.id || loading || photoBusy}
                    onClick={() => void handleCancel("cancelled")}
                  >
                    <XCircle size={19} aria-hidden="true" />
                    {cancellingId === selectedSession.id ? "Đang hủy..." : "Hủy lượt"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {canRedeemRewards ? (
          <RedeemRewardPanel
            salonId={salonId}
            branchId={branchFilter === "all" ? undefined : branchFilter}
          />
        ) : null}

        <AccountDeletionPanel currentUser={currentUser} />

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
