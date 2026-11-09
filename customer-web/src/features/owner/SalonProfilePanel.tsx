import { useEffect, useId, useState } from "react";
import { Eye, Save } from "lucide-react";
import { SalonCustomerPreview, type PreviewBranch } from "./SalonCustomerPreview";
import type {
  SalonProfile,
  SalonProfileSwitches,
  SalonProfileUpdate,
} from "../../services/operations";

type Props = {
  profile: SalonProfile | null;
  branches?: readonly PreviewBranch[];
  saving: boolean;
  onSave: (input: Omit<SalonProfileUpdate, "salonId">) => void;
};

const visibilityOptions = [
  ["showLogo", "Hiện logo"],
  ["showHotline", "Hiện hotline"],
  ["showOpeningHours", "Hiện giờ mở cửa"],
] as const;
const operationOptions = [
  ["acceptWebPointRequests", "Nhận yêu cầu tích điểm mới"],
  ["allowWebWheel", "Cho phép quay thưởng"],
] as const;
type SwitchKey = keyof SalonProfileSwitches;

export function SalonProfilePanel({ profile, branches = [], saving, onSave }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hotline, setHotline] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [pointPerVisit, setPointPerVisit] = useState(1);
  const [switchDraft, setSwitchDraft] = useState<SalonProfileSwitches>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewId = useId();

  const savedName = profile?.name ?? "";
  const savedAddress = profile?.address ?? "";
  const savedPhone = profile?.phone ?? "";
  const savedHotline = profile?.hotline ?? "";
  const savedHours = profile?.openingHours ?? "";
  const savedPoints = profile?.pointPerVisit ?? 1;
  useEffect(() => {
    setName(savedName);
    setPhone(savedPhone);
    setHotline(savedHotline);
    setOpeningHours(savedHours);
    setPointPerVisit(savedPoints);
    setSwitchDraft({});
  }, [
    profile?.id,
    savedName,
    savedPhone,
    savedHotline,
    savedHours,
    savedPoints,
    profile?.showLogo,
    profile?.showHotline,
    profile?.showOpeningHours,
    profile?.acceptWebPointRequests,
    profile?.allowWebWheel,
  ]);

  const hotlineChanged = hotline.trim() !== savedHotline;
  const hoursChanged = openingHours.trim() !== savedHours;
  const savedSwitch = (key: SwitchKey) => profile?.[key] ?? true;
  const draftSwitch = (key: SwitchKey) => switchDraft[key] ?? savedSwitch(key);
  const switchPatch: SalonProfileSwitches = {};
  for (const [key] of [...visibilityOptions, ...operationOptions]) {
    const value = switchDraft[key];
    if (value !== undefined && value !== savedSwitch(key)) switchPatch[key] = value;
  }
  const changed =
    name.trim() !== savedName ||
    phone.trim() !== savedPhone ||
    hotlineChanged ||
    hoursChanged ||
    Object.keys(switchPatch).length > 0 ||
    pointPerVisit !== savedPoints;
  const canSave = Boolean(profile && !saving && name.trim() && changed);

  function renderSwitches(options: ReadonlyArray<readonly [SwitchKey, string]>) {
    return (
      <div className="salon-visibility-options">
        {options.map(([key, label]) => {
          const enabled = draftSwitch(key);
          return (
            <button
              className="secondary-button salon-visibility-switch"
              key={key}
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() =>
                setSwitchDraft((current) => ({
                  ...current,
                  [key]: !(current[key] ?? savedSwitch(key)),
                }))
              }
            >
              {label}
              <span className="salon-visibility-status" aria-hidden="true">
                {enabled ? "Bật" : "Tắt"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <form
      className="panel salon-profile-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave({
          name,
          address: savedAddress,
          phone,
          pointPerVisit,
          ...(hotlineChanged ? { hotline: hotline.trim() } : {}),
          ...(hoursChanged ? { openingHours: openingHours.trim() } : {}),
          ...switchPatch,
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
      </fieldset>
      <fieldset className="salon-profile-fields salon-visibility" disabled={saving || !profile}>
        <legend>Hiển thị với khách</legend>
        <p className="muted">
          Tắt để ẩn mà vẫn giữ nội dung. Tên chi nhánh vẫn hiện để khách đối chiếu QR.
        </p>
        {renderSwitches(visibilityOptions)}
      </fieldset>
      <fieldset className="salon-profile-fields salon-visibility" disabled={saving || !profile}>
        <legend>Vận hành trên Web</legend>
        <p className="muted">
          Tạm dừng lượt gửi từ QR hoặc vòng quay mới. Yêu cầu đã gửi, điểm và quà đã có không thay
          đổi. Áp dụng sau khi lưu.
        </p>
        {renderSwitches(operationOptions)}
      </fieldset>
      <div className="button-row wrap-row">
        <button
          type="button"
          className="secondary-button"
          disabled={!profile}
          aria-expanded={previewOpen}
          aria-controls={previewId}
          onClick={() => setPreviewOpen((open) => !open)}
        >
          <Eye size={18} aria-hidden="true" />
          Xem trước thông tin khách
        </button>
        <button type="submit" className="primary-button" disabled={!canSave}>
          <Save size={18} aria-hidden="true" />
          {saving ? "Đang lưu..." : "Lưu thông tin salon"}
        </button>
      </div>
      <section
        id={previewId}
        className="salon-customer-preview"
        aria-label="Xem trước thông tin khách"
        hidden={!previewOpen || !profile}
      >
        {previewOpen && profile ? (
          <SalonCustomerPreview
            key={profile.id}
            salonId={profile.id}
            branches={branches}
            salonName={name}
            salonAvatarUrl={draftSwitch("showLogo") ? profile.avatarUrl : ""}
            salonHotline={draftSwitch("showHotline") ? hotline.trim() : ""}
            salonOpeningHours={draftSwitch("showOpeningHours") ? openingHours.trim() : ""}
          />
        ) : null}
      </section>
    </form>
  );
}
