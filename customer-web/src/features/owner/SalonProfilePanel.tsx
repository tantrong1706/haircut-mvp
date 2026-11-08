import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { SalonProfile, SalonProfileUpdate } from "../../services/operations";

type Props = {
  profile: SalonProfile | null;
  saving: boolean;
  onSave: (input: Omit<SalonProfileUpdate, "salonId">) => void;
};

const visibilityOptions = [
  ["showLogo", "Hiện logo"],
  ["showHotline", "Hiện hotline"],
  ["showOpeningHours", "Hiện giờ mở cửa"],
] as const;

export function SalonProfilePanel({ profile, saving, onSave }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hotline, setHotline] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [pointPerVisit, setPointPerVisit] = useState(1);
  const [visibility, setVisibility] = useState({
    showLogo: true,
    showHotline: true,
    showOpeningHours: true,
  });

  const savedName = profile?.name ?? "";
  const savedAddress = profile?.address ?? "";
  const savedPhone = profile?.phone ?? "";
  const savedHotline = profile?.hotline ?? "";
  const savedHours = profile?.openingHours ?? "";
  const savedPoints = profile?.pointPerVisit ?? 1;
  const savedShowLogo = profile?.showLogo ?? true;
  const savedShowHotline = profile?.showHotline ?? true;
  const savedShowOpeningHours = profile?.showOpeningHours ?? true;
  useEffect(() => {
    setName(savedName);
    setAddress(savedAddress);
    setPhone(savedPhone);
    setHotline(savedHotline);
    setOpeningHours(savedHours);
    setPointPerVisit(savedPoints);
    setVisibility({
      showLogo: savedShowLogo,
      showHotline: savedShowHotline,
      showOpeningHours: savedShowOpeningHours,
    });
  }, [
    profile?.id,
    savedName,
    savedAddress,
    savedPhone,
    savedHotline,
    savedHours,
    savedPoints,
    savedShowLogo,
    savedShowHotline,
    savedShowOpeningHours,
  ]);

  const hotlineChanged = hotline.trim() !== savedHotline;
  const hoursChanged = openingHours.trim() !== savedHours;
  const visibilityPatch = {
    ...(visibility.showLogo !== savedShowLogo ? { showLogo: visibility.showLogo } : {}),
    ...(visibility.showHotline !== savedShowHotline ? { showHotline: visibility.showHotline } : {}),
    ...(visibility.showOpeningHours !== savedShowOpeningHours
      ? { showOpeningHours: visibility.showOpeningHours }
      : {}),
  };
  const changed =
    name.trim() !== savedName ||
    address.trim() !== savedAddress ||
    phone.trim() !== savedPhone ||
    hotlineChanged ||
    hoursChanged ||
    Object.keys(visibilityPatch).length > 0 ||
    pointPerVisit !== savedPoints;
  const canSave = Boolean(profile && !saving && name.trim() && changed);

  return (
    <form
      className="panel salon-profile-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave({
          name,
          address,
          phone,
          pointPerVisit,
          ...(hotlineChanged ? { hotline: hotline.trim() } : {}),
          ...(hoursChanged ? { openingHours: openingHours.trim() } : {}),
          ...visibilityPatch,
        });
      }}
    >
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Thiết lập salon</p>
          <h2>Thông tin salon</h2>
        </div>
        <span className="pill muted-pill">
          {profile ? `${profile.freeCustomerLimit} khách miễn phí` : "Đang tải"}
        </span>
      </div>
      <fieldset
        className="salon-profile-grid salon-profile-fields"
        aria-label="Thông tin và liên hệ"
        disabled={saving || !profile}
      >
        <label className="field">
          <span>Tên hiển thị</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Ví dụ: CH Hair Studio"
            required
          />
        </label>
        <label className="field">
          <span>Hotline hiển thị cho khách</span>
          <input
            type="tel"
            value={hotline}
            onChange={(event) => setHotline(event.target.value)}
            maxLength={30}
            placeholder="Ví dụ: 028 0000 0000"
          />
          <small>Chỉ nhập số của salon mà bạn muốn khách nhìn thấy. Để trống để ẩn.</small>
        </label>
        <label className="field wide-field">
          <span>Giờ mở cửa</span>
          <input
            value={openingHours}
            onChange={(event) => setOpeningHours(event.target.value)}
            maxLength={160}
            placeholder="Ví dụ: Thứ 2–CN, 09:00–20:00"
          />
          <small>Giờ chung của salon, chỉ để khách tham khảo. Để trống để ẩn.</small>
        </label>
        <label className="field">
          <span>Số liên hệ nội bộ</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={30}
            placeholder="Không hiển thị cho khách"
          />
        </label>
        <label className="field">
          <span>Điểm cộng mỗi lượt cắt</span>
          <input
            type="number"
            min={1}
            max={100}
            value={pointPerVisit}
            onChange={(event) =>
              setPointPerVisit(Math.min(100, Math.max(1, Number(event.target.value || 1))))
            }
          />
          <small>Nhân viên sẽ gửi yêu cầu cộng đúng số điểm này cho mỗi lượt cắt.</small>
        </label>
        <label className="field wide-field">
          <span>Địa chỉ</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={200}
            placeholder="Địa chỉ để nhận diện salon"
          />
        </label>
      </fieldset>
      <fieldset className="salon-profile-fields salon-visibility" disabled={saving || !profile}>
        <legend>Hiển thị với khách</legend>
        <p className="muted">Tắt để ẩn mà vẫn giữ nội dung. Thay đổi áp dụng sau khi lưu.</p>
        <div className="salon-visibility-options">
          {visibilityOptions.map(([key, label]) => (
            <button
              className="secondary-button salon-visibility-switch"
              key={key}
              type="button"
              role="switch"
              aria-checked={visibility[key]}
              onClick={() => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
            >
              {label}
              <span className="salon-visibility-status" aria-hidden="true">
                {visibility[key] ? "Bật" : "Tắt"}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="button-row wrap-row">
        <button type="submit" className="primary-button" disabled={!canSave}>
          <Save size={18} aria-hidden="true" />
          {saving ? "Đang lưu..." : "Lưu thông tin salon"}
        </button>
      </div>
    </form>
  );
}
