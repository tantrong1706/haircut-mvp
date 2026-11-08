import { ChevronRight, QrCode, SlidersHorizontal, UsersRound } from "lucide-react";
import type { OwnerTab } from "./useOwnerNavigation";

const links = [
  {
    tab: "branches",
    title: "Chi nhánh và QR",
    detail: "Thông tin chi nhánh và mã QR tích điểm.",
    Icon: QrCode,
  },
  {
    tab: "staff",
    title: "Nhân viên và quyền",
    detail: "Tài khoản, chi nhánh và quyền đổi quà.",
    Icon: UsersRound,
  },
  {
    tab: "wheel",
    title: "Vòng quay",
    detail: "Điểm cần để quay và phần thưởng.",
    Icon: SlidersHorizontal,
  },
] as const;

export function OwnerSetupLinks({ onOpenTab }: { onOpenTab: (tab: OwnerTab) => void }) {
  return (
    <nav className="panel owner-setup" aria-label="Lối tắt quản lý">
      <h2>Lối tắt quản lý</h2>
      <div className="owner-setup-links">
        {links.map(({ tab, title, detail, Icon }) => (
          <button
            className="secondary-button"
            type="button"
            key={tab}
            onClick={() => onOpenTab(tab)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}
