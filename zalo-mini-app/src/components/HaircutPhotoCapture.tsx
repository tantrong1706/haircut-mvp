import { Camera, ImagePlus, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";

export type HaircutPhotoItem = {
  id: string;
  url: string;
};

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
  onFilesSelected,
  onRemove,
}: Props<TPhoto>) {
  const atLimit = photos.length >= maxPhotos;
  const captureDisabled = disabled || !consentGranted || busy || atLimit;
  const statusText = consentGranted ? "Khách đã đồng ý" : "Chưa có đồng ý";
  const message = !consentGranted
    ? "Khách chưa đồng ý lưu ảnh kiểu tóc. Camera được khóa để bảo vệ quyền riêng tư."
    : atLimit
      ? `Đã đủ ${maxPhotos} ảnh cho lượt cắt này.`
      : disabledReason;

  function selectFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length > 0) {
      void onFilesSelected(selected);
    }
  }

  return (
    <section className="photo-capture-tool" aria-label={title}>
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
        <label
          className={captureDisabled ? "photo-capture-button disabled" : "photo-capture-button"}
        >
          {busy ? (
            <LoaderCircle className="spin-icon" size={22} aria-hidden="true" />
          ) : (
            <Camera size={22} aria-hidden="true" />
          )}
          <span>
            <strong>{busy ? "Đang lưu ảnh..." : "Chụp ảnh"}</strong>
            <small>Camera sau</small>
          </span>
          <input
            aria-label={captureLabel}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={captureDisabled}
            onChange={(event) => {
              selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

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
            accept="image/jpeg,image/png,image/webp"
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

      {photos.length > 0 ? (
        <div className="haircut-photo-grid photo-capture-grid">
          {photos.map((photo, index) => (
            <div className="haircut-photo" key={photo.id}>
              <img src={photo.url} alt={`Ảnh kiểu tóc ${index + 1}`} />
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
