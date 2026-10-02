import { useEffect, useState } from "react";
import { Image as ImageIcon, Save, Trash2, XCircle } from "lucide-react";
import { BrandLogo } from "../../../components/BrandLogo";

type Props = {
  salonName: string;
  avatarUrl: string;
  saving: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
};

export function SalonBrandingPanel({ salonName, avatarUrl, saving, onUpload, onClear }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    setSelectedFile(null);
    setImageFailed(false);
  }, [avatarUrl]);

  const displayUrl = previewUrl || avatarUrl;

  return (
    <div className="panel salon-branding-panel">
      <div className="salon-branding-preview">
        {displayUrl && !imageFailed ? (
          <img
            src={displayUrl}
            alt={`Ảnh đại diện ${salonName || "salon"}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <BrandLogo />
        )}
      </div>

      <div className="salon-branding-form">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Nhận diện với khách</p>
            <h2>Ảnh đại diện salon</h2>
          </div>
          <span className="pill muted-pill">Hiện khi quét QR</span>
        </div>

        <label className={saving ? "avatar-upload-zone disabled" : "avatar-upload-zone"}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              setImageFailed(false);
              event.currentTarget.value = "";
            }}
          />
          <span className="avatar-upload-icon">
            <ImageIcon size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>{selectedFile ? selectedFile.name : "Chọn ảnh salon"}</strong>
            <small>
              {selectedFile
                ? `${formatUploadSize(selectedFile.size)} · bấm Lưu để tải lên`
                : "JPG, PNG hoặc WebP dưới 10MB. Ảnh được cắt vuông 512px."}
            </small>
          </span>
        </label>

        <div className="button-row wrap-row">
          <button
            className="primary-button"
            disabled={saving || !selectedFile}
            onClick={() => selectedFile && onUpload(selectedFile)}
          >
            <Save size={18} aria-hidden="true" />
            {saving ? "Đang tải lên..." : avatarUrl ? "Thay ảnh salon" : "Lưu ảnh salon"}
          </button>
          {selectedFile ? (
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => setSelectedFile(null)}
            >
              <XCircle size={18} aria-hidden="true" />
              Bỏ chọn
            </button>
          ) : null}
          <button className="secondary-button" disabled={saving || !avatarUrl} onClick={onClear}>
            <Trash2 size={18} aria-hidden="true" />
            Xóa ảnh salon
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUploadSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(size / 1024))}KB`;
}
