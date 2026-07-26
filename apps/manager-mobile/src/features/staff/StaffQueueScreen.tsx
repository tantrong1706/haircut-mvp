import { Clock3, ClipboardCheck, Scissors, UserRoundCheck, UsersRound } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/Feedback";
import { MetricCard, ScreenHeader, Section } from "../../components/ScreenPrimitives";
import { formatDateTime, type SalonBranch, type StaffSession } from "../../services/managerApi";
import { maskedPhone } from "./staffFormatters";

export function StaffQueueScreen({
  sessions,
  branches,
  branchFilter,
  loading,
  error,
  pointPerVisit,
  onBranchChange,
  onOpenSession,
  onRetry,
}: {
  sessions: StaffSession[];
  branches: SalonBranch[];
  branchFilter: string;
  loading: boolean;
  error: string;
  pointPerVisit: number;
  onBranchChange: (branchId: string) => void;
  onOpenSession: (session: StaffSession) => void;
  onRetry: () => void;
}) {
  const waiting = sessions.filter((session) => session.status === "waiting");
  const serving = sessions.filter((session) => session.status === "serving");
  const pending = sessions.filter((session) => session.status === "pending_approval");

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Ưu tiên hiện tại"
        title={`Hàng chờ (${waiting.length})`}
        description="Khách mới xuất hiện theo thời gian thực tại đúng chi nhánh."
      />
      {branches.length > 0 ? (
        <label className="manager-field compact">
          <span>Chi nhánh hiện tại</span>
          <select value={branchFilter} onChange={(event) => onBranchChange(event.target.value)}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="manager-metric-grid four">
        <MetricCard icon={UsersRound} label="Đang chờ" value={waiting.length} tone="warning" />
        <MetricCard icon={UserRoundCheck} label="Đang làm" value={serving.length} />
        <MetricCard icon={ClipboardCheck} label="Chờ duyệt" value={pending.length} />
        <MetricCard icon={Scissors} label="Điểm/lượt" value={pointPerVisit} />
      </div>

      {error && sessions.length === 0 ? (
        <ErrorState description={error} onRetry={onRetry} />
      ) : loading ? (
        <LoadingState label="Đang tải hàng chờ" />
      ) : waiting.length === 0 ? (
        <EmptyState
          icon={<Clock3 aria-hidden="true" />}
          title="Chưa có khách đang chờ"
          description="Khách quét QR và xác nhận sẽ tự xuất hiện tại đây."
        />
      ) : (
        <Section title="Khách cần nhận">
          <div className="manager-session-list">
            {waiting.map((session, index) => (
              <button
                key={session.id}
                className="manager-session-row"
                type="button"
                onClick={() => onOpenSession(session)}
              >
                <span className="manager-queue-number">{index + 1}</span>
                <span>
                  <strong>{session.customer?.name || "Khách hàng"}</strong>
                  <small>
                    {maskedPhone(session)} · {session.customer?.points ?? 0} điểm
                  </small>
                  <small>
                    {session.branchName || "Chi nhánh"} ·{" "}
                    {formatDateTime(session.createdAtMs) || "Vừa tạo"}
                  </small>
                </span>
                <strong>Nhận</strong>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
