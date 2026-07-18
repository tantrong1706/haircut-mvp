import {
  ClipboardPenLine,
  Send,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog, type ConfirmDialogRequest } from "../../components/ConfirmDialog";
import { InlineFeedback } from "../../components/Feedback";
import { PhotoCapture } from "../../components/PhotoCapture";
import { DetailHeader, Section } from "../../components/ScreenPrimitives";
import {
  MAX_HAIRCUT_PHOTOS,
  cancelServiceSession,
  claimServiceSession,
  deleteHaircutPhoto,
  submitPointRequest,
  uploadHaircutPhoto,
  type AppUser,
  type StaffSession,
  type UploadedHaircutPhoto,
} from "../../services/managerApi";
import { trackEvent, withMonitoringTrace } from "../../services/monitoring";
import { maskedPhone, sessionStatusText, staffStatusLabel } from "./staffFormatters";

const QUICK_NOTES = ["Fade thấp", "Fade cao", "Cắt ngắn", "Tỉa mái", "Giữ form cũ", "Nhuộm / uốn"];

export function StaffSessionDetail({
  user,
  session,
  pointPerVisit,
  photos,
  note,
  onBack,
  onSessionChange,
  onSessionRemove,
  onPhotosChange,
  onNoteChange,
  photoUploadEnabled,
  pointApprovalEnabled,
}: {
  user: AppUser;
  session: StaffSession;
  pointPerVisit: number;
  photos: UploadedHaircutPhoto[];
  note: string;
  onBack: () => void;
  onSessionChange: (session: StaffSession) => void;
  onSessionRemove: (sessionId: string) => void;
  onPhotosChange: (photos: UploadedHaircutPhoto[]) => void;
  onNoteChange: (note: string) => void;
  photoUploadEnabled: boolean;
  pointApprovalEnabled: boolean;
}) {
  const [busy, setBusy] = useState<"claim" | "submit" | "cancel" | "photo" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmDialogRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const assignedToMe = session.assignedStaffId === user.uid;
  const canEdit = session.status === "serving" && assignedToMe;
  const consent = session.customer?.allowPhoto === true;
  const revokedWithPhotos = photos.length > 0 && !consent;

  async function claim() {
    setBusy("claim");
    setMessage("");
    setError("");
    try {
      const result = await withMonitoringTrace(
        "staff_claim_session",
        () => claimServiceSession({ salonId: user.salonId, session }),
        { salon_id: user.salonId, branch_id: session.branchId },
      );
      onSessionChange({
        ...session,
        status: result.status,
        assignedStaffId: result.assignedStaffId,
        assignedStaffName: result.assignedStaffName,
        claimedAtMs: Date.now(),
      });
      setMessage(
        result.status === "pending_approval"
          ? "Lượt đã được gửi duyệt trước đó."
          : "Đã nhận khách. Mở tab Đang làm để hoàn tất dịch vụ.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không nhận được khách.");
    } finally {
      setBusy("");
    }
  }

  async function cancel(reason: "cancelled" | "no_show") {
    setBusy("cancel");
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "staff_cancel_session",
        () => cancelServiceSession({ salonId: user.salonId, session, reason }),
        {
          salon_id: user.salonId,
          branch_id: session.branchId,
          cancellation_reason: reason,
        },
      );
      onSessionRemove(session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đóng được lượt.");
    } finally {
      setBusy("");
      setConfirm(null);
    }
  }

  async function submit() {
    if (!canEdit) return;
    setBusy("submit");
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "staff_point_request",
        () =>
          submitPointRequest({
            salonId: user.salonId,
            session,
            note,
            photoUrls: photos.map((photo) => photo.url),
            pointsRequested: pointPerVisit,
          }),
        { salon_id: user.salonId, branch_id: session.branchId },
      );
      onSessionChange({ ...session, status: "pending_approval" });
      onNoteChange("");
      onPhotosChange([]);
      setMessage(`Đã gửi yêu cầu cộng ${pointPerVisit} điểm.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được yêu cầu điểm.");
    } finally {
      setBusy("");
    }
  }

  async function addPhotos(files: File[]) {
    if (!photoUploadEnabled || !canEdit || !consent || busy) return;
    const available = MAX_HAIRCUT_PHOTOS - photos.length;
    if (available <= 0 || files.length > available) {
      setError(available <= 0 ? "Lượt này đã đủ 3 ảnh." : `Bạn chỉ có thể thêm ${available} ảnh.`);
      return;
    }
    setBusy("photo");
    setError("");
    setMessage("");
    const next = [...photos];
    try {
      for (const file of files) {
        next.push(
          await uploadHaircutPhoto({
            salonId: user.salonId,
            branchId: session.branchId,
            customerId: session.customerId,
            sessionId: session.id,
            file,
          }),
        );
      }
      onPhotosChange(next);
      setMessage(`Đã thêm ${files.length} ảnh kiểu tóc.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được ảnh.");
    } finally {
      setBusy("");
    }
  }

  async function removePhoto(photo: UploadedHaircutPhoto) {
    if (busy) return;
    setBusy("photo");
    setError("");
    try {
      await deleteHaircutPhoto(photo.path);
      onPhotosChange(photos.filter((item) => item.id !== photo.id));
      setMessage("Đã xóa ảnh.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được ảnh.");
    } finally {
      setBusy("");
    }
  }

  function addQuickNote(value: string) {
    const current = note.trim();
    if (!current) onNoteChange(value);
    else if (!current.includes(value)) onNoteChange(`${current}, ${value}`);
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="manager-screen">
      <DetailHeader
        title={session.customer?.name || "Khách hàng"}
        description={`${session.branchName || "Chi nhánh"} · ${staffStatusLabel(session.status)}`}
        onBack={onBack}
      />
      <Section>
        <div className="manager-card-heading">
          <div>
            <strong>{maskedPhone(session)}</strong>
            <span>{session.customer?.points ?? 0} điểm hiện có</span>
          </div>
          <span className={`manager-pill ${session.status}`}>{staffStatusLabel(session.status)}</span>
        </div>
        <div className="manager-calm-status">
          <UserRoundCheck aria-hidden="true" />
          <div>
            <strong>{sessionStatusText(session, user.uid)}</strong>
            {session.assignedStaffName ? <span>Phụ trách: {session.assignedStaffName}</span> : null}
          </div>
        </div>
      </Section>

      {session.status === "waiting" ? (
        <Section title="Bắt đầu phục vụ">
          <button
            className="manager-button primary wide"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void claim()}
          >
            <UserRoundCheck aria-hidden="true" />
            {busy === "claim" ? "Đang nhận khách..." : "Nhận khách"}
          </button>
          <button
            className="manager-button secondary wide"
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              setConfirm({
                title: "Khách không đến?",
                description: "Lượt chờ này sẽ được đóng và biến mất khỏi hàng chờ.",
                confirmLabel: "Đóng lượt",
                tone: "danger",
                onConfirm: () => cancel("no_show"),
              })
            }
          >
            <XCircle aria-hidden="true" />
            Khách không đến
          </button>
        </Section>
      ) : session.status === "serving" ? (
        <>
          <PhotoCapture
            photos={photos}
            consentGranted={consent}
            busy={busy === "photo"}
            disabled={!photoUploadEnabled || !canEdit}
            disabledReason={
              !photoUploadEnabled
                ? "Tính năng tải ảnh đang tạm ngừng."
                : assignedToMe
                ? "Có thể thêm ảnh trước khi gửi duyệt."
                : `Lượt đang do ${session.assignedStaffName || "nhân viên khác"} phụ trách.`
            }
            maxPhotos={MAX_HAIRCUT_PHOTOS}
            onFilesSelected={addPhotos}
            onRemove={removePhoto}
          />
          <Section title="Ghi chú kiểu tóc">
            <div className="manager-quick-notes" aria-label="Ghi chú nhanh">
              {QUICK_NOTES.map((quickNote) => (
                <button
                  key={quickNote}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => addQuickNote(quickNote)}
                >
                  {quickNote}
                </button>
              ))}
            </div>
            <label className="manager-field">
              <span>
                <ClipboardPenLine aria-hidden="true" />
                Ghi chú sau cắt
              </span>
              <textarea
                value={note}
                disabled={!canEdit}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="Ví dụ: Fade thấp, giữ mái, không cắt quá cao"
              />
            </label>
            {revokedWithPhotos ? (
              <InlineFeedback tone="warning">
                Khách đã rút đồng ý lưu ảnh. Hãy xóa ảnh trước khi gửi.
              </InlineFeedback>
            ) : null}
            <button
              className="manager-button primary wide"
              type="button"
              disabled={
                Boolean(busy) ||
                !pointApprovalEnabled ||
                !canEdit ||
                !note.trim() ||
                revokedWithPhotos
              }
              onClick={() => void submit()}
            >
              <Send aria-hidden="true" />
              {busy === "submit" ? "Đang gửi..." : `Gửi cộng ${pointPerVisit} điểm`}
            </button>
            {!pointApprovalEnabled ? (
              <InlineFeedback tone="warning">
                Tính năng gửi và duyệt điểm đang tạm ngừng.
              </InlineFeedback>
            ) : null}
            {canEdit ? (
              <button
                className="manager-button secondary wide"
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  setConfirm({
                    title: "Hủy lượt đang phục vụ?",
                    description: "Lượt sẽ đóng mà không tạo yêu cầu cộng điểm.",
                    confirmLabel: "Hủy lượt",
                    tone: "danger",
                    onConfirm: () => cancel("cancelled"),
                  })
                }
              >
                <XCircle aria-hidden="true" />
                Hủy lượt
              </button>
            ) : null}
          </Section>
        </>
      ) : null}

      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      <ConfirmDialog
        request={confirm}
        busy={confirming}
        onCancel={() => {
          if (!confirming) setConfirm(null);
        }}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}
