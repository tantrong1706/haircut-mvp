import { Camera, ImagePlus, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";

export type ManagerPhoto = { id: string; url: string };

export function PhotoCapture<TPhoto extends ManagerPhoto>({
  title = "Ảnh kiểu tóc sau cắt",
  photos,
  consentGranted,
  busy = false,
  disabled = false,
  disabledReason = "",
  maxPhotos = 3,
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
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onRemove?: (photo: TPhoto) => void | Promise<void>;
}) {
  const atLimit = photos.length >= maxPhotos;
  const captureDisabled = disabled || !consentGranted || busy || atLimit;
  const note = !consentGranted
    ? "Khách chưa đồng ý lưu ảnh. Camera đang khóa để bảo vệ quyền riêng tư."
    : atLimit
      ? `Đã đủ ${maxPhotos} ảnh cho lượt này.`
      : disabledReason;

  function selectFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length > 0) void onFilesSelected(selected);
  }

  return (
    <section className="manager-photo-tool" aria-label={title}>
      <div className="manager-photo-heading">
        <span className="manager-action-icon">
          <Camera aria-hidden="true" />
        </span>
        <div>
          <strong>{title}</strong>
          <small>
            {photos.length}/{maxPhotos} ảnh
          </small>
        </div>
        <span className={consentGranted ? "manager-consent granted" : "manager-consent"}>
          <ShieldCheck aria-hidden="true" />
          {consentGranted ? "Đã đồng ý" : "Chưa đồng ý"}
        </span>
      </div>
      <div className="manager-photo-actions">
        <label className={captureDisabled ? "disabled" : ""}>
          {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
          <span>
            <strong>{busy ? "Đang lưu..." : "Chụp ảnh"}</strong>
            <small>Camera sau</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={captureDisabled}
            aria-label="Chụp ảnh kiểu tóc"
            onChange={(event) => {
              selectFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className={captureDisabled ? "secondary disabled" : "secondary"}>
          <ImagePlus aria-hidden="true" />
          <span>
            <strong>Chọn ảnh</strong>
            <small>Thư viện</small>
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={captureDisabled}
            aria-label="Chọn ảnh kiểu tóc từ máy"
            onChange={(event) => {
              selectFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {note ? <p className="manager-field-note">{note}</p> : null}
      {photos.length > 0 ? (
        <div className="manager-photo-grid">
          {photos.map((photo, index) => (
            <figure key={photo.id}>
              <img src={photo.url} alt={`Ảnh kiểu tóc ${index + 1}`} />
              {onRemove ? (
                <button
                  className="manager-icon-button"
                  type="button"
                  aria-label={`Xóa ảnh kiểu tóc ${index + 1}`}
                  disabled={busy}
                  onClick={() => void onRemove(photo)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
