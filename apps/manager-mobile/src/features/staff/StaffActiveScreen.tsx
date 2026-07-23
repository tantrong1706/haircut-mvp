import { Scissors, UserRoundCheck } from "lucide-react";
import { EmptyState } from "../../components/Feedback";
import { ScreenHeader, Section } from "../../components/ScreenPrimitives";
import { type StaffSession } from "../../services/managerApi";
import { maskedPhone } from "./staffFormatters";

export function StaffActiveScreen({
  sessions,
  currentUid,
  onOpenSession,
}: {
  sessions: StaffSession[];
  currentUid: string;
  onOpenSession: (session: StaffSession) => void;
}) {
  const active = sessions.filter(
    (session) => session.status === "serving" && session.assignedStaffId === currentUid,
  );

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Lượt của bạn"
        title={`Đang làm (${active.length})`}
        description="Chụp ảnh khi khách đồng ý, thêm ghi chú rồi gửi yêu cầu điểm."
      />
      {active.length === 0 ? (
        <EmptyState
          icon={<Scissors aria-hidden="true" />}
          title="Bạn chưa nhận khách"
          description="Mở tab Hàng chờ và bấm Nhận khách để bắt đầu."
        />
      ) : (
        <Section title="Khách đang phục vụ">
          <div className="manager-session-list">
            {active.map((session) => (
              <button
                key={session.id}
                className="manager-session-row active"
                type="button"
                onClick={() => onOpenSession(session)}
              >
                <span className="manager-action-icon">
                  <UserRoundCheck aria-hidden="true" />
                </span>
                <span>
                  <strong>{session.customer?.name || "Khách hàng"}</strong>
                  <small>
                    {maskedPhone(session)} · {session.customer?.points ?? 0} điểm
                  </small>
                  <small>{session.branchName || "Chi nhánh"}</small>
                </span>
                <strong>Tiếp tục</strong>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
