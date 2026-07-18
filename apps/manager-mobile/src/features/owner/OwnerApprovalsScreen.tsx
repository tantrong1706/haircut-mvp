import { CheckCircle2, ClipboardCheck, RefreshCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { type ConfirmDialogRequest } from "../../components/ConfirmDialog";
import { EmptyState, InlineFeedback } from "../../components/Feedback";
import { PhotoCapture, type ManagerPhoto } from "../../components/PhotoCapture";
import { ScreenHeader } from "../../components/ScreenPrimitives";
import {
  MAX_HAIRCUT_PHOTOS,
  approvePointRequest,
  deleteHaircutPhoto,
  formatDateTime,
  rejectPointRequest,
  updatePendingPointRequestPhotos,
  uploadHaircutPhoto,
  type PointRequest,
  type SalonBranch,
} from "../../services/managerApi";
import { trackEvent, withMonitoringTrace } from "../../services/monitoring";
import { ownerPhoneLabel } from "./ownerFormatters";

export function OwnerApprovalsScreen({
  salonId,
  requests,
  branches,
  branchFilter,
  onBranchFilterChange,
  onRequestsChange,
  onRefreshOverview,
  onConfirm,
}: {
  salonId: string;
  requests: PointRequest[];
  branches: SalonBranch[];
  branchFilter: string;
  onBranchFilterChange: (branchId: string) => void;
  onRequestsChange: (requests: PointRequest[]) => void;
  onRefreshOverview: () => void;
  onConfirm: (request: ConfirmDialogRequest) => void;
}) {
  const [expandedId, setExpandedId] = useState(requests[0]?.id || "");
  const [busyId, setBusyId] = useState("");
  const [photoBusyId, setPhotoBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function approve(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "owner_approve_point_request",
        () => approvePointRequest(request),
        { salon_id: salonId, points_added: request.pointsAdded },
      );
      onRequestsChange(requests.filter((item) => item.id !== request.id));
      onRefreshOverview();
      setMessage("Đã duyệt điểm và lưu lịch sử cắt tóc.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không duyệt được yêu cầu.");
    } finally {
      setBusyId("");
    }
  }

  async function reject(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "owner_reject_point_request",
        () => rejectPointRequest(request),
        { salon_id: salonId },
      );
      onRequestsChange(requests.filter((item) => item.id !== request.id));
      onRefreshOverview();
      setMessage("Đã từ chối yêu cầu.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không từ chối được yêu cầu.");
    } finally {
      setBusyId("");
    }
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
    setMessage("");
    setError("");
    const uploaded: Array<{ path: string; url: string }> = [];
    try {
      for (const file of files) {
        uploaded.push(
          await uploadHaircutPhoto({
            salonId,
            branchId: request.branchId,
            customerId: request.customerId,
            sessionId: request.sessionId,
            file,
          }),
        );
      }
      const photoUrls = [...request.photoUrls, ...uploaded.map((photo) => photo.url)];
      await updatePendingPointRequestPhotos({ salonId, requestId: request.id, photoUrls });
      onRequestsChange(
        requests.map((item) => (item.id === request.id ? { ...item, photoUrls } : item)),
      );
      setMessage(`Đã lưu ${uploaded.length} ảnh cho ${request.customer?.name || "khách"}.`);
    } catch (caught) {
      await Promise.allSettled(uploaded.map((photo) => deleteHaircutPhoto(photo.path)));
      setError(caught instanceof Error ? caught.message : "Không lưu được ảnh.");
    } finally {
      setPhotoBusyId("");
    }
  }

  async function removePhoto(request: PointRequest, photo: ManagerPhoto) {
    if (photoBusyId) return;
    setPhotoBusyId(request.id);
    setError("");
    setMessage("");
    const photoUrls = request.photoUrls.filter((url) => url !== photo.url);
    try {
      await updatePendingPointRequestPhotos({ salonId, requestId: request.id, photoUrls });
      onRequestsChange(
        requests.map((item) => (item.id === request.id ? { ...item, photoUrls } : item)),
      );
      try {
        await deleteHaircutPhoto(photo.url);
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
      {branches.length > 0 ? (
        <label className="manager-field compact">
          <span>Lọc theo chi nhánh</span>
          <select
            value={branchFilter}
            onChange={(event) => onBranchFilterChange(event.target.value)}
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
                      photos={request.photoUrls.map((url) => ({ id: url, url }))}
                      consentGranted={request.customer?.allowPhoto === true}
                      busy={photoBusyId === request.id}
                      disabled={Boolean(busyId) || Boolean(photoBusyId)}
                      disabledReason="Có thể chụp bổ sung trước khi duyệt."
                      maxPhotos={MAX_HAIRCUT_PHOTOS}
                      onFilesSelected={(files) => addPhotos(request, files)}
                      onRemove={(photo) => removePhoto(request, photo)}
                    />
                    <div className="manager-button-row">
                      <button
                        className="manager-button primary"
                        type="button"
                        disabled={busyId === request.id || photoBusyId === request.id}
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
                        disabled={busyId === request.id || photoBusyId === request.id}
                        onClick={() =>
                          onConfirm({
                            title: "Từ chối yêu cầu?",
                            description: `Điểm của ${
                              request.customer?.name || "khách hàng"
                            } sẽ không thay đổi.`,
                            confirmLabel: "Từ chối",
                            tone: "danger",
                            onConfirm: () => reject(request),
                          })
                        }
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
