import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, Store, UserRound } from "lucide-react";
import { OwnerSetupLinks } from "./OwnerSetupLinks";
import { SalonProfilePanel } from "./SalonProfilePanel";
import type { OwnerTab } from "./useOwnerNavigation";
import "../../styles/owner-settings.css";

const groups = [
  {
    id: "profile",
    title: "Thông tin salon",
    description: "Tên, logo, hotline và giờ mở cửa",
    Icon: Store,
  },
  {
    id: "operations",
    title: "Vận hành",
    description: "Điểm mỗi lượt, tích điểm QR và vòng quay",
    Icon: SlidersHorizontal,
  },
  {
    id: "account",
    title: "Tài khoản & dữ liệu",
    description: "Ảnh tài khoản và yêu cầu xóa salon",
    Icon: UserRound,
  },
] as const;

type Group = (typeof groups)[number]["id"];

type Props = {
  profileForm: Omit<ComponentProps<typeof SalonProfilePanel>, "section" | "onEditName">;
  branding: ReactNode;
  account: ReactNode;
  onOpenTab: (tab: OwnerTab) => void;
};

export function OwnerSettingsPanel({ profileForm, branding, account, onOpenTab }: Props) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null);
  const id = useId();
  const operations = openGroup === "operations";
  const salonPaneId = `${id}-salon`;
  const accountPaneId = `${id}-account`;

  return (
    <section className="owner-settings" aria-label="Cài đặt salon">
      <header className="owner-settings-heading">
        <h2>Cài đặt salon</h2>
        <p className="muted">Chọn nhóm cần chỉnh.</p>
      </header>
      <nav className="owner-settings-menu" aria-label="Nhóm cài đặt">
        {groups.map(({ id: group, title, description, Icon }) => (
          <button
            key={group}
            className="owner-settings-choice"
            type="button"
            aria-labelledby={`${id}-${group}-title`}
            aria-describedby={`${id}-${group}-description`}
            aria-expanded={openGroup === group}
            aria-controls={group === "account" ? accountPaneId : salonPaneId}
            onClick={() => setOpenGroup((current) => (current === group ? null : group))}
          >
            <Icon size={18} aria-hidden="true" />
            <span>
              <strong id={`${id}-${group}-title`}>{title}</strong>
              <small id={`${id}-${group}-description`}>{description}</small>
            </span>
            <ChevronDown size={16} className="owner-settings-chevron" aria-hidden="true" />
          </button>
        ))}
      </nav>
      <section
        id={salonPaneId}
        className="owner-settings-content"
        aria-label={operations ? "Vận hành salon" : "Hồ sơ salon"}
        hidden={openGroup !== "profile" && !operations}
      >
        {/* Keep the shared form mounted so changing groups does not discard edits. */}
        <SalonProfilePanel
          {...profileForm}
          section={operations ? "operations" : "profile"}
          onEditName={() => setOpenGroup("profile")}
        />
        <div hidden={openGroup !== "profile"}>
          <details className="owner-settings-details">
            <summary>Ảnh và logo salon</summary>
            <div className="owner-settings-details-content">{branding}</div>
          </details>
        </div>
        {operations ? <OwnerSetupLinks onOpenTab={onOpenTab} /> : null}
      </section>
      <section
        id={accountPaneId}
        className="owner-settings-content"
        aria-label="Tài khoản chủ salon"
        hidden={openGroup !== "account"}
      >
        {openGroup === "account" ? (
          <>
            {account}
            <div className="panel owner-settings-data">
              <h2>Quyền dữ liệu</h2>
              <p className="muted">Xem, gửi hoặc hủy yêu cầu trên trang quản lý riêng.</p>
              <a className="secondary-button" href="/delete-account/manage">
                Quản lý yêu cầu xóa salon
              </a>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
