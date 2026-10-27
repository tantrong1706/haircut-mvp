import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gift,
  RefreshCcw,
  Search,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import { formatDateTime, type OwnerOverview } from "../../services/operations";
import type { OwnerTab } from "./useOwnerNavigation";
import { ownerPhoneLabel } from "./ownerFormatters";
export function OverviewPanel({
  overview,
  loading,
  onRefresh,
  onOpenTab,
}: {
  overview: OwnerOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenTab: (tab: OwnerTab) => void;
}) {
  const data =
    overview ||
    ({
      customersToday: 0,
      customers7Days: 0,
      customers30Days: 0,
      pendingRequests: 0,
      pointsApprovedToday: 0,
      spinsToday: 0,
      unusedRewards: 0,
      inactiveCustomers: [],
    } satisfies OwnerOverview);

  return (
    <div className="panel overview-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Hôm nay</p>
          <h2>Tổng quan</h2>
        </div>
        <button className="icon-text-button" disabled={loading} onClick={onRefresh}>
          <RefreshCcw size={18} aria-hidden="true" />
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </div>

      <section className="owner-next-actions" aria-label="Thao tác nhanh">
        <button type="button" onClick={() => onOpenTab("approvals")}>
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>
            <strong>Duyệt điểm</strong>
            <small>
              {data.pendingRequests > 0 ? `${data.pendingRequests} đang chờ` : "Chưa có yêu cầu"}
            </small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("customers")}>
          <Search size={20} aria-hidden="true" />
          <span>
            <strong>Tìm khách</strong>
            <small>Điểm và lịch sử</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("redeem")}>
          <TicketCheck size={20} aria-hidden="true" />
          <span>
            <strong>Đổi quà</strong>
            <small>
              {data.unusedRewards > 0 ? `${data.unusedRewards} mã quà` : "Kiểm tra mã quà"}
            </small>
          </span>
        </button>
      </section>

      <div className="overview-grid">
        <OverviewMetric
          icon={<UsersRound size={21} />}
          label="Khách hôm nay"
          value={data.customersToday}
        />
        <OverviewMetric
          icon={<ClipboardCheck size={21} />}
          label="Chờ xác nhận"
          value={data.pendingRequests}
        />
        <OverviewMetric
          icon={<CheckCircle2 size={21} />}
          label="Điểm đã cộng"
          value={data.pointsApprovedToday}
        />
        <OverviewMetric
          icon={<TicketCheck size={21} />}
          label="Mã quà chưa dùng"
          value={data.unusedRewards}
        />
        <OverviewMetric
          icon={<BarChart3 size={21} />}
          label="Khách 7 ngày"
          value={data.customers7Days}
        />
        <OverviewMetric
          icon={<BarChart3 size={21} />}
          label="Khách 30 ngày"
          value={data.customers30Days}
        />
        <OverviewMetric icon={<Gift size={21} />} label="Lượt quay" value={data.spinsToday} />
      </div>

      <div className="retention-panel">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Giữ chân khách</p>
            <h2>Khách lâu chưa quay lại</h2>
          </div>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => onOpenTab("customers")}
          >
            <Search size={18} aria-hidden="true" />
            Tìm khách
          </button>
        </div>

        {data.inactiveCustomers.length === 0 ? (
          <div className="empty-state compact-empty soft-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Chưa có khách cần nhắc lại</strong>
            <p>Khi có khách hơn 30 ngày chưa quay lại, danh sách sẽ hiện ở đây.</p>
          </div>
        ) : (
          <div className="retention-list">
            {data.inactiveCustomers.map((customer) => (
              <article className="retention-card" key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>
                    {ownerPhoneLabel(customer)} · {customer.points} điểm
                  </span>
                </div>
                <div>
                  <strong>{formatInactiveDays(customer.daysSinceLastVisit)}</strong>
                  <span>{formatDateTime(customer.lastVisitAtMs) || "Chưa có lịch sử"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="overview-metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatInactiveDays(days: number) {
  if (days >= 999) {
    return "Chưa quay lại";
  }

  return `${days} ngày`;
}
