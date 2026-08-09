import { CalendarClock, CheckCircle2, ClipboardCheck, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type ConfirmDialogRequest } from "../../components/ConfirmDialog";
import { EmptyState, InlineFeedback } from "../../components/Feedback";
import { PhotoCapture, type ManagerPhoto } from "../../components/PhotoCapture";
import { ScreenHeader, Section } from "../../components/ScreenPrimitives";
import {
  MAX_HAIRCUT_PHOTOS,
  approvePointRequest,
  deleteHaircutPhoto,
  formatDateTime,
  getManagerPointRequestHistory,
  rejectPointRequest,
  updatePendingPointRequestPhotos,
  uploadHaircutPhoto,
  type PointRequest,
  type ManagerPointRequestHistoryItem,
  type SalonBranch,
} from "../../services/managerApi";
import { trackEvent, withMonitoringTrace } from "../../services/monitoring";
import { ownerPhoneLabel } from "./ownerFormatters";

const REJECTION_PRESETS = [
  "Số điểm chưa đúng",
  "Thiếu thông tin lượt cắt",
  "Yêu cầu bị gửi nhầm",
] as const;

function legacyPhotoUrlsFor(request: PointRequest): string[] {
  if (request.legacyPhotoUrls) return request.legacyPhotoUrls;
  const pathCount = request.photoPaths?.length ?? 0;
  return request.photoUrls.slice(0, Math.max(0, request.photoUrls.length - pathCount));
}

function photoItemsFor(request: PointRequest): ManagerPhoto[] {
  const legacyUrls = legacyPhotoUrlsFor(request);
  const pathUrls = request.photoUrls.slice(legacyUrls.length);
  return [
    ...legacyUrls.map((url) => ({ id: url, url })),
    ...(request.photoPaths ?? []).flatMap((path, index) => {
      const url = pathUrls[index];
      return url ? [{ id: path, url }] : [];
    }),
  ];
}

export function OwnerApprovalsScreen({
  salonId,
  requests,
  branches,
  branchFilter,
  onBranchFilterChange,
  onRequestsChange,
  onRefreshOverview,
  onConfirm,
  pointApprovalEnabled,
  photoUploadEnabled,
}: {
  salonId: string;
  requests: PointRequest[];
  branches: SalonBranch[];
  branchFilter: string;
  onBranchFilterChange: (branchId: string) => void;
  onRequestsChange: (requests: PointRequest[]) => void;
  onRefreshOverview: () => void;
  onConfirm: (request: ConfirmDialogRequest) => void;
  pointApprovalEnabled: boolean;
  photoUploadEnabled: boolean;
}) {
  const [expandedId, setExpandedId] = useState(requests[0]?.id || "");
  const [busyId, setBusyId] = useState("");
  const [photoBusyId, setPhotoBusyId] = useState("");
  const [photoProgress, setPhotoProgress] = useState(0);
  const photoAbortRef = useRef<AbortController | null>(null);
  const [rejectingId, setRejectingId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<ManagerPointRequestHistoryItem[]>([]);

  useEffect(() => () => photoAbortRef.current?.abort(), []);

  async function loadHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setError("");
    try {
      const result = await getManagerPointRequestHistory({
        salonId,
        branchId: branchFilter === "all" ? null : branchFilter,
        limit: 50,
      });
      setHistory(result.requests);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được lịch sử duyệt điểm.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function approve(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace("owner_approve_point_request", () => approvePointRequest(request), {
        salon_id: salonId,
        points_added: request.pointsAdded,
      });
      onRequestsChange(requests.filter((item) => item.id !== request.id));
      onRefreshOverview();
      setMessage("Đã duyệt điểm và lưu lịch sử cắt tóc.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không duyệt được yêu cầu.");
    } finally {
      setBusyId("");
    }
  }

  async function reject(request: PointRequest, reason: string) {
    setBusyId(request.id);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "owner_reject_point_request",
        () => rejectPointRequest(request, reason),
        { salon_id: salonId },
      );
      onRequestsChange(requests.filter((item) => item.id !== request.id));
      onRefreshOverview();
      setRejectingId("");
      setRejectionReason("");
      setRejectionError("");
      setMessage("Đã từ chối yêu cầu.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không từ chối được yêu cầu.");
    } finally {
      setBusyId("");
    }
  }

  function requestRejection(request: PointRequest) {
    const reason = rejectionReason.trim().replace(/\s+/g, " ");
    if (reason.length < 5) {
      setRejectionError("Nhập lý do từ chối có ít nhất 5 ký tự.");
      return;
    }
    if (reason.length > 200) {
      setRejectionError("Lý do từ chối không được quá 200 ký tự.");
      return;
    }
    setRejectionError("");
    onConfirm({
      title: "Từ chối yêu cầu?",
      description: `Điểm của ${
        request.customer?.name || "khách hàng"
      } sẽ không thay đổi. Lý do: ${reason}`,
      confirmLabel: "Xác nhận từ chối",
      tone: "danger",
      onConfirm: () => reject(request, reason),
    });
  }

  async function addPhotos(request: PointRequest, files: File[]) {
    if (photoBusyId || request.customer?.allowPhoto !== true || files.length === 0) return;
    const available = MAX_HAIRCUT_PHOTOS - request.photoUrls.length;
    if (available <= 0 || files.length > available) {
      setError(
        available <= 0
          ? `Mỗi lượt chỉ lưu tối đa ${MAX_HAIRCUT_PHOTOS} ảnh.`
          : `Bạn chỉ có thể thêm ${available} ảnh nữa.`,
      );
      return;
    }
    setPhotoBusyId(request.id);
    setPhotoProgress(0);
    setMessage("");
    setError("");
    const uploaded: Array<{ path: string; url: string }> = [];
    const abortController = new AbortController();
    photoAbortRef.current = abortController;
    try {
      for (const file of files) {
        uploaded.push(
          await uploadHaircutPhoto({
            salonId,
            branchId: request.branchId,
            customerId: request.customerId,
            sessionId: request.sessionId,
            file,
            signal: abortController.signal,
            onProgress: setPhotoProgress,
          }),
        );
      }
      const legacyPhotoUrls = legacyPhotoUrlsFor(request);
      const photoPaths = [...(request.photoPaths ?? []), ...uploaded.map((photo) => photo.path)];
      const photoUrls = [...request.photoUrls, ...uploaded.map((photo) => photo.url)];
      await updatePendingPointRequestPhotos({
        salonId,
        requestId: request.id,
        photoUrls: legacyPhotoUrls,
        photoPaths,
      });
      onRequestsChange(
        requests.map((item) =>
          item.id === request.id
            ? { ...item, photoUrls, legacyPhotoUrls, photoPaths }
            : item,
        ),
      );
      setMessage(`Đã lưu ${uploaded.length} ảnh cho ${request.customer?.name || "khách"}.`);
    } catch (caught) {
      await Promise.allSettled(uploaded.map((photo) => deleteHaircutPhoto(photo.path, salonId)));
      setError(caught instanceof Error ? caught.message : "Không lưu được ảnh.");
    } finally {
      if (photoAbortRef.current === abortController) photoAbortRef.current = null;
      setPhotoBusyId("");
      setPhotoProgress(0);
    }
  }

  async function removePhoto(request: PointRequest, photo: ManagerPhoto) {
    if (photoBusyId) return;
    setPhotoBusyId(request.id);
    setError("");
    setMessage("");
    const isStoredPath = (request.photoPaths ?? []).includes(photo.id);
    const legacyPhotoUrls = isStoredPath
      ? legacyPhotoUrlsFor(request)
      : legacyPhotoUrlsFor(request).filter((url) => url !== photo.id);
    const photoPaths = isStoredPath
      ? (request.photoPaths ?? []).filter((path) => path !== photo.id)
      : (request.photoPaths ?? []);
    const photoUrls = request.photoUrls.filter((url) => url !== photo.url);
    try {
      await updatePendingPointRequestPhotos({
        salonId,
        requestId: request.id,
        photoUrls: legacyPhotoUrls,
        photoPaths,
      });
      onRequestsChange(
        requests.map((item) =>
          item.id === request.id
            ? { ...item, photoUrls, legacyPhotoUrls, photoPaths }
            : item,
        ),
      );
      try {
        await deleteHaircutPhoto(photo.id, isStoredPath ? salonId : undefined);
      } catch {
        trackEvent("owner_haircut_photo_cleanup_deferred", { salon_id: salonId });
      }
      setMessage("Đã gỡ ảnh khỏi yêu cầu.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gỡ được ảnh.");
    } finally {
      setPhotoBusyId("");
    }
  }

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Cần xử lý"
        title={`Duyệt điểm (${requests.length})`}
        description="Kiểm tra đúng khách, nhân viên, ảnh và ghi chú trước khi duyệt."
      />
      {!pointApprovalEnabled ? (
        <InlineFeedback tone="warning">
          Tính năng duyệt điểm đang tạm ngừng. Danh sách vẫn được giữ để xử lý sau.
        </InlineFeedback>
      ) : null}
      {branches.length > 0 ? (
        <label className="manager-field compact">
          <span>Lọc theo chi nhánh</span>
          <select
            value={branchFilter}
            onChange={(event) => {
              onBranchFilterChange(event.target.value);
              setHistoryOpen(false);
              setHistory([]);
            }}
          >
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        className="manager-button secondary"
        type="button"
        disabled={historyLoading}
        onClick={() => (historyOpen ? setHistoryOpen(false) : void loadHistory())}
      >
        <CalendarClock aria-hidden="true" />
        {historyOpen ? "Ẩn lịch sử đã xử lý" : "Xem lịch sử đã xử lý"}
      </button>

      {historyOpen ? (
        <Section title={`Đã xử lý (${history.length})`}>
          {historyLoading ? (
            <p className="manager-field-note">Đang tải lịch sử duyệt điểm...</p>
          ) : history.length === 0 ? (
            <p className="manager-field-note">Chưa có yêu cầu đã xử lý.</p>
          ) : (
            <div className="manager-list">
              {history.map((item) => (
                <article className="manager-list-item" key={item.id}>
                  <span className="manager-action-icon">
                    {item.status === "approved" ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : (
                      <XCircle aria-hidden="true" />
                    )}
                  </span>
                  <div className="manager-list-main">
                    <strong>{item.customer?.name || "Khách hàng"}</strong>
                    <span>
                      {item.branchName || "Chi nhánh"} · {item.staffName || "Nhân viên"}
                    </span>
                    {item.rejectionReason ? <small>{item.rejectionReason}</small> : null}
                  </div>
                  <div className="manager-list-meta">
                    <strong>
                      {item.status === "approved" ? `+${item.pointsAdded} điểm` : "Từ chối"}
                    </strong>
                    <span>{formatDateTime(item.processedAtMs) || "Chưa rõ giờ"}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck aria-hidden="true" />}
          title="Đã xử lý hết yêu cầu"
          description="Yêu cầu mới từ nhân viên sẽ tự xuất hiện tại đây."
        />
      ) : (
        <div className="manager-list">
          {requests.map((request) => {
            const expanded = request.id === expandedId;
            return (
              <article className="manager-approval-card" key={request.id}>
                <button
                  className="manager-card-toggle"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? "" : request.id)}
                >
                  <span>
                    <strong>{request.customer?.name || "Khách hàng"}</strong>
                    <small>
                      {request.branchName || "Chi nhánh"} · {request.staffName || "Nhân viên"}
                    </small>
                  </span>
                  <span className="manager-pill warning">+{request.pointsAdded} điểm</span>
                </button>
                {expanded ? (
                  <div className="manager-card-detail">
                    <dl className="manager-summary-list">
                      <div>
                        <dt>Số điện thoại</dt>
                        <dd>{request.customer ? ownerPhoneLabel(request.customer) : "Chưa có"}</dd>
                      </div>
                      <div>
                        <dt>Gửi lúc</dt>
                        <dd>{formatDateTime(request.createdAtMs) || "Chưa rõ"}</dd>
                      </div>
                    </dl>
                    <div className="manager-note-box">
                      <strong>Ghi chú kiểu tóc</strong>
                      <p>{request.note || "Không có ghi chú."}</p>
                    </div>
                    <PhotoCapture
                      title="Ảnh sau cắt"
                      photos={photoItemsFor(request)}
                      consentGranted={request.customer?.allowPhoto === true}
                      busy={photoBusyId === request.id}
                      disabled={!photoUploadEnabled || Boolean(busyId) || Boolean(photoBusyId)}
                      disabledReason={
                        photoUploadEnabled
                          ? "Có thể chụp bổ sung trước khi duyệt."
                          : "Tính năng tải ảnh đang tạm ngừng."
                      }
                      maxPhotos={MAX_HAIRCUT_PHOTOS}
                      progress={photoBusyId === request.id ? photoProgress : undefined}
                      onCancelUpload={() => photoAbortRef.current?.abort()}
                      onFilesSelected={(files) => addPhotos(request, files)}
                      onRemove={(photo) => removePhoto(request, photo)}
                    />
                    {rejectingId === request.id ? (
                      <div className="manager-rejection-form">
                        <strong>Lý do từ chối</strong>
                        <div className="manager-quick-notes" aria-label="Lý do từ chối mẫu">
                          {REJECTION_PRESETS.map((reason) => (
                            <button
                              type="button"
                              key={reason}
                              aria-pressed={rejectionReason === reason}
                              onClick={() => {
                                setRejectionReason(reason);
                                setRejectionError("");
                              }}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                        <label className="manager-field">
                          <span>Lý do cụ thể</span>
                          <textarea
                            autoFocus
                            rows={3}
                            maxLength={200}
                            value={rejectionReason}
                            aria-invalid={Boolean(rejectionError)}
                            aria-describedby={
                              rejectionError ? `rejection-error-${request.id}` : undefined
                            }
                            onChange={(event) => {
                              setRejectionReason(event.target.value);
                              setRejectionError("");
                            }}
                            placeholder="Nhập lý do để nhân viên có thể kiểm tra lại"
                          />
                          <small>{rejectionReason.length}/200 ký tự</small>
                        </label>
                        {rejectionError ? (
                          <p
                            className="manager-field-error"
                            id={`rejection-error-${request.id}`}
                            role="alert"
                          >
                            {rejectionError}
                          </p>
                        ) : null}
                        <div className="manager-button-row">
                          <button
                            className="manager-button secondary"
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => {
                              setRejectingId("");
                              setRejectionReason("");
                              setRejectionError("");
                            }}
                          >
                            Quay lại
                          </button>
                          <button
                            className="manager-button danger"
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => requestRejection(request)}
                          >
                            <XCircle aria-hidden="true" />
                            Xác nhận lý do
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="manager-button-row">
                      <button
                        className="manager-button primary"
                        type="button"
                        disabled={
                          !pointApprovalEnabled ||
                          busyId === request.id ||
                          photoBusyId === request.id
                        }
                        onClick={() =>
                          onConfirm({
                            title: "Duyệt cộng điểm?",
                            description: `Cộng ${request.pointsAdded} điểm cho ${
                              request.customer?.name || "khách hàng"
                            } và lưu lịch sử cắt tóc.`,
                            confirmLabel: "Duyệt điểm",
                            onConfirm: () => approve(request),
                          })
                        }
                      >
                        <CheckCircle2 aria-hidden="true" />
                        {busyId === request.id ? "Đang duyệt..." : "Duyệt điểm"}
                      </button>
                      <button
                        className="manager-button secondary"
                        type="button"
                        disabled={
                          !pointApprovalEnabled ||
                          busyId === request.id ||
                          photoBusyId === request.id
                        }
                        onClick={() => {
                          setRejectingId(request.id);
                          setRejectionReason("");
                          setRejectionError("");
                        }}
                      >
                        <XCircle aria-hidden="true" />
                        Từ chối
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? (
        <InlineFeedback
          tone="error"
          action={
            <button type="button" onClick={() => setError("")}>
              <RefreshCcw aria-hidden="true" />
              Đóng
            </button>
          }
        >
          {error}
        </InlineFeedback>
      ) : null}
    </div>
  );
}
