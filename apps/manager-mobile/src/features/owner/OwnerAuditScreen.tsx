import { History, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/Feedback";
import { Section } from "../../components/ScreenPrimitives";
import {
  formatDateTime,
  getManagerAuditEvents,
  type ManagerAuditEventItem,
} from "../../services/managerApi";

const ACTION_LABELS: Record<string, string> = {
  "session.claimed": "Nhận khách",
  "session.completed": "Hoàn tất lượt khách",
  "session.cancelled": "Hủy lượt khách",
  "point_request.approved": "Duyệt cộng điểm",
  "point_request.rejected": "Từ chối cộng điểm",
  "reward.redeemed": "Xác nhận đổi quà",
  "reward.restored": "Khôi phục mã quà",
  "staff.created": "Tạo nhân viên",
  "staff.disabled": "Tắt nhân viên",
  "staff.branch_updated": "Đổi chi nhánh nhân viên",
  "salon.avatar_updated": "Cập nhật ảnh salon",
  "salon.avatar_removed": "Xóa ảnh salon",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action || "Thao tác hệ thống";
}

export function OwnerAuditScreen({
  salonId,
  branchId,
}: {
  salonId: string;
  branchId?: string | null;
}) {
  const [events, setEvents] = useState<ManagerAuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await getManagerAuditEvents({ salonId, branchId, limit: 50 });
      if (generation.current === currentGeneration) setEvents(result.events);
    } catch (caught) {
      if (generation.current === currentGeneration) {
        setError(caught instanceof Error ? caught.message : "Không tải được nhật ký hoạt động.");
      }
    } finally {
      if (generation.current === currentGeneration) setLoading(false);
    }
  }, [branchId, salonId]);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  if (loading) return <LoadingState label="Đang tải nhật ký hoạt động" />;
  if (error) return <ErrorState description={error} onRetry={() => void load()} />;
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<History aria-hidden="true" />}
        title="Chưa có hoạt động"
        description="Các thao tác quan trọng tại salon sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <Section
      title={`${events.length} hoạt động gần nhất`}
      action={
        <button
          className="manager-icon-button"
          type="button"
          aria-label="Tải lại nhật ký"
          onClick={() => void load()}
        >
          <RefreshCcw aria-hidden="true" />
        </button>
      }
    >
      <div className="manager-list">
        {events.map((event) => (
          <article className="manager-list-item" key={event.id}>
            <span className="manager-action-icon">
              <History aria-hidden="true" />
            </span>
            <div className="manager-list-main">
              <strong>{actionLabel(event.action)}</strong>
              <span>{event.actorName}</span>
              {event.requestId ? <small>Mã tra cứu: {event.requestId}</small> : null}
            </div>
            <div className="manager-list-meta">
              <span>{formatDateTime(event.createdAtMs) || "Chưa rõ giờ"}</span>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
