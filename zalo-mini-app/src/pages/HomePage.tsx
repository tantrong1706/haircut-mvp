import {
  CalendarClock,
  CheckCircle2,
  Gift,
  Hourglass,
  Scissors,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { AppSession, TabKey } from "../services/types";

type Props = {
  session: AppSession;
  onTabChange: (tab: TabKey) => void;
  onResetSession: () => void;
};

const actions: Array<{
  tab: TabKey;
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    tab: "history",
    title: "Lịch sử cắt tóc",
    description: "Xem ghi chú kiểu tóc các lần trước",
    Icon: CalendarClock,
  },
  {
    tab: "wheel",
    title: "Vòng quay may mắn",
    description: "Đổi điểm lấy ưu đãi tại salon",
    Icon: Sparkles,
  },
  {
    tab: "rewards",
    title: "Quà của tôi",
    description: "Kiểm tra mã quà chưa sử dụng",
    Icon: Gift,
  },
];

export function HomePage({ session, onTabChange, onResetSession }: Props) {
  const { customer } = session;
  const status = session.sessionStatus || "waiting";

  return (
    <section className="page customer-home">
      <header className="customer-hero premium-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">{mirrorLabel(session.qr.mirrorId)}</span>
        </div>
        <p className="eyebrow">Hồ sơ thành viên</p>
        <h1>Chào {customer.name}</h1>
        <p className="muted">{customerIntroText(status)}</p>
      </header>

      <div className="status-banner">
        <div className="status-step done">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <strong>Đã nhận khách tại {mirrorLabel(session.qr.mirrorId)}</strong>
            <span>Hồ sơ của bạn đã được tạo cho lượt cắt này.</span>
          </div>
        </div>
        <div className={status === "serving" || status === "completed" ? "status-step done" : "status-step"}>
          <Hourglass size={20} aria-hidden="true" />
          <div>
            <strong>{staffStepTitle(status)}</strong>
            <span>{staffStepDescription(status)}</span>
          </div>
        </div>
        <div className={status === "completed" ? "status-step done" : "status-step"}>
          <Gift size={20} aria-hidden="true" />
          <div>
            <strong>{ownerStepTitle(status)}</strong>
            <span>{ownerStepDescription(status)}</span>
          </div>
        </div>
      </div>

      <div className="points-panel premium-points">
        <div>
          <span>Điểm tích lũy</span>
          <strong>{customer.points}</strong>
        </div>
        <Scissors size={34} strokeWidth={2.1} aria-hidden="true" />
      </div>

      <div className="summary-grid">
        <div className="summary-item">
          <span>Số điện thoại</span>
          <strong>{customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa cung cấp"}</strong>
        </div>
        <div className="summary-item">
          <span>Ảnh kiểu tóc</span>
          <strong>{customer.allowPhoto ? "Đã đồng ý" : "Không lưu"}</strong>
        </div>
      </div>

      <div className="notice-banner">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>Dữ liệu chỉ dùng để chăm sóc khách hàng tại salon này.</span>
      </div>

      <div className="quick-actions">
        {actions.map(({ tab, title, description, Icon }) => (
          <button key={tab} onClick={() => onTabChange(tab)}>
            <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </div>

      <button className="secondary-button" type="button" onClick={onResetSession}>
        Tạo lượt cắt mới trên thiết bị này
      </button>
    </section>
  );
}

function customerIntroText(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Lượt cắt đã hoàn tất và điểm đã được cập nhật. Bạn có thể xem lịch sử, mã quà hoặc quay thưởng nếu đủ điểm.";
  }
  if (status === "serving") {
    return "Nhân viên đã gửi yêu cầu cộng điểm. Vui lòng chờ chủ salon duyệt để điểm được cập nhật.";
  }
  return "Salon đã nhận hồ sơ của bạn. Sau khi cắt xong, nhân viên sẽ gửi yêu cầu cộng điểm để chủ salon duyệt.";
}

function staffStepTitle(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Nhân viên đã ghi chú kiểu tóc";
  }
  if (status === "serving") {
    return "Nhân viên đã gửi yêu cầu cộng điểm";
  }
  return "Vui lòng chờ nhân viên xác nhận sau khi cắt";
}

function staffStepDescription(status: AppSession["sessionStatus"]) {
  if (status === "waiting") {
    return "Nhân viên sẽ ghi chú kiểu tóc và gửi yêu cầu cộng điểm.";
  }
  return "Thông tin lượt cắt đã được gửi sang chủ salon để xử lý.";
}

function ownerStepTitle(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Điểm đã được chủ salon duyệt";
  }
  return "Điểm được cộng sau khi chủ salon duyệt";
}

function ownerStepDescription(status: AppSession["sessionStatus"]) {
  if (status === "completed") {
    return "Bạn có thể xem lịch sử cắt tóc và dùng điểm để quay thưởng.";
  }
  return "Bạn có thể quay thưởng khi đủ điểm tích lũy.";
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}
