import {
  CalendarClock,
  CheckCircle2,
  Gift,
  Hourglass,
  RefreshCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandLogo } from "../components/BrandLogo";
import { MINI_APP_MARK } from "../config/branding";
import { getCustomerWheelConfig } from "../services/api";
import { AppSession, defaultLuckyWheelConfig, TabKey } from "../services/types";
import { activeWheelSlots } from "../services/wheel";

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
  const [wheelConfig, setWheelConfig] = useState(defaultLuckyWheelConfig);
  const wheelSlots = useMemo(() => activeWheelSlots(wheelConfig), [wheelConfig]);
  const missingPoints = Math.max(0, wheelConfig.requiredPoints - customer.points);
  const wheelProgress = Math.min(
    100,
    Math.round((customer.points / wheelConfig.requiredPoints) * 100),
  );

  useEffect(() => {
    let cancelled = false;
    getCustomerWheelConfig(session)
      .then((config) => {
        if (!cancelled) {
          setWheelConfig(config);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [session.qr.salonId, session.sessionId]);

  return (
    <section className="page customer-home">
      <header className="customer-hero premium-hero visual-hero compact-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">{branchLabel(session)}</span>
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

      <section className="home-wheel-card" aria-label="Điểm và vòng quay may mắn">
        <div className="home-wheel-copy">
          <span>Điểm hiện có</span>
          <div className="home-points-value">
            <strong>{customer.points}</strong>
            <small>điểm</small>
          </div>
          <p>
            {missingPoints === 0
              ? "Bạn đã đủ điểm để quay."
              : `Thêm ${missingPoints} điểm để mở lượt quay.`}
          </p>
        </div>

        <div
          className="home-wheel-preview"
          style={{ background: wheelPreviewBackground(wheelSlots.length) }}
          aria-hidden="true"
        >
          <div>
            <Sparkles size={25} />
            <span>{MINI_APP_MARK}</span>
          </div>
        </div>

        <div className="home-wheel-progress">
          <div>
            <span>Tiến độ lượt quay</span>
            <strong>
              {Math.min(customer.points, wheelConfig.requiredPoints)}/{wheelConfig.requiredPoints}
            </strong>
          </div>
          <div
            className="home-wheel-progress-track"
            role="progressbar"
            aria-label="Tiến độ vòng quay"
            aria-valuemin={0}
            aria-valuemax={wheelConfig.requiredPoints}
            aria-valuenow={Math.min(customer.points, wheelConfig.requiredPoints)}
          >
            <span style={{ width: `${wheelProgress}%` }} />
          </div>
        </div>

        <div className="home-prize-preview" aria-label="Một số phần thưởng">
          {wheelSlots.slice(0, 3).map((slot) => (
            <span key={slot.label}>{slot.label}</span>
          ))}
        </div>

        <button className="home-wheel-button" type="button" onClick={() => onTabChange("wheel")}>
          <Sparkles size={20} aria-hidden="true" />
          {missingPoints === 0 ? "Quay ngay" : "Xem vòng quay"}
        </button>
      </section>

      <div className="status-card">
        <StatusStep
          done
          icon={<CheckCircle2 size={20} />}
          title="Đã check-in"
          text={
            session.branchAddress
              ? `${branchLabel(session)} · ${session.branchAddress}`
              : branchLabel(session)
          }
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

      {status === "completed" || status === "cancelled" ? (
        <button className="secondary-button" type="button" onClick={onResetSession}>
          Tạo lượt mới
        </button>
      ) : null}
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
    return "Đã hoàn tất";
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
  if (status === "pending_approval") {
    return "Đã gửi chủ salon duyệt điểm.";
  }
  return "Dịch vụ đã hoàn tất.";
}

function ownerStepTitle(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Đã cộng điểm";
  }
  if (status === "cancelled") {
    return "Không cộng điểm";
  }
  if (status === "pending_approval") {
    return "Chờ chủ duyệt";
  }
  return "Cập nhật điểm";
}

function ownerStepText(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Sẵn sàng dùng điểm.";
  }
  if (status === "cancelled") {
    return "Hỏi salon nếu cần.";
  }
  if (status === "pending_approval") {
    return "Chủ salon đang kiểm tra.";
  }
  return "Điểm cập nhật khi dịch vụ hoàn tất.";
}

function branchLabel(session: AppSession) {
  return session.branchName?.trim() || session.mirrorName?.trim() || "Chi nhánh";
}

function formatSyncTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function wheelPreviewBackground(slotCount: number) {
  const colors = ["#13815f", "#f4b942", "#ef6c4d", "#4f75d8", "#7357aa", "#2a9aa0"];
  const safeCount = Math.max(1, slotCount);
  const slice = 100 / safeCount;
  const stops = Array.from({ length: safeCount }, (_, index) => {
    const color = colors[index % colors.length];
    return `${color} ${index * slice}% ${(index + 1) * slice}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}
