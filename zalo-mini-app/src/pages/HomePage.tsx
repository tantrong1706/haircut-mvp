import { CalendarClock, Gift, Scissors, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { AppSession, TabKey } from "../services/types";

type Props = {
  session: AppSession;
  onTabChange: (tab: TabKey) => void;
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

export function HomePage({ session, onTabChange }: Props) {
  const { customer } = session;

  return (
    <section className="page customer-home">
      <header className="customer-hero">
        <div className="hero-topline">
          <div className="brand-mark">HAIRCUT</div>
          <span className="soft-chip">{mirrorLabel(session.qr.mirrorId)}</span>
        </div>
        <p className="eyebrow">Hồ sơ thành viên</p>
        <h1>Chào {customer.name}</h1>
        <p className="muted">
          Salon đã nhận hồ sơ của bạn. Sau khi cắt xong, nhân viên sẽ gửi yêu cầu cộng điểm
          để chủ salon duyệt.
        </p>
      </header>

      <div className="points-panel">
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
    </section>
  );
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}
