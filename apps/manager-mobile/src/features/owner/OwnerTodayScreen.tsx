import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gift,
  QrCode,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TicketCheck,
  UserPlus,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../../components/Feedback";
import {
  ActionRow,
  MetricCard,
  ScreenHeader,
  Section,
} from "../../components/ScreenPrimitives";
import type { OwnerPrimaryTab } from "../../navigation/managerNavigation";
import {
  formatDateTime,
  type OwnerOverview,
  type SalonBranch,
  type StaffSession,
} from "../../services/managerApi";
import { formatInactiveDays, ownerPhoneLabel } from "./ownerFormatters";

const EMPTY_OVERVIEW: OwnerOverview = {
  customersToday: 0,
  customers7Days: 0,
  customers30Days: 0,
  pendingRequests: 0,
  pointsApprovedToday: 0,
  spinsToday: 0,
  unusedRewards: 0,
  inactiveCustomers: [],
};

export function OwnerTodayScreen({
  overview,
  sessions,
  loading,
  error,
  branches,
  branchFilter,
  onBranchFilterChange,
  onRefresh,
  onOpenTab,
  onOpenManagement,
}: {
  overview: OwnerOverview | null;
  sessions: StaffSession[];
  loading: boolean;
  error: string;
  branches: SalonBranch[];
  branchFilter: string;
  onBranchFilterChange: (branchId: string) => void;
  onRefresh: () => void;
  onOpenTab: (tab: OwnerPrimaryTab) => void;
  onOpenManagement: (section: "branches" | "staff" | "wheel" | "redeem") => void;
}) {
  const data = overview || EMPTY_OVERVIEW;
  const waitingCount = sessions.filter((session) => session.status === "waiting").length;
  const servingCount = sessions.filter((session) => session.status === "serving").length;

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Vận hành hôm nay"
        title="Tổng quan salon"
        description="Việc cần xử lý được ưu tiên trước, số liệu chi tiết nằm ngay bên dưới."
        action={
          <button
            className="manager-icon-button"
            type="button"
            aria-label="Làm mới tổng quan"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCcw className={loading ? "spin" : ""} aria-hidden="true" />
          </button>
        }
      />

      {branches.length > 0 ? (
        <label className="manager-field compact">
          <span>Phạm vi dữ liệu</span>
          <select
            value={branchFilter}
            onChange={(event) => onBranchFilterChange(event.target.value)}
          >
            <option value="all">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error && !overview ? (
        <ErrorState description={error} onRetry={onRefresh} />
      ) : loading && !overview ? (
        <LoadingState label="Đang tải tổng quan" />
      ) : (
        <>
          {data.pendingRequests > 0 ? (
            <Section className="manager-priority-section">
              <ActionRow
                icon={ClipboardCheck}
                title={`${data.pendingRequests} yêu cầu đang chờ duyệt`}
                description="Duyệt sớm để khách nhận điểm và xem lịch sử."
                meta={<span className="manager-count-badge">{data.pendingRequests}</span>}
                onClick={() => onOpenTab("approvals")}
              />
            </Section>
          ) : (
            <div className="manager-calm-status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Không có việc gấp</strong>
                <span>Yêu cầu điểm đã được xử lý hết.</span>
              </div>
            </div>
          )}

          <div className="manager-metric-grid">
            <MetricCard
              icon={UsersRound}
              label="Đang chờ"
              value={waitingCount}
              tone={waitingCount > 0 ? "warning" : "default"}
            />
            <MetricCard
              icon={UserRoundCheck}
              label="Đang phục vụ"
              value={servingCount}
              tone={servingCount > 0 ? "success" : "default"}
            />
            <MetricCard icon={UsersRound} label="Khách hôm nay" value={data.customersToday} />
            <MetricCard icon={CalendarDays} label="Khách 7 ngày" value={data.customers7Days} />
            <MetricCard
              icon={CheckCircle2}
              label="Điểm đã cộng"
              value={data.pointsApprovedToday}
              tone="success"
            />
            <MetricCard icon={Gift} label="Lượt quay" value={data.spinsToday} />
            <MetricCard
              icon={TicketCheck}
              label="Quà chưa dùng"
              value={data.unusedRewards}
              tone={data.unusedRewards > 0 ? "warning" : "default"}
            />
          </div>

          <Section
            title="Khách lâu chưa quay lại"
            description="Danh sách tối đa 5 khách hơn 30 ngày chưa ghé salon."
            action={
              <button
                className="manager-button secondary compact"
                type="button"
                onClick={() => onOpenTab("customers")}
              >
                <Search aria-hidden="true" />
                Tìm khách
              </button>
            }
          >
            {data.inactiveCustomers.length === 0 ? (
              <EmptyState
                icon={<UsersRound aria-hidden="true" />}
                title="Chưa có khách cần xem lại"
                description="Danh sách sẽ tự xuất hiện khi có dữ liệu phù hợp."
              />
            ) : (
              <div className="manager-list">
                {data.inactiveCustomers.map((customer) => (
                  <article className="manager-list-item" key={customer.id}>
                    <div className="manager-list-main">
                      <strong>{customer.name}</strong>
                      <span>
                        {ownerPhoneLabel(customer)} · {customer.points} điểm
                      </span>
                    </div>
                    <div className="manager-list-meta">
                      <strong>{formatInactiveDays(customer.daysSinceLastVisit)}</strong>
                      <span>{formatDateTime(customer.lastVisitAtMs) || "Chưa có lịch sử"}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section title="Thao tác thường dùng">
            <div className="manager-action-list">
              <ActionRow
                icon={UsersRound}
                title="Xem lượt khách"
                description={`${waitingCount} đang chờ · ${servingCount} đang phục vụ.`}
                onClick={() => onOpenTab("customers")}
              />
              <ActionRow
                icon={ClipboardCheck}
                title="Duyệt điểm và ảnh"
                description="Xử lý yêu cầu nhân viên vừa gửi."
                onClick={() => onOpenTab("approvals")}
              />
              <ActionRow
                icon={QrCode}
                title="Chi nhánh và QR"
                description="Tải QR salon hoặc QR từng chi nhánh."
                onClick={() => onOpenManagement("branches")}
              />
              <ActionRow
                icon={UserPlus}
                title="Nhân viên"
                description="Tạo tài khoản, phân chi nhánh và cấp quyền."
                onClick={() => onOpenManagement("staff")}
              />
              <ActionRow
                icon={SlidersHorizontal}
                title="Vòng quay"
                description="Cấu hình điểm quay và nội dung phần thưởng."
                onClick={() => onOpenManagement("wheel")}
              />
              <ActionRow
                icon={TicketCheck}
                title="Đổi mã quà"
                description="Kiểm tra và xác nhận mã khách đưa."
                onClick={() => onOpenManagement("redeem")}
              />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
