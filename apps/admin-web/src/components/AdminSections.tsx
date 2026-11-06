import {
  Activity,
  ArrowRight,
  Building2,
  CirclePause,
  ClipboardCheck,
  Gauge,
  Users,
} from "lucide-react";
import type { SystemFeatures } from "@haircut/contracts";
import type { AdminAuditEvent, AdminOverview, AdminSalon } from "../services/adminApi";
import { ADMIN_FEATURE_LABELS, auditActionLabel } from "../services/adminPresentation";

export function SupportSteps() {
  return (
    <section className="workflow-strip" aria-label="Quy trình xử lý">
      <ol>
        <li>
          <span>1</span>Chọn salon
        </li>
        <li>
          <span>2</span>Đối chiếu dữ liệu
        </li>
        <li>
          <span>3</span>Xem trước & xác nhận
        </li>
      </ol>
    </section>
  );
}

export function Overview({
  overview,
  onOpenSalons,
}: {
  overview: AdminOverview;
  onOpenSalons: () => void;
}) {
  const metrics = [
    ["Tổng số salon", overview.salons.total, Building2],
    ["Salon hoạt động", overview.salons.active, Building2],
    ["Salon đang khóa", overview.salons.suspended, CirclePause],
    ["Salon chờ xóa", overview.salons.pendingDeletion, ClipboardCheck],
    ["Chủ salon", overview.users.owners, Users],
    ["Nhân viên", overview.users.staff, Users],
    ["Yêu cầu điểm chờ", overview.operations.pendingPointRequests, Activity],
    ["Lượt đang mở", overview.operations.openSessions, Gauge],
  ] as const;
  return (
    <>
      <section className="metric-grid" aria-label="Số liệu tổng hợp">
        {metrics.map(([label, value, Icon]) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <p className="overview-data-note">
        Số yêu cầu chờ bao gồm yêu cầu hết hạn chưa được đóng. Mở từng salon để đối chiếu hạn chờ và
        lượt cắt trước khi xử lý. Số hồ sơ chủ/thợ không phải số người đang online.
      </p>
      <section className="overview-workbench surface">
        <div>
          <p className="eyebrow">Bắt đầu xử lý</p>
          <h2>Kiểm tra đúng salon trước khi sửa</h2>
          <p>
            Chọn salon, đọc kết quả và xem trước thay đổi. Các số liệu tổng hợp không phải kết luận
            hệ thống đang có lỗi hay đã hoạt động bình thường.
          </p>
          <button className="primary" onClick={onOpenSalons}>
            Kiểm tra một salon <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div className="scope-note">
          <ClipboardCheck aria-hidden="true" />
          <h3>Công cụ hỗ trợ có giới hạn</h3>
          <p>
            Đối chiếu bộ đếm, liên kết lượt, trạng thái salon và yêu cầu chờ. Chỉ thao tác máy chủ
            cho phép mới được xác nhận; không sửa điểm, quà hay xóa lịch sử.
          </p>
          <span className="quiet-label">Có xem trước · Có xác nhận · Có nhật ký</span>
        </div>
      </section>
      <SupportSteps />
    </>
  );
}

export function FeaturePanel({ features }: { features: SystemFeatures }) {
  const keys = Object.keys(ADMIN_FEATURE_LABELS) as Array<keyof typeof ADMIN_FEATURE_LABELS>;
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Chỉ đọc</p>
          <h2>Cấu hình toàn hệ thống</h2>
          <p className="muted">
            Đối chiếu trạng thái tính năng. Trang này không tự bật lại hoặc thay cấu hình.
          </p>
        </div>
        <span className="state-pill neutral">Chỉ xem</span>
      </div>
      <div className="toggle-list">
        {keys.map((key) => (
          <div key={key}>
            <span>
              <strong>{ADMIN_FEATURE_LABELS[key]}</strong>
              <small>{key}</small>
            </span>
            <span
              className={`state-pill ${features[key] ? (key === "maintenanceMode" ? "warning" : "ok") : "neutral"}`}
            >
              {features[key] ? "Đang bật" : "Đang tắt"}
            </span>
          </div>
        ))}
      </div>
      <div className="version-grid">
        <div className="surface">
          <span>Phiên bản tối thiểu</span>
          <strong>{features.minimumSupportedAppVersion || "Chưa đặt"}</strong>
        </div>
        <div className="surface">
          <span>Phiên bản khuyến nghị</span>
          <strong>{features.recommendedAppVersion || "Chưa đặt"}</strong>
        </div>
      </div>
    </section>
  );
}

export function AuditPanel({
  events,
  salons,
  salonId,
  loading,
  onFilter,
}: {
  events: AdminAuditEvent[] | null;
  salons: AdminSalon[];
  salonId: string;
  loading: boolean;
  onFilter: (id: string) => void;
}) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Truy vết thao tác</p>
          <h2>Nhật ký gần nhất</h2>
          <p className="muted">
            Tối đa 50 bản ghi được tải. Dùng mã salon, thời điểm và mã thao tác để đối chiếu.
          </p>
        </div>
        <span className="quiet-label">{events ? `${events.length} bản ghi` : "Chưa tải xong"}</span>
      </div>
      <label className="audit-filter">
        Nhật ký của salon
        <select value={salonId} onChange={(event) => onFilter(event.target.value)}>
          <option value="">Toàn hệ thống</option>
          {salons.map((salon) => (
            <option key={salon.id} value={salon.id}>
              {salon.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        Danh sách chọn gồm các salon đã tải. Nhật ký được lọc trên máy chủ; tối đa 50 sự kiện gần
        nhất của phạm vi đã chọn, không phải toàn bộ lịch sử.
      </p>
      {loading ? <p role="status">Đang tải nhật ký…</p> : null}
      <div className="audit-list">
        {events?.length === 0 && !loading ? (
          <p className="empty">Chưa có thao tác quản trị.</p>
        ) : (
          events?.map((event) => (
            <article key={event.id}>
              <span className="audit-dot" aria-hidden="true" />
              <div>
                <strong>{auditActionLabel(event.action)}</strong>
                <span className="audit-salon">Salon: {event.salonId || "Không xác định"}</span>
                <details>
                  <summary>Thông tin kỹ thuật</summary>
                  <code>{event.action}</code>
                  <small>
                    {event.targetType} · {event.targetId}
                  </small>
                  <small>Người thực hiện: {event.actorId || "Chưa rõ"}</small>
                </details>
              </div>
              <time>{formatDate(event.createdAtMs)}</time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === "active" ? "Hoạt động" : status === "suspended" ? "Đang khóa" : "Chờ xóa";
  return <span className={`status ${status}`}>{label}</span>;
}
function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value)
    : "Chưa rõ";
}
