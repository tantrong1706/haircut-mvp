import { Camera, ImagePlus, LoaderCircle, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  cameraPermissionMessage,
  inspectCameraPermission,
  type CameraPermissionState,
} from "../services/managerApi";

export type ManagerPhoto = { id: string; url: string };
type DraftPhoto = { file: File; url: string };

export function PhotoCapture<TPhoto extends ManagerPhoto>({
  title = "Ảnh kiểu tóc sau cắt",
  photos,
  consentGranted,
  busy = false,
  disabled = false,
  disabledReason = "",
  maxPhotos = 3,
  progress,
  onCancelUpload,
  onFilesSelected,
  onRemove,
}: {
  title?: string;
  photos: TPhoto[];
  consentGranted: boolean;
  busy?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  maxPhotos?: number;
  progress?: number;
  onCancelUpload?: () => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onRemove?: (photo: TPhoto) => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>("unknown");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef<DraftPhoto[]>([]);
  draftsRef.current = drafts;
  const atLimit = photos.length + drafts.length >= maxPhotos;
  const captureDisabled = disabled || !consentGranted || busy || atLimit;
  const note = disabled && disabledReason
    ? disabledReason
    : !consentGranted
    ? "Khách chưa đồng ý lưu ảnh. Camera đang khóa để bảo vệ quyền riêng tư."
    : atLimit
      ? `Đã đủ ${maxPhotos} ảnh cho lượt này.`
      : disabledReason;

  useEffect(
    () => () => draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.url)),
    [],
  );

  function selectFiles(files: FileList | null) {
    const available = Math.max(0, maxPhotos - photos.length - drafts.length);
    const selected = Array.from(files ?? []).slice(0, available);
    if (!selected.length) return;
    setDrafts((current) => [
      ...current,
      ...selected.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  async function openCamera() {
    if (captureDisabled) return;
    setCameraPermission("checking");
    const permission = await inspectCameraPermission();
    setCameraPermission(permission);
    if (permission === "denied" || permission === "unavailable") return;
    cameraInputRef.current?.click();
  }

  function removeDraft(index: number) {
    setDrafts((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function confirmDrafts() {
    if (!drafts.length || busy) return;
    await onFilesSelected(drafts.map((draft) => draft.file));
    drafts.forEach((draft) => URL.revokeObjectURL(draft.url));
    setDrafts([]);
  }

  return (
    <section className="manager-photo-tool" aria-label={title} aria-busy={busy}>
      <div className="manager-photo-heading">
        <span className="manager-action-icon"><Camera aria-hidden="true" /></span>
        <div><strong>{title}</strong><small>{photos.length}/{maxPhotos} ảnh</small></div>
        <span className={consentGranted ? "manager-consent granted" : "manager-consent"}>
          <ShieldCheck aria-hidden="true" />
          {consentGranted ? "Đã đồng ý" : "Chưa đồng ý"}
        </span>
      </div>

      <div className="manager-photo-actions">
        <button type="button" className={captureDisabled ? "disabled" : ""} disabled={captureDisabled || cameraPermission === "checking"} onClick={() => void openCamera()}>
          {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
          <span><strong>{busy ? "Đang tải ảnh..." : "Chụp ảnh"}</strong><small>Camera sau</small></span>
        </button>
        <input ref={cameraInputRef} className="manager-hidden-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" disabled={captureDisabled} aria-label="Chụp ảnh kiểu tóc" onChange={(event) => { if (event.target.files?.length) setCameraPermission("granted"); selectFiles(event.target.files); event.currentTarget.value = ""; }} />
        <label className={captureDisabled ? "secondary disabled" : "secondary"}>
          <ImagePlus aria-hidden="true" />
          <span><strong>Chọn ảnh</strong><small>Thư viện</small></span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={captureDisabled} aria-label="Chọn ảnh kiểu tóc từ máy" onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }} />
        </label>
      </div>

      {note ? <p className="manager-field-note">{note}</p> : null}
      {cameraPermissionMessage(cameraPermission) ? <p className="manager-field-note" role={cameraPermission === "denied" ? "alert" : undefined}>{cameraPermissionMessage(cameraPermission)}</p> : null}
      {busy && typeof progress === "number" ? (
        <div className="manager-photo-progress" aria-label={`Đã tải ${progress}%`}>
          <progress value={progress} max={100} /><span>{progress}%</span>
          {onCancelUpload ? <button type="button" onClick={onCancelUpload}><X aria-hidden="true" /> Hủy tải</button> : null}
        </div>
      ) : null}

      {drafts.length ? (
        <div className="manager-photo-drafts">
          <div className="manager-photo-grid">
            {drafts.map((draft, index) => (
              <figure key={draft.url}>
                <img src={draft.url} alt={`Ảnh chờ tải ${index + 1}`} />
                <button type="button" aria-label={`Xóa ảnh chờ tải ${index + 1}`} disabled={busy} onClick={() => removeDraft(index)}><Trash2 aria-hidden="true" /></button>
              </figure>
            ))}
          </div>
          <button className="manager-button primary" type="button" disabled={busy} onClick={() => void confirmDrafts()}><Upload aria-hidden="true" /> Tải {drafts.length} ảnh</button>
        </div>
      ) : null}

      {photos.length ? (
        <div className="manager-photo-grid">
          {photos.map((photo, index) => (
            <figure key={photo.id}>
              <img src={photo.url} alt={`Ảnh kiểu tóc ${index + 1}`} loading="lazy" />
              {onRemove ? <button type="button" aria-label={`Xóa ảnh kiểu tóc ${index + 1}`} disabled={busy} onClick={() => void onRemove(photo)}><Trash2 aria-hidden="true" /></button> : null}
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
