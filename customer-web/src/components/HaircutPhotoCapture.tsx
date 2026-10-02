import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import {
  cameraPermissionMessage,
  inspectCameraPermission,
  type CameraPermissionState,
} from "../services/cameraPermission";

export type HaircutPhotoItem = { id: string; url: string };
type DraftPhoto = { file: File; url: string };

type Props<TPhoto extends HaircutPhotoItem> = {
  title?: string;
  photos: TPhoto[];
  consentGranted: boolean;
  busy?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  captureLabel?: string;
  galleryLabel?: string;
  maxPhotos?: number;
  progress?: number;
  onCancelUpload?: () => void;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onRemove?: (photo: TPhoto) => void | Promise<void>;
};

export function HaircutPhotoCapture<TPhoto extends HaircutPhotoItem>({
  title = "Ảnh kiểu tóc sau cắt",
  photos,
  consentGranted,
  busy = false,
  disabled = false,
  disabledReason = "",
  captureLabel = "Chụp ảnh kiểu tóc",
  galleryLabel = "Chọn ảnh kiểu tóc từ máy",
  maxPhotos = 3,
  progress,
  onCancelUpload,
  onFilesSelected,
  onRemove,
}: Props<TPhoto>) {
  const [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState>("unknown");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef<DraftPhoto[]>([]);
  draftsRef.current = drafts;
  const atLimit = photos.length + drafts.length >= maxPhotos;
  const captureDisabled = disabled || !consentGranted || busy || atLimit;
  const statusText = consentGranted ? "Khách đã đồng ý" : "Chưa có đồng ý";
  const message =
    disabled && disabledReason
      ? disabledReason
      : !consentGranted
        ? "Khách chưa đồng ý lưu ảnh kiểu tóc. Camera được khóa để bảo vệ quyền riêng tư."
        : atLimit
          ? `Đã đủ ${maxPhotos} ảnh cho lượt cắt này.`
          : disabledReason;

  useEffect(
    () => () => {
      draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.url));
    },
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
    <section className="photo-capture-tool" aria-label={title} aria-busy={busy}>
      <div className="photo-capture-heading">
        <div className="photo-capture-title">
          <span className="photo-capture-icon">
            <Camera size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{title}</strong>
            <small>
              {photos.length}/{maxPhotos} ảnh
            </small>
          </div>
        </div>
        <span className={consentGranted ? "photo-consent granted" : "photo-consent"}>
          <ShieldCheck size={15} aria-hidden="true" />
          {statusText}
        </span>
      </div>

      <div className="photo-capture-actions">
        <button
          type="button"
          className={captureDisabled ? "photo-capture-button disabled" : "photo-capture-button"}
          disabled={captureDisabled || cameraPermission === "checking"}
          onClick={() => void openCamera()}
        >
          {busy ? (
            <LoaderCircle className="spin-icon" size={22} aria-hidden="true" />
          ) : (
            <Camera size={22} aria-hidden="true" />
          )}
          <span>
            <strong>{busy ? "Đang tải ảnh..." : "Chụp ảnh"}</strong>
            <small>Camera sau</small>
          </span>
        </button>
        <input
          ref={cameraInputRef}
          className="photo-hidden-input"
          aria-label={captureLabel}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          disabled={captureDisabled}
          onChange={(event) => {
            if (event.target.files?.length) setCameraPermission("granted");
            selectFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <label
          className={
            captureDisabled
              ? "photo-capture-button secondary disabled"
              : "photo-capture-button secondary"
          }
        >
          <ImagePlus size={22} aria-hidden="true" />
          <span>
            <strong>Chọn ảnh</strong>
            <small>Thư viện ảnh</small>
          </span>
          <input
            aria-label={galleryLabel}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            disabled={captureDisabled}
            onChange={(event) => {
              selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {message ? <p className="photo-capture-message">{message}</p> : null}
      {cameraPermissionMessage(cameraPermission) ? (
        <p
          className="photo-capture-message"
          role={cameraPermission === "denied" ? "alert" : undefined}
        >
          {cameraPermissionMessage(cameraPermission)}
        </p>
      ) : null}
      {busy && typeof progress === "number" ? (
        <div className="photo-upload-progress" aria-label={`Đã tải ${progress}%`}>
          <progress value={progress} max={100} />
          <span>{progress}%</span>
          {onCancelUpload ? (
            <button type="button" onClick={onCancelUpload}>
              <X size={16} aria-hidden="true" /> Hủy tải
            </button>
          ) : null}
        </div>
      ) : null}

      {drafts.length ? (
        <div className="photo-draft-panel">
          <div className="haircut-photo-grid photo-capture-grid">
            {drafts.map((draft, index) => (
              <div className="haircut-photo" key={draft.url}>
                <img src={draft.url} alt={`Ảnh chờ tải ${index + 1}`} />
                <button
                  type="button"
                  aria-label={`Xóa ảnh chờ tải ${index + 1}`}
                  disabled={busy}
                  onClick={() => removeDraft(index)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <button
            className="photo-upload-confirm"
            type="button"
            disabled={busy}
            onClick={() => void confirmDrafts()}
          >
            <Upload size={18} aria-hidden="true" /> Tải {drafts.length} ảnh
          </button>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="haircut-photo-grid photo-capture-grid">
          {photos.map((photo, index) => (
            <div className="haircut-photo" key={photo.id}>
              <img src={photo.url} alt={`Ảnh kiểu tóc ${index + 1}`} loading="lazy" />
              {onRemove ? (
                <button
                  type="button"
                  aria-label={`Xóa ảnh kiểu tóc ${index + 1}`}
                  disabled={busy}
                  onClick={() => void onRemove(photo)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
