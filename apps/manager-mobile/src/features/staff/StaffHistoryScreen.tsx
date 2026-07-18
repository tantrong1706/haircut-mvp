import { CalendarClock, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/Feedback";
import { ScreenHeader, Section } from "../../components/ScreenPrimitives";
import { formatDateTime, type StaffSession } from "../../services/managerApi";
import { maskedPhone } from "./staffFormatters";

export function StaffHistoryScreen({
  sessions,
  currentUid,
}: {
  sessions: StaffSession[];
  currentUid: string;
}) {
  const [days, setDays] = useState<1 | 7 | 30>(1);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const history = sessions.filter(
    (session) =>
      (session.status === "pending_approval" ||
        session.status === "completed" ||
        session.status === "cancelled") &&
      (!session.assignedStaffId || session.assignedStaffId === currentUid) &&
      (session.createdAtMs === null || session.createdAtMs >= cutoff),
  );

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Theo dõi thao tác"
        title="Lịch sử gần đây"
        description="Các lượt đã gửi, hoàn tất hoặc hủy tại chi nhánh của bạn."
      />
      <div className="manager-segmented three" aria-label="Khoảng thời gian lịch sử">
        {[
          { value: 1 as const, label: "Hôm nay" },
          { value: 7 as const, label: "7 ngày" },
          { value: 30 as const, label: "30 ngày" },
        ].map((option) => (
          <button
            type="button"
            key={option.value}
            className={days === option.value ? "active" : ""}
            aria-pressed={days === option.value}
            onClick={() => setDays(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {history.length === 0 ? (
        <EmptyState
          icon={<CalendarClock aria-hidden="true" />}
          title="Chưa có lịch sử trong khoảng này"
          description="Sau khi hoàn tất hoặc hủy lượt, thông tin sẽ xuất hiện tại đây."
        />
      ) : (
        <Section title={`Lượt gần đây (${history.length})`}>
          <div className="manager-list">
            {history.map((session) => (
              <article className="manager-list-item" key={session.id}>
                <span className="manager-action-icon">
                  <ClipboardCheck aria-hidden="true" />
                </span>
                <div className="manager-list-main">
                  <strong>{session.customer?.name || "Khách hàng"}</strong>
                  <span>
                    {maskedPhone(session)} · {session.branchName || "Chi nhánh"}
                  </span>
                </div>
                <div className="manager-list-meta">
                  <strong>{historyStatusLabel(session.status)}</strong>
                  <span>{formatDateTime(session.createdAtMs) || "Vừa gửi"}</span>
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function historyStatusLabel(status: StaffSession["status"]) {
  if (status === "completed") return "Hoàn tất";
  if (status === "cancelled") return "Đã hủy";
  return "Chờ duyệt";
}
