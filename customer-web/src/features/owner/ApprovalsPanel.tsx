import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import {
  HaircutPhotoCapture,
  type HaircutPhotoItem,
  type PhotoSelectionResult,
} from "../../components/HaircutPhotoCapture";
import { MAX_HAIRCUT_PHOTOS } from "../../services/customerPhotos";
import { formatDateTime, type PointRequest } from "../../services/operations";
import { photoItemsFor } from "../../services/pointRequestPhotos";
import { ownerPhoneLabel } from "./ownerFormatters";
export function ApprovalsPanel({
  requests,
  noteDrafts,
  onNoteChange,
  onSaveNote,
  busyId,
  photoBusyId,
  photoProgress,
  onApprove,
  onReject,
  onAddPhotos,
  onRemovePhoto,
  onCancelPhotoUpload,
}: {
  requests: PointRequest[];
  noteDrafts: Record<string, string>;
  onNoteChange: (requestId: string, note: string) => void;
  onSaveNote: (request: PointRequest) => Promise<boolean>;
  busyId: string;
  photoBusyId: string;
  photoProgress: number;
  onApprove: (request: PointRequest) => void;
  onReject: (request: PointRequest) => void;
  onAddPhotos: (
    request: PointRequest,
    files: File[],
  ) => PhotoSelectionResult | Promise<PhotoSelectionResult>;
  onRemovePhoto: (request: PointRequest, photo: HaircutPhotoItem) => void | Promise<void>;
  onCancelPhotoUpload: () => void;
}) {
  return (
    <div className="ops-list">
      {requests.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={30} aria-hidden="true" />
          <strong>Chưa có yêu cầu cộng điểm</strong>
          <p>Khi nhân viên gửi yêu cầu, chủ salon có thể bổ sung ảnh rồi duyệt tại đây.</p>
        </div>
      ) : (
        requests.map((request) => (
          <article className="ops-card static-card approval-card" key={request.id}>
            <span className="ops-card-title">{request.customer?.name || "Khách hàng"}</span>
            <span>SĐT: {request.customer ? ownerPhoneLabel(request.customer) : "Chưa có"}</span>
            <span>Thợ: {request.staffName || "Nhân viên"}</span>
            <span>Chi nhánh: {request.branchName || "Chi nhánh"}</span>
            <label className="field">
              <span>Ghi chú kiểu tóc (không bắt buộc)</span>
              <textarea
                value={noteDrafts[request.id] ?? request.note}
                maxLength={1000}
                disabled={Boolean(busyId) || Boolean(photoBusyId)}
                onChange={(event) => onNoteChange(request.id, event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              disabled={
                Boolean(busyId) ||
                Boolean(photoBusyId) ||
                noteDrafts[request.id] === undefined ||
                noteDrafts[request.id] === request.note
              }
              onClick={() => void onSaveNote(request)}
            >
              Lưu ghi chú
            </button>
            {request.photoReadError ? (
              <p role="status">
                Ảnh tạm thời chưa tải được. Các ảnh đã lưu vẫn được giữ; hãy làm mới trang để thử
                lại.
              </p>
            ) : null}
            <HaircutPhotoCapture
              title="Ảnh khách sau cắt"
              photos={photoItemsFor(request)}
              consentGranted={request.customer?.allowPhoto === true}
              busy={photoBusyId === request.id}
              disabled={busyId === request.id || Boolean(photoBusyId)}
              disabledReason="Chụp hoặc chọn ảnh trước khi duyệt điểm."
              captureLabel={`Chụp ảnh kiểu tóc cho ${request.customer?.name || "khách hàng"}`}
              galleryLabel={`Chọn ảnh kiểu tóc cho ${request.customer?.name || "khách hàng"}`}
              maxPhotos={MAX_HAIRCUT_PHOTOS}
              progress={photoBusyId === request.id ? photoProgress : undefined}
              onCancelUpload={onCancelPhotoUpload}
              onFilesSelected={(files) => onAddPhotos(request, files)}
              onRemove={(photo) => onRemovePhoto(request, photo)}
            />
            <small>
              +{request.pointsAdded} điểm · {formatDateTime(request.createdAtMs)}
            </small>

            <div className="button-row">
              <button
                className="primary-button compact"
                disabled={busyId === request.id || photoBusyId === request.id}
                onClick={() => onApprove(request)}
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                Duyệt
              </button>
              <button
                className="secondary-button"
                disabled={busyId === request.id || photoBusyId === request.id}
                onClick={() => onReject(request)}
              >
                <XCircle size={18} aria-hidden="true" />
                Từ chối
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
