import {
  Building2,
  ExternalLink,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AccountDeletion } from "../../components/AccountDeletion";
import { BrandMark } from "../../components/BrandMark";
import { InlineFeedback } from "../../components/Feedback";
import { SecuritySettings } from "../../components/SecuritySettings";
import {
  ActionRow,
  DetailHeader,
  ScreenHeader,
  Section,
} from "../../components/ScreenPrimitives";
import {
  removeSalonAvatar,
  signOutOwnerStaff,
  updateOwnerAvatar,
  updateSalonProfile,
  uploadOwnerAvatarFile,
  uploadSalonAvatarFile,
  type AppUser,
  type SalonProfile,
} from "../../services/managerApi";
import { formatUploadSize } from "./ownerFormatters";

type SettingsSection = "salon" | "branding" | "owner" | "security" | "data" | "support";

export function OwnerSettingsScreen({
  user,
  profile,
  biometricEnabled,
  nativeReady,
  online,
  onProfileChange,
  onOwnerAvatarChange,
  onToggleBiometric,
}: {
  user: AppUser;
  profile: SalonProfile | null;
  biometricEnabled: boolean;
  nativeReady: boolean;
  online: boolean;
  onProfileChange: (profile: SalonProfile) => void;
  onOwnerAvatarChange: (avatarUrl: string) => void;
  onToggleBiometric: () => Promise<void>;
}) {
  const [section, setSection] = useState<SettingsSection | null>(null);

  if (section) {
    const title = {
      salon: "Thông tin salon",
      branding: "Nhận diện salon",
      owner: "Tài khoản chủ",
      security: "Bảo mật thiết bị",
      data: "Dữ liệu và tài khoản",
      support: "Hỗ trợ và pháp lý",
    }[section];
    return (
      <div className="manager-screen">
        <DetailHeader title={title} onBack={() => setSection(null)} />
        {section === "salon" ? (
          <SalonProfileEditor profile={profile} onChange={onProfileChange} />
        ) : section === "branding" ? (
          <SalonBrandingEditor profile={profile} onChange={onProfileChange} />
        ) : section === "owner" ? (
          <OwnerAvatarEditor
            user={user}
            onChange={onOwnerAvatarChange}
            onSignOut={() => void signOutOwnerStaff()}
          />
        ) : section === "security" ? (
          <SecuritySettings
            nativeReady={nativeReady}
            biometricEnabled={biometricEnabled}
            online={online}
            onToggleBiometric={onToggleBiometric}
          />
        ) : section === "data" ? (
          <AccountDeletion user={user} />
        ) : (
          <SupportLinks />
        )}
      </div>
    );
  }

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Cấu hình"
        title="Cài đặt"
        description="Thông tin salon, tài khoản, bảo mật và quyền dữ liệu."
      />
      <Section>
        <div className="manager-action-list">
          <ActionRow
            icon={Building2}
            title="Thông tin salon"
            description="Tên, địa chỉ, SĐT và điểm mỗi lượt."
            onClick={() => setSection("salon")}
          />
          <ActionRow
            icon={ImageIcon}
            title="Nhận diện salon"
            description="Ảnh vuông hiển thị khi khách quét QR."
            onClick={() => setSection("branding")}
          />
          <ActionRow
            icon={UserRound}
            title="Tài khoản chủ"
            description="Avatar cá nhân và đăng xuất."
            onClick={() => setSection("owner")}
          />
          <ActionRow
            icon={LockKeyhole}
            title="Bảo mật thiết bị"
            description={biometricEnabled ? "Khóa sinh trắc học đang bật." : "Bảo vệ khi mở Manager."}
            onClick={() => setSection("security")}
          />
          <ActionRow
            icon={Trash2}
            title="Dữ liệu và tài khoản"
            description="Xem trạng thái hoặc yêu cầu xóa salon."
            onClick={() => setSection("data")}
          />
          <ActionRow
            icon={ShieldCheck}
            title="Hỗ trợ và pháp lý"
            description="Quyền riêng tư, điều khoản và liên hệ hỗ trợ."
            onClick={() => setSection("support")}
          />
        </div>
      </Section>
    </div>
  );
}

function SalonProfileEditor({
  profile,
  onChange,
}: {
  profile: SalonProfile | null;
  onChange: (profile: SalonProfile) => void;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [pointPerVisit, setPointPerVisit] = useState(profile?.pointPerVisit || 1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(profile?.name || "");
    setAddress(profile?.address || "");
    setPhone(profile?.phone || "");
    setPointPerVisit(profile?.pointPerVisit || 1);
  }, [profile]);

  async function save() {
    if (!profile) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await updateSalonProfile({
        salonId: profile.id,
        name,
        address,
        phone,
        pointPerVisit,
      });
      onChange(next);
      setMessage("Đã lưu thông tin salon.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được thông tin salon.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Thông tin vận hành">
      <label className="manager-field">
        <span>Tên salon</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="manager-field">
        <span>Địa chỉ</span>
        <input value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label className="manager-field">
        <span>Số điện thoại</span>
        <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="manager-field">
        <span>Điểm cộng mỗi lượt</span>
        <input
          type="number"
          min={1}
          max={100}
          value={pointPerVisit}
          onChange={(event) =>
            setPointPerVisit(Math.min(100, Math.max(1, Number(event.target.value || 1))))
          }
        />
      </label>
      <button
        className="manager-button primary wide"
        type="button"
        disabled={busy || !name.trim() || !profile}
        onClick={() => void save()}
      >
        <Save aria-hidden="true" />
        {busy ? "Đang lưu..." : "Lưu thông tin"}
      </button>
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </Section>
  );
}

function SalonBrandingEditor({
  profile,
  onChange,
}: {
  profile: SalonProfile | null;
  onChange: (profile: SalonProfile) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file || !profile) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await uploadSalonAvatarFile({ salonId: profile.id, file });
      onChange({ ...profile, avatarUrl: result.salonAvatarUrl });
      setFile(null);
      setMessage("Đã cập nhật ảnh đại diện salon.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được ảnh salon.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      await removeSalonAvatar(profile.id);
      onChange({ ...profile, avatarUrl: "" });
      setMessage("Đã xóa ảnh salon. Ứng dụng sẽ dùng logo HAIRCUT.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được ảnh salon.");
    } finally {
      setBusy(false);
    }
  }

  const imageUrl = preview || profile?.avatarUrl || "";
  return (
    <Section
      title="Ảnh đại diện salon"
      description="Ảnh được cắt vuông 512 × 512 trước khi tải lên."
    >
      <div className="manager-avatar-preview large">
        {imageUrl ? (
          <img src={imageUrl} alt={`Ảnh đại diện ${profile?.name || "salon"}`} />
        ) : (
          <BrandMark compact />
        )}
      </div>
      <label className="manager-upload-control">
        <ImageIcon aria-hidden="true" />
        <span>
          <strong>{file ? file.name : "Chọn ảnh từ thiết bị"}</strong>
          <small>
            {file
              ? `${formatUploadSize(file.size)} · sẵn sàng tải lên`
              : "JPG, PNG hoặc WebP, ảnh nguồn tối đa 10 MB."}
          </small>
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="manager-button-row">
        <button
          className="manager-button primary"
          type="button"
          disabled={busy || !file}
          onClick={() => void upload()}
        >
          <Save aria-hidden="true" />
          {busy ? "Đang tải..." : profile?.avatarUrl ? "Thay ảnh salon" : "Lưu ảnh salon"}
        </button>
        <button
          className="manager-button secondary"
          type="button"
          disabled={busy || !profile?.avatarUrl}
          onClick={() => void clear()}
        >
          <Trash2 aria-hidden="true" />
          Xóa ảnh
        </button>
      </div>
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </Section>
  );
}

function OwnerAvatarEditor({
  user,
  onChange,
  onSignOut,
}: {
  user: AppUser;
  onChange: (avatarUrl: string) => void;
  onSignOut: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadOwnerAvatarFile({ salonId: user.salonId, file });
      setAvatarUrl(result.avatarUrl);
      onChange(result.avatarUrl);
      setFile(null);
      setMessage("Đã cập nhật avatar chủ salon.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được avatar.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      await updateOwnerAvatar({ salonId: user.salonId, avatarUrl: "" });
      setAvatarUrl("");
      onChange("");
      setMessage("Đã xóa avatar cá nhân.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được avatar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section title="Avatar chủ salon" description="Ảnh cá nhân này khác với ảnh đại diện salon.">
        <div className="manager-avatar-preview">
          {preview || avatarUrl ? (
            <img src={preview || avatarUrl} alt={`Avatar ${user.name || "chủ salon"}`} />
          ) : (
            <UserRound aria-hidden="true" />
          )}
        </div>
        <label className="manager-upload-control">
          <ImageIcon aria-hidden="true" />
          <span>
            <strong>{file ? file.name : "Chọn ảnh cá nhân"}</strong>
            <small>{file ? formatUploadSize(file.size) : "JPG, PNG hoặc WebP dưới 10 MB."}</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="manager-button-row">
          <button
            className="manager-button primary"
            type="button"
            disabled={busy || !file}
            onClick={() => void upload()}
          >
            <Save aria-hidden="true" />
            {busy ? "Đang tải..." : "Lưu avatar"}
          </button>
          <button
            className="manager-button secondary"
            type="button"
            disabled={busy || !avatarUrl}
            onClick={() => void clear()}
          >
            <Trash2 aria-hidden="true" />
            Xóa avatar
          </button>
        </div>
        {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
        {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      </Section>
      <button className="manager-button secondary wide" type="button" onClick={onSignOut}>
        <LogOut aria-hidden="true" />
        Đăng xuất
      </button>
    </>
  );
}

function SupportLinks() {
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "tantrong1706@gmail.com");
  const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || "0838098761");
  const publicWebUrl = String(
    import.meta.env.VITE_PUBLIC_WEB_URL || "https://haircut-c7d12.web.app",
  ).replace(/\/+$/, "");
  return (
    <Section title="Hỗ trợ và pháp lý">
      <div className="manager-link-list">
        <a href={`${publicWebUrl}/privacy`} target="_blank" rel="noreferrer">
          Chính sách quyền riêng tư
          <ExternalLink aria-hidden="true" />
        </a>
        <a href={`${publicWebUrl}/terms`} target="_blank" rel="noreferrer">
          Điều khoản sử dụng
          <ExternalLink aria-hidden="true" />
        </a>
        <a href={`mailto:${supportEmail}`}>
          Email: {supportEmail}
          <ExternalLink aria-hidden="true" />
        </a>
        <a href={`tel:${supportPhone}`}>
          Điện thoại: {supportPhone}
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </Section>
  );
}
