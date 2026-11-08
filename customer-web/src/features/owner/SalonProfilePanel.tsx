import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { SalonProfile, SalonProfileUpdate } from "../../services/operations";

type Props = {
  profile: SalonProfile | null;
  saving: boolean;
  onSave: (input: Omit<SalonProfileUpdate, "salonId">) => void;
};

export function SalonProfilePanel({ profile, saving, onSave }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hotline, setHotline] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [pointPerVisit, setPointPerVisit] = useState(1);

  const savedName = profile?.name ?? "";
  const savedAddress = profile?.address ?? "";
  const savedPhone = profile?.phone ?? "";
  const savedHotline = profile?.hotline ?? "";
  const savedHours = profile?.openingHours ?? "";
  const savedPoints = profile?.pointPerVisit ?? 1;
  useEffect(() => {
    setName(savedName);
    setAddress(savedAddress);
    setPhone(savedPhone);
    setHotline(savedHotline);
    setOpeningHours(savedHours);
    setPointPerVisit(savedPoints);
  }, [profile?.id, savedName, savedAddress, savedPhone, savedHotline, savedHours, savedPoints]);

  const hotlineChanged = hotline.trim() !== savedHotline;
  const hoursChanged = openingHours.trim() !== savedHours;
  const changed =
    name.trim() !== savedName ||
    address.trim() !== savedAddress ||
    phone.trim() !== savedPhone ||
    hotlineChanged ||
    hoursChanged ||
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
      <div className="button-row wrap-row">
        <button type="submit" className="primary-button" disabled={!canSave}>
          <Save size={18} aria-hidden="true" />
          {saving ? "Đang lưu..." : "Lưu thông tin salon"}
        </button>
      </div>
    </form>
  );
}
