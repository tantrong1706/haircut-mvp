import { Gift, ScanLine, Scissors, ShieldX, Star } from "lucide-react";
import { EmptyState } from "../../components/Feedback";
import { RewardRedemption } from "../../components/RewardRedemption";
import {
  ActionRow,
  MetricCard,
  ScreenHeader,
  Section,
} from "../../components/ScreenPrimitives";

export function StaffRewardsScreen({
  salonId,
  branchId,
  pointPerVisit,
  canRedeem,
  scanning,
  onOpenScanner,
  onOpenActive,
}: {
  salonId: string;
  branchId?: string;
  pointPerVisit: number;
  canRedeem: boolean;
  scanning: boolean;
  onOpenScanner: () => void;
  onOpenActive: () => void;
}) {
  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Điểm và quà"
        title="Xác nhận cho khách"
        description="Điểm do chủ salon duyệt. Mã quà chỉ được xác nhận một lần."
      />
      <div className="manager-metric-grid">
        <MetricCard icon={Star} label="Điểm mỗi lượt" value={pointPerVisit} />
        <MetricCard
          icon={Gift}
          label="Quyền đổi quà"
          value={canRedeem ? "Đã bật" : "Chưa bật"}
          tone={canRedeem ? "success" : "warning"}
        />
      </div>
      <Section title="Gửi yêu cầu điểm">
        <ActionRow
          icon={Scissors}
          title="Mở khách đang làm"
          description="Hoàn tất ghi chú và ảnh, sau đó gửi chủ salon duyệt điểm."
          onClick={onOpenActive}
        />
      </Section>
      {canRedeem ? (
        <RewardRedemption
          salonId={salonId}
          branchId={branchId}
          onOpenScanner={scanning ? undefined : onOpenScanner}
        />
      ) : (
        <EmptyState
          icon={<ShieldX aria-hidden="true" />}
          title="Chưa được phép đổi quà"
          description="Chủ salon có thể bật quyền này trong mục Quản lý nhân viên."
          action={
            <span className="manager-field-note">
              <ScanLine aria-hidden="true" /> Camera quét mã đang tắt.
            </span>
          }
        />
      )}
    </div>
  );
}
