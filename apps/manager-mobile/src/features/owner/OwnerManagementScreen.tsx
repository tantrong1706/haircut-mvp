import {
  BarChart3,
  ContactRound,
  History,
  MapPin,
  Settings2,
  SlidersHorizontal,
  Star,
  TicketCheck,
  UsersRound,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/Feedback";
import { RewardRedemption } from "../../components/RewardRedemption";
import {
  ActionRow,
  DetailHeader,
  ScreenHeader,
  Section,
} from "../../components/ScreenPrimitives";
import type { ConfirmDialogRequest } from "../../components/ConfirmDialog";
import type {
  OwnerManagementSection,
  OwnerPrimaryTab,
} from "../../navigation/managerNavigation";
import type { SalonBranch } from "../../services/managerApi";
import { BranchesManager } from "./management/BranchesManager";
import { StaffManager } from "./management/StaffManager";
import { WheelManager } from "./management/WheelManager";

export function OwnerManagementScreen({
  salonId,
  initialSection,
  branchFilter,
  onBranchesChange,
  onConfirm,
  onOpenScanner,
  onOpenTab,
}: {
  salonId: string;
  initialSection: OwnerManagementSection | null;
  branchFilter: string;
  onBranchesChange: (branches: SalonBranch[]) => void;
  onConfirm: (request: ConfirmDialogRequest) => void;
  onOpenScanner: () => void;
  onOpenTab: (tab: OwnerPrimaryTab) => void;
}) {
  const [section, setSection] = useState<OwnerManagementSection | null>(initialSection);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  if (section) {
    const title =
      section === "branches"
        ? "Chi nhánh và QR"
        : section === "staff"
          ? "Nhân viên"
          : section === "wheel"
            ? "Vòng quay"
            : section === "redeem"
              ? "Đổi quà"
              : "Nhật ký hoạt động";
    return (
      <div className="manager-screen">
        <DetailHeader title={title} onBack={() => setSection(null)} />
        {section === "branches" ? (
          <BranchesManager
            salonId={salonId}
            onConfirm={onConfirm}
            onBranchesChange={onBranchesChange}
          />
        ) : section === "staff" ? (
          <StaffManager salonId={salonId} />
        ) : section === "wheel" ? (
          <WheelManager salonId={salonId} />
        ) : section === "redeem" ? (
          <RewardRedemption
            salonId={salonId}
            branchId={branchFilter === "all" ? undefined : branchFilter}
            allowRestore
            onOpenScanner={onOpenScanner}
          />
        ) : (
          <EmptyState
            icon={<ShieldCheck aria-hidden="true" />}
            title="Nhật ký được bảo vệ"
            description="Các thao tác quan trọng vẫn được ghi tự động. Tài khoản chủ salon hiện không có quyền đọc nhật ký hệ thống."
          />
        )}
      </div>
    );
  }

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Thiết lập vận hành"
        title="Quản lý salon"
        description="Mỗi nhóm được tách riêng để thao tác nhanh và tránh nhầm."
      />
      <Section>
        <div className="manager-action-list">
          <ActionRow
            icon={MapPin}
            title="Chi nhánh và QR"
            description="Tạo chi nhánh, tải QR, khóa hoặc tạo lại QR."
            onClick={() => setSection("branches")}
          />
          <ActionRow
            icon={UsersRound}
            title="Nhân viên"
            description="Tạo tài khoản, phân chi nhánh và cấp quyền."
            onClick={() => setSection("staff")}
          />
          <ActionRow
            icon={ContactRound}
            title="Khách hàng"
            description="Xem lượt hiện tại, tìm hồ sơ, lịch sử và quà."
            onClick={() => onOpenTab("customers")}
          />
          <ActionRow
            icon={Star}
            title="Điểm"
            description="Duyệt yêu cầu điểm và theo dõi lượt chờ xử lý."
            onClick={() => onOpenTab("approvals")}
          />
          <ActionRow
            icon={SlidersHorizontal}
            title="Quà và vòng quay"
            description="Điểm quay, hạn mã quà và nội dung phần thưởng."
            onClick={() => setSection("wheel")}
          />
          <ActionRow
            icon={TicketCheck}
            title="Đổi quà"
            description="Kiểm tra mã trước khi xác nhận đã sử dụng."
            onClick={() => setSection("redeem")}
          />
          <ActionRow
            icon={BarChart3}
            title="Báo cáo"
            description="Khách, điểm, lượt quay và quà theo thời gian."
            onClick={() => onOpenTab("today")}
          />
          <ActionRow
            icon={History}
            title="Nhật ký hoạt động"
            description="Xem trạng thái quyền đối với nhật ký thao tác."
            onClick={() => setSection("audit")}
          />
          <ActionRow
            icon={Settings2}
            title="Quản lý thêm"
            description="Thương hiệu, bảo mật, dữ liệu và hỗ trợ."
            onClick={() => onOpenTab("settings")}
          />
        </div>
      </Section>
    </div>
  );
}
