import { CalendarClock } from "lucide-react";
import { EmptyState } from "../../components/Feedback";
import { ScreenHeader } from "../../components/ScreenPrimitives";

export function StaffHistoryScreen() {
  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Theo dõi thao tác"
        title="Lịch sử của bạn"
        description="Lịch sử đầy đủ sẽ chỉ hiển thị khi dữ liệu đã được tải từ API riêng an toàn."
      />
      <EmptyState
        icon={<CalendarClock aria-hidden="true" />}
        title="Lịch sử đầy đủ đang được hoàn thiện"
        description="Các lượt đang chờ hoặc đang phục vụ vẫn được theo dõi tại tab Hàng chờ. Màn hình này chưa dùng dữ liệu hàng chờ để giả làm lịch sử."
      />
    </div>
  );
}
