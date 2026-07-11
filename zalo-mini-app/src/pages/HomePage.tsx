import {
  CalendarClock,
  CheckCircle2,
  Gift,
  Hourglass,
  RefreshCcw,
  Scissors,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "../components/BrandLogo";
import { AppSession, TabKey } from "../services/types";

type Props = {
  session: AppSession;
  syncStatus?: "idle" | "syncing" | "synced" | "error";
  syncMessage?: string;
  lastSyncedAtMs?: number | null;
  onRetrySync?: () => void;
  onTabChange: (tab: TabKey) => void;
  onResetSession: () => void;
};

const actions: Array<{
  tab: TabKey;
  title: string;
  Icon: LucideIcon;
}> = [
  { tab: "history", title: "Lịch sử", Icon: CalendarClock },
  { tab: "wheel", title: "Vòng quay", Icon: Sparkles },
  { tab: "rewards", title: "Quà", Icon: Gift },
];

export function HomePage({
  session,
  syncStatus = "idle",
  syncMessage = "",
  lastSyncedAtMs = null,
  onRetrySync,
  onTabChange,
  onResetSession,
}: Props) {
  const { customer } = session;
  const status = session.sessionStatus || "waiting";

  return (
    <section className="page customer-home">
      <header className="customer-hero premium-hero visual-hero compact-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">{mirrorLabel(session.qr.mirrorId, session.mirrorName)}</span>
        </div>
        <p className="eyebrow">Thành viên</p>
        <h1>{customer.name}</h1>
        <p className="muted">{shortStatusText(status, session.assignedStaffName)}</p>
      </header>

      {syncStatus === "error" ? (
        <div className="session-sync-banner error" role="status">
          <div>
            <strong>Chưa cập nhật được dữ liệu mới</strong>
            <span>{syncMessage || "Điểm và trạng thái có thể chưa mới nhất."}</span>
          </div>
          <button type="button" onClick={onRetrySync}>
            <RefreshCcw size={17} aria-hidden="true" />
            Thử lại
          </button>
        </div>
      ) : syncStatus === "syncing" ? (
        <div className="session-sync-banner" role="status">
          <RefreshCcw className="spin-icon" size={17} aria-hidden="true" />
          <span>Đang cập nhật trạng thái...</span>
        </div>
      ) : lastSyncedAtMs ? (
        <span className="last-sync-time">Cập nhật lúc {formatSyncTime(lastSyncedAtMs)}</span>
      ) : null}

      <div className="status-card">
        <StatusStep
          done
          icon={<CheckCircle2 size={20} />}
          title="Đã check-in"
          text={mirrorLabel(session.qr.mirrorId, session.mirrorName)}
        />
        <StatusStep
          done={
            status === "serving" ||
            status === "pending_approval" ||
            status === "completed" ||
            status === "cancelled"
          }
          icon={<Hourglass size={20} />}
          title={staffStepTitle(status)}
          text={staffStepText(status, session.assignedStaffName)}
        />
        <StatusStep
          done={status === "completed"}
          icon={<Gift size={20} />}
          title={ownerStepTitle(status)}
          text={ownerStepText(status)}
        />
      </div>

      <div className="points-panel premium-points member-card">
        <div>
          <span>Điểm</span>
          <strong>{customer.points}</strong>
        </div>
        <div className="member-card-mark" aria-hidden="true">
          <Scissors size={34} strokeWidth={2.1} />
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-item">
          <span>SĐT</span>
          <strong>{customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có"}</strong>
        </div>
        <div className="summary-item">
          <span>Ảnh tóc</span>
          <strong>{customer.allowPhoto ? "Đã đồng ý" : "Không lưu"}</strong>
        </div>
      </div>

      <div className="quick-actions compact-actions">
        {actions.map(({ tab, title, Icon }) => (
          <button key={tab} onClick={() => onTabChange(tab)}>
            <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
            </span>
          </button>
        ))}
      </div>

      <button className="secondary-button" type="button" onClick={onResetSession}>
        Tạo lượt mới
      </button>
    </section>
  );
}

function StatusStep({
  done,
  icon,
  title,
  text,
}: {
  done: boolean;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={done ? "status-step done" : "status-step"}>
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function shortStatusText(status: AppSession["sessionStatus"], assignedStaffName?: string) {
  if (status === "completed") {
    return "Điểm đã được cập nhật.";
  }
  if (status === "cancelled") {
    return "Lượt này không cộng điểm.";
  }
  if (status === "serving") {
    return assignedStaffName
      ? `${assignedStaffName} đang phục vụ bạn.`
      : "Nhân viên đang phục vụ bạn.";
  }
  if (status === "pending_approval") {
    return "Đang chờ chủ salon duyệt điểm.";
  }
  return "Salon đã nhận khách.";
}

function staffStepTitle(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Đã ghi chú";
  }
  if (status === "cancelled") {
    return "Đã xử lý";
  }
  if (status === "serving") {
    return "Đang phục vụ";
  }
  if (status === "pending_approval") {
    return "Chờ duyệt";
  }
  return "Chờ nhân viên";
}

function staffStepText(status: AppSession["sessionStatus"], assignedStaffName?: string) {
  if (status === "cancelled") {
    return "Có thể tạo lượt mới.";
  }
  if (status === "waiting") {
    return "Salon sẽ nhận khách ngay.";
  }
  if (status === "serving") {
    return assignedStaffName
      ? `${assignedStaffName} đang phụ trách.`
      : "Đã có nhân viên phụ trách.";
  }
  return "Đã gửi sang chủ.";
}

function ownerStepTitle(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Đã cộng điểm";
  }
  if (status === "cancelled") {
    return "Không cộng điểm";
  }
  return "Chờ chủ salon";
}

function ownerStepText(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Sẵn sàng dùng điểm.";
  }
  if (status === "cancelled") {
    return "Hỏi salon nếu cần.";
  }
  return "Duyệt sau khi cắt.";
}

function mirrorLabel(mirrorId: string, mirrorName?: string) {
  if (mirrorName?.trim()) {
    return mirrorName.trim();
  }
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}

function formatSyncTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
