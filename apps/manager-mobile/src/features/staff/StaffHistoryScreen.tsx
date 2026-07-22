import { CalendarClock, Gift, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/Feedback";
import { ScreenHeader, Section } from "../../components/ScreenPrimitives";
import {
  formatDateTime,
  getManagerRewardHistory,
  getManagerSessionHistory,
  type ManagerRewardHistoryItem,
  type ManagerSessionHistoryItem,
} from "../../services/managerApi";

export function StaffHistoryScreen({ salonId, branchId }: { salonId: string; branchId: string }) {
  const [sessions, setSessions] = useState<ManagerSessionHistoryItem[]>([]);
  const [rewards, setRewards] = useState<ManagerRewardHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sessionResult, rewardResult] = await Promise.all([
        getManagerSessionHistory({ salonId, branchId, limit: 30 }),
        getManagerRewardHistory({ salonId, branchId, limit: 30 }),
      ]);
      setSessions(sessionResult.sessions);
      setRewards(rewardResult.rewards);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được lịch sử.");
    } finally {
      setLoading(false);
    }
  }, [branchId, salonId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Theo dõi thao tác"
        title="Lịch sử của bạn"
        description="Các lượt đã hoàn tất, đã hủy và mã quà bạn đã xác nhận tại chi nhánh này."
        action={
          <button
            className="manager-icon-button"
            type="button"
            aria-label="Tải lại lịch sử"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCcw aria-hidden="true" />
          </button>
        }
      />

      {loading ? <LoadingState label="Đang tải lịch sử" /> : null}
      {!loading && error ? <ErrorState description={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <>
          <Section title={`Lượt đã xử lý (${sessions.length})`}>
            {sessions.length === 0 ? (
              <EmptyState
                icon={<CalendarClock aria-hidden="true" />}
                title="Chưa có lượt đã xử lý"
                description="Lượt bạn hoàn tất hoặc hủy sẽ xuất hiện tại đây."
              />
            ) : (
              <div className="manager-list">
                {sessions.map((session) => (
                  <article className="manager-list-item" key={session.id}>
                    <span className="manager-action-icon">
                      <CalendarClock aria-hidden="true" />
                    </span>
                    <div className="manager-list-main">
                      <strong>{session.customer?.name || "Khách hàng"}</strong>
                      <span>
                        {session.branchName || "Chi nhánh"} ·{" "}
                        {formatDateTime(
                          session.completedAtMs || session.cancelledAtMs || session.createdAtMs,
                        )}
                      </span>
                    </div>
                    <span className={`manager-pill ${session.status}`}>
                      {session.status === "completed"
                        ? "Hoàn tất"
                        : session.cancellationReason === "no_show"
                          ? "Không đến"
                          : "Đã hủy"}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Mã quà đã xác nhận (${rewards.length})`}>
            {rewards.length === 0 ? (
              <p className="manager-field-note">Bạn chưa xác nhận mã quà nào tại chi nhánh này.</p>
            ) : (
              <div className="manager-list">
                {rewards.map((reward) => (
                  <article className="manager-list-item" key={reward.id}>
                    <span className="manager-action-icon">
                      <Gift aria-hidden="true" />
                    </span>
                    <div className="manager-list-main">
                      <strong>{reward.rewardName || "Phần quà"}</strong>
                      <span>
                        {reward.customerName} · Mã kết thúc {reward.rewardCodeLast4 || "----"}
                      </span>
                    </div>
                    <div className="manager-list-meta">
                      <strong>Đã dùng</strong>
                      <span>{formatDateTime(reward.usedAtMs) || "Chưa rõ giờ"}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
